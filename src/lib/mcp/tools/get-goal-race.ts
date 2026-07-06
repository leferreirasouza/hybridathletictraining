import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_goal_race",
  title: "Get goal race",
  description:
    "Return the signed-in athlete's current HYROX goal race: name, date, location, target finish time, and days until race day.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("profiles")
      .select("full_name, goal_race_name, goal_race_date, goal_race_location, goal_finish_time_seconds")
      .eq("id", ctx.getUserId())
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data?.goal_race_date) {
      return { content: [{ type: "text", text: "No goal race set." }] };
    }
    const days = Math.ceil((new Date(data.goal_race_date).getTime() - Date.now()) / 86400000);
    const targetHms = data.goal_finish_time_seconds
      ? new Date(data.goal_finish_time_seconds * 1000).toISOString().slice(11, 19)
      : null;
    const text =
      `Goal race for ${data.full_name}:\n` +
      `• ${data.goal_race_name ?? "HYROX"} — ${data.goal_race_date}${
        data.goal_race_location ? ` (${data.goal_race_location})` : ""
      }\n` +
      `• ${days > 0 ? `${days} days to go` : days === 0 ? "Race day!" : `${-days} days since race`}` +
      (targetHms ? `\n• Target finish: ${targetHms}` : "");
    return { content: [{ type: "text", text }], structuredContent: { ...data, daysUntil: days } };
  },
});
