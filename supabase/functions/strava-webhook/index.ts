// Strava real-time webhook receiver.
//
// Public endpoint (no JWT — Strava calls this directly). Handles both the
// one-time subscription verification handshake (GET) and real event
// deliveries (POST). Strava allows exactly one subscription per app and
// requires a 200 response within ~2 seconds, so POST acks immediately and
// does the actual activity-fetch + matching work in the background.
//
// One-time setup after this function is deployed and the two secrets below
// are set (never run this with real values committed anywhere):
//
//   curl -X POST https://www.strava.com/api/v3/push_subscriptions \
//     -F client_id=$STRAVA_CLIENT_ID \
//     -F client_secret=$STRAVA_CLIENT_SECRET \
//     -F callback_url=https://<project>.functions.supabase.co/strava-webhook \
//     -F verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN
//
// Required secrets (STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET already exist
// for strava-connect; STRAVA_WEBHOOK_VERIFY_TOKEN is new — any random
// string, e.g. `openssl rand -hex 16`):
//   - STRAVA_CLIENT_ID
//   - STRAVA_CLIENT_SECRET
//   - STRAVA_WEBHOOK_VERIFY_TOKEN
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getValidStravaAccessToken, findUserIdByStravaAthleteId } from "../_shared/stravaToken.ts";
import { ingestStravaActivity } from "../_shared/stravaMap.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

interface StravaWebhookEvent {
  aspect_type: "create" | "update" | "delete";
  event_time: number;
  object_id: number;
  object_type: "activity" | "athlete";
  owner_id: number;
  subscription_id: number;
  updates?: Record<string, string>;
}

// Discipline mapping, row mapping and the matching engine all live in
// _shared/stravaMap.ts so webhook and pull sync behave identically.

function runInBackground(promise: Promise<unknown>) {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  const guarded = promise.catch((e) => console.error("strava-webhook background error:", e));
  if (rt?.waitUntil) rt.waitUntil(guarded);
}

async function processActivityEvent(
  service: ReturnType<typeof createClient>,
  event: StravaWebhookEvent,
) {
  const userId = await findUserIdByStravaAthleteId(service, event.owner_id);
  if (!userId) {
    console.log("strava-webhook: no connection for owner_id", event.owner_id);
    return;
  }

  if (event.aspect_type === "delete") {
    // Deliberately a no-op: the corresponding completed_sessions row may
    // already have been reviewed/edited, so we don't cascade-delete plan
    // history just because the source Strava activity was removed.
    return;
  }

  const tokenResult = await getValidStravaAccessToken(service, userId);
  if (!tokenResult) {
    console.error("strava-webhook: could not get a valid token for user", userId);
    return;
  }

  const actResp = await fetch(`https://www.strava.com/api/v3/activities/${event.object_id}`, {
    headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
  });
  if (!actResp.ok) {
    console.error("strava-webhook: activity fetch failed", actResp.status, await actResp.text());
    return;
  }
  const a = await actResp.json();

  // Shared ingest: stores the activity, then enriches / links / creates the
  // matching completion. Idempotent, so webhook retries are harmless.
  const result = await ingestStravaActivity(service, userId, a);
  console.log("strava-webhook: ingest outcome", result.outcome, "activity", event.object_id);

  if (result.completedSessionId) {
    const { error: rpcErr } = await service.rpc("recompute_training_load", { _athlete_id: userId });
    if (rpcErr) console.error("strava-webhook: recompute_training_load failed", rpcErr);
  }
}

async function processDeauth(service: ReturnType<typeof createClient>, event: StravaWebhookEvent) {
  const userId = await findUserIdByStravaAthleteId(service, event.owner_id);
  if (!userId) return;

  // Webhook bodies are unsigned, so confirm revocation against Strava itself
  // before dropping the connection. Only a 401 proves the token is dead.
  const tokenResult = await getValidStravaAccessToken(service, userId);
  if (!tokenResult) return;

  const probe = await fetch("https://www.strava.com/api/v3/athlete", {
    headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
  });
  if (probe.status !== 401) {
    console.log("strava-webhook: deauth event ignored, token still valid", probe.status);
    return;
  }
  await service.from("strava_connections").delete().eq("user_id", userId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = url.searchParams.get("hub.verify_token");
    const expected = Deno.env.get("STRAVA_WEBHOOK_VERIFY_TOKEN");

    if (mode === "subscribe" && challenge && expected && verifyToken === expected) {
      return new Response(JSON.stringify({ "hub.challenge": challenge }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    return new Response(JSON.stringify({ error: "Verification failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 403,
    });
  }

  if (req.method === "POST") {
    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const parsed = await req.json().catch(() => null) as Record<string, unknown> | null;

    // Ack immediately — Strava requires a fast 200, and the real work
    // (an outbound Strava API call + DB writes) can take longer.
    const response = new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

    // Ignore malformed bodies outright.
    const isWellFormed = !!parsed
      && typeof parsed.object_type === "string"
      && typeof parsed.object_id === "number"
      && typeof parsed.owner_id === "number"
      && typeof parsed.aspect_type === "string";

    if (!isWellFormed) {
      console.log("strava-webhook: ignoring malformed body");
      return response;
    }

    const event = parsed as unknown as StravaWebhookEvent;

    // Unsigned webhook: when the expected subscription id is configured,
    // only accept deliveries that carry it.
    const expectedSub = Deno.env.get("STRAVA_WEBHOOK_SUBSCRIPTION_ID");
    if (expectedSub && String(event.subscription_id ?? "") !== expectedSub) {
      console.log("strava-webhook: subscription_id mismatch, ignoring");
      return response;
    }

    if (event.object_type === "athlete" && event.updates?.authorized === "false") {
      runInBackground(processDeauth(service, event));
    } else if (event.object_type === "activity") {
      runInBackground(processActivityEvent(service, event));
    }

    return response;
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 405,
  });
});
