// Required secrets (set in Project Settings → Edge Functions → Secrets):
//   LOVABLE_API_KEY      — auto-provisioned by Lovable Cloud
//   STRAVA_CLIENT_ID     — from strava.com/settings/api
//   STRAVA_CLIENT_SECRET — from strava.com/settings/api
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tsbAdjustmentFactor } from "../_shared/interferenceRules.ts";
import { decomposeRace, describeDecomposition, divisionKeyOf, isRelayKey } from "../_shared/raceDecomposition.ts";
import { formatNewSince, NEW_SINCE_LIMIT, type NewSinceItem } from "../_shared/newSince.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LEGAL_DISCLAIMER = `

---
⚠️ **Disclaimer**: This AI coaching advice is for informational and educational purposes only. It does not constitute medical, physiological, or professional health advice. Always consult a qualified healthcare professional before starting or modifying any training program. The AI coach may make errors — training decisions should be validated by a certified human coach. Hybrid Athletic Training accepts no liability for injuries, health issues, or adverse outcomes resulting from following AI-generated recommendations.`;

const GENERIC_PROMPT = `You are the HYROX Coach AI — an expert assistant for HYROX athletes and coaches. You have deep knowledge of the HYROX race format, training periodization, HR zone training, strength programming for HYROX, recovery, race strategy, and pacing. Be concise and actionable. Never give medical advice. Use conservative progression principles.`;

/**
 * Plain-language note for completed_sessions/strava_activities.data_flags
 * (see _shared/activityQuality.ts), so the coach doesn't read treadmill
 * distance or a strap spike as measured fact.
 */
function qualityNote(flags: string[] | null | undefined): string {
  const f = flags ?? [];
  const notes: string[] = [];
  if (f.includes("race")) notes.push("race");
  if (f.includes("distance_estimated")) notes.push("indoor, distance/pace estimated");
  if (f.includes("hr_artifact")) notes.push("HR unreliable");
  else if (f.includes("max_hr_artifact")) notes.push("max HR is a sensor spike");
  return notes.length ? ` [${notes.join("; ")}]` : "";
}

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

    // --- Conversation memory: one coach thread per user, user turns only ---
    // The client sends the whole conversation each time; only its newest user
    // turn is stored. Stored turns drive the hourly limit below and the
    // "new since your last conversation" context. Failures are logged and
    // never block the chat.
    let threadId: string | null = null;
    let prevUserAt: string | null = null;
    try {
      const { data: thread, error: threadErr } = await serviceClient
        .from("ai_threads")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (threadErr) throw threadErr;
      if (thread?.id) {
        threadId = thread.id;
        const { data: last, error: lastErr } = await serviceClient
          .from("ai_messages")
          .select("created_at")
          .eq("thread_id", threadId)
          .eq("role", "user")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastErr) throw lastErr;
        prevUserAt = (last as any)?.created_at ?? null;
      } else {
        const { data: created, error: createErr } = await serviceClient
          .from("ai_threads")
          .insert({ user_id: userId, title: "AI coach" })
          .select("id")
          .single();
        if (createErr) throw createErr;
        threadId = (created as any).id;
      }
    } catch (threadErr) {
      console.error("AI coach thread lookup/create failed (non-fatal):", threadErr);
    }

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

    const latestUserTurn = [...messages].reverse().find((m: any) => m.role === "user");
    if (threadId && latestUserTurn) {
      const { error: msgErr } = await serviceClient
        .from("ai_messages")
        .insert({ thread_id: threadId, role: "user", content: latestUserTurn.content });
      if (msgErr) console.error("ai_messages insert failed (rate limit + new-since depend on it):", msgErr);
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
        .select("date, discipline, actual_distance_km, rpe, notes, data_flags, planned_sessions(session_name)")
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
        ? recent.map((s: any) => `- ${s.date}: ${s.planned_sessions?.session_name || s.discipline} (${s.discipline}${s.actual_distance_km ? `, ${s.actual_distance_km}km` : ""}${s.rpe ? `, RPE ${s.rpe}` : ""})${qualityNote(s.data_flags)}${s.notes ? ` — ${s.notes}` : ""}`).join("\n")
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
          "id, start_date_local, sport_type, name, discipline, distance_m, duration_sec, avg_hr, max_hr, avg_pace_min_per_km, completed_session_id, data_flags, duplicate_of, raw",
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

      // A second recording of the same effort adds nothing for the coach.
      const distinctActs = (acts ?? []).filter((a: any) => !a.duplicate_of);
      if (distinctActs.length > 0) {
        const lines = distinctActs.map((a: any) => {
          const km = a.distance_m ? `${(Number(a.distance_m) / 1000).toFixed(1)}km` : "—";
          const min = a.duration_sec ? `${Math.round(Number(a.duration_sec) / 60)}min` : "—";
          const hr = a.avg_hr ? ` | HR ${a.avg_hr}${a.max_hr ? `/${a.max_hr}` : ""}` : "";
          let link = "not logged";
          if (a.completed_session_id) {
            link = plannedByCompletion.get(a.completed_session_id)
              ? "matched a planned session"
              : "logged as unplanned";
          }
          return `- ${String(a.start_date_local ?? "").slice(0, 10)}: ${a.discipline ?? a.sport_type} | ${km} | ${min}${hr}${fmtPace(a.avg_pace_min_per_km)} | ${link}${qualityNote(a.data_flags)}`;
        });
        sections.push(`SYNCED ACTIVITIES (last 14 days):\n${lines.join("\n")}`);
      }

      // Trailing 4-week rollup per discipline, from logged completions.
      const { data: comps } = await serviceClient
        .from("completed_sessions")
        .select("date, discipline, actual_duration_min, actual_distance_km, avg_hr, data_flags")
        .eq("athlete_id", userId)
        .gte("date", isoDay(since28));

      if (comps && comps.length > 0) {
        const buckets = new Map<string, { n: number; h: number; km: number; estKm: number; hrSum: number; hrN: number }>();
        let totalHours = 0;
        for (const c of comps as any[]) {
          const key = c.discipline ?? "custom";
          const b = buckets.get(key) ?? { n: 0, h: 0, km: 0, estKm: 0, hrSum: 0, hrN: 0 };
          const minutes = Number(c.actual_duration_min ?? 0) || 0;
          const flags: string[] = c.data_flags ?? [];
          const km = Number(c.actual_distance_km ?? 0) || 0;
          b.n++;
          b.h += minutes / 60;
          // Indoor bike "km" is a trainer estimate, not distance — never summed.
          // Treadmill run km stays (trend-useful) but is reported separately.
          if (flags.includes("distance_estimated")) {
            if (key !== "bike") {
              b.km += km;
              b.estKm += km;
            }
          } else {
            b.km += km;
          }
          if (c.avg_hr && !flags.includes("hr_artifact")) {
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
              `- ${d}: ${b.n} sessions | ${(Math.round(b.h * 10) / 10)} h | ${(Math.round(b.km * 10) / 10)} km${b.estKm > 0 ? ` (${Math.round(b.estKm * 10) / 10} km indoor-estimated)` : ""}${b.hrN > 0 ? ` | avg HR ${Math.round(b.hrSum / b.hrN)}` : ""}`,
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

    // --- Training load trend + race PBs ---
    // The 4-week rollup above is an activity summary, not a fitness/fatigue
    // trend or a race-history record — neither reached this prompt before.
    let loadContext = "";
    try {
      const { data: loadRows } = await serviceClient
        .from("training_load_daily")
        .select("date, ctl, atl, tsb")
        .eq("athlete_id", userId)
        .order("date", { ascending: false })
        .limit(14);

      if (loadRows && loadRows.length > 0) {
        // Mirrors the band thresholds in _shared/interferenceRules.ts's
        // tsbAdjustmentFactor and src/hooks/useTrainingLoad.ts's
        // fatigueRiskFromTsb, so the band name matches what the dashboard shows.
        const bandOf = (tsb: number): string => {
          if (tsb >= 5) return "fresh";
          if (tsb >= -10) return "neutral";
          if (tsb >= -20) return "fatigued";
          return "high_risk";
        };
        const latest = loadRows[0];
        const latestBand = bandOf(Number(latest.tsb));
        let daysInBand = 0;
        for (const row of loadRows) {
          if (bandOf(Number(row.tsb)) !== latestBand) break;
          daysInBand++;
        }
        const adj = tsbAdjustmentFactor(Number(latest.tsb));
        loadContext = `\n\n---\nTRAINING LOAD (as of ${latest.date}):\nCTL (fitness) ${Number(latest.ctl).toFixed(1)} | ATL (fatigue) ${Number(latest.atl).toFixed(1)} | TSB (form) ${Number(latest.tsb).toFixed(1)}\nForm band: ${latestBand}, for ${daysInBand} of the last ${loadRows.length} day(s) with data\n${adj.directive}`;
      }

      const { data: races } = await serviceClient
        .from("race_results")
        .select("*")
        .eq("athlete_id", userId)
        .not("total_time_seconds", "is", null)
        .order("race_date", { ascending: false });
      // Goal rows are targets, not results.
      const results = ((races ?? []) as any[]).filter((r) => r.input_method !== "goal");

      if (results.length > 0) {
        const fmtRaceTime = (s: number) => {
          const h = Math.floor(s / 3600);
          const m = Math.floor((s % 3600) / 60);
          const sec = s % 60;
          return `${h > 0 ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(sec).padStart(2, "0")}`;
        };
        // Bests are per division: a doubles or relay time is a team result
        // and must never read as a singles PB.
        const byDivision = new Map<string, any[]>();
        for (const r of results) {
          const key = divisionKeyOf(r) ?? "unspecified";
          byDivision.set(key, [...(byDivision.get(key) ?? []), r]);
        }
        const lines = [...byDivision.entries()].map(([key, rs]) => {
          const best = rs.reduce((b, r) => (r.total_time_seconds < b.total_time_seconds ? r : b), rs[0]);
          const recent = rs[0];
          let line = `- ${key.replace(/_/g, " ")}${isRelayKey(key) ? " (relay — team time)" : ""}: best ${fmtRaceTime(best.total_time_seconds)} at "${best.race_name ?? "unnamed race"}" on ${best.race_date}`;
          if (recent.id !== best.id) {
            line += `; most recent ${fmtRaceTime(recent.total_time_seconds)} on ${recent.race_date}`;
          }
          return line + ` (${rs.length} race${rs.length === 1 ? "" : "s"})`;
        });
        let raceBlock = `\n\n---\nRACE HISTORY (${results.length} results, by division — compare races only within a division):\n${lines.join("\n")}`;
        const latest = results[0];
        const breakdown = describeDecomposition(decomposeRace(latest, results));
        if (breakdown) {
          raceBlock += `\nLatest race breakdown (${latest.race_date}, ${String(divisionKeyOf(latest) ?? "").replace(/_/g, " ")}):\n${breakdown}`;
        }
        loadContext += raceBlock;
      }
    } catch (loadErr) {
      console.error("Training load / race history context (non-fatal):", loadErr);
    }

    // --- What happened since the athlete's previous message ---
    let newSinceContext = "";
    if (prevUserAt) {
      try {
        const [{ data: fresh, count: freshCount }, { data: manual, count: manualCount }] = await Promise.all([
          serviceClient
            .from("strava_activities")
            .select("start_date_local, discipline, sport_type, duration_sec, distance_m, data_flags", { count: "exact" })
            .eq("user_id", userId)
            .eq("ignored", false)
            .is("duplicate_of", null)
            .gt("created_at", prevUserAt)
            .order("start_date_local", { ascending: false })
            .limit(NEW_SINCE_LIMIT),
          serviceClient
            .from("completed_sessions")
            .select("date, discipline, actual_duration_min, actual_distance_km", { count: "exact" })
            .eq("athlete_id", userId)
            .eq("source", "manual")
            .gt("completed_at", prevUserAt)
            .order("completed_at", { ascending: false })
            .limit(NEW_SINCE_LIMIT),
        ]);
        const items: NewSinceItem[] = [
          ...((fresh ?? []) as any[]).map((a) => ({
            date: String(a.start_date_local ?? "").slice(0, 10),
            discipline: a.discipline ?? a.sport_type ?? "activity",
            minutes: a.duration_sec ? Number(a.duration_sec) / 60 : null,
            km: a.distance_m ? Number(a.distance_m) / 1000 : null,
            source: "strava" as const,
            note: qualityNote(a.data_flags),
          })),
          ...((manual ?? []) as any[]).map((c) => ({
            date: String(c.date),
            discipline: c.discipline ?? "session",
            minutes: c.actual_duration_min != null ? Number(c.actual_duration_min) : null,
            km: c.actual_distance_km != null ? Number(c.actual_distance_km) : null,
            source: "manual" as const,
          })),
        ];
        const text = formatNewSince(prevUserAt, items, (freshCount ?? 0) + (manualCount ?? 0));
        if (text) newSinceContext = `\n\n---\n${text}`;
      } catch (newErr) {
        console.error("New-since context (non-fatal):", newErr);
      }
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

    const systemPrompt = basePrompt + APPEND_RULES + athleteContext + stravaContext + newSinceContext + loadContext + knowledgeContext;

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
