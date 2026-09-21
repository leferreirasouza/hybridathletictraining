import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    return new Response(
      JSON.stringify({ success: true, athletes: athleteIds.length, succeeded, failed, proposalsCreated }),
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
