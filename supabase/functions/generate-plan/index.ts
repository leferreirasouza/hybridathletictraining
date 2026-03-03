import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
- Include a taper week as the final week if a race date is specified.
- If athlete has injury concerns, be CONSERVATIVE: reduce intensity, add extra prehab/mobility, avoid aggravating movements.
- Prioritize weak stations/areas with extra practice sessions.
- Keep sessions realistic (30-90 min).
- Vary session names and content across weeks.

VALID discipline values: "run", "bike", "stairs", "rowing", "skierg", "mobility", "strength", "accessories", "hyrox_station", "prehab", "custom"
VALID intensity values: "easy", "moderate", "hard", "race_pace", "max_effort"

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
      "notes": "string" | null
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

serve(async (req) => {
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

    const { profile, organizationId, predictionOnly } = await req.json();
    if (!profile) throw new Error("Missing profile");

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
      .insert({ name: planData.plan_name || "AI Generated Plan", organization_id: organizationId, created_by: user.id })
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

    if (sessions.length > 0) {
      const { error: sessErr } = await supabase.from("planned_sessions").insert(sessions);
      if (sessErr) throw sessErr;
    }

    // If race date provided, save it as a future race_result entry for countdown
    if (profile.raceDate && profile.raceName) {
      await supabase.from("race_results").insert({
        athlete_id: user.id,
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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
