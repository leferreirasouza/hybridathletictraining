import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CHUNK_SIZE = 1500; // characters per chunk
const CHUNK_OVERLAP = 200;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
    if (start >= text.length) break;
  }
  return chunks;
}

serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "";
  const devOrigins = ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"];
  const isAllowed = !allowedOrigin || origin === allowedOrigin || devOrigins.includes(origin);
  const corsHeaders = {
    "Access-Control-Allow-Origin": isAllowed ? (origin || allowedOrigin || "*") : allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth client to verify user
    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the JWT server-side via Supabase Auth
    const { data: { user: authUser }, error: userError } = await authClient.auth.getUser();
    if (userError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authUser.id;

    // Service client for admin operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { document_id, source_type, source_url, file_path } = await req.json();

    if (!document_id) {
      return new Response(JSON.stringify({ error: "document_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: caller must be coach/admin/master_admin. The knowledge
    // base is org-scoped, so match the document's organization when known.
    const { data: docRow } = await serviceClient
      .from("knowledge_documents")
      .select("organization_id")
      .eq("id", document_id)
      .maybeSingle();
    const docOrgId = docRow?.organization_id ?? null;

    const { data: callerRoles, error: callerRolesErr } = await serviceClient
      .from("user_roles")
      .select("role, organization_id")
      .eq("user_id", userId);
    if (callerRolesErr) {
      return new Response(JSON.stringify({ error: "Failed to verify permissions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const isGlobalMaster = (callerRoles || []).some((r) => r.role === "master_admin");
    const hasOrgRole = docOrgId
      ? (callerRoles || []).some(
          (r) => r.organization_id === docOrgId && ["coach", "admin", "master_admin"].includes(r.role)
        )
      : (callerRoles || []).some((r) => ["coach", "admin", "master_admin"].includes(r.role));
    if (!isGlobalMaster && !hasOrgRole) {
      return new Response(JSON.stringify({ error: "Forbidden: coach or admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SSRF guard for user-supplied source_url: only public http(s) hosts.
    function isSafePublicHttpUrl(raw: string): boolean {
      let u: URL;
      try { u = new URL(raw); } catch { return false; }
      if (u.protocol !== "http:" && u.protocol !== "https:") return false;
      const host = u.hostname.toLowerCase();
      if (!host || host === "localhost" || host.endsWith(".localhost")) return false;
      // Block IP-literal hosts entirely (covers link-local, loopback, private
      // ranges, IPv6 ::1 / fc00::/7, cloud metadata 169.254.169.254 etc.).
      const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
      if (ipv4) return false;
      if (host.includes(":")) return false; // bare IPv6
      if (host.startsWith("[") && host.endsWith("]")) return false;
      // Block obvious internal TLDs.
      const blockedTlds = [".internal", ".local", ".lan", ".intranet", ".corp", ".home"];
      if (blockedTlds.some((tld) => host.endsWith(tld))) return false;
      return true;
    }

    let extractedText = "";

    if (source_type === "url" && source_url) {
      // Scrape URL content using AI to extract and summarize
      console.log("Scraping URL:", source_url);

      try {
        const fetchRes = await fetch(source_url, {
          headers: { "User-Agent": "HybridAthleticTraining-KnowledgeBot/1.0" },
        });
        if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
        const html = await fetchRes.text();

        // Strip HTML tags for raw text extraction
        extractedText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ")
          .trim();

        // Use AI to clean and summarize the content for better quality
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY && extractedText.length > 100) {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a content extraction assistant. Extract the main educational/scientific content from the following web page text. Remove navigation, ads, footers, and irrelevant content. Preserve all factual information, data, methodologies, and conclusions. Return ONLY the cleaned content as plain text, no commentary.",
                },
                {
                  role: "user",
                  content: extractedText.slice(0, 50000),
                },
              ],
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const cleaned = aiData.choices?.[0]?.message?.content;
            if (cleaned && cleaned.length > 50) {
              extractedText = cleaned;
            }
          }
        }
      } catch (fetchErr) {
        console.error("URL scrape failed:", fetchErr);
        // Update status to error
        await serviceClient
          .from("knowledge_documents")
          .update({ status: "error", metadata: { error: `Failed to scrape: ${fetchErr.message}` } })
          .eq("id", document_id);
        return new Response(JSON.stringify({ error: `Failed to scrape URL: ${fetchErr.message}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (source_type === "pdf" && file_path) {
      // Download file from storage and extract text using AI vision
      console.log("Processing PDF:", file_path);

      const { data: fileData, error: downloadErr } = await serviceClient.storage
        .from("knowledge-files")
        .download(file_path);

      if (downloadErr || !fileData) {
        console.error("File download error:", downloadErr);
        await serviceClient
          .from("knowledge_documents")
          .update({ status: "error", metadata: { error: "Failed to download file" } })
          .eq("id", document_id);
        return new Response(JSON.stringify({ error: "Failed to download file" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Convert to base64 for AI processing
      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      // Use Gemini to extract text from the PDF
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are a document extraction assistant specialized in sports science and training literature. Extract ALL text content from the provided document. Preserve structure (headings, lists, tables as text). Include all factual data, research findings, methodologies, and recommendations. Return ONLY the extracted text content, no commentary or metadata.",
            },
            {
              role: "user",
              content: [
                {
                  type: "file",
                  file: {
                    filename: file_path.split("/").pop() || "document.pdf",
                    file_data: `data:application/pdf;base64,${base64}`,
                  },
                },
                {
                  type: "text",
                  text: "Extract all text content from this PDF document. Preserve the structure and all information.",
                },
              ],
            },
          ],
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error("AI extraction failed:", aiRes.status, errText);
        await serviceClient
          .from("knowledge_documents")
          .update({ status: "error", metadata: { error: "AI extraction failed" } })
          .eq("id", document_id);
        return new Response(JSON.stringify({ error: "AI extraction failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiRes.json();
      extractedText = aiData.choices?.[0]?.message?.content || "";
    } else {
      return new Response(JSON.stringify({ error: "Unsupported source type or missing parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!extractedText || extractedText.length < 20) {
      await serviceClient
        .from("knowledge_documents")
        .update({ status: "error", metadata: { error: "No meaningful content extracted" } })
        .eq("id", document_id);
      return new Response(JSON.stringify({ error: "No meaningful content could be extracted" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chunk the extracted text
    const chunks = chunkText(extractedText);
    console.log(`Extracted ${extractedText.length} chars, created ${chunks.length} chunks`);

    // Store chunks
    const chunkInserts = chunks.map((content, index) => ({
      document_id,
      content,
      chunk_index: index,
      metadata: { source_type, char_count: content.length },
    }));

    // Delete any existing chunks first
    await serviceClient.from("knowledge_chunks").delete().eq("document_id", document_id);

    // Insert in batches of 50
    for (let i = 0; i < chunkInserts.length; i += 50) {
      const batch = chunkInserts.slice(i, i + 50);
      const { error: insertErr } = await serviceClient.from("knowledge_chunks").insert(batch);
      if (insertErr) {
        console.error("Chunk insert error:", insertErr);
        throw insertErr;
      }
    }

    // Update the document status
    await serviceClient
      .from("knowledge_documents")
      .update({
        status: "processed",
        content_text: extractedText.slice(0, 5000), // Preview
        total_chunks: chunks.length,
        metadata: {
          total_characters: extractedText.length,
          processing_date: new Date().toISOString(),
          source_type,
        },
      })
      .eq("id", document_id);

    return new Response(
      JSON.stringify({
        success: true,
        chunks_created: chunks.length,
        characters_extracted: extractedText.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ingest-knowledge error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
