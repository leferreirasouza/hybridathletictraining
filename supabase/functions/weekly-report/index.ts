import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { weekData, athleteName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `You are a HYROX training coach reviewing an athlete's weekly training report. Provide a brief, encouraging yet honest 3-4 sentence commentary.

Athlete: ${athleteName || "Athlete"}
Week ${weekData.weekNumber} Summary:
- Completion: ${weekData.completedCount}/${weekData.plannedCount} sessions (${weekData.completionPct}%)
- Total duration: ${weekData.totalDurationMin || 0} min | Total distance: ${weekData.totalDistanceKm || 0} km
- Average RPE: ${weekData.avgRpe || "N/A"} | Average HR: ${weekData.avgHr || "N/A"} bpm
- Pain flags: ${weekData.painFlags || 0}
- Session swaps: ${weekData.swapCount || 0}
${weekData.missedDisciplines?.length ? `- Missed disciplines: ${weekData.missedDisciplines.join(", ")}` : ""}

Give actionable advice for the upcoming week. If pain flags > 0, recommend caution. Be concise, use markdown formatting.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const commentary = data.choices?.[0]?.message?.content || "No commentary available.";

    return new Response(JSON.stringify({ commentary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
