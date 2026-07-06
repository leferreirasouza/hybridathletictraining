import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_todays_session",
  title: "Get today's training session",
  description:
    "Return the signed-in athlete's planned training session(s) for today, including discipline, name, duration, distance, intensity, and workout details.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabaseForUser(ctx)
      .from("planned_sessions")
      .select(
        "id, date, discipline, session_name, duration_min, distance_km, intensity, workout_details, notes, order_index",
      )
      .eq("athlete_id", ctx.getUserId())
      .eq("date", today)
      .order("order_index");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    const text = rows.length
      ? `Found ${rows.length} session(s) for ${today}:\n\n` +
        rows
          .map(
            (s) =>
              `• ${s.session_name} (${s.discipline}) — ${s.duration_min ?? "?"} min${
                s.distance_km ? `, ${s.distance_km} km` : ""
              }${s.intensity ? `, ${s.intensity}` : ""}${
                s.workout_details ? `\n  ${s.workout_details}` : ""
              }`,
          )
          .join("\n")
      : `No planned sessions for ${today}.`;
    return {
      content: [{ type: "text", text }],
      structuredContent: { date: today, sessions: rows },
    };
  },
});
