import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_GEN_PROMPT = `You are a HYROX training plan generator. Given an athlete's profile, produce a structured multi-week training plan in JSON.

HYROX race format: 8 × 1km runs alternating with 8 stations (SkiErg 1000m, Sled Push 50m, Sled Pull 50m, Burpee Broad Jumps 80m, Row 1000m, Farmers Carry 200m, Sandbag Lunges 100m, Wall Balls 100 reps).

CRITICAL STRUCTURE RULES:
- The plan MUST have exactly the number of weeks specified (e.g. 8 weeks = week_number 1 through 8).
- Each week MUST have exactly the number of training days specified, spread across DIFFERENT days of the week (e.g. 4 days/week → use day_of_week values like 1,3,5,6).
- NEVER put all sessions in week 1. Distribute sessions evenly: if 4 days/week for 8 weeks = 32 total sessions.
- Each session object represents ONE session on ONE specific day of ONE specific week.

TRAINING RULES:
- Include a mix of: running (easy, tempo, intervals), strength, HYROX station practice, mobility/prehab.
- Apply progressive overload (max 10% weekly volume increase).
- Include a taper week as the final week if a race date is specified.
- Prioritize the athlete's weak stations with extra practice sessions.
- Keep sessions realistic (30-90 min).
- Vary session names and content across weeks — avoid repeating identical sessions.

VALID discipline values: "run", "bike", "stairs", "rowing", "skierg", "mobility", "strength", "accessories", "hyrox_station", "prehab", "custom"
VALID intensity values: "easy", "moderate", "hard", "race_pace", "max_effort"

Respond with ONLY valid JSON (no markdown, no backticks) in this exact format:
{
  "plan_name": "string",
  "total_weeks": number,
  "sessions": [
    {
      "week_number": number (1 to total_weeks, MUST distribute across ALL weeks),
      "day_of_week": number (1=Mon to 7=Sun, MUST vary within each week),
      "discipline": "valid_discipline",
      "session_name": "string",
      "duration_min": number | null,
      "distance_km": number | null,
      "intensity": "valid_intensity" | null,
      "workout_details": "string describing the session with exercises, sets, reps, paces etc.",
      "notes": "string" | null
    }
  ]
}`;

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

    const { profile, organizationId } = await req.json();
    if (!profile || !organizationId) throw new Error("Missing profile or organizationId");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build athlete description for the AI
    let athleteDesc = `
Athlete Profile:
- Experience Level: ${profile.experience || "beginner"}
- Available Training Days/Week: ${profile.trainingDays || 4}
- Current Running Pace (easy, min/km): ${profile.easyPace || "unknown"}
- Current Running Pace (race, min/km): ${profile.racePace || "unknown"}
- Goal Race Date: ${profile.raceDate || "no specific date"}
- Weakest Stations: ${profile.weakStations?.join(", ") || "none specified"}
- Injuries/Limitations: ${profile.injuries || "none"}
- Additional Goals: ${profile.goals || "general HYROX preparation"}
- Plan Duration Preference (weeks): ${profile.planWeeks || "8"}
- Plan Focus: ${profile.planFocus || "balanced (running + stations)"}
`.trim();

    // Append race history if provided
    if (profile.raceResults && profile.raceResults.length > 0) {
      const stationNames = ["SkiErg", "Sled Push", "Sled Pull", "Burpee Broad Jumps", "Rowing", "Farmers Carry", "Sandbag Lunges", "Wall Balls"];
      const fmtTime = (s: number | null) => {
        if (!s) return "N/A";
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${String(sec).padStart(2, "0")}`;
      };

      athleteDesc += `\n\nPast HYROX Race Results (${profile.raceResults.length} race(s)):`;
      for (const race of profile.raceResults) {
        athleteDesc += `\n\n--- ${race.race_name || "Race"} (${race.race_date}, ${race.category}) - Total: ${fmtTime(race.total_time_seconds)} ---`;
        for (let i = 0; i < 8; i++) {
          const runKey = `run_${i + 1}_seconds`;
          const stationKey = `station_${i + 1}_seconds`;
          athleteDesc += `\n  Round ${i + 1}: Run ${fmtTime(race[runKey])} | ${stationNames[i]} ${fmtTime(race[stationKey])}`;
        }
        if (race.total_transition_seconds) {
          athleteDesc += `\n  Transitions: ${fmtTime(race.total_transition_seconds)}`;
        }
      }
      athleteDesc += `\n\nUse this race data to identify weaknesses and tailor the training plan. Focus on the athlete's slowest stations and running splits relative to their target.`;
    }

    // Call AI to generate plan
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
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(`AI service error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("Empty AI response");

    // Parse JSON (strip any accidental markdown)
    const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let planData;
    try {
      planData = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI JSON:", cleaned.substring(0, 500));
      throw new Error("AI returned invalid plan format. Please try again.");
    }

    // Validate
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
      .insert({ plan_id: plan.id, version_number: 1, created_by: user.id, notes: "AI-generated from athlete profile" })
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
