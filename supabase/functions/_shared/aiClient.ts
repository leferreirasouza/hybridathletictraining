// One place that decides where AI (chat-completion) calls go.
//
// Today every function calls Google Gemini models through Lovable's AI
// gateway (LOVABLE_API_KEY, auto-provisioned by Lovable Cloud). Once the app
// runs on its own Supabase project there is no Lovable gateway, so the same
// OpenAI-format requests go straight to Google's OpenAI-compatible Gemini
// endpoint with GEMINI_API_KEY. Setting GEMINI_API_KEY is the switch; without
// it behaviour is exactly what it was. Changing provider later (Anthropic,
// OpenAI) means changing this file, not the seven callers.
//
// Import-free so vitest can load it (src/test/aiClient.test.ts).

export type AiProvider = "gemini" | "lovable";

export interface AiEnv {
  GEMINI_API_KEY?: string;
  LOVABLE_API_KEY?: string;
}

const ENDPOINTS: Record<AiProvider, string> = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  lovable: "https://ai.gateway.lovable.dev/v1/chat/completions",
};

export function resolveAiProvider(env: AiEnv): { provider: AiProvider; key: string } | null {
  if (env.GEMINI_API_KEY) return { provider: "gemini", key: env.GEMINI_API_KEY };
  if (env.LOVABLE_API_KEY) return { provider: "lovable", key: env.LOVABLE_API_KEY };
  return null;
}

/**
 * The gateway names models "google/gemini-2.5-flash"; Google's own endpoint
 * wants "gemini-2.5-flash". Everything else in the body (messages, images,
 * tools, stream) is the same OpenAI format on both.
 */
export function modelForProvider(model: string, provider: AiProvider): string {
  return provider === "gemini" ? model.replace(/^google\//, "") : model;
}

export interface BuiltAiRequest {
  provider: AiProvider;
  model: string;
  url: string;
  init: RequestInit;
}

/** Pure: turns a caller's fetch init (JSON string body) into the provider's request. */
export function buildAiRequest(env: AiEnv, init: RequestInit): BuiltAiRequest {
  const resolved = resolveAiProvider(env);
  if (!resolved) throw new Error("AI provider not configured (set GEMINI_API_KEY or LOVABLE_API_KEY)");
  const { provider, key } = resolved;

  let body = init.body;
  let model = "unknown";
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed.model === "string") {
        parsed.model = modelForProvider(parsed.model, provider);
        model = parsed.model;
        body = JSON.stringify(parsed);
      }
    } catch {
      // Not JSON: send as-is.
    }
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${key}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  return { provider, model, url: ENDPOINTS[provider], init: { ...init, method: init.method ?? "POST", headers, body } };
}

function readEnv(): AiEnv {
  // deno-lint-ignore no-explicit-any
  const denoEnv = (globalThis as any).Deno?.env;
  return {
    GEMINI_API_KEY: denoEnv?.get("GEMINI_API_KEY") || undefined,
    LOVABLE_API_KEY: denoEnv?.get("LOVABLE_API_KEY") || undefined,
  };
}

export function aiConfigured(): boolean {
  return resolveAiProvider(readEnv()) !== null;
}

/**
 * Drop-in for `fetch(<gateway url>, init)`. Logs one line per call
 * (function, provider, model, status, latency) so AI usage is visible in the
 * function logs regardless of provider.
 */
export async function aiFetch(fnName: string, init: RequestInit): Promise<Response> {
  const req = buildAiRequest(readEnv(), init);
  const started = Date.now();
  try {
    const res = await fetch(req.url, req.init);
    console.log(`[ai] fn=${fnName} provider=${req.provider} model=${req.model} status=${res.status} ms=${Date.now() - started}`);
    return res;
  } catch (e) {
    console.error(`[ai] fn=${fnName} provider=${req.provider} model=${req.model} network error after ${Date.now() - started} ms`, e);
    throw e;
  }
}
