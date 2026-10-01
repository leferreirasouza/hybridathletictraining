// Creates a Stripe Billing Portal session so an athlete can self-service
// manage or cancel their subscription. Same request/response shape as
// stripe-checkout: returns { url }, frontend redirects there.
//
// Required secrets: STRIPE_SECRET_KEY.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getStripeClient } from "../_shared/subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResp({ error: "Missing authorization header" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResp({ error: "Unauthorized" }, 401);

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("athlete_id", user.id)
      .maybeSingle();
    if (!sub?.stripe_customer_id) return jsonResp({ error: "No billing account found" }, 404);

    const origin = req.headers.get("Origin") ?? "";
    const stripe = getStripeClient();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/settings`,
    });

    return jsonResp({ url: portalSession.url });
  } catch (e) {
    console.error("stripe-portal error:", e);
    return jsonResp({ error: "Internal error" }, 500);
  }
});
