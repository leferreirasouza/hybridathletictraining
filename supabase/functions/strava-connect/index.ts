import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const STRAVA_CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID");
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET");

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function authedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return { userId: data.claims.sub as string };
}

function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    return jsonResp({ error: "Strava is not configured. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET." }, 500);
  }

  try {
    if (req.method === "GET") {
      const origin = req.headers.get("Origin") || (req.headers.get("Referer") ? new URL(req.headers.get("Referer")!).origin : "");
      if (!origin) return jsonResp({ error: "Missing origin" }, 400);
      const url = new URL("https://www.strava.com/oauth/authorize");
      url.searchParams.set("client_id", STRAVA_CLIENT_ID);
      url.searchParams.set("redirect_uri", `${origin}/strava/callback`);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "activity:read_all");
      url.searchParams.set("approval_prompt", "force");
      return jsonResp({ url: url.toString() });
    }

    if (req.method === "POST") {
      const auth = await authedUser(req);
      if (!auth) return jsonResp({ error: "Unauthorized" }, 401);

      const body = await req.json().catch(() => ({}));
      const svc = serviceClient();

      // Token refresh
      if (body.refresh === true) {
        const { data: conn } = await svc
          .from("strava_connections")
          .select("refresh_token")
          .eq("user_id", auth.userId)
          .single();
        if (!conn) return jsonResp({ error: "No Strava connection" }, 404);

        const resp = await fetch("https://www.strava.com/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            refresh_token: conn.refresh_token,
            grant_type: "refresh_token",
          }),
        });
        if (!resp.ok) {
          const t = await resp.text();
          console.error("Strava refresh failed:", resp.status, t);
          return jsonResp({ error: "Refresh failed" }, 500);
        }
        const data = await resp.json();
        await svc.from("strava_connections").update({
          access_token: data.access_token,
          expires_at: data.expires_at,
          ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
        }).eq("user_id", auth.userId);
        return jsonResp({ access_token: data.access_token, expires_at: data.expires_at });
      }

      // Initial code exchange
      const code = body.code as string | undefined;
      if (!code) return jsonResp({ error: "Missing code" }, 400);

      const resp = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.error("Strava token exchange failed:", resp.status, t);
        return jsonResp({ error: "Token exchange failed" }, 500);
      }
      const data = await resp.json();
      const athlete = data.athlete || {};

      const { error: upsertErr } = await svc.from("strava_connections").upsert({
        user_id: auth.userId,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        strava_athlete_id: athlete.id,
        athlete_name: [athlete.firstname, athlete.lastname].filter(Boolean).join(" ") || null,
        athlete_username: athlete.username || null,
        athlete_avatar_url: athlete.profile || null,
        scope: "activity:read_all",
      }, { onConflict: "user_id" });

      if (upsertErr) {
        console.error("Upsert failed:", upsertErr);
        return jsonResp({ error: "Failed to save connection" }, 500);
      }

      return jsonResp({
        ok: true,
        athlete: {
          name: [athlete.firstname, athlete.lastname].filter(Boolean).join(" "),
          username: athlete.username,
          avatar_url: athlete.profile,
        },
      });
    }

    return jsonResp({ error: "Method not allowed" }, 405);
  } catch (e) {
    console.error("strava-connect error:", e);
    return jsonResp({ error: "Internal error" }, 500);
  }
});
