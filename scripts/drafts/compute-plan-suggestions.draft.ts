// DRAFT — held for review, NOT wired to anything. Placed under scripts/
// (not supabase/functions/<name>/index.ts) deliberately: Supabase only
// deploys a function from that exact path shape, so this file is
// structurally inert wherever it sits outside it. That's intentional —
// training-safety-adjacent logic should not go live off a single Lovable
// chat message; it needs a deliberate human pass on the thresholds below.
//
// WHAT THIS IS: three new periodization_adjustments rule types, meant to
// sit alongside the ones that already run today. Before drafting this, I
// checked what's actually live (reading generate-plan/index.ts and
// compute-training-load/index.ts in full) rather than assuming the
// TaskList description was still accurate — it wasn't. Already shipped,
// right now, with zero changes needed:
//   - interference_spacing, tsb_intensity_reduction, slot_mismatch —
//     generate-plan/index.ts, at PLAN-GENERATION time only (once, when a
//     plan is created).
//   - adherence_volume_reduction — compute-training-load/index.ts,
//     proposeIfLowAdherence(), runs daily, fires when the last TWO
//     completed weeks both land under 70% of planned sessions, 14-day
//     cooldown. This is why periodization_adjustments has 0 rows ever: the
//     logic exists and runs daily, it just hasn't fired (a 2-consecutive-
//     week shortfall hasn't happened) — it was never dormant/unwired.
// Genuinely missing, and what this draft adds:
//   1. missed_hard_session — single-session grain, next-day. The adherence
//      check only reacts after two full weeks of pattern; it would never
//      have caught Thu 1 Oct or Sun 4 Oct (per the Coaching Context
//      MASTER's Behavioural Log) on their own, since adherence stayed
//      fine overall that week.
//   2. harder_than_planned — flags a session that ran meaningfully
//      hotter/longer than prescribed. Nothing today checks this at all;
//      the "gate opens, spend it maximally" pattern documented extensively
//      in the Coaching Context MASTER has no corresponding system signal.
//   3. tsb_fatigue_watch — re-applies the SAME tsbAdjustmentFactor()/
//      downgradeIntensity() generate-plan already uses, but continuously.
//      generate-plan only checks TSB once, at generation time; a plan
//      built when TSB was neutral never gets revisited as real training
//      pushes TSB down afterward, until the athlete generates a new plan.
//
// DESIGN CHOICES, and which ones need a second pair of eyes:
//   - missed_hard_session and harder_than_planned are informational ONLY
//     (no suggested_intensity/duration/distance — those fields are left
//     null). respond_to_plan_suggestion's accept path does
//     COALESCE(suggested, original), so Accept on a null-suggested row is
//     a safe no-op — it just closes the card out. This is deliberate: a
//     single missed or overshot session often has a legitimate cause (see
//     the Behavioural Log's own confirmed-legitimate-deviation entries),
//     and this codebase has no generic way to tell "logistics" from "the
//     pattern that preceded a past HRV crash" apart from the number alone.
//     [NEEDS SIGN-OFF] Whether these two should ever suggest a concrete
//     change (vs. staying purely a human-reviewed flag) is a judgment
//     call, not a technical one.
//   - tsb_fatigue_watch DOES suggest a concrete change, because it's not
//     new math — it's tsbAdjustmentFactor()'s existing, already-reviewed
//     bands and downgradeIntensity()'s existing single-tier-down logic,
//     applied on a new trigger (daily) instead of the old one
//     (plan-generation only). The bands themselves are not up for revision
//     here; only "should this stay purely informational like the other two,
//     for the first few weeks of real use" is.
//   - [NEEDS SIGN-OFF] DURATION_OVERSHOOT_RATIO (1.5x) and
//     RPE_OVERSHOOT_THRESHOLD (8) below are new numbers I'm proposing, not
//     numbers pulled from an existing validated source the way TSB's bands
//     are. Sat 3 Oct's long run (122 vs 65min = 1.88x) and the VO2-LONG
//     accumulated-time overshoot would both have tripped the ratio check;
//     Thu 1 Oct's gym day wouldn't (no completed_sessions row to compare
//     duration against — that's what missed_hard_session is for instead).
//     Worth running these numbers against a few more weeks of this
//     specific athlete's real data before trusting them broadly.
//   - Every rule only ever targets the athlete's OWN next upcoming session
//     — never rewrites multiple future sessions in one pass, unlike
//     generate-plan's tsb_intensity_reduction which (correctly, for its
//     one-time generation-time context) touches every high-intensity
//     session in the newly-created plan at once. A daily-firing rule doing
//     that every day would be a very different, much heavier-handed tool.
//
// TO ACTIVATE (only after reviewing the above):
//   1. Move this file's content to a new
//      supabase/functions/compute-plan-suggestions/index.ts (drop this
//      header, or keep it as in-code documentation — your call).
//   2. Add a case to supabase/functions/cron-dispatcher/index.ts, mirroring
//      the existing compute-training-load/strava-sync cases exactly:
//
//        async function runComputePlanSuggestions() {
//          const url = `${SUPABASE_URL}/functions/v1/compute-plan-suggestions`;
//          const res = await fetch(url, {
//            method: "POST",
//            headers: { "Content-Type": "application/json", "x-cron-secret": CRON_SECRET },
//            body: "{}",
//          });
//          const body = await res.text();
//          await logRun("cron.compute_plan_suggestions", { status: res.status, body: body.slice(0, 500) });
//          if (!res.ok) throw new Error(`compute-plan-suggestions failed: ${res.status} ${body.slice(0, 200)}`);
//          return { ok: true, status: res.status };
//        }
//
//      ...and a "compute-plan-suggestions" case in the switch statement
//      calling it, plus adding it to the `allowed` array in the 400 response.
//   3. THIS is the step that actually makes it fire against real athlete
//      data — everything before this is inert:
//
//        SELECT cron.schedule(
//          'cron-compute-plan-suggestions',
//          '30 3 * * *',  -- after strava-sync (02:45) and
//                         -- compute-training-load (03:15), so TSB and
//                         -- yesterday's completed_sessions are both fresh
//          $$ SELECT net.http_post(
//               url := 'https://cdrpypapdqbwwiuqvqti.supabase.co/functions/v1/cron-dispatcher?job=compute-plan-suggestions',
//               headers := jsonb_build_object(
//                 'Content-Type','application/json',
//                 'x-cron-secret', '<same CRON_SECRET value the other jobs use>'
//               ),
//               body := '{}'::jsonb
//             ); $$
//        );
//
//   4. Watch audit_logs (action = 'cron.compute_plan_suggestions') and the
//      periodization_adjustments table for a few real days before trusting
//      this unattended — same bar as any other new scheduled job here.
//
// New adjustment_type values this introduces: missed_hard_session,
// harder_than_planned, tsb_fatigue_watch. PlanSuggestions.tsx's
// reasonLabel() already falls back to the raw type with underscores
// replaced by spaces when no i18n key exists (t('planSuggest.r_<type>',
// {defaultValue: ...})), so these render fine with zero UI changes; proper
// translated labels (planSuggest.r_missed_hard_session, etc.) are a nice-
// to-have, not a blocker.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tsbAdjustmentFactor, downgradeIntensity } from "../../supabase/functions/_shared/interferenceRules.ts";
// NOTE on the import path above: written relative to this draft's CURRENT
// location (scripts/drafts/). Once moved to
// supabase/functions/compute-plan-suggestions/index.ts per step 1, change
// it to "../_shared/interferenceRules.ts", matching generate-plan's and
// compute-training-load's own imports.

// deno-lint-ignore no-explicit-any
type SupaClient = any;

const HIGH_INTENSITY = ["hard", "race_pace", "max_effort"];

// Server-to-server only, same pattern as compute-training-load and
// cron-dispatcher: shared-secret header, no user JWT (no user session
// exists in a cron context).
Deno.serve(async (req) => {
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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: athleteRoles, error } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "athlete");
    if (error) throw error;
    const athleteIds = [...new Set((athleteRoles ?? []).map((r: { user_id: string }) => r.user_id))];

    let missed = 0;
    let harder = 0;
    let tsbWatch = 0;
    for (const athleteId of athleteIds) {
      try {
        if (await checkMissedHardSession(supabase, athleteId)) missed++;
      } catch (e) {
        console.error("missed_hard_session check failed for", athleteId, e);
      }
      try {
        if (await checkHarderThanPlanned(supabase, athleteId)) harder++;
      } catch (e) {
        console.error("harder_than_planned check failed for", athleteId, e);
      }
      try {
        if (await checkTsbFatigueWatch(supabase, athleteId)) tsbWatch++;
      } catch (e) {
        console.error("tsb_fatigue_watch check failed for", athleteId, e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, athletes: athleteIds.length, missed, harder, tsbWatch }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("compute-plan-suggestions error:", e);
    return new Response(JSON.stringify({ error: "An error occurred processing the request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function alreadyFiredToday(supabase: SupaClient, athleteId: string, adjustmentType: string): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("periodization_adjustments")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("adjustment_type", adjustmentType)
    .gte("created_at", todayStart.toISOString())
    .limit(1);
  return !!(data && data.length);
}

async function nextUpcomingSession(supabase: SupaClient, athleteId: string, intensityFilter?: string[]) {
  let q = supabase
    .from("planned_sessions")
    .select("id, session_name, intensity, duration_min, distance_km")
    .eq("athlete_id", athleteId)
    .gte("date", isoDay(new Date()))
    .order("date", { ascending: true })
    .limit(1);
  if (intensityFilter) q = q.in("intensity", intensityFilter);
  const { data } = await q;
  return data?.[0] ?? null;
}

// ---- Rule 1: missed_hard_session ----------------------------------------
// A planned session dated exactly yesterday, intensity in
// (hard, race_pace, max_effort), with no matching completed_sessions row.
// Naturally fires at most once per athlete per day (only ever looks at
// "yesterday"); alreadyFiredToday() guards a same-day manual re-run.
// KNOWN LIMITATION: only checks exactly yesterday, so a completed_sessions
// row that syncs in late (Strava/Garmin backfill) for an earlier date won't
// retroactively clear or fire this. Same simplification compute-training-
// load's own adherence check makes (fixed weekly windows, not a rolling
// re-scan) — acceptable for v1, worth widening later if late syncs turn
// out to be common.
async function checkMissedHardSession(supabase: SupaClient, athleteId: string): Promise<boolean> {
  const yesterday = isoDay(new Date(Date.now() - 86400000));
  const { data: planned } = await supabase
    .from("planned_sessions")
    .select("id, session_name, intensity, discipline")
    .eq("athlete_id", athleteId)
    .eq("date", yesterday)
    .in("intensity", HIGH_INTENSITY);
  if (!planned || planned.length === 0) return false;

  const { data: completed } = await supabase
    .from("completed_sessions")
    .select("planned_session_id")
    .eq("athlete_id", athleteId)
    .eq("date", yesterday);
  const completedIds = new Set(
    (completed ?? []).map((c: { planned_session_id: string | null }) => c.planned_session_id).filter(Boolean),
  );

  const missedOne = planned.find((p: { id: string }) => !completedIds.has(p.id));
  if (!missedOne) return false;
  if (await alreadyFiredToday(supabase, athleteId, "missed_hard_session")) return false;

  const target = await nextUpcomingSession(supabase, athleteId);
  if (!target) return false;

  const { error } = await supabase.from("periodization_adjustments").insert({
    athlete_id: athleteId,
    target_session_id: target.id,
    adjustment_type: "missed_hard_session",
    source: "plan_suggestions",
    status: "pending_coach",
    reason_details:
      `Yesterday's "${missedOne.session_name}" (${missedOne.intensity}, ${missedOne.discipline}) has no matching ` +
      `logged session. No change suggested here — this is a flag for review, not an automatic downgrade. If it ` +
      `was skipped for recovery, "${target.session_name ?? "the next session"}" may still deserve a fatigue check ` +
      `before running as scripted; if it was genuine logistics, dismiss this.`,
    original_intensity: target.intensity ?? null,
    original_duration_min: target.duration_min ?? null,
    original_distance_km: target.distance_km ?? null,
    // suggested_* left null on purpose (see header: Accept is then a safe no-op).
  });
  if (error) {
    console.error("missed_hard_session insert failed", error);
    return false;
  }
  return true;
}

// ---- Rule 2: harder_than_planned -----------------------------------------
// [NEEDS SIGN-OFF — see header] Two independent triggers, either one fires
// the flag, checked against completed_sessions logged for yesterday:
//   - duration overshoot: actual_duration_min >= planned.duration_min * 1.5,
//     only when planned.duration_min >= 20 (skip short mobility/accessory
//     sessions where the ratio is noisy off a small base).
//   - RPE overshoot: logged rpe >= 8 on a planned "easy" or "moderate"
//     session (self-reported, so this only ever fires for manually-logged
//     completions — Strava/Garmin auto-sync never populates rpe).
const DURATION_OVERSHOOT_RATIO = 1.5;
const MIN_PLANNED_DURATION_FOR_RATIO_CHECK = 20;
const RPE_OVERSHOOT_THRESHOLD = 8;

async function checkHarderThanPlanned(supabase: SupaClient, athleteId: string): Promise<boolean> {
  const yesterday = isoDay(new Date(Date.now() - 86400000));
  const { data: completed } = await supabase
    .from("completed_sessions")
    .select("id, planned_session_id, actual_duration_min, rpe")
    .eq("athlete_id", athleteId)
    .eq("date", yesterday)
    .not("planned_session_id", "is", null);
  if (!completed || completed.length === 0) return false;

  const plannedIds = completed.map((c: { planned_session_id: string }) => c.planned_session_id);
  const { data: plannedRows } = await supabase
    .from("planned_sessions")
    .select("id, session_name, intensity, duration_min")
    .in("id", plannedIds);
  const plannedById = new Map(
    (plannedRows ?? []).map((p: { id: string }) => [p.id, p]),
  );

  let flagged: { session_name: string; reason: string } | null = null;
  for (const c of completed) {
    const p = plannedById.get(c.planned_session_id) as
      | { session_name: string; intensity: string | null; duration_min: number | null }
      | undefined;
    if (!p) continue;
    if (
      p.duration_min != null &&
      c.actual_duration_min != null &&
      p.duration_min >= MIN_PLANNED_DURATION_FOR_RATIO_CHECK &&
      c.actual_duration_min >= p.duration_min * DURATION_OVERSHOOT_RATIO
    ) {
      flagged = {
        session_name: p.session_name,
        reason: `ran ${c.actual_duration_min}min vs ${p.duration_min}min planned (${(c.actual_duration_min / p.duration_min).toFixed(1)}x)`,
      };
      break;
    }
    if (c.rpe != null && c.rpe >= RPE_OVERSHOOT_THRESHOLD && (p.intensity === "easy" || p.intensity === "moderate")) {
      flagged = { session_name: p.session_name, reason: `logged RPE ${c.rpe}/10 on a planned "${p.intensity}" session` };
      break;
    }
  }
  if (!flagged) return false;
  if (await alreadyFiredToday(supabase, athleteId, "harder_than_planned")) return false;

  const target = await nextUpcomingSession(supabase, athleteId);
  if (!target) return false;

  const { error } = await supabase.from("periodization_adjustments").insert({
    athlete_id: athleteId,
    target_session_id: target.id,
    adjustment_type: "harder_than_planned",
    source: "plan_suggestions",
    status: "pending_coach",
    reason_details:
      `Yesterday's "${flagged.session_name}" ${flagged.reason}. No change suggested here — flagged for a fatigue ` +
      `check before the next hard day, not an automatic downgrade.`,
    original_intensity: target.intensity ?? null,
    original_duration_min: target.duration_min ?? null,
    original_distance_km: target.distance_km ?? null,
  });
  if (error) {
    console.error("harder_than_planned insert failed", error);
    return false;
  }
  return true;
}

// ---- Rule 3: tsb_fatigue_watch -------------------------------------------
// Reuses tsbAdjustmentFactor()/downgradeIntensity() UNCHANGED from
// _shared/interferenceRules.ts — the same function, same bands, already
// live in generate-plan today. Only new thing: WHEN it runs. generate-plan
// checks TSB once, at generation time; this re-checks the latest
// training_load_daily.tsb every day and, if it's fatigued/high_risk, caps
// the next upcoming HIGH-INTENSITY session the exact same way generate-plan
// would have — one intensity tier down via downgradeIntensity(), duration/
// distance scaled by volumeCapPct. Mirrors generate-plan's
// tsb_intensity_reduction block exactly (single downgrade, not a bigger cut
// for the worse band) for consistency between the two triggers.
// Cooldown 3 days: TSB moves slowly for the same underlying cause, so a
// fresh flag every single day the band stays bad would just be noise once
// it's already been seen and responded to once.
const TSB_WATCH_COOLDOWN_DAYS = 3;

async function checkTsbFatigueWatch(supabase: SupaClient, athleteId: string): Promise<boolean> {
  const { data: loadRows } = await supabase
    .from("training_load_daily")
    .select("tsb")
    .eq("athlete_id", athleteId)
    .order("date", { ascending: false })
    .limit(1);
  const tsb = loadRows?.[0]?.tsb;
  if (tsb == null) return false;

  const adj = tsbAdjustmentFactor(Number(tsb));
  if (adj.intensityCapPct >= 100 && adj.volumeCapPct >= 100) return false; // fresh/neutral, nothing to do

  const cooldownSince = new Date(Date.now() - TSB_WATCH_COOLDOWN_DAYS * 86400000).toISOString();
  const { data: existing } = await supabase
    .from("periodization_adjustments")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("adjustment_type", "tsb_fatigue_watch")
    .gte("created_at", cooldownSince)
    .limit(1);
  if (existing && existing.length > 0) return false;

  const target = await nextUpcomingSession(supabase, athleteId, HIGH_INTENSITY);
  if (!target) return false; // nothing high-intensity coming up to cap — no action needed

  const { error } = await supabase.from("periodization_adjustments").insert({
    athlete_id: athleteId,
    target_session_id: target.id,
    adjustment_type: "tsb_fatigue_watch",
    source: "plan_suggestions",
    status: "pending_coach",
    reason_details: `TSB is ${tsb} as of the latest training-load compute. ${adj.directive} Proposal applies to "${target.session_name}".`,
    original_intensity: target.intensity ?? null,
    original_duration_min: target.duration_min ?? null,
    original_distance_km: target.distance_km ?? null,
    suggested_intensity: downgradeIntensity(target.intensity),
    suggested_duration_min: target.duration_min != null ? target.duration_min * (adj.volumeCapPct / 100) : null,
    suggested_distance_km: target.distance_km != null ? target.distance_km * (adj.volumeCapPct / 100) : null,
    tsb_at_suggestion: tsb,
  });
  if (error) {
    console.error("tsb_fatigue_watch insert failed", error);
    return false;
  }
  return true;
}
