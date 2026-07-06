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
  name: "list_upcoming_sessions",
  title: "List upcoming training sessions",
  description:
    "List the signed-in athlete's planned sessions from today through the next N days (default 7, max 60).",
  inputSchema: {
    days: z.number().int().min(1).max(60).optional().describe("How many days ahead to include. Defaults to 7."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const window = days ?? 7;
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + window);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const { data, error } = await supabaseForUser(ctx)
      .from("planned_sessions")
      .select("id, date, discipline, session_name, duration_min, distance_km, intensity, order_index")
      .eq("athlete_id", ctx.getUserId())
      .gte("date", startStr)
      .lte("date", endStr)
      .order("date")
      .order("order_index");

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    const text = rows.length
      ? `${rows.length} session(s) between ${startStr} and ${endStr}:\n\n` +
        rows
          .map(
            (s) =>
              `• ${s.date} — ${s.session_name} (${s.discipline})${
                s.duration_min ? `, ${s.duration_min} min` : ""
              }${s.distance_km ? `, ${s.distance_km} km` : ""}${s.intensity ? `, ${s.intensity}` : ""}`,
          )
          .join("\n")
      : `No planned sessions between ${startStr} and ${endStr}.`;
    return {
      content: [{ type: "text", text }],
      structuredContent: { start: startStr, end: endStr, sessions: rows },
    };
  },
});
