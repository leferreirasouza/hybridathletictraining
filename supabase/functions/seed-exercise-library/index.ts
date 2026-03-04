import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEED_PROMPT = `Generate a comprehensive HYROX exercise library as a JSON array. Each exercise should be relevant to HYROX training (endurance + functional fitness).

Include exercises across these categories:
- strength: compound lifts, accessory work
- endurance: running drills, rowing, ski erg, bike
- station_specific: exercises mimicking or training for each HYROX station (skierg, sled_push, sled_pull, burpee_broad_jump, row, farmers_carry, sandbag_lunges, wall_balls)
- mobility: flexibility, recovery, prehab
- plyometric: explosive movements
- warmup: activation exercises
- cooldown: recovery exercises

For EACH exercise provide:
{
  "name": "Exercise Name",
  "category": "one of: strength, endurance, mobility, plyometric, station_specific, accessory, warmup, cooldown",
  "discipline": "one of: run, bike, stairs, rowing, skierg, mobility, strength, accessories, hyrox_station, prehab, custom",
  "muscle_groups": ["primary", "secondary"],
  "equipment_required": ["list of equipment needed, empty array for bodyweight"],
  "hyrox_station": "null or one of: skierg, sled_push, sled_pull, burpee_broad_jump, row, farmers_carry, sandbag_lunges, wall_balls",
  "difficulty_level": "one of: beginner, intermediate, advanced, elite",
  "description": "Brief description of the exercise",
  "coaching_cues": "Key form and technique points",
  "contraindications": "Safety warnings, when to avoid this exercise",
  "progression_from": "Easier exercise this progresses from (or null)",
  "progression_to": "Harder exercise to progress to (or null)"
}

Generate exactly 50 exercises covering all categories. Ensure safety-first approach with clear contraindications.`;

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

    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Use tool calling for structured output
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a HYROX training expert. Generate safe, evidence-based exercises." },
          { role: "user", content: SEED_PROMPT },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_exercises",
              description: "Save generated exercises to the library",
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
                        coaching_cues: { type: "string" },
                        contraindications: { type: "string" },
                        progression_from: { type: "string", nullable: true },
                        progression_to: { type: "string", nullable: true },
                      },
                      required: ["name", "category", "discipline", "muscle_groups", "equipment_required", "difficulty_level", "description", "coaching_cues", "contraindications"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["exercises"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_exercises" } },
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
      throw new Error("AI service unavailable");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured response from AI");

    const { exercises } = JSON.parse(toolCall.function.arguments);

    // Insert exercises with service role for admin operations
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const rows = exercises.map((ex: any) => ({
      organization_id,
      created_by: user.id,
      name: ex.name,
      category: ex.category || 'general',
      discipline: ex.discipline || 'custom',
      muscle_groups: ex.muscle_groups || [],
      equipment_required: ex.equipment_required || [],
      hyrox_station: ex.hyrox_station || null,
      difficulty_level: ex.difficulty_level || 'intermediate',
      description: ex.description || null,
      coaching_cues: ex.coaching_cues || null,
      contraindications: ex.contraindications || null,
      progression_from: ex.progression_from || null,
      progression_to: ex.progression_to || null,
      is_approved: false,
      source: 'ai_seed',
    }));

    const { error: insertError } = await serviceSupabase.from('exercise_library').insert(rows);
    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to save exercises: " + insertError.message);
    }

    return new Response(JSON.stringify({ success: true, count: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seed-exercise-library error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
