import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function paceLabel(secPerKm: number | null): string {
  if (!secPerKm || secPerKm <= 0) return "";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return ` | ${m}:${String(s).padStart(2, "0")}/km`;
}

export default defineTool({
  name: "list_strava_activities",
  title: "List synced Strava activities",
  description:
    "Return the signed-in athlete's Strava activities synced into the app over a recent window, optionally filtered to one discipline (run, bike, rowing, strength, mobility, hyrox_station, custom).",
  inputSchema: {
    type: "object",
    properties: {
      days: {
        type: "number",
        description: "Size of the look-back window in days (1-180). Defaults to 14.",
      },
      discipline: {
        type: ["string", "null"],
        description: "Optional discipline filter, e.g. run or bike. Null returns every discipline.",
      },
    },
    required: ["days", "discipline"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input: { days?: number; discipline?: string | null }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const days = Math.min(180, Math.max(1, Math.round(Number(input?.days) || 14)));
    const since = new Date(Date.now() - days * 86400000).toISOString();

    let query = supabaseForUser(ctx)
      .from("strava_activities")
      .select(
        "start_date_local, sport_type, name, discipline, distance_m, duration_sec, avg_hr, max_hr, avg_pace_min_per_km, completed_session_id",
      )
      .eq("user_id", ctx.getUserId())
      .gte("start_date_local", since)
      .order("start_date_local", { ascending: false })
      .limit(100);

    if (input?.discipline) query = query.eq("discipline", input.discipline);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data || data.length === 0) {
      return {
        content: [{ type: "text", text: `No synced Strava activities in the last ${days} days.` }],
      };
    }

    const lines = data.map((a: Record<string, unknown>) => {
      const date = String(a.start_date_local ?? "").slice(0, 10);
      const km = a.distance_m ? `${(Number(a.distance_m) / 1000).toFixed(1)}km` : "—";
      const min = a.duration_sec ? `${Math.round(Number(a.duration_sec) / 60)}min` : "—";
      const hr = a.avg_hr ? ` | avg HR ${a.avg_hr}${a.max_hr ? `/max ${a.max_hr}` : ""}` : "";
      const pace = paceLabel(a.avg_pace_min_per_km ? Number(a.avg_pace_min_per_km) * 60 : null);
      const matched = a.completed_session_id ? " | logged" : " | not logged";
      return `- ${date}: ${a.discipline ?? a.sport_type} "${a.name ?? ""}" | ${km} | ${min}${hr}${pace}${matched}`;
    });

    return {
      content: [{ type: "text", text: `Strava activities (last ${days} days):\n${lines.join("\n")}` }],
      structuredContent: { days, count: data.length, activities: data },
    };
  },
});
