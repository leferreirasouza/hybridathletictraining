// Garmin Health API — OAuth 1.0a handshake
//
// Required secrets (set after Garmin Health API approval):
//   - GARMIN_CONSUMER_KEY
//   - GARMIN_CONSUMER_SECRET
//
// Callback URL to register in the Garmin developer portal:
//   https://hybridathletictraining.lovable.app/garmin/callback
//
// Actions (POST JSON: { action: "start" | "callback" | "disconnect", ... }):
//   start     -> returns { authorize_url } the client should redirect to
//   callback  -> { oauth_token, oauth_verifier } exchanges for access token, persists row
//   disconnect-> deletes the user's garmin_connections row
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REQUEST_TOKEN_URL = "https://connectapi.garmin.com/oauth-service/oauth/request_token";
const AUTHORIZE_URL = "https://connect.garmin.com/oauthConfirm";
const ACCESS_TOKEN_URL = "https://connectapi.garmin.com/oauth-service/oauth/access_token";
const CALLBACK_URL = "https://hybridathletictraining.lovable.app/garmin/callback";

// ---- OAuth 1.0a helpers ----
function percentEncode(s: string) {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function nonce() {
  return crypto.randomUUID().replace(/-/g, "");
}

function signRequest(opts: {
  method: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  tokenSecret?: string;
  extraOAuth?: Record<string, string>;
}) {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: opts.consumerKey,
    oauth_nonce: nonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    ...(opts.extraOAuth ?? {}),
  };

  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join("&");

  const baseString = [
    opts.method.toUpperCase(),
    percentEncode(opts.url),
    percentEncode(paramString),
  ].join("&");

  const signingKey = `${percentEncode(opts.consumerSecret)}&${percentEncode(opts.tokenSecret ?? "")}`;
  const sig = hmac("sha1", signingKey, baseString, "utf8", "base64") as string;

  const authParams = { ...oauthParams, oauth_signature: sig };
  const authHeader =
    "OAuth " +
    Object.keys(authParams)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(authParams[k])}"`)
      .join(", ");
  return authHeader;
}

function parseFormResponse(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of text.split("&")) {
    const [k, v] = pair.split("=");
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const consumerKey = Deno.env.get("GARMIN_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("GARMIN_CONSUMER_SECRET");
    if (!consumerKey || !consumerSecret) {
      return new Response(
        JSON.stringify({ error: "Garmin Health API credentials not configured yet" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;
    const service = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    if (action === "start") {
      const authHeaderOAuth = signRequest({
        method: "POST",
        url: REQUEST_TOKEN_URL,
        consumerKey,
        consumerSecret,
        extraOAuth: { oauth_callback: CALLBACK_URL },
      });
      const r = await fetch(REQUEST_TOKEN_URL, { method: "POST", headers: { Authorization: authHeaderOAuth } });
      const txt = await r.text();
      if (!r.ok) {
        console.error("Garmin request_token error:", r.status, txt);
        return new Response(JSON.stringify({ error: "Failed to get request token" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const parsed = parseFormResponse(txt);
      const oauth_token = parsed["oauth_token"];
      const oauth_token_secret = parsed["oauth_token_secret"];
      if (!oauth_token || !oauth_token_secret) {
        return new Response(JSON.stringify({ error: "Malformed request token response" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // persist transient request token/secret for this user
      await service.from("garmin_connections").upsert({
        user_id: userId,
        request_token: oauth_token,
        request_token_secret: oauth_token_secret,
      }, { onConflict: "user_id" });

      const authorize_url = `${AUTHORIZE_URL}?oauth_token=${encodeURIComponent(oauth_token)}`;
      return new Response(JSON.stringify({ authorize_url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "callback") {
      const { oauth_token, oauth_verifier } = body ?? {};
      if (!oauth_token || !oauth_verifier) {
        return new Response(JSON.stringify({ error: "Missing oauth_token or oauth_verifier" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: conn } = await service
        .from("garmin_connections")
        .select("request_token, request_token_secret")
        .eq("user_id", userId)
        .maybeSingle();
      if (!conn?.request_token_secret || conn.request_token !== oauth_token) {
        return new Response(JSON.stringify({ error: "Request token mismatch" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const authHeaderOAuth = signRequest({
        method: "POST",
        url: ACCESS_TOKEN_URL,
        consumerKey,
        consumerSecret,
        tokenSecret: conn.request_token_secret,
        extraOAuth: { oauth_token, oauth_verifier },
      });
      const r = await fetch(ACCESS_TOKEN_URL, { method: "POST", headers: { Authorization: authHeaderOAuth } });
      const txt = await r.text();
      if (!r.ok) {
        console.error("Garmin access_token error:", r.status, txt);
        return new Response(JSON.stringify({ error: "Failed to exchange access token" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const parsed = parseFormResponse(txt);
      await service.from("garmin_connections").update({
        access_token: parsed["oauth_token"],
        access_token_secret: parsed["oauth_token_secret"],
        garmin_user_id: parsed["oauth_token"]?.slice(0, 40) ?? null, // overwritten by /user/id call later
        request_token: null,
        request_token_secret: null,
        last_sync_at: new Date().toISOString(),
      }).eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      await service.from("garmin_connections").delete().eq("user_id", userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("garmin-oauth error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
