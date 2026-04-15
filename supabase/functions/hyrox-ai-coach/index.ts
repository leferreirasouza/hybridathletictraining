import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LEGAL_DISCLAIMER = `

---
⚠️ **Disclaimer**: This AI coaching advice is for informational and educational purposes only. It does not constitute medical, physiological, or professional health advice. Always consult a qualified healthcare professional before starting or modifying any training program. The AI coach may make errors — training decisions should be validated by a certified human coach. Hybrid Athletic Training accepts no liability for injuries, health issues, or adverse outcomes resulting from following AI-generated recommendations.`;

const HYROX_SYSTEM_PROMPT = `You are the HYROX Coach AI — an expert assistant for HYROX athletes and coaches.

Your knowledge covers:
- HYROX race format: 8 x 1km runs alternating with 8 functional stations (SkiErg 1000m, Sled Push 50m, Sled Pull 50m, Burpee Broad Jumps 80m, Row 1000m, Farmers Carry 200m, Sandbag Lunges 100m, Wall Balls 100 reps)
- Training periodization for endurance + functional fitness
- HR zone training (Z1-Z5), pace targets, RPE scales
- Strength programming for HYROX (compound lifts, accessory work)
- Recovery, mobility, prehab protocols
- Race strategy and pacing

RULES:
- Be concise and actionable. Athletes want clear guidance, not essays.
- When suggesting session changes, specify exact swaps (e.g., "swap Tuesday's 8km tempo → 45min bike Z2").
- Never give medical advice. If a pain flag is mentioned, recommend consulting a physiotherapist.
- Use conservative progression: no more than 10% weekly volume increase.
- Always cite specific sessions/dates when referencing the athlete's plan.
- If asked to modify more than 2-3 sessions, flag that this is a "major reset" and recommend coach approval.
- Format responses with markdown for readability.
- IMPORTANT: You MUST always append the following legal disclaimer at the end of EVERY response you give, without exception. Do not skip or modify it:
${LEGAL_DISCLAIMER}

KNOWLEDGE BASE CONTEXT:
When provided with knowledge base context below, use it to inform your answers. Cite specific sources when possible. If the knowledge base contradicts general knowledge, prefer the knowledge base as it represents the coaching organization's methodology.
`;

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !data?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = data.claims.sub as string;
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // --- RAG: Retrieve relevant knowledge chunks ---
    let knowledgeContext = "";
    try {
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

      // Get user's organization
      const { data: userRoles } = await serviceClient
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", userId)
        .limit(1);

      if (userRoles && userRoles.length > 0) {
        const orgId = userRoles[0].organization_id;

        // Get the latest user message for keyword matching
        const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
        const query = lastUserMsg?.content || "";

        if (query.length > 3) {
          // Simple keyword search across knowledge chunks
          // Search for relevant chunks by matching keywords
          const keywords = query
            .toLowerCase()
            .split(/\s+/)
            .filter((w: string) => w.length > 3)
            .slice(0, 5);

          if (keywords.length > 0) {
            // Get processed documents for this org
            const { data: docs } = await serviceClient
              .from("knowledge_documents")
              .select("id, title")
              .eq("organization_id", orgId)
              .eq("status", "processed")
              .eq("is_verified", true);

            if (docs && docs.length > 0) {
              const docIds = docs.map(d => d.id);
              const docTitleMap = new Map(docs.map(d => [d.id, d.title]));

              // Get chunks from these documents using text search
              const searchPattern = keywords.join(" | ");
              const { data: chunks } = await serviceClient
                .from("knowledge_chunks")
                .select("content, document_id, chunk_index")
                .in("document_id", docIds)
                .textSearch("content", searchPattern, { type: "websearch", config: "english" })
                .limit(8);

              if (chunks && chunks.length > 0) {
                knowledgeContext = "\n\n--- KNOWLEDGE BASE CONTEXT ---\n";
                for (const chunk of chunks) {
                  const docTitle = docTitleMap.get(chunk.document_id) || "Unknown";
                  knowledgeContext += `\n[Source: ${docTitle}]\n${chunk.content}\n`;
                }
                knowledgeContext += "\n--- END KNOWLEDGE BASE ---\n";
              }
            }
          }
        }
      }
    } catch (ragErr) {
      console.error("RAG retrieval error (non-fatal):", ragErr);
      // Continue without knowledge context
    }

    const systemPrompt = HYROX_SYSTEM_PROMPT + knowledgeContext;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("hyrox-ai-coach error:", e);
    return new Response(JSON.stringify({ error: "An error occurred processing your request" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
