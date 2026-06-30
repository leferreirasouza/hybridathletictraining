// Garmin Health API — Webhook receiver (push notifications)
//
// Public endpoint. Garmin POSTs JSON payloads here for each summary type.
// Register this URL in the Garmin Health portal for every enabled summary
// (Activities, Dailies, Sleep, ...):
//
//   https://<project>.functions.supabase.co/garmin-webhook
//
// Garmin payloads are grouped by type, e.g.
//   { activities: [...], dailies: [...], sleeps: [...] }
// Every item carries `userId` and `userAccessToken` so we can resolve the
// owning row in `garmin_connections`.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

type AnyItem = Record<string, any>;

// Garmin activityType -> our discipline enum
function mapDiscipline(activityType?: string): string | null {
  if (!activityType) return null;
  const t = activityType.toUpperCase();
  if (t.includes("RUN")) return "run";
  if (t.includes("CYCL") || t.includes("BIKING") || t === "BIKING") return "bike";
  if (t.includes("ROW")) return "rowing";
  if (t.includes("STAIR")) return "stairs";
  if (t.includes("STRENGTH") || t.includes("WEIGHT")) return "strength";
  if (t.includes("YOGA") || t.includes("MOBILITY") || t.includes("STRETCH")) return "mobility";
  return "custom";
}

function epochToISO(sec?: number, offsetSec = 0): string | null {
  if (!sec || typeof sec !== "number") return null;
  return new Date((sec + offsetSec) * 1000).toISOString();
}

function speedToPaceMinPerKm(mps?: number): number | null {
  if (!mps || mps <= 0) return null;
  return 1000 / mps / 60;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return new Response("ok", { headers: corsHeaders, status: 200 });

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const payload = await req.json().catch(() => ({} as AnyItem));
    console.log("garmin-webhook keys:", Object.keys(payload ?? {}));

    // Resolve userAccessToken -> user_id once
    const tokenToUser = new Map<string, string>();
    const allItems: AnyItem[] = Object.values(payload ?? {}).flat() as AnyItem[];
    const tokens = Array.from(
      new Set(allItems.map((i) => i?.userAccessToken).filter(Boolean)),
    ) as string[];

    if (tokens.length) {
      const { data: conns } = await service
        .from("garmin_connections")
        .select("user_id, access_token")
        .in("access_token", tokens);
      for (const c of conns ?? []) tokenToUser.set(c.access_token!, c.user_id);

      await service
        .from("garmin_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .in("access_token", tokens);
    }

    const resolveUser = (item: AnyItem) =>
      item?.userAccessToken ? tokenToUser.get(item.userAccessToken) : undefined;

    // ---------- Activities ----------
    const activities: AnyItem[] = payload.activities ?? [];
    for (const a of activities) {
      const userId = resolveUser(a);
      const summaryId = a.summaryId ?? a.activityId?.toString();
      if (!userId || !summaryId) continue;

      const offset = a.startTimeOffsetInSeconds ?? 0;
      const startUtc = epochToISO(a.startTimeInSeconds);
      const startLocal = epochToISO(a.startTimeInSeconds, offset);
      const discipline = mapDiscipline(a.activityType);

      const row = {
        user_id: userId,
        summary_id: String(summaryId),
        activity_id: a.activityId ? String(a.activityId) : null,
        activity_type: a.activityType ?? null,
        start_time_utc: startUtc,
        start_time_local: startLocal,
        duration_sec: a.durationInSeconds ?? null,
        distance_m: a.distanceInMeters ?? null,
        avg_hr: a.averageHeartRateInBeatsPerMinute ?? null,
        max_hr: a.maxHeartRateInBeatsPerMinute ?? null,
        avg_speed_mps: a.averageSpeedInMetersPerSecond ?? null,
        avg_pace_min_per_km: speedToPaceMinPerKm(a.averageSpeedInMetersPerSecond),
        calories: a.activeKilocalories ?? null,
        steps: a.steps ?? null,
        elevation_gain_m: a.totalElevationGainInMeters ?? null,
        training_load: a.activityTrainingLoad ?? null,
        device_name: a.deviceName ?? null,
        discipline,
        raw: a,
      };

      const { data: inserted, error: actErr } = await service
        .from("garmin_activities")
        .upsert(row, { onConflict: "user_id,summary_id" })
        .select("id")
        .maybeSingle();

      if (actErr) {
        console.error("activity upsert error", actErr);
        continue;
      }

      // Map to a completed_session: prefer matching a planned session on same date+discipline
      if (discipline && startLocal) {
        const date = startLocal.slice(0, 10);
        const { data: planned } = await service
          .from("planned_sessions")
          .select("id, athlete_id")
          .eq("athlete_id", userId)
          .eq("date", date)
          .eq("discipline", discipline)
          .limit(1)
          .maybeSingle();

        const completedRow = {
          athlete_id: userId,
          planned_session_id: planned?.id ?? null,
          date,
          discipline,
          actual_duration_min: a.durationInSeconds ? Math.round(a.durationInSeconds / 60) : null,
          actual_distance_km: a.distanceInMeters ? Number((a.distanceInMeters / 1000).toFixed(2)) : null,
          avg_hr: a.averageHeartRateInBeatsPerMinute ?? null,
          max_hr: a.maxHeartRateInBeatsPerMinute ?? null,
          avg_pace: speedToPaceMinPerKm(a.averageSpeedInMetersPerSecond)?.toFixed(2) ?? null,
          notes: `Auto-imported from Garmin (${a.activityType ?? "activity"})`,
          completed_at: startUtc ?? new Date().toISOString(),
        };

        const { data: cs, error: csErr } = await service
          .from("completed_sessions")
          .insert(completedRow)
          .select("id")
          .maybeSingle();

        if (csErr) {
          console.error("completed_sessions insert error", csErr);
        } else if (cs?.id && inserted?.id) {
          await service
            .from("garmin_activities")
            .update({ completed_session_id: cs.id })
            .eq("id", inserted.id);
        }
      }
    }

    // ---------- Dailies ----------
    const dailies: AnyItem[] = payload.dailies ?? [];
    for (const d of dailies) {
      const userId = resolveUser(d);
      const calendarDate = d.calendarDate ?? (d.startTimeInSeconds
        ? epochToISO(d.startTimeInSeconds, d.startTimeOffsetInSeconds ?? 0)?.slice(0, 10)
        : null);
      if (!userId || !calendarDate) continue;

      await service.from("garmin_dailies").upsert(
        {
          user_id: userId,
          summary_id: String(d.summaryId ?? `${userId}-${calendarDate}`),
          calendar_date: calendarDate,
          steps: d.steps ?? null,
          distance_m: d.distanceInMeters ?? null,
          active_kilocalories: d.activeKilocalories ?? null,
          bmr_kilocalories: d.bmrKilocalories ?? null,
          floors_climbed: d.floorsClimbed ?? null,
          active_time_sec: d.activeTimeInSeconds ?? null,
          moderate_intensity_sec: d.moderateIntensityDurationInSeconds ?? null,
          vigorous_intensity_sec: d.vigorousIntensityDurationInSeconds ?? null,
          resting_hr: d.restingHeartRateInBeatsPerMinute ?? null,
          min_hr: d.minHeartRateInBeatsPerMinute ?? null,
          max_hr: d.maxHeartRateInBeatsPerMinute ?? null,
          avg_hr: d.averageHeartRateInBeatsPerMinute ?? null,
          avg_stress: d.averageStressLevel ?? null,
          max_stress: d.maxStressLevel ?? null,
          body_battery_charged: d.bodyBatteryChargedValue ?? null,
          body_battery_drained: d.bodyBatteryDrainedValue ?? null,
          hrv_ms: d.hrvSummary?.lastNightAvg ?? null,
          spo2_avg: d.averageSpo2 ?? null,
          respiration_avg: d.averageRespirationInBreathsPerMinute ?? null,
          raw: d,
        },
        { onConflict: "user_id,calendar_date" },
      );
    }

    // ---------- Sleep ----------
    const sleeps: AnyItem[] = payload.sleeps ?? payload.sleep ?? [];
    for (const s of sleeps) {
      const userId = resolveUser(s);
      const calendarDate = s.calendarDate ?? epochToISO(s.startTimeInSeconds, s.startTimeOffsetInSeconds ?? 0)?.slice(0, 10);
      if (!userId || !calendarDate) continue;

      await service.from("garmin_sleep").upsert(
        {
          user_id: userId,
          summary_id: String(s.summaryId ?? `${userId}-${calendarDate}-sleep`),
          calendar_date: calendarDate,
          start_time_utc: epochToISO(s.startTimeInSeconds),
          end_time_utc: epochToISO(
            (s.startTimeInSeconds ?? 0) + (s.durationInSeconds ?? 0),
          ),
          duration_sec: s.durationInSeconds ?? null,
          deep_sleep_sec: s.deepSleepDurationInSeconds ?? null,
          light_sleep_sec: s.lightSleepDurationInSeconds ?? null,
          rem_sleep_sec: s.remSleepInSeconds ?? null,
          awake_sec: s.awakeDurationInSeconds ?? null,
          sleep_score: s.overallSleepScore?.value ?? s.sleepScore ?? null,
          avg_hrv_ms: s.averageHrvInMillis ?? null,
          avg_respiration: s.averageRespirationValue ?? null,
          avg_spo2: s.averageSpo2Value ?? null,
          raw: s,
        },
        { onConflict: "user_id,calendar_date" },
      );
    }

    return new Response(
      JSON.stringify({
        received: true,
        counts: {
          activities: activities.length,
          dailies: dailies.length,
          sleeps: sleeps.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    console.error("garmin-webhook error:", e);
    // Always 200 so Garmin does not retry-storm on parse errors.
    return new Response(JSON.stringify({ received: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
