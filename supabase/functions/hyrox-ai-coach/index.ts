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
    const body = await req.json().catch(() => null);
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    if (rawMessages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Keep only the most recent turns, and cap each message length.
    const messages = rawMessages
      .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Per-user abuse limit: 30 requests per rolling hour.
    try {
      const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: threads } = await serviceClient
        .from("ai_threads")
        .select("id")
        .eq("user_id", userId);
      if (threads && threads.length > 0) {
        const { count } = await serviceClient
          .from("ai_messages")
          .select("id", { count: "exact", head: true })
          .in("thread_id", threads.map((t: any) => t.id))
          .eq("role", "user")
          .gte("created_at", sinceIso);
        if ((count ?? 0) >= 30) {
          return new Response(
            JSON.stringify({
              error: "You've reached the hourly limit for AI coach messages. Please try again a bit later.",
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    } catch (rateErr) {
      console.error("Rate limit check failed (non-fatal):", rateErr);
    }

    // --- Base prompt + per-user coaching context + athlete context ---
    let basePrompt = GENERIC_PROMPT;
    let athleteContext = "";
    try {
      const { data: ctxRow } = await serviceClient
        .from("coach_context")
        .select("context_text")
        .eq("user_id", userId)
        .maybeSingle();
      const contextText = ((ctxRow as any)?.context_text ?? "").trim();
      if (contextText) {
        basePrompt = `${GENERIC_PROMPT}

--- ATHLETE-SPECIFIC COACHING CONTEXT (provided by this user) ---
${contextText.slice(0, 20000)}
--- END CONTEXT ---`;
      }

      const { data: profile } = await serviceClient
        .from("profiles")
        .select("age, weight_kg, goal_race_name, goal_race_date")
        .eq("id", userId)
        .single();

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

    // --- Synced activity context, read from the database only ---
    // No Strava tokens are read, refreshed or sent here: everything comes from
    // the rows the sync/webhook functions already persisted. The whole block is
    // capped so it cannot crowd out the rest of the prompt.
    const SYNCED_CONTEXT_CHAR_BUDGET = 3000;
    let stravaContext = "";
    try {
      const dayMs = 86400000;
      const isoDay = (d: Date) => d.toISOString().slice(0, 10);
      const today = new Date();
      const since14 = new Date(today.getTime() - 14 * dayMs);
      const since28 = new Date(today.getTime() - 28 * dayMs);
      // Monday-start current week
      const dowMon = (today.getUTCDay() + 6) % 7;
      const weekStart = new Date(today.getTime() - dowMon * dayMs);
      const weekEnd = new Date(weekStart.getTime() + 6 * dayMs);

      const fmtPace = (minPerKm: number | null | undefined) => {
        const v = Number(minPerKm ?? 0);
        if (!v || v <= 0) return "";
        const secs = Math.round(v * 60);
        return ` | ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}/km`;
      };

      const { data: acts } = await serviceClient
        .from("strava_activities")
        .select(
          "id, start_date_local, sport_type, name, discipline, distance_m, duration_sec, avg_hr, max_hr, avg_pace_min_per_km, completed_session_id, raw",
        )
        .eq("user_id", userId)
        .gte("start_date_local", since14.toISOString())
        .order("start_date_local", { ascending: false })
        .limit(40);

      const linkedIds = (acts ?? [])
        .map((a: any) => a.completed_session_id)
        .filter((v: any): v is string => Boolean(v));
      const plannedByCompletion = new Map<string, string | null>();
      if (linkedIds.length > 0) {
        const { data: linkedCompletions } = await serviceClient
          .from("completed_sessions")
          .select("id, planned_session_id")
          .in("id", linkedIds);
        for (const c of linkedCompletions ?? []) {
          plannedByCompletion.set(c.id, (c as any).planned_session_id ?? null);
        }
      }

      const sections: string[] = [];

      if (acts && acts.length > 0) {
        const lines = acts.map((a: any) => {
          const km = a.distance_m ? `${(Number(a.distance_m) / 1000).toFixed(1)}km` : "—";
          const min = a.duration_sec ? `${Math.round(Number(a.duration_sec) / 60)}min` : "—";
          const hr = a.avg_hr ? ` | HR ${a.avg_hr}${a.max_hr ? `/${a.max_hr}` : ""}` : "";
          let link = "not logged";
          if (a.completed_session_id) {
            link = plannedByCompletion.get(a.completed_session_id)
              ? "matched a planned session"
              : "logged as unplanned";
          }
          return `- ${String(a.start_date_local ?? "").slice(0, 10)}: ${a.discipline ?? a.sport_type} | ${km} | ${min}${hr}${fmtPace(a.avg_pace_min_per_km)} | ${link}`;
        });
        sections.push(`SYNCED ACTIVITIES (last 14 days):\n${lines.join("\n")}`);
      }

      // Trailing 4-week rollup per discipline, from logged completions.
      const { data: comps } = await serviceClient
        .from("completed_sessions")
        .select("date, discipline, actual_duration_min, actual_distance_km, avg_hr")
        .eq("athlete_id", userId)
        .gte("date", isoDay(since28));

      if (comps && comps.length > 0) {
        const buckets = new Map<string, { n: number; h: number; km: number; hrSum: number; hrN: number }>();
        let totalHours = 0;
        for (const c of comps as any[]) {
          const key = c.discipline ?? "custom";
          const b = buckets.get(key) ?? { n: 0, h: 0, km: 0, hrSum: 0, hrN: 0 };
          const minutes = Number(c.actual_duration_min ?? 0) || 0;
          b.n++;
          b.h += minutes / 60;
          b.km += Number(c.actual_distance_km ?? 0) || 0;
          if (c.avg_hr) {
            b.hrSum += Number(c.avg_hr);
            b.hrN++;
          }
          buckets.set(key, b);
          totalHours += minutes / 60;
        }
        const rows = [...buckets.entries()]
          .sort((a, b) => b[1].h - a[1].h)
          .map(
            ([d, b]) =>
              `- ${d}: ${b.n} sessions | ${(Math.round(b.h * 10) / 10)} h | ${(Math.round(b.km * 10) / 10)} km${b.hrN > 0 ? ` | avg HR ${Math.round(b.hrSum / b.hrN)}` : ""}`,
          );
        sections.push(
          `TRAILING 4-WEEK ROLLUP (${(Math.round((totalHours / 4) * 10) / 10)} h/week):\n${rows.join("\n")}`,
        );
      }

      // Planned vs actual for the current week.
      const { data: weekPlanned } = await serviceClient
        .from("planned_sessions")
        .select("id, date, session_name, discipline, duration_min")
        .eq("athlete_id", userId)
        .gte("date", isoDay(weekStart))
        .lte("date", isoDay(weekEnd));

      if (weekPlanned && weekPlanned.length > 0) {
        const { data: weekDone } = await serviceClient
          .from("completed_sessions")
          .select("planned_session_id, discipline, date")
          .eq("athlete_id", userId)
          .gte("date", isoDay(weekStart))
          .lte("date", isoDay(weekEnd));
        const donePlanned = new Set(
          (weekDone ?? []).map((c: any) => c.planned_session_id).filter(Boolean),
        );
        const lines = (weekPlanned as any[]).map((p) => {
          const status = donePlanned.has(p.id) ? "done" : "missed";
          return `- ${p.date}: ${p.session_name || p.discipline} (${p.discipline}${p.duration_min ? `, ${p.duration_min} min` : ""}) — ${status}`;
        });
        sections.push(
          `THIS WEEK PLANNED VS ACTUAL (${donePlanned.size}/${weekPlanned.length} planned sessions done, ${(weekDone ?? []).length} sessions logged in total):\n${lines.join("\n")}`,
        );
      }

      // Compact lap summary for the 3 most recent activities that carry laps.
      const lapLines: string[] = [];
      for (const a of (acts ?? []).slice(0, 3) as any[]) {
        const laps = Array.isArray(a?.raw?.laps) ? a.raw.laps : null;
        if (!laps || laps.length === 0) continue;
        const paces: number[] = [];
        const hrs: number[] = [];
        for (const l of laps) {
          const speed = Number(l?.average_speed ?? 0);
          if (speed > 0) paces.push(1000 / speed / 60);
          if (l?.average_heartrate) hrs.push(Number(l.average_heartrate));
        }
        const paceRange = paces.length
          ? `pace ${fmtPace(Math.min(...paces)).replace(" | ", "")}–${fmtPace(Math.max(...paces)).replace(" | ", "")}`
          : "pace n/a";
        const hrRange = hrs.length
          ? `HR ${Math.round(Math.min(...hrs))}–${Math.round(Math.max(...hrs))}`
          : "HR n/a";
        lapLines.push(
          `- ${String(a.start_date_local ?? "").slice(0, 10)} ${a.discipline ?? a.sport_type}: ${laps.length} laps | ${paceRange} | ${hrRange}`,
        );
      }
      if (lapLines.length > 0) {
        sections.push(`LAP DETAIL (3 most recent):\n${lapLines.join("\n")}`);
      }

      if (sections.length > 0) {
        let assembled = "";
        for (const section of sections) {
          if (assembled.length + section.length + 2 > SYNCED_CONTEXT_CHAR_BUDGET) break;
          assembled += (assembled ? "\n\n" : "") + section;
        }
        stravaContext = `\n\n---\n${assembled}`;
      }
    } catch (stravaErr) {
      console.error("Synced activity context (non-fatal):", stravaErr);
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
