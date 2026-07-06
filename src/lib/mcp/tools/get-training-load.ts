import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function tsbBand(tsb: number): string {
  if (tsb > 15) return "very fresh";
  if (tsb > 5) return "fresh";
  if (tsb >= -10) return "neutral";
  if (tsb >= -25) return "fatigued";
  return "high injury risk";
}

export default defineTool({
  name: "get_training_load",
  title: "Get current training load (CTL/ATL/TSB)",
  description:
    "Return the athlete's most recent training-load snapshot: chronic training load (CTL), acute training load (ATL), training stress balance (TSB), and a fatigue band interpretation.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("training_load_daily")
      .select("date, ctl, atl, tsb, trimp")
      .eq("athlete_id", ctx.getUserId())
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) {
      return {
        content: [
          { type: "text", text: "No training-load data yet. Log a few sessions and the daily cron will populate CTL/ATL/TSB." },
        ],
      };
    }
    const band = tsbBand(data.tsb);
    const text =
      `Training load as of ${data.date}:\n` +
      `• CTL (fitness): ${data.ctl.toFixed(1)}\n` +
      `• ATL (fatigue): ${data.atl.toFixed(1)}\n` +
      `• TSB (form): ${data.tsb.toFixed(1)} — ${band}\n` +
      `• Today's TRIMP: ${data.trimp.toFixed(0)}`;
    return { content: [{ type: "text", text }], structuredContent: { ...data, band } };
  },
});
