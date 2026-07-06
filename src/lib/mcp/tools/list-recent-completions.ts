import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_recent_completions",
  title: "List recent completed sessions",
  description:
    "List the signed-in athlete's most recently completed training sessions with actuals (duration, distance, HR, RPE).",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("How many recent completions to return (default 10, max 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const n = limit ?? 10;
    const { data, error } = await supabaseForUser(ctx)
      .from("completed_sessions")
      .select(
        "id, date, discipline, actual_duration_min, actual_distance_km, avg_hr, max_hr, avg_pace, rpe, soreness, pain_flag, notes",
      )
      .eq("athlete_id", ctx.getUserId())
      .order("date", { ascending: false })
      .limit(n);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    const text = rows.length
      ? rows
          .map(
            (s) =>
              `• ${s.date} — ${s.discipline}${s.actual_duration_min ? `, ${s.actual_duration_min} min` : ""}${
                s.actual_distance_km ? `, ${s.actual_distance_km} km` : ""
              }${s.avg_hr ? `, HR ${s.avg_hr}` : ""}${s.rpe ? `, RPE ${s.rpe}` : ""}${
                s.pain_flag ? " ⚠️ pain flag" : ""
              }`,
          )
          .join("\n")
      : "No completed sessions yet.";
    return {
      content: [{ type: "text", text }],
      structuredContent: { completions: rows },
    };
  },
});
