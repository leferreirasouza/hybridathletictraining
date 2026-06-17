// Garmin Health API — Webhook receiver (push notifications)
//
// Public endpoint. Garmin POSTs JSON payloads here for each push type.
// Register the following URL in the Garmin Health API portal for each
// summary type you enable (Activities, Activity Details, Dailies, Sleep,
// Stress, Body Composition, etc.):
//
//   https://<your-project>.functions.supabase.co/garmin-webhook
//
// Garmin Health pushes are unsigned but include the Garmin userId + userAccessToken
// in each summary so we can route to the correct row in garmin_connections.
//
// This handler currently logs payloads and stamps last_sync_at. Wire in
// per-type ingestion (activities -> completed_sessions, dailies -> health
// metrics, sleep -> recovery, etc.) as the Garmin API approval matures.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Garmin sends a GET ping during webhook registration validation
  if (req.method === "GET") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    console.log("garmin-webhook payload keys:", Object.keys(payload ?? {}));

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Garmin push payloads are arrays grouped by type, e.g.:
    //   { activities: [{ userId, userAccessToken, ... }], activityDetails: [...] }
    const groups = Object.values(payload ?? {}).flat() as Array<{
      userId?: string;
      userAccessToken?: string;
    }>;

    const touched = new Set<string>();
    for (const item of groups) {
      const token = item?.userAccessToken;
      if (token && !touched.has(token)) {
        touched.add(token);
        await service
          .from("garmin_connections")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("access_token", token);
      }
    }

    // TODO(Garmin ingestion): map activities -> completed_sessions,
    // dailies -> daily summary tables, sleep -> recovery metrics.

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("garmin-webhook error:", e);
    // Always return 200 so Garmin does not retry storms on parse errors.
    return new Response(JSON.stringify({ received: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
