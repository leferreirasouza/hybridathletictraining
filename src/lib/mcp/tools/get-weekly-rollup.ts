import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface Bucket {
  sessions: number;
  hours: number;
  km: number;
  hrSum: number;
  hrCount: number;
}

export default defineTool({
  name: "get_weekly_rollup",
  title: "Get weekly training rollup per discipline",
  description:
    "Summarise the signed-in athlete's logged training over a trailing number of weeks: sessions, hours, kilometres and average heart rate per discipline, plus hours per week.",
  inputSchema: {
    weeks: z
      .number()
      .nullable()
      .describe("Number of trailing weeks to summarise (1-26). Defaults to 4."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input: { weeks?: number }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const weeks = Math.min(26, Math.max(1, Math.round(Number(input?.weeks) || 4)));
    const since = new Date(Date.now() - weeks * 7 * 86400000).toISOString().slice(0, 10);

    const { data, error } = await supabaseForUser(ctx)
      .from("completed_sessions")
      .select("date, discipline, actual_duration_min, actual_distance_km, avg_hr, source")
      .eq("athlete_id", ctx.getUserId())
      .gte("date", since)
      .order("date", { ascending: false });

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data || data.length === 0) {
      return { content: [{ type: "text", text: `No logged sessions in the last ${weeks} weeks.` }] };
    }

    const byDiscipline = new Map<string, Bucket>();
    let totalHours = 0;
    for (const s of data as Record<string, unknown>[]) {
      const key = String(s.discipline ?? "custom");
      const b = byDiscipline.get(key) ?? { sessions: 0, hours: 0, km: 0, hrSum: 0, hrCount: 0 };
      const minutes = Number(s.actual_duration_min ?? 0) || 0;
      b.sessions++;
      b.hours += minutes / 60;
      b.km += Number(s.actual_distance_km ?? 0) || 0;
      if (s.avg_hr) {
        b.hrSum += Number(s.avg_hr);
        b.hrCount++;
      }
      byDiscipline.set(key, b);
      totalHours += minutes / 60;
    }

    const rows = [...byDiscipline.entries()]
      .sort((a, b) => b[1].hours - a[1].hours)
      .map(([discipline, b]) => ({
        discipline,
        sessions: b.sessions,
        hours: Math.round(b.hours * 10) / 10,
        km: Math.round(b.km * 10) / 10,
        avgHr: b.hrCount > 0 ? Math.round(b.hrSum / b.hrCount) : null,
      }));

    const text =
      `Trailing ${weeks}-week rollup (${data.length} sessions, ${Math.round(totalHours * 10) / 10} h total, ` +
      `${Math.round((totalHours / weeks) * 10) / 10} h/week):\n` +
      rows
        .map(
          (r) =>
            `- ${r.discipline}: ${r.sessions} sessions | ${r.hours} h | ${r.km} km${r.avgHr ? ` | avg HR ${r.avgHr}` : ""}`,
        )
        .join("\n");

    return {
      content: [{ type: "text", text }],
      structuredContent: {
        weeks,
        totalSessions: data.length,
        totalHours: Math.round(totalHours * 10) / 10,
        hoursPerWeek: Math.round((totalHours / weeks) * 10) / 10,
        disciplines: rows,
      },
    };
  },
});
