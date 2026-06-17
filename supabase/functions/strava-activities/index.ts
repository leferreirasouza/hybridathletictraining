import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResp({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return jsonResp({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const svc = createClient(supabaseUrl, supabaseServiceKey);
    const { data: conn } = await svc
      .from("strava_connections")
      .select("access_token, refresh_token, expires_at, athlete_name, athlete_username, athlete_avatar_url")
      .eq("user_id", userId)
      .single();

    if (!conn) return jsonResp({ connected: false });

    let accessToken = conn.access_token;
    if (conn.expires_at < Math.floor(Date.now() / 1000) + 300) {
      const refreshResp = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: Deno.env.get("STRAVA_CLIENT_ID"),
          client_secret: Deno.env.get("STRAVA_CLIENT_SECRET"),
          refresh_token: conn.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      if (!refreshResp.ok) {
        const t = await refreshResp.text();
        console.error("Strava refresh failed:", refreshResp.status, t);
        return jsonResp({ error: "Strava token refresh failed" }, 500);
      }
      const refreshData = await refreshResp.json();
      accessToken = refreshData.access_token;
      await svc.from("strava_connections").update({
        access_token: refreshData.access_token,
        expires_at: refreshData.expires_at,
        ...(refreshData.refresh_token ? { refresh_token: refreshData.refresh_token } : {}),
      }).eq("user_id", userId);
    }

    const actsResp = await fetch(
      "https://www.strava.com/api/v3/athlete/activities?per_page=8",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!actsResp.ok) {
      const t = await actsResp.text();
      console.error("Strava activities fetch failed:", actsResp.status, t);
      return jsonResp({ error: "Failed to fetch activities" }, 500);
    }
    const activities = await actsResp.json();

    return jsonResp({
      connected: true,
      athlete: {
        name: conn.athlete_name,
        username: conn.athlete_username,
        avatar_url: conn.athlete_avatar_url,
      },
      activities,
    });
  } catch (e) {
    console.error("strava-activities error:", e);
    return jsonResp({ error: "Internal error" }, 500);
  }
});
