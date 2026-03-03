import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_PROMPT = `You are a HYROX race result extraction AI. Given a screenshot from the ROX Fit app or a HYROX results page, extract the race split data.

HYROX has 8 rounds. Each round consists of a 1km run followed by a station workout in this order:
1. SkiErg (1000m)
2. Sled Push (50m)
3. Sled Pull (50m)
4. Burpee Broad Jumps (80m)
5. Rowing (1000m)
6. Farmers Carry (200m)
7. Sandbag Lunges (100m)
8. Wall Balls (100 reps)

Extract times as total seconds. If a split shows "5:23", that's 323 seconds. If "1:05:23" that's 3923 seconds.

Respond with ONLY valid JSON (no markdown, no backticks):
{
  "race_name": "string or null",
  "race_location": "string or null",
  "race_date": "YYYY-MM-DD or null",
  "category": "open" | "pro" | "doubles" | "relay" | null,
  "total_time_seconds": number or null,
  "run_1_seconds": number or null,
  "run_2_seconds": number or null,
  "run_3_seconds": number or null,
  "run_4_seconds": number or null,
  "run_5_seconds": number or null,
  "run_6_seconds": number or null,
  "run_7_seconds": number or null,
  "run_8_seconds": number or null,
  "station_1_seconds": number or null,
  "station_2_seconds": number or null,
  "station_3_seconds": number or null,
  "station_4_seconds": number or null,
  "station_5_seconds": number or null,
  "station_6_seconds": number or null,
  "station_7_seconds": number or null,
  "station_8_seconds": number or null,
  "total_transition_seconds": number or null,
  "confidence": "high" | "medium" | "low",
  "notes": "any observations about data quality"
}

If you cannot read certain splits, set them to null. Always try your best to extract what's visible.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { imageBase64, imageUrl } = await req.json();
    if (!imageBase64 && !imageUrl) throw new Error("Missing image data");

    // Build the image content for the vision model
    const imageContent = imageBase64
      ? { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      : { type: "image_url" as const, image_url: { url: imageUrl } };

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the HYROX race results from this screenshot." },
              imageContent,
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(`AI service error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("Empty AI response");

    const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let extracted;
    try {
      extracted = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI JSON:", cleaned.substring(0, 500));
      throw new Error("Could not parse race data from screenshot. Try manual entry.");
    }

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-race-screenshot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
