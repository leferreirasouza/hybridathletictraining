import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidStravaAccessToken } from "../_shared/stravaToken.ts";

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
      .select("athlete_name, athlete_username, athlete_avatar_url")
      .eq("user_id", userId)
      .single();

    if (!conn) return jsonResp({ connected: false });

    const tokenResult = await getValidStravaAccessToken(svc, userId);
    if (!tokenResult) return jsonResp({ error: "Strava token refresh failed" }, 500);

    const actsResp = await fetch(
      "https://www.strava.com/api/v3/athlete/activities?per_page=8",
      { headers: { Authorization: `Bearer ${tokenResult.accessToken}` } }
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
