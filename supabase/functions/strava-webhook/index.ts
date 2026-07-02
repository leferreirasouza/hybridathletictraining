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

// Strava's `type` field -> our discipline enum. Mirrors garmin-webhook's
// mapDiscipline for consistency across sources.
function mapStravaDiscipline(type?: string): string | null {
  if (!type) return null;
  const t = type.toUpperCase();
  if (t.includes("RUN")) return "run";
  if (t.includes("RIDE") || t.includes("VELOMOBILE") || t.includes("HANDCYCLE")) return "bike";
  if (t.includes("ROW")) return "rowing";
  if (t.includes("STAIR")) return "stairs";
  if (t.includes("WEIGHTTRAINING") || t.includes("CROSSFIT") || t.includes("WORKOUT")) return "strength";
  if (t.includes("YOGA")) return "mobility";
  return "custom";
}

function speedToPaceMinPerKm(mps?: number): number | null {
  if (!mps || mps <= 0) return null;
  return 1000 / mps / 60;
}

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

  const discipline = mapStravaDiscipline(a.type);
  const startLocal: string | null = a.start_date_local ?? null;
  const avgSpeed = a.average_speed as number | undefined;

  const row = {
    user_id: userId,
    strava_activity_id: event.object_id,
    activity_type: a.type ?? null,
    sport_type: a.sport_type ?? null,
    name: a.name ?? null,
    start_date_utc: a.start_date ?? null,
    start_date_local: startLocal,
    duration_sec: a.moving_time ?? null,
    distance_m: a.distance ?? null,
    avg_hr: a.average_heartrate ?? null,
    max_hr: a.max_heartrate ?? null,
    avg_speed_mps: avgSpeed ?? null,
    avg_pace_min_per_km: speedToPaceMinPerKm(avgSpeed),
    elevation_gain_m: a.total_elevation_gain ?? null,
    discipline,
    raw: a,
  };

  const { data: inserted, error: actErr } = await service
    .from("strava_activities")
    .upsert(row, { onConflict: "user_id,strava_activity_id" })
    .select("id, completed_session_id")
    .maybeSingle();

  if (actErr) {
    console.error("strava-webhook: strava_activities upsert error", actErr);
    return;
  }

  // Already matched from a previous delivery of this same event — don't
  // insert a second completed_sessions row on webhook retries.
  if (inserted?.completed_session_id) return;
  if (!discipline || !startLocal) return;

  const date = startLocal.slice(0, 10);
  const { data: planned } = await service
    .from("planned_sessions")
    .select("id")
    .eq("athlete_id", userId)
    .eq("date", date)
    .eq("discipline", discipline)
    .limit(1)
    .maybeSingle();

  if (!planned?.id) return;

  // Don't create a competing entry if that planned session already has a
  // completed_sessions row from any source (manual log, Garmin, or an
  // earlier Strava match).
  const { data: existingCompletion } = await service
    .from("completed_sessions")
    .select("id")
    .eq("planned_session_id", planned.id)
    .limit(1)
    .maybeSingle();
  if (existingCompletion?.id) return;

  const { data: cs, error: csErr } = await service
    .from("completed_sessions")
    .insert({
      athlete_id: userId,
      planned_session_id: planned.id,
      date,
      discipline,
      source: "strava",
      actual_duration_min: a.moving_time ? Math.round(a.moving_time / 60) : null,
      actual_distance_km: a.distance ? Number((a.distance / 1000).toFixed(2)) : null,
      avg_hr: a.average_heartrate ?? null,
      max_hr: a.max_heartrate ?? null,
      avg_pace: speedToPaceMinPerKm(avgSpeed)?.toFixed(2) ?? null,
      notes: `Auto-imported from Strava (${a.type ?? "activity"})`,
      completed_at: a.start_date ?? new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (csErr) {
    console.error("strava-webhook: completed_sessions insert error", csErr);
    return;
  }
  if (cs?.id && inserted?.id) {
    await service.from("strava_activities").update({ completed_session_id: cs.id }).eq("id", inserted.id);
  }
}

async function processDeauth(service: ReturnType<typeof createClient>, event: StravaWebhookEvent) {
  const userId = await findUserIdByStravaAthleteId(service, event.owner_id);
  if (!userId) return;
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

    const event = await req.json().catch(() => null) as StravaWebhookEvent | null;

    // Ack immediately — Strava requires a fast 200, and the real work
    // (an outbound Strava API call + DB writes) can take longer.
    const response = new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

    if (event) {
      if (event.object_type === "athlete" && event.updates?.authorized === "false") {
        runInBackground(processDeauth(service, event));
      } else if (event.object_type === "activity") {
        runInBackground(processActivityEvent(service, event));
      }
    }

    return response;
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 405,
  });
});
