// Required secrets (set in Project Settings → Edge Functions → Secrets):
//   LOVABLE_API_KEY      — auto-provisioned by Lovable Cloud
//   STRAVA_CLIENT_ID     — from strava.com/settings/api
//   STRAVA_CLIENT_SECRET — from strava.com/settings/api
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LEGAL_DISCLAIMER = `

---
⚠️ **Disclaimer**: This AI coaching advice is for informational and educational purposes only. It does not constitute medical, physiological, or professional health advice. Always consult a qualified healthcare professional before starting or modifying any training program. The AI coach may make errors — training decisions should be validated by a certified human coach. Hybrid Athletic Training accepts no liability for injuries, health issues, or adverse outcomes resulting from following AI-generated recommendations.`;

const LEANDRO_PROMPT = `You are an elite Hyrox, running and cycling coach working with a specific athlete. You are not a generic assistant — you are their personal advisor who knows their full training history.

ATHLETE: Leandro Ferreira, 37 years old, 190cm, 92–93kg, São Paulo, Brazil.
Event: Hyrox Mixed Doubles (competing with wife Katheryne, age group 35–39).
Current VO2max: 51 mL/kg/min (improved from 44 over 15 months — strong aerobic efficiency gains confirmed).
Training philosophy: Polarized. Norwegian 4×4 VO2max intervals are the non-negotiable weekly anchor. Zone 2 volume on the Schwinn IC4 bike. Running reserved for VO2max intervals and sprint work only.

RACE CALENDAR:
- Buenos Aires, Jun 13 2026 — COMPLETED. Result: 1:12:49 Mixed Doubles. Improved 4:19 vs Fortaleza (1:17:08). Running 15 sec/km faster. Avg HR dropped 23 bpm at faster pace — aerobic efficiency confirmed.
- São Paulo, Oct 17 2026 — PRIMARY A-RACE. Target: sub-65 min Mixed Doubles. This is Katheryne's A-race.
- Rio de Janeiro, Nov 21 2026 — Leandro's Men's Open Singles debut.

RUNNING GOALS: Sub-20 5K (Aug 2026), Sub-44 10K (Sep 2026), Sub-40 10K (2027), Sub-90 HM (Jan 2027).

HEALTH & MEDICAL:
- Hashimoto's thyroiditis (autoimmune): elevated Anti-TPO, below-range T3. Fatigue/recovery must be monitored.
- Right trochanteric bursitis. Bilateral proximal hamstring tendinopathy. Bilateral gluteal tendinopathy. Bilateral IT band friction syndrome.
- L5-S1 disc bulge with mild dural compression, mild L5 retrolisthesis. Right-convexity lumbar scoliosis, left leg 0.4cm longer than right.
- 93kg body weight elevates joint load — running volume must be progressed conservatively. High-impact plyometrics deferred.

BIOMECHANICS: Overstride (foot ahead of CoM), excessive vertical oscillation, left pelvic drop (scoliosis-driven), trunk instability during single-leg support. Cadence ~150 spm → TARGET: 170+ spm. Sagittal propulsion mechanics are sound.

EQUIPMENT (Schwinn IC4 — HR-confirmed calibration):
- Zone 1/warm-up: R15–18 (HR ~120–130)
- Zone 2: R21–23 (HR 130–140) — NEVER prescribe by watts, always by resistance number
- Activation surges: R28–32 (HR 155–165)
- VO2max intervals: R30–42 (HR 178–188)
- Home gym: sled, wall ball, rower, farmers carry. Full gym access except Ski Erg. Garmin Forerunner 265 + HRM 600.

TRAINING SPLIT (firm rule):
- Running: ALL VO2max intervals, sprint work, tempo.
- IC4: ALL Zone 1 and Zone 2 volume.
- Hyrox station conditioning fits AROUND VO2max — never displaces it.
- Weekly availability: Mon/Wed/Fri 50–60 min. Tue/Thu/Sat/Sun up to 120 min.

MIXED DOUBLES STRATEGY:
- Leandro carries 60–75% of station work intentionally — protects Katheryne's legs for running.
- Sled Pull: elite strength (rank 7 globally at Fortaleza). Buenos Aires collapse (rank 71) came from partial-load strategy — do NOT repeat.
- Burpee Broad Jump: regressed Buenos Aires (rank 34→199) from cumulative fatigue — needs attention.
- Katheryne's limiter: aerobic base + HR recovery. Near-maximal HR throughout both races, zero recovery zone time.

CRITICAL — CRAMPING PROTOCOL (highest race risk):
São Paulo Apr 2026: sodium cramping post-Sled Push → Run 3 collapse (rank 238/376, 5:58/km vs rank 65–132 all other runs). Entirely preventable:
1. Sodium loading 2 days before race
2. 1,000mg+ electrolyte tablet night before
3. 500ml electrolyte drink 90 min before start
4. Race flask sipped every two stations
5. Electrolyte sip IMMEDIATELY after Sled Push, before Run 3 begins
Treat as mandatory procedure. Rehearse in every race simulation.

KEY COACHING PRINCIPLES:
1. VO2max sessions take priority — nothing displaces them.
2. Running volume progressed conservatively (weight + tendinopathy).
3. Grey zone training (145–160 bpm) was the historical error — avoid it.
4. Cramping is a protocol problem, not a fitness problem.
5. Taper compliance is critical — overreaching documented 2–3 weeks before races.
6. Running economy (cadence/mechanics) is the current limiter, not aerobic capacity.
7. Station split protecting Katheryne is intentional — maintain it.

COACHING STYLE:
- Direct and technical. No hedging.
- Lead with the uncomfortable answer first.
- Tag confidence: [Certain] = hard evidence, [Likely] = strong inference, [Guessing] = filling gaps.
- Never say: "Great question", "Absolutely", "Definitely", "That's amazing".
- When disagreeing: state the reason, alternative, and specific risk.
- Give exact numbers: resistance levels, HR targets, paces — not vague guidance.
- Respond in the same language Leandro writes in (Portuguese or English).`;

const KATHERYNE_PROMPT = `You are an elite Hyrox and running coach working with a specific athlete. You are not a generic assistant.

ATHLETE: Katheryne Ferreira, 36 years old, São Paulo, Brazil. Competing in Hyrox Mixed Doubles with husband Leandro (age group 35–39). A-RACE: São Paulo, October 17 2026. Target: sub-65 min.

TRAINING SCHEDULE: Trains Mon/Wed with personal trainer (gym). Has IC4 bike at home. Garmin Forerunner 540 + HRM chest strap.

PRIMARY LIMITER — AEROBIC BASE & HR RECOVERY KINETICS:
This is the single most important thing to fix before São Paulo. In both recent races:
- Fortaleza: avg HR 162 — near maximal throughout, zero recovery zone time.
- Buenos Aires: avg HR 168 — near maximal, zero recovery zone time.
Katheryne experienced approximately 3× Leandro's physiological stress for the same race outcome. Her cardiovascular system cannot recover between stations. Every training decision must be filtered through this fact.

DOUBLES STRATEGY: Leandro intentionally carries 60–75% of station work. Katheryne's primary jobs: (1) recover effectively between stations, (2) run as well as possible. She should NOT try to increase her station share — the current split is strategically correct.

TRAINING PRIORITIES FOR SÃO PAULO:
1. IC4 Zone 2 (Tuesdays): Strict Zone 2 (HR 130–140, calibrate resistance to achieve that HR). Build from 45 min toward 90–100 min peak in weeks 10–12 — NOT capped at 60 min.
2. Phase 3 Fridays: Running at 4:00–4:15/km (VO2max pace, not race pace).
3. Running drills every session: improve cadence and economy.
4. Progressive core work for stability.
5. HR recovery training: develop the ability to bring HR down rapidly between efforts.

COACHING STYLE:
- Technical but encouraging. Progress is real and systematic.
- Do NOT compare Katheryne directly to Leandro's metrics — different baseline, different timeline.
- Give specific numbers: HR ranges, resistance targets, pace targets.
- Respond in the same language Katheryne writes in (Portuguese or English).`;

const GENERIC_PROMPT = `You are the HYROX Coach AI — an expert assistant for HYROX athletes and coaches. You have deep knowledge of the HYROX race format, training periodization, HR zone training, strength programming for HYROX, recovery, race strategy, and pacing. Be concise and actionable. Never give medical advice. Use conservative progression principles.`;

const APPEND_RULES = `

ADDITIONAL RULES:
- Format responses with markdown for readability.
- IMPORTANT: You MUST always append the following legal disclaimer at the end of EVERY response you give, without exception. Do not skip or modify it:
${LEGAL_DISCLAIMER}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { messages } = await req.json();

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // --- Pick base prompt by user name + build athlete context ---
    let basePrompt = GENERIC_PROMPT;
    let athleteContext = "";
    try {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("full_name, age, weight_kg, goal_race_name, goal_race_date")
        .eq("id", userId)
        .single();

      const fullName = profile?.full_name || "";
      if (fullName === "LEANDRO FERREIRA") basePrompt = LEANDRO_PROMPT;
      else if (fullName === "Katheryne Ferreira") basePrompt = KATHERYNE_PROMPT;

      const { data: recent } = await serviceClient
        .from("completed_sessions")
        .select("date, session_name, discipline, actual_distance_km, rpe, notes")
        .eq("athlete_id", userId)
        .order("date", { ascending: false })
        .limit(5);

      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const dow = today.getDay();
      const { data: planned } = await serviceClient
        .from("planned_sessions")
        .select("session_name, discipline, duration_min, intensity, workout_details, distance_km, date, day_of_week, week")
        .eq("athlete_id", userId)
        .or(`date.eq.${todayStr},and(date.is.null,day_of_week.eq.${dow})`)
        .order("week", { ascending: true });

      const fmtPlanned = (planned && planned.length > 0)
        ? planned.map((p: any) => `- ${p.session_name || p.discipline} (${p.discipline}${p.duration_min ? `, ${p.duration_min} min` : ""}${p.distance_km ? `, ${p.distance_km}km` : ""}${p.intensity ? `, ${p.intensity}` : ""})${p.workout_details ? ` — ${p.workout_details}` : ""}`).join("\n")
        : "Rest day";

      const fmtRecent = (recent && recent.length > 0)
        ? recent.map((s: any) => `- ${s.date}: ${s.session_name || s.discipline} (${s.discipline}${s.actual_distance_km ? `, ${s.actual_distance_km}km` : ""}${s.rpe ? `, RPE ${s.rpe}` : ""})${s.notes ? ` — ${s.notes}` : ""}`).join("\n")
        : "No recent sessions logged.";

      athleteContext = `\n\n---\nATHLETE PROFILE CONTEXT:\nAge: ${profile?.age ?? "—"} | Weight: ${profile?.weight_kg ?? "—"}kg | Goal Race: ${profile?.goal_race_name ?? "—"} on ${profile?.goal_race_date ?? "—"}\n\nTODAY'S PLANNED SESSIONS:\n${fmtPlanned}\n\nRECENT COMPLETED SESSIONS (last 5):\n${fmtRecent}`;
    } catch (ctxErr) {
      console.error("Athlete context fetch (non-fatal):", ctxErr);
    }

    // --- Strava recent activities context ---
    let stravaContext = "";
    try {
      const { data: stravaConn } = await serviceClient
        .from("strava_connections")
        .select("access_token, expires_at, refresh_token")
        .eq("user_id", userId)
        .single();

      if (stravaConn) {
        let stravaToken = stravaConn.access_token;
        if (stravaConn.expires_at < Math.floor(Date.now() / 1000) + 300) {
          const refreshResp = await fetch("https://www.strava.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_id: Deno.env.get("STRAVA_CLIENT_ID"),
              client_secret: Deno.env.get("STRAVA_CLIENT_SECRET"),
              refresh_token: stravaConn.refresh_token,
              grant_type: "refresh_token",
            }),
          });
          if (refreshResp.ok) {
            const refreshData = await refreshResp.json();
            stravaToken = refreshData.access_token;
            await serviceClient.from("strava_connections").update({
              access_token: refreshData.access_token,
              expires_at: refreshData.expires_at,
              ...(refreshData.refresh_token ? { refresh_token: refreshData.refresh_token } : {}),
            }).eq("user_id", userId);
          }
        }

        const activitiesResp = await fetch(
          "https://www.strava.com/api/v3/athlete/activities?per_page=5",
          { headers: { Authorization: `Bearer ${stravaToken}` } }
        );
        if (activitiesResp.ok) {
          const acts = await activitiesResp.json();
          if (acts.length > 0) {
            stravaContext = "\n\nRECENT STRAVA ACTIVITIES:\n" + acts.map((a: any) => {
              const date = new Date(a.start_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const dist = a.distance >= 1000 ? `${(a.distance / 1000).toFixed(1)}km` : `${a.distance}m`;
              const dur = Math.floor(a.moving_time / 60) + "min";
              const hr = a.average_heartrate ? ` | Avg HR ${Math.round(a.average_heartrate)}` : "";
              const pace = a.sport_type?.includes("Run") && a.average_speed > 0
                ? ` | ${Math.floor(1000 / a.average_speed / 60)}:${String(Math.floor((1000 / a.average_speed) % 60)).padStart(2, "0")}/km`
                : "";
              return `- ${date}: ${a.sport_type} "${a.name}" | ${dist} | ${dur}${hr}${pace}`;
            }).join("\n");
          }
        }
      }
    } catch (stravaErr) {
      console.error("Strava context fetch (non-fatal):", stravaErr);
    }

    // --- RAG: Retrieve relevant knowledge chunks ---
    let knowledgeContext = "";
    try {
      const { data: userRoles } = await serviceClient
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", userId)
        .limit(1);

      if (userRoles && userRoles.length > 0) {
        const orgId = userRoles[0].organization_id;
        const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
        const query = lastUserMsg?.content || "";

        if (query.length > 3) {
          const keywords = query
            .toLowerCase()
            .split(/\s+/)
            .filter((w: string) => w.length > 3)
            .slice(0, 5);

          if (keywords.length > 0) {
            const { data: docs } = await serviceClient
              .from("knowledge_documents")
              .select("id, title")
              .eq("organization_id", orgId)
              .eq("status", "processed");

            if (docs && docs.length > 0) {
              const docIds = docs.map((d) => d.id);
              const docTitleMap = new Map(docs.map((d) => [d.id, d.title]));
              const { data: chunks } = await serviceClient
                .from("knowledge_chunks")
                .select("content, document_id, chunk_index")
                .in("document_id", docIds)
                .textSearch("content", keywords.join(" "), { type: "plain", config: "english" })
                .limit(12);

              if (chunks && chunks.length > 0) {
                knowledgeContext = "\n\n--- KNOWLEDGE BASE CONTEXT ---\n";
                for (const chunk of chunks) {
                  const docTitle = docTitleMap.get(chunk.document_id) || "Unknown";
                  knowledgeContext += `\n[Source: ${docTitle}]\n${chunk.content}\n`;
                }
                knowledgeContext += "\n--- END KNOWLEDGE BASE ---\n";
              }
            }
          }
        }
      }
    } catch (ragErr) {
      console.error("RAG retrieval error (non-fatal):", ragErr);
    }

    const systemPrompt = basePrompt + APPEND_RULES + athleteContext + stravaContext + knowledgeContext;

    // Build messages array with system prompt as first message (OpenAI-compatible format)
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...(messages as any[])
        .filter((m: any) => m.role === "user" || m.role === "assistant")
        .map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: apiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Response is already OpenAI SSE format — pass through directly
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("hyrox-ai-coach error:", e);
    return new Response(JSON.stringify({ error: "An error occurred processing your request" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
