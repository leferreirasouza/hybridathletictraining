import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evaluateReadiness, mergeGarminDays } from "../_shared/readinessGates.ts";
import { downgradeIntensity } from "../_shared/interferenceRules.ts";

// Server-to-server only (invoked by a scheduled cron job, not by end users).
// Auth is a shared secret header rather than a user JWT, since there is no
// user session in a cron context.
serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { data: athleteRoles, error } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "athlete");
    if (error) throw error;

    // Anyone with logged sessions needs a load series, whatever their role
    // and whichever source (manual, Garmin, Strava) produced the rows. The
    // recompute function aggregates completed_sessions per date, so a
    // session enriched by a second source is still counted exactly once.
    const { data: loggers, error: logErr } = await supabase
      .from("completed_sessions")
      .select("athlete_id");
    if (logErr) throw logErr;

    const athleteIds = [
      ...new Set([
        ...(athleteRoles ?? []).map((r) => r.user_id),
        ...(loggers ?? []).map((r) => r.athlete_id),
      ]),
    ];
    let succeeded = 0;
    let failed = 0;

    for (const athleteId of athleteIds) {
      const { error: rpcError } = await supabase.rpc("recompute_training_load", {
        _athlete_id: athleteId,
      });
      if (rpcError) {
        console.error("recompute_training_load failed for", athleteId, rpcError);
        failed++;
      } else {
        succeeded++;
      }
    }

    // Adherence watch: two consecutive completed weeks below 70% of planned
    // sessions raises a PROPOSAL for the athlete to approve. Plans are never
    // modified automatically here.
    let proposalsCreated = 0;
    for (const athleteId of athleteIds) {
      try {
        if (await proposeIfLowAdherence(supabase, athleteId)) proposalsCreated++;
      } catch (adhErr) {
        console.error("adherence check failed for", athleteId, adhErr);
      }
    }

    // Readiness watch (sleep / HRV / resting HR from Garmin): a fired gate
    // before a hard session raises a PROPOSAL to ease it. Inert for athletes
    // without Garmin data — today that is everyone.
    let readinessProposals = 0;
    let readinessAthletesWithData = 0;
    for (const athleteId of athleteIds) {
      try {
        const r = await proposeIfNotReady(supabase, athleteId);
        if (r.hadData) readinessAthletesWithData++;
        if (r.proposed) readinessProposals++;
      } catch (readyErr) {
        console.error("readiness check failed for", athleteId, readyErr);
      }
    }

    // Suggestions whose session date has passed can no longer be acted on.
    let staleSuggestionsCancelled = 0;
    try {
      staleSuggestionsCancelled = await cancelStaleSuggestions(supabase);
    } catch (staleErr) {
      console.error("stale suggestion cleanup failed", staleErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        athletes: athleteIds.length,
        succeeded,
        failed,
        proposalsCreated,
        readinessAthletesWithData,
        readinessProposals,
        staleSuggestionsCancelled,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("compute-training-load error:", e);
    return new Response(JSON.stringify({ error: "An error occurred processing the request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

const ADHERENCE_THRESHOLD = 0.7;
const ADHERENCE_ADJUSTMENT_TYPE = "adherence_volume_reduction";
const PROPOSAL_COOLDOWN_DAYS = 14;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday-start week boundaries for the week `weeksAgo` before the current one. */
function weekWindow(weeksAgo: number): { start: Date; end: Date } {
  const today = new Date();
  const dowMon = (today.getUTCDay() + 6) % 7;
  const thisMonday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - dowMon * 86400000,
  );
  const start = new Date(thisMonday.getTime() - weeksAgo * 7 * 86400000);
  return { start, end: new Date(start.getTime() + 6 * 86400000) };
}

// deno-lint-ignore no-explicit-any
async function weekAdherence(supabase: any, athleteId: string, weeksAgo: number) {
  const { start, end } = weekWindow(weeksAgo);
  const { data: planned } = await supabase
    .from("planned_sessions")
    .select("id, duration_min")
    .eq("athlete_id", athleteId)
    .gte("date", isoDay(start))
    .lte("date", isoDay(end));
  if (!planned || planned.length === 0) return null;

  const { data: done } = await supabase
    .from("completed_sessions")
    .select("planned_session_id")
    .eq("athlete_id", athleteId)
    .gte("date", isoDay(start))
    .lte("date", isoDay(end));

  const plannedIds = new Set(planned.map((p: { id: string }) => p.id));
  const completed = new Set(
    (done ?? [])
      .map((c: { planned_session_id: string | null }) => c.planned_session_id)
      .filter((id: string | null): id is string => Boolean(id) && plannedIds.has(id as string)),
  );
  return { planned: planned.length, done: completed.size, ratio: completed.size / planned.length };
}

/**
 * Raises one pending proposal when the two most recent completed weeks both
 * fall below the adherence threshold. Returns true when a proposal was created.
 */
// deno-lint-ignore no-explicit-any
async function proposeIfLowAdherence(supabase: any, athleteId: string): Promise<boolean> {
  const lastWeek = await weekAdherence(supabase, athleteId, 1);
  const weekBefore = await weekAdherence(supabase, athleteId, 2);
  if (!lastWeek || !weekBefore) return false;
  if (lastWeek.ratio >= ADHERENCE_THRESHOLD || weekBefore.ratio >= ADHERENCE_THRESHOLD) return false;

  const cooldownSince = new Date(Date.now() - PROPOSAL_COOLDOWN_DAYS * 86400000).toISOString();
  const { data: existing } = await supabase
    .from("periodization_adjustments")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("adjustment_type", ADHERENCE_ADJUSTMENT_TYPE)
    .gte("created_at", cooldownSince)
    .limit(1);
  if (existing && existing.length > 0) return false;

  // Attach the proposal to the next upcoming planned session.
  const { data: upcoming } = await supabase
    .from("planned_sessions")
    .select("id, intensity, duration_min, distance_km")
    .eq("athlete_id", athleteId)
    .gte("date", isoDay(new Date()))
    .order("date", { ascending: true })
    .limit(1);
  const target = upcoming?.[0];
  if (!target) return false;

  const { data: load } = await supabase
    .from("training_load_daily")
    .select("tsb")
    .eq("athlete_id", athleteId)
    .order("date", { ascending: false })
    .limit(1);

  const pct = (r: number) => Math.round(r * 100);
  const { error } = await supabase.from("periodization_adjustments").insert({
    athlete_id: athleteId,
    target_session_id: target.id,
    adjustment_type: ADHERENCE_ADJUSTMENT_TYPE,
    reason_details:
      `Completed ${weekBefore.done}/${weekBefore.planned} planned sessions two weeks ago and ` +
      `${lastWeek.done}/${lastWeek.planned} last week (${pct(weekBefore.ratio)}% then ${pct(lastWeek.ratio)}%). ` +
      `Proposal: ease the coming week's volume so the plan matches what fits the schedule. Nothing changes unless this is approved.`,
    source: "adherence_check",
    status: "pending_coach",
    original_intensity: target.intensity ?? null,
    original_duration_min: target.duration_min ?? null,
    original_distance_km: target.distance_km ?? null,
    suggested_intensity: target.intensity ?? null,
    suggested_duration_min: target.duration_min != null ? Math.round(Number(target.duration_min) * 0.8) : null,
    suggested_distance_km: target.distance_km != null ? Math.round(Number(target.distance_km) * 0.8 * 10) / 10 : null,
    tsb_at_suggestion: load?.[0]?.tsb ?? null,
  });
  if (error) {
    console.error("adherence proposal insert failed", error);
    return false;
  }
  return true;
}

const READINESS_ADJUSTMENT_TYPE = "readiness_downgrade";
const READINESS_COOLDOWN_DAYS = 3;
const READINESS_LOOKBACK_DAYS = 60;
/** Only sessions this hard are worth easing on a poor-readiness day. */
const HARD_INTENSITIES = ["hard", "race_pace", "max_effort"];

/**
 * Evaluates the readiness gates (see _shared/readinessGates.ts) and, when one
 * fires and a hard session is planned today or tomorrow, raises one pending
 * proposal to ease that session. Never edits the plan itself.
 */
// deno-lint-ignore no-explicit-any
async function proposeIfNotReady(supabase: any, athleteId: string): Promise<{ hadData: boolean; proposed: boolean }> {
  const since = isoDay(new Date(Date.now() - READINESS_LOOKBACK_DAYS * 86400000));
  const [dailiesRes, sleepsRes] = await Promise.all([
    supabase
      .from("garmin_dailies")
      .select("calendar_date, resting_hr, hrv_ms")
      .eq("user_id", athleteId)
      .gte("calendar_date", since),
    supabase
      .from("garmin_sleep")
      .select("calendar_date, duration_sec, avg_hrv_ms")
      .eq("user_id", athleteId)
      .gte("calendar_date", since),
  ]);
  if (dailiesRes.error) throw dailiesRes.error;
  if (sleepsRes.error) throw sleepsRes.error;
  const dailies = dailiesRes.data ?? [];
  const sleeps = sleepsRes.data ?? [];
  if (dailies.length === 0 && sleeps.length === 0) return { hadData: false, proposed: false };

  const today = new Date();
  const readiness = evaluateReadiness(mergeGarminDays(dailies, sleeps), isoDay(today));
  if (readiness.status !== "ok" || readiness.gates.length === 0) return { hadData: true, proposed: false };

  const cooldownSince = new Date(Date.now() - READINESS_COOLDOWN_DAYS * 86400000).toISOString();
  const { data: recent } = await supabase
    .from("periodization_adjustments")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("adjustment_type", READINESS_ADJUSTMENT_TYPE)
    .gte("created_at", cooldownSince)
    .limit(1);
  if (recent && recent.length > 0) return { hadData: true, proposed: false };

  const { data: upcoming } = await supabase
    .from("planned_sessions")
    .select("id, intensity, duration_min, distance_km")
    .eq("athlete_id", athleteId)
    .gte("date", isoDay(today))
    .lte("date", isoDay(new Date(today.getTime() + 86400000)))
    .in("intensity", HARD_INTENSITIES)
    .order("date", { ascending: true })
    .limit(1);
  const target = upcoming?.[0];
  if (!target) return { hadData: true, proposed: false };

  const { data: load } = await supabase
    .from("training_load_daily")
    .select("tsb")
    .eq("athlete_id", athleteId)
    .order("date", { ascending: false })
    .limit(1);

  const { error } = await supabase.from("periodization_adjustments").insert({
    athlete_id: athleteId,
    target_session_id: target.id,
    adjustment_type: READINESS_ADJUSTMENT_TYPE,
    reason_details:
      `${readiness.gates.map((g) => g.detail).join(" ")} ` +
      `Proposal: make this session easier. Nothing changes unless this is approved.`,
    source: "readiness_check",
    status: "pending_coach",
    original_intensity: target.intensity ?? null,
    original_duration_min: target.duration_min ?? null,
    original_distance_km: target.distance_km ?? null,
    suggested_intensity: downgradeIntensity(target.intensity ?? null),
    suggested_duration_min: target.duration_min ?? null,
    suggested_distance_km: target.distance_km ?? null,
    tsb_at_suggestion: load?.[0]?.tsb ?? null,
  });
  if (error) {
    console.error("readiness proposal insert failed", error);
    return { hadData: true, proposed: false };
  }
  return { hadData: true, proposed: true };
}

/** Cancels pending suggestions whose target session date is already past. */
// deno-lint-ignore no-explicit-any
async function cancelStaleSuggestions(supabase: any): Promise<number> {
  const { data: pending, error } = await supabase
    .from("periodization_adjustments")
    .select("id, target_session_id")
    .eq("status", "pending_coach")
    .not("target_session_id", "is", null);
  if (error) throw error;
  if (!pending || pending.length === 0) return 0;

  const today = isoDay(new Date());
  const sessionIds = [...new Set(pending.map((p: { target_session_id: string }) => p.target_session_id))];
  const past = new Set<string>();
  for (let i = 0; i < sessionIds.length; i += 200) {
    const { data: sessions, error: sErr } = await supabase
      .from("planned_sessions")
      .select("id, date")
      .in("id", sessionIds.slice(i, i + 200))
      .lt("date", today);
    if (sErr) throw sErr;
    for (const s of sessions ?? []) past.add(s.id);
  }
  const staleIds = pending
    .filter((p: { target_session_id: string }) => past.has(p.target_session_id))
    .map((p: { id: string }) => p.id);
  if (staleIds.length === 0) return 0;

  const { error: updErr } = await supabase
    .from("periodization_adjustments")
    .update({ status: "cancelled" })
    .in("id", staleIds)
    .eq("status", "pending_coach");
  if (updErr) throw updErr;
  return staleIds.length;
}
