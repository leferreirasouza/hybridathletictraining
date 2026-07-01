import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detectInterferenceConflicts, downgradeIntensity, tsbAdjustmentFactor } from "../_shared/interferenceRules.ts";
import { decomposeHyroxTarget, estimateVDOT, paceZonesFromVDOT, formatPace } from "../_shared/paceZones.ts";
import { buildPhaseSchedule, formatPhaseTable } from "../_shared/phaseModel.ts";
import { assignWeeklySlots, formatSlotTable, validateSlotCompliance, type RunTypeWeights } from "../_shared/sessionSlots.ts";
import { buildRunVolumePlan, formatRunVolumeTable } from "../_shared/runVolumeProgression.ts";

const PLAN_GEN_PROMPT = `You are a HYROX and running race training plan generator. Given an athlete's profile, produce a structured multi-week training plan in JSON.

HYROX race format: 8 × 1km runs alternating with 8 stations (SkiErg 1000m, Sled Push 50m, Sled Pull 50m, Burpee Broad Jumps 80m, Row 1000m, Farmers Carry 200m, Sandbag Lunges 100m, Wall Balls 100 reps).

CRITICAL STRUCTURE RULES:
- The plan MUST have exactly the number of weeks specified.
- Each week MUST have exactly the number of training days specified, spread across DIFFERENT days of the week.
- NEVER put all sessions in week 1. Distribute sessions evenly.
- Each session object represents ONE session on ONE specific day of ONE specific week.

TRAINING RULES:
- For HYROX: Include a mix of running (easy, tempo, intervals), strength, HYROX station practice, mobility/prehab.
- For running-only: Focus on running with supporting strength/mobility work.
- Apply progressive overload (max 10% weekly volume increase).
- COMBINED load across ALL of the athlete's active plans must not exceed safety limits.
- If athlete has injury concerns, be CONSERVATIVE: reduce intensity, add extra prehab/mobility, avoid aggravating movements.
- Prioritize weak stations/areas with extra practice sessions.
- Keep sessions realistic (30-90 min).
- Vary session names and content across weeks.
- A COMPUTED WEEKLY SESSION SLOT TABLE and PHASE TABLE will be provided below when available. These are deterministic, not suggestions — fill EXACTLY the category/count specified per week (run subtype, strength with its muscle focus, or mobility/technique with its subtype). You choose the specific workout content/exercises within each slot, but do not add, drop, or change the category counts. Map mobility/technique slots to discipline "mobility" or "prehab" as appropriate.
- COMPUTED PACE ZONES, when provided, are derived mathematically from the athlete's target time — use them as the actual pace targets in workout_details for easy/tempo/interval/long runs. Do not invent your own pace numbers when this block is present.
- The phase table's intensity cap and volume percentage for each week replace any freeform taper/progression guessing — follow it exactly, including which week(s) are the taper.

VALID discipline values: "run", "bike", "stairs", "rowing", "skierg", "mobility", "strength", "accessories", "hyrox_station", "prehab", "custom"
VALID intensity values: "easy", "moderate", "hard", "race_pace", "max_effort"
VALID block_type values: "warmup", "main", "cooldown", "station", "strength", "accessory", "superset"

STRUCTURED BLOCKS (optional but preferred when you have enough detail): in addition to the free-text workout_details, you may include a "blocks" array per session breaking it into discrete steps:
- For RUN sessions: emit blocks in order as warmup → one or more main → cooldown. For interval-style sessions, use ONE main block with repeat_count set and target_pace_label describing both the work and recovery pace (e.g. "200m at 3:55/km, 200m at 5:30/km") rather than duplicating rows per rep. For progressive/varied-pace runs, use target_pace_label (e.g. "5km at 4:55/km, 4km at 4:35/km, 3km at 4:15/km") instead of a single target_pace.
- For STRENGTH sessions: group exercises into numbered parts (part_number, e.g. 1,2,3...). Within a part, give exercises that should be performed back-to-back the same superset_group integer (unique per part; omit/null if the exercise stands alone). Set repeat_count for how many rounds the part/superset repeats. Tag each exercise block with equipment (one item from the athlete's available equipment list, or "bodyweight") and muscle_group (e.g. "chest", "back", "core", "shoulders", "full_body", "legs", "accessory").
- Leave any field null/omitted when not applicable. If you cannot produce meaningful structured detail for a session, omit "blocks" entirely — workout_details alone is fine.

Respond with ONLY valid JSON (no markdown, no backticks) in this exact format:
{
  "plan_name": "string",
  "total_weeks": number,
  "sessions": [
    {
      "week_number": number (1 to total_weeks),
      "day_of_week": number (1=Mon to 7=Sun),
      "discipline": "valid_discipline",
      "session_name": "string",
      "duration_min": number | null,
      "distance_km": number | null,
      "intensity": "valid_intensity" | null,
      "workout_details": "string describing the session",
      "notes": "string" | null,
      "blocks": [
        {
          "block_type": "valid_block_type",
          "exercise_name": "string",
          "part_number": number | null,
          "superset_group": number | null,
          "repeat_count": number | null,
          "sets": number | null,
          "reps": number | null,
          "duration_sec": number | null,
          "distance_m": number | null,
          "load_kg": number | null,
          "target_pace": "string" | null,
          "target_pace_label": "string" | null,
          "target_rpe": number | null,
          "equipment": "string" | null,
          "muscle_group": "string" | null,
          "notes": "string" | null
        }
      ] | null
    }
  ]
}`;

const PREDICTION_PROMPT = `You are a sports performance analyst. Given an athlete's training data and race history, provide a race prediction and safety assessment.

Respond with ONLY valid JSON in this format:
{
  "predictedTime": "string (formatted time e.g. '1:25:30' or '49:15')",
  "confidence": "string (e.g. 'High - based on 3 months of data' or 'Low - limited training data')",
  "targetFeedback": "string (assessment of whether their target time is realistic)",
  "riskLevel": "low" | "moderate" | "high",
  "injuryRisk": "string or null (specific injury risk assessment based on training load, reported pain, and target aggressiveness)",
  "recommendations": ["array of 2-4 specific actionable recommendations"]
}

ASSESSMENT RULES:
- For RUNNING: Use recent training paces, weekly volume, and race history to predict finish time. Compare with target.
- For HYROX first-timers: Use age-group averages as baseline. Factor in training fitness indicators.
- For HYROX with race history: Analyze station splits. Identify below-average stations. Calculate improvement potential.
- INJURY RISK: Flag as "high" if target requires >15% improvement with <8 weeks training, or if athlete reports pain/injuries and target is aggressive.
- INJURY RISK: Flag as "moderate" if target requires >10% improvement or athlete has minor injury concerns.
- Be honest but encouraging. If target is unrealistic, suggest a more achievable alternative.
- Consider training volume, consistency (gaps in data), and RPE trends for injury risk.`;

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function parseTimeToSeconds(time: string | undefined | null): number | null {
  if (!time) return null;
  const parts = time.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

const RUN_DISTANCE_METERS: Record<string, number> = {
  "5k": 5000,
  "10k": 10000,
  half: 21097.5,
  marathon: 42195,
};

const DEFAULT_RUN_TYPE_WEIGHTS: RunTypeWeights = { easy: 0.6, tempo: 0.15, interval: 0.1, long: 0.15, fartlek: 0 };

serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "";
  const devOrigins = ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"];
  const isAllowed = !allowedOrigin || origin === allowedOrigin || devOrigins.includes(origin);
  const corsHeaders = {
    "Access-Control-Allow-Origin": isAllowed ? (origin || allowedOrigin || "*") : allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { profile, organizationId, predictionOnly, athleteId } = await req.json();
    if (!profile) throw new Error("Missing profile");

    // Coach-on-behalf-of-athlete authorization: the caller (user.id) is the
    // athlete by default; a coach can pass athleteId to generate for one of
    // their assigned athletes instead, verified against coach_athlete_assignments.
    let effectiveAthleteId = user.id;
    if (athleteId && athleteId !== user.id) {
      if (!organizationId) throw new Error("organizationId required when generating on behalf of another athlete");
      const { data: assignment, error: assignmentErr } = await supabase
        .from("coach_athlete_assignments")
        .select("id")
        .eq("coach_id", user.id)
        .eq("athlete_id", athleteId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (assignmentErr || !assignment) throw new Error("Not authorized to generate a plan for this athlete");
      effectiveAthleteId = athleteId;
    }

    // Authorization: if an organizationId is supplied (used to tag the plan
    // and to scope cross-plan load queries), the caller must be a member of
    // that organization in any role. Global master_admins pass through.
    if (organizationId) {
      const { data: orgMembership, error: orgMembershipErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId);
      if (orgMembershipErr) throw new Error("Failed to verify organization membership");
      const isGlobalMaster = (orgMembership || []).some((r) => r.role === "master_admin");
      if (!isGlobalMaster && (!orgMembership || orgMembership.length === 0)) {
        const { data: globalMaster } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "master_admin")
          .limit(1);
        if (!globalMaster || globalMaster.length === 0) {
          return new Response(JSON.stringify({ error: "Forbidden: not a member of this organization" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const raceType = profile.raceType || "hyrox";
    const stationNames = ["SkiErg", "Sled Push", "Sled Pull", "Burpee Broad Jumps", "Rowing", "Farmers Carry", "Sandbag Lunges", "Wall Balls"];

    // Build athlete description
    let athleteDesc = `
Race Type: ${raceType.toUpperCase()}
Experience Level: ${profile.experience || "beginner"}
Available Training Days/Week: ${profile.trainingDays || 4}
Current Easy Pace (min/km): ${profile.easyPace || "unknown"}
Current Race Pace (min/km): ${profile.racePace || "unknown"}
Goal Race Date: ${profile.raceDate || "no specific date"}
Injuries/Limitations: ${profile.injuries || "none"}
Additional Goals: ${profile.goals || "general preparation"}
Plan Duration (weeks): ${profile.planWeeks || "8"}
Current Running Volume: ${profile.currentWeeklyKm ?? 0} km/week across ${profile.currentRunDaysPerWeek ?? 0} days. A COMPUTED WEEKLY RUN VOLUME TABLE (below) already applies the 10%-rule and phase multipliers to this baseline — use its per-week km totals and per-slot km values as the source of truth for distance_km on run sessions. Do not invent your own weekly km progression.
`.trim();

    if (raceType === "running") {
      athleteDesc += `\nRace Distance: ${profile.runDistance || "10k"}`;
      if (profile.targetTime) athleteDesc += `\nTarget Time: ${profile.targetTime}`;
      else athleteDesc += `\nTarget Time: Not specified (predict based on training)`;
    } else {
      athleteDesc += `\nPlan Focus: ${profile.planFocus || "balanced"}`;
      athleteDesc += `\nWeakest Stations: ${profile.weakStations?.join(", ") || "none specified"}`;
      if (profile.totalTarget) athleteDesc += `\nTotal Race Target: ${profile.totalTarget}`;
      if (profile.runKmTarget) athleteDesc += `\nRun Split Target: ${profile.runKmTarget}/km`;
      athleteDesc += `\nAge Group: ${profile.ageGroup || "30-34"}`;

      // Per-station targets
      if (profile.stationTargets && Object.keys(profile.stationTargets).length > 0) {
        athleteDesc += `\n\nINDIVIDUAL STATION TIME TARGETS:`;
        for (const [station, target] of Object.entries(profile.stationTargets)) {
          athleteDesc += `\n  - ${station}: ${target}`;
        }
        athleteDesc += `\nThe training plan MUST include dedicated practice sessions for stations with set targets. Prioritize stations where the target represents the largest improvement from current performance. Include progressive drills to build toward these specific times.`;
      }
    }

    // Append race history
    if (profile.raceResults && profile.raceResults.length > 0) {
      athleteDesc += `\n\nPast Race Results (${profile.raceResults.length} race(s)):`;
      for (const race of profile.raceResults) {
        athleteDesc += `\n\n--- ${race.race_name || "Race"} (${race.race_date}, ${race.category || "open"}) - Total: ${fmtTime(race.total_time_seconds || 0)} ---`;
        for (let i = 0; i < 8; i++) {
          const runKey = `run_${i + 1}_seconds`;
          const stationKey = `station_${i + 1}_seconds`;
          if (race[runKey] || race[stationKey]) {
            athleteDesc += `\n  Round ${i + 1}: Run ${fmtTime(race[runKey] || 0)} | ${stationNames[i]} ${fmtTime(race[stationKey] || 0)}`;
          }
        }
        if (race.total_transition_seconds) {
          athleteDesc += `\n  Transitions: ${fmtTime(race.total_transition_seconds)}`;
        }
      }

      // Analyze stations to highlight weak ones
      const latestRace = profile.raceResults[0];
      const stationTimes: number[] = [];
      for (let i = 0; i < 8; i++) {
        const t = latestRace[`station_${i + 1}_seconds`];
        if (t) stationTimes.push(t);
      }
      if (stationTimes.length > 0) {
        const avgStation = stationTimes.reduce((a: number, b: number) => a + b, 0) / stationTimes.length;
        const weakOnes: string[] = [];
        for (let i = 0; i < 8; i++) {
          const t = latestRace[`station_${i + 1}_seconds`];
          if (t && t > avgStation * 1.1) weakOnes.push(stationNames[i]);
        }
        if (weakOnes.length > 0) {
          athleteDesc += `\n\nDATA-DETECTED WEAK STATIONS (>10% above avg): ${weakOnes.join(", ")}`;
          athleteDesc += `\nThe plan MUST include extra practice for these stations to bring them below average.`;
        }
      }

      athleteDesc += `\n\nUse this race data to identify weaknesses and tailor the training plan.`;
    } else if (raceType === "hyrox") {
      athleteDesc += `\n\nNo prior HYROX race data available. This is likely their first race.`;
      athleteDesc += `\nUse age group (${profile.ageGroup || "30-34"}) average times as baseline targets.`;
      athleteDesc += `\nFocus on building a solid foundation across all stations and running.`;
    }

    // Append training history for predictions
    if (profile.trainingHistory && profile.trainingHistory.length > 0) {
      const history = profile.trainingHistory;
      const totalSessions = history.length;
      const runSessions = history.filter((s: any) => s.discipline === "run");
      const totalRunKm = runSessions.reduce((sum: number, s: any) => sum + (Number(s.actual_distance_km) || 0), 0);
      const totalDuration = history.reduce((sum: number, s: any) => sum + (Number(s.actual_duration_min) || 0), 0);
      const avgRpe = history.filter((s: any) => s.rpe).reduce((sum: number, s: any) => sum + s.rpe, 0) / (history.filter((s: any) => s.rpe).length || 1);
      const avgHr = history.filter((s: any) => s.avg_hr).reduce((sum: number, s: any) => sum + s.avg_hr, 0) / (history.filter((s: any) => s.avg_hr).length || 1);

      athleteDesc += `\n\nRecent Training Summary (last ${totalSessions} sessions):`;
      athleteDesc += `\n- Total run distance: ${totalRunKm.toFixed(1)} km across ${runSessions.length} runs`;
      athleteDesc += `\n- Total training time: ${Math.round(totalDuration)} minutes`;
      athleteDesc += `\n- Average RPE: ${avgRpe.toFixed(1)} / 10`;
      if (avgHr > 0) athleteDesc += `\n- Average HR: ${Math.round(avgHr)} bpm`;

      // Recent paces
      const recentRuns = runSessions.filter((s: any) => s.avg_pace).slice(0, 5);
      if (recentRuns.length > 0) {
        athleteDesc += `\n- Recent run paces: ${recentRuns.map((s: any) => s.avg_pace).join(", ")}`;
      }

      // Pain flags
      const painSessions = history.filter((s: any) => s.pain_flag);
      if (painSessions.length > 0) {
        athleteDesc += `\n- ⚠️ ${painSessions.length} sessions with pain flagged`;
      }
    }

    // ---- PREDICTION ONLY MODE ----
    if (predictionOnly) {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: PREDICTION_PROMPT },
            { role: "user", content: athleteDesc },
          ],
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI service error: ${aiResponse.status}`);
      }

      const aiResult = await aiResponse.json();
      const rawContent = aiResult.choices?.[0]?.message?.content;
      if (!rawContent) throw new Error("Empty AI response");

      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      let prediction;
      try {
        prediction = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse prediction JSON:", cleaned.substring(0, 500));
        throw new Error("AI returned invalid prediction format. Please try again.");
      }

      return new Response(JSON.stringify({ prediction }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- FULL PLAN GENERATION ----
    if (!organizationId) throw new Error("Missing organizationId");

    // Fetch existing sessions from OTHER plans to calculate aggregate load
    const { data: existingPlans } = await supabase
      .from("training_plans")
      .select("id")
      .eq("organization_id", organizationId)
      .neq("created_by", "placeholder"); // all org plans

    let existingLoadSection = "";
    if (existingPlans && existingPlans.length > 0) {
      const planIds = existingPlans.map((p: any) => p.id);
      // Get latest version per plan
      const versionIds: string[] = [];
      for (const pid of planIds) {
        const { data: ver } = await supabase
          .from("plan_versions")
          .select("id")
          .eq("plan_id", pid)
          .order("version_number", { ascending: false })
          .limit(1)
          .single();
        if (ver) versionIds.push(ver.id);
      }
      if (versionIds.length > 0) {
        const { data: existingSessions } = await supabase
          .from("planned_sessions")
          .select("week_number, day_of_week, discipline, intensity, distance_km, duration_min")
          .in("plan_version_id", versionIds);

        if (existingSessions && existingSessions.length > 0) {
          const experience = profile.experience || "intermediate";

          // Safety limits by experience
          const MAX_RUN_KM: Record<string, number> = { beginner: 30, intermediate: 55, advanced: 80, elite: 120 };
          const MAX_SESSIONS: Record<string, number> = { beginner: 5, intermediate: 7, advanced: 10, elite: 12 };
          const MAX_DURATION: Record<string, number> = { beginner: 300, intermediate: 480, advanced: 660, elite: 900 };
          const MAX_HIGH: Record<string, number> = { beginner: 2, intermediate: 3, advanced: 4, elite: 5 };

          const weeks = [...new Set(existingSessions.map((s: any) => s.week_number))].sort();
          existingLoadSection = `\n\n⚠️ EXISTING TRAINING LOAD FROM OTHER ACTIVE PLANS:\n`;
          existingLoadSection += `The athlete already has ${existingSessions.length} sessions across ${weeks.length} weeks.\n`;
          for (const w of weeks) {
            const ws = existingSessions.filter((s: any) => s.week_number === w);
            const runKm = ws.filter((s: any) => s.discipline === "run").reduce((sum: number, s: any) => sum + (Number(s.distance_km) || 0), 0);
            const dur = ws.reduce((sum: number, s: any) => sum + (Number(s.duration_min) || 0), 0);
            const hi = ws.filter((s: any) => ["hard", "race_pace", "max_effort"].includes(s.intensity)).length;
            existingLoadSection += `  Week ${w}: ${ws.length} sessions, ${runKm.toFixed(1)}km run, ${Math.round(dur)}min, ${hi} high-intensity\n`;
          }
          existingLoadSection += `\nSAFETY LIMITS (${experience}):\n`;
          existingLoadSection += `- Max weekly running: ${MAX_RUN_KM[experience] || 55}km TOTAL across all plans\n`;
          existingLoadSection += `- Max weekly sessions: ${MAX_SESSIONS[experience] || 7} TOTAL\n`;
          existingLoadSection += `- Max weekly duration: ${MAX_DURATION[experience] || 480}min TOTAL\n`;
          existingLoadSection += `- Max high-intensity/week: ${MAX_HIGH[experience] || 3} TOTAL\n`;
          existingLoadSection += `- Max 10% weekly mileage increase\n`;
          existingLoadSection += `- Include ≥1 strength/prehab session per week\n`;
          existingLoadSection += `- Max 5 consecutive training days\n`;
          existingLoadSection += `\nCRITICAL: The NEW plan combined with existing load MUST stay within these limits. Reduce volume, avoid overlapping high-intensity days, or lower intensity. Safety > performance.\n`;
        }
      }
    }

    athleteDesc += existingLoadSection;

    // ---- TSB / interference constraint (Phase 2, hand-coded) ----
    const { data: loadRows } = await supabase
      .from("training_load_daily")
      .select("tsb")
      .eq("athlete_id", effectiveAthleteId)
      .order("date", { ascending: false })
      .limit(1);

    const currentTsb = loadRows?.[0]?.tsb != null ? Number(loadRows[0].tsb) : null;
    const tsbAdjustment = currentTsb !== null ? tsbAdjustmentFactor(currentTsb) : null;

    let periodizationSection = "";
    if (tsbAdjustment) {
      periodizationSection += `\n\n🔬 CURRENT TRAINING STRESS BALANCE (TSB): ${currentTsb!.toFixed(1)}\n`;
      periodizationSection += `${tsbAdjustment.directive}\n`;
      if (tsbAdjustment.intensityCapPct < 100 || tsbAdjustment.volumeCapPct < 100) {
        periodizationSection += `- Reduce high-intensity session frequency to ~${tsbAdjustment.intensityCapPct}% of normal.\n`;
        periodizationSection += `- Reduce overall weekly volume to ~${tsbAdjustment.volumeCapPct}% of normal.\n`;
      }
    }
    periodizationSection += `\n\n🔁 CONCURRENT-TRAINING INTERFERENCE RULES (Hickson 1980):\n`;
    periodizationSection += `- Do NOT schedule a hard/race-pace/max-effort endurance session (run/bike/row/skierg/stairs) on the same day as heavy strength or HYROX station work.\n`;
    periodizationSection += `- Leave at least 1 easy/rest day between two high-intensity sessions of different qualities (endurance vs strength).\n`;
    periodizationSection += `- If forced to pair them, downgrade one session's intensity rather than stacking two hard sessions.\n`;
    athleteDesc += periodizationSection;

    // ---- Plan Generator Rework Phase A (hand-coded, deterministic backbone) ----
    const planWeeksNum = Number(profile.planWeeks) || 8;
    const phaseSchedule = buildPhaseSchedule(planWeeksNum, profile.experience || "intermediate");
    const weekNumbers = phaseSchedule.map((w) => w.weekNumber);
    const phaseByWeek: Record<number, "base" | "build" | "peak" | "taper"> = {};
    for (const w of phaseSchedule) phaseByWeek[w.weekNumber] = w.phase;

    // Persistent + per-plan preferences (training_preferences row may not
    // exist yet for athletes who haven't visited the new preferences UI —
    // synthesize sensible defaults from the trainingDays count instead of
    // blocking on it, per the Phase A rollout decision).
    const { data: prefsRow } = await supabase
      .from("training_preferences")
      .select("available_days, run_type_weights, strength_sessions_per_week, muscle_focus, mobility_technique_sessions_per_week, equipment")
      .eq("athlete_id", effectiveAthleteId)
      .maybeSingle();

    const trainingDaysCount = prefsRow?.available_days?.length || Number(profile.trainingDays) || 4;
    const runTypeWeights: RunTypeWeights = (prefsRow?.run_type_weights as RunTypeWeights) || DEFAULT_RUN_TYPE_WEIGHTS;
    const strengthSessionsPerWeek = prefsRow?.strength_sessions_per_week ?? 1;
    const mobilityTechSessionsPerWeek = prefsRow?.mobility_technique_sessions_per_week ?? 1;
    const muscleFocus: string[] = prefsRow?.muscle_focus || [];

    const slotPlan = assignWeeklySlots(
      weekNumbers,
      trainingDaysCount,
      runTypeWeights,
      strengthSessionsPerWeek,
      mobilityTechSessionsPerWeek,
      muscleFocus,
      phaseByWeek
    );

    const runVolumePlan = buildRunVolumePlan(
      Number(profile.currentWeeklyKm),
      phaseSchedule,
      slotPlan
    );

    let deterministicSection = `\n\n📐 PHASE SCHEDULE (deterministic — follow exactly):\n${formatPhaseTable(phaseSchedule)}\n`;
    deterministicSection += `\n📋 WEEKLY SESSION SLOTS (deterministic — fill exactly these categories/counts per week):\n${formatSlotTable(slotPlan)}\n`;
    deterministicSection += `\n🏃 WEEKLY RUN VOLUME TARGETS (deterministic — derived from athlete's ${runVolumePlan.baselineKm} km/week baseline via the 10%-rule and phase multipliers). Each run session's distance_km MUST match its assigned per-slot km within ±10%. Do NOT exceed the week total.\n${formatRunVolumeTable(runVolumePlan)}\n`;

    // Equipment constraint — reads defensively since live rows may still use
    // the old flat {gym_access,sled,rower,skierg} shape, pre-preset-migration.
    if (prefsRow?.equipment) {
      const equipmentSource = (prefsRow.equipment as any).items ?? prefsRow.equipment;
      const availableItems = Object.entries(equipmentSource)
        .filter(([, v]) => v === true)
        .map(([k]) => k.replace(/_/g, " "));
      deterministicSection += `\n🏋️ AVAILABLE EQUIPMENT: ${availableItems.length > 0 ? availableItems.join(", ") : "bodyweight only"}\nONLY prescribe strength/accessory exercises using this equipment (or bodyweight).\n`;
    }

    // Pace zones — computed mathematically from the target time, not
    // LLM-guessed, mirroring how Runna derives pace targets.
    let paceZoneInfo: { vdot: number; zones: ReturnType<typeof paceZonesFromVDOT> } | null = null;
    if (raceType === "running") {
      const distanceMeters = RUN_DISTANCE_METERS[profile.runDistance] || null;
      const targetSeconds = parseTimeToSeconds(profile.targetTime);
      if (distanceMeters && targetSeconds) {
        const vdot = estimateVDOT(distanceMeters, targetSeconds);
        paceZoneInfo = { vdot, zones: paceZonesFromVDOT(vdot) };
      }
    } else {
      const totalSeconds = parseTimeToSeconds(profile.totalTarget);
      const runKmSeconds = parseTimeToSeconds(profile.runKmTarget);
      if (totalSeconds) {
        const decomposed = decomposeHyroxTarget(totalSeconds, runKmSeconds);
        paceZoneInfo = { vdot: decomposed.vdot, zones: decomposed.zones };
      }
    }

    if (paceZoneInfo) {
      const z = paceZoneInfo.zones;
      deterministicSection += `\n🎯 COMPUTED PACE ZONES (derived from target time, do not invent your own):\n`;
      deterministicSection += `  Easy: ${formatPace(z.easySecPerKm)} | Marathon/steady: ${formatPace(z.marathonSecPerKm)} | Threshold/tempo: ${formatPace(z.thresholdSecPerKm)} | Interval: ${formatPace(z.intervalSecPerKm)} | Repetition/sprint: ${formatPace(z.repetitionSecPerKm)}\n`;
    }

    athleteDesc += deterministicSection;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: PLAN_GEN_PROMPT },
          { role: "user", content: athleteDesc },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(`AI service error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("Empty AI response");

    const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let planData;
    try {
      planData = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI JSON:", cleaned.substring(0, 500));
      throw new Error("AI returned invalid plan format. Please try again.");
    }

    if (!planData.sessions || !Array.isArray(planData.sessions)) {
      throw new Error("AI plan missing sessions array");
    }

    // Persist to DB
    const { data: plan, error: planErr } = await supabase
      .from("training_plans")
      .insert({ name: planData.plan_name || "AI Generated Plan", organization_id: organizationId, created_by: user.id, source: 'ai_generated' })
      .select()
      .single();
    if (planErr) throw planErr;

    const { data: version, error: verErr } = await supabase
      .from("plan_versions")
      .insert({ plan_id: plan.id, version_number: 1, created_by: user.id, notes: `AI-generated ${raceType} plan` })
      .select()
      .single();
    if (verErr) throw verErr;

    const validDisciplines = ["run", "bike", "stairs", "rowing", "skierg", "mobility", "strength", "accessories", "hyrox_station", "prehab", "custom"];
    const validIntensities = ["easy", "moderate", "hard", "race_pace", "max_effort"];

    const sessions = planData.sessions.map((s: any, idx: number) => ({
      plan_version_id: version.id,
      athlete_id: effectiveAthleteId,
      week_number: s.week_number || 1,
      day_of_week: s.day_of_week || 1,
      discipline: validDisciplines.includes(s.discipline) ? s.discipline : "custom",
      session_name: s.session_name || `Session ${idx + 1}`,
      duration_min: s.duration_min || null,
      distance_km: s.distance_km || null,
      intensity: validIntensities.includes(s.intensity) ? s.intensity : null,
      workout_details: s.workout_details || null,
      notes: s.notes || null,
      order_index: idx,
    }));

    let insertedSessions: any[] = [];
    if (sessions.length > 0) {
      const { data: inserted, error: sessErr } = await supabase
        .from("planned_sessions")
        .insert(sessions)
        .select("id, week_number, day_of_week, discipline, intensity, duration_min, distance_km");
      if (sessErr) throw sessErr;
      insertedSessions = inserted || [];
    }

    // ---- Structured session_blocks (Plan Generator Rework Phase B) ----
    // Enrichment, not the source of truth — workout_details remains the
    // fallback, so a failure here must never fail plan generation.
    const validBlockTypes = ["warmup", "main", "cooldown", "station", "strength", "accessory", "superset"];
    try {
      const blockRows: Record<string, unknown>[] = [];
      planData.sessions.forEach((s: any, idx: number) => {
        const sessionId = insertedSessions[idx]?.id;
        if (!sessionId || !Array.isArray(s.blocks)) return;
        s.blocks.forEach((b: any, bIdx: number) => {
          blockRows.push({
            session_id: sessionId,
            order_index: bIdx,
            block_type: validBlockTypes.includes(b.block_type) ? b.block_type : "main",
            exercise_name: b.exercise_name || s.session_name || "",
            part_number: b.part_number ?? null,
            superset_group: b.superset_group ?? null,
            repeat_count: b.repeat_count ?? null,
            sets: b.sets ?? null,
            reps: b.reps ?? null,
            duration_sec: b.duration_sec ?? null,
            distance_m: b.distance_m ?? null,
            load_kg: b.load_kg ?? null,
            target_pace: b.target_pace ?? null,
            target_pace_label: b.target_pace_label ?? null,
            target_rpe: b.target_rpe ?? null,
            equipment: b.equipment ?? null,
            muscle_group: b.muscle_group ?? null,
            notes: b.notes ?? null,
          });
        });
      });
      if (blockRows.length > 0) {
        const { error: blocksErr } = await supabase.from("session_blocks").insert(blockRows);
        if (blocksErr) console.error("session_blocks insert error (non-fatal):", blocksErr);
      }
    } catch (e) {
      console.error("session_blocks enrichment failed (non-fatal):", e);
    }

    // ---- Deterministic post-hoc safety net (Phase 2, hand-coded) ----
    // Independent of whether the AI followed the prompt's periodization
    // guidance, re-check the actual generated output and surface any
    // conflicts/caps as coach-reviewable proposals. Nothing here mutates
    // planned_sessions directly — see periodization_adjustments table.
    if (insertedSessions.length > 0) {
      const adjustments: Record<string, unknown>[] = [];

      const conflicts = detectInterferenceConflicts(insertedSessions);
      for (const conflict of conflicts) {
        const targets = insertedSessions.filter(
          (s) => s.week_number === conflict.weekNumber && (s.day_of_week === conflict.dayA || s.day_of_week === conflict.dayB)
        );
        for (const target of targets) {
          adjustments.push({
            athlete_id: effectiveAthleteId,
            target_session_id: target.id,
            adjustment_type: "interference_spacing",
            reason_details: conflict.reasonDetails,
            status: "pending_coach",
            original_intensity: target.intensity,
            original_duration_min: target.duration_min,
            original_distance_km: target.distance_km,
            suggested_intensity: downgradeIntensity(target.intensity),
            suggested_duration_min: target.duration_min,
            suggested_distance_km: target.distance_km,
            tsb_at_suggestion: currentTsb,
          });
        }
      }

      if (tsbAdjustment && (tsbAdjustment.intensityCapPct < 100 || tsbAdjustment.volumeCapPct < 100)) {
        const highIntensitySessions = insertedSessions.filter((s) =>
          ["hard", "race_pace", "max_effort"].includes(s.intensity)
        );
        for (const target of highIntensitySessions) {
          adjustments.push({
            athlete_id: effectiveAthleteId,
            target_session_id: target.id,
            adjustment_type: "tsb_intensity_reduction",
            reason_details: tsbAdjustment.directive,
            status: "pending_coach",
            original_intensity: target.intensity,
            original_duration_min: target.duration_min,
            original_distance_km: target.distance_km,
            suggested_intensity: downgradeIntensity(target.intensity),
            suggested_duration_min: target.duration_min != null ? target.duration_min * (tsbAdjustment.volumeCapPct / 100) : null,
            suggested_distance_km: target.distance_km != null ? target.distance_km * (tsbAdjustment.volumeCapPct / 100) : null,
            tsb_at_suggestion: currentTsb,
          });
        }
      }

      // ---- Slot-compliance check (Plan Generator Rework Phase A) ----
      // The slot plan is week-level, not session-level, so there's no single
      // session a shortfall "belongs to" — we attach the adjustment to the
      // first inserted session of that week purely so the coach-review UI
      // has a row to anchor to; reason_details carries the real signal.
      const slotMismatches = validateSlotCompliance(insertedSessions, slotPlan);
      for (const mismatch of slotMismatches) {
        const weekSessions = insertedSessions.filter((s) => s.week_number === mismatch.weekNumber);
        if (weekSessions.length === 0) continue;
        const target = weekSessions[0];
        adjustments.push({
          athlete_id: effectiveAthleteId,
          target_session_id: target.id,
          adjustment_type: "slot_mismatch",
          reason_details: mismatch.reasonDetails,
          status: "pending_coach",
          original_intensity: target.intensity,
          original_duration_min: target.duration_min,
          original_distance_km: target.distance_km,
          suggested_intensity: target.intensity,
          suggested_duration_min: target.duration_min,
          suggested_distance_km: target.distance_km,
          tsb_at_suggestion: currentTsb,
        });
      }

      if (adjustments.length > 0) {
        await supabase.from("periodization_adjustments").insert(adjustments);
      }
    }

    // If race date provided, save it as a future race_result entry for countdown
    if (profile.raceDate && profile.raceName) {
      await supabase.from("race_results").insert({
        athlete_id: effectiveAthleteId,
        race_date: profile.raceDate,
        race_name: profile.raceName,
        race_location: profile.raceLocation || null,
        category: profile.ageGroup ? `age_${profile.ageGroup}` : "open",
        input_method: "goal",
      });
    }

    return new Response(JSON.stringify({
      success: true,
      planId: plan.id,
      planName: plan.name,
      totalWeeks: planData.total_weeks || Math.max(...sessions.map((s: any) => s.week_number)),
      sessionsCreated: sessions.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-plan error:", e);
    return new Response(JSON.stringify({ error: "An error occurred processing your request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
