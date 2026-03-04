import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_PROMPT = `You are a fitness exercise extraction AI. Given a screenshot of a training session, workout plan, or exercise list, extract ALL exercises visible.

For EACH exercise found, extract:
- name: The exercise name
- category: One of: strength, endurance, mobility, plyometric, station_specific, accessory, warmup, cooldown, general
- discipline: One of: run, bike, stairs, rowing, skierg, mobility, strength, accessories, hyrox_station, prehab, custom
- muscle_groups: Array of primary muscle groups targeted
- equipment_required: Array of equipment needed (empty for bodyweight)
- hyrox_station: If it maps to a HYROX station (skierg, sled_push, sled_pull, burpee_broad_jump, row, farmers_carry, sandbag_lunges, wall_balls), otherwise null
- difficulty_level: One of: beginner, intermediate, advanced, elite
- description: Brief description if visible
- coaching_cues: Any form cues visible
- contraindications: Safety warnings if apparent
- sets: Number of sets if visible
- reps: Number of reps if visible
- duration_sec: Duration in seconds if visible

Extract as many exercises as you can see. If details aren't visible, make reasonable inferences based on exercise name.`;

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { imageBase64 } = await req.json();
    if (!imageBase64) throw new Error("Missing image data");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              { type: "text", text: "Extract all exercises from this training session screenshot." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_exercises",
              description: "Return extracted exercises from the screenshot",
              parameters: {
                type: "object",
                properties: {
                  exercises: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        category: { type: "string" },
                        discipline: { type: "string" },
                        muscle_groups: { type: "array", items: { type: "string" } },
                        equipment_required: { type: "array", items: { type: "string" } },
                        hyrox_station: { type: "string", nullable: true },
                        difficulty_level: { type: "string" },
                        description: { type: "string" },
                        coaching_cues: { type: "string", nullable: true },
                        contraindications: { type: "string", nullable: true },
                        sets: { type: "number", nullable: true },
                        reps: { type: "number", nullable: true },
                        duration_sec: { type: "number", nullable: true },
                      },
                      required: ["name", "category", "discipline", "muscle_groups", "equipment_required", "difficulty_level", "description"],
                      additionalProperties: false,
                    },
                  },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                  notes: { type: "string" },
                },
                required: ["exercises", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_exercises" } },
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
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error("AI service unavailable");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured response from AI");

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-exercise-screenshot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
