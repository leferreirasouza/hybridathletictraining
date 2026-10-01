// Creates a Stripe Checkout Session for the Paid tier and returns its hosted
// URL. The frontend redirects the browser there directly (same shape as
// Settings.tsx's handleConnectGarmin: invoke -> { url } -> window.location.href).
//
// Required secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_ID_PAID.
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

    const priceId = Deno.env.get("STRIPE_PRICE_ID_PAID");
    if (!priceId) return jsonResp({ error: "Billing is not configured" }, 500);

    const origin = req.headers.get("Origin") ?? "";

    const stripe = getStripeClient();

    // Reuse an existing Stripe customer for this athlete if one exists, so
    // a user who cancels and re-subscribes doesn't accumulate duplicates.
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("athlete_id", user.id)
      .maybeSingle();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      customer: existing?.stripe_customer_id,
      customer_email: existing?.stripe_customer_id ? undefined : user.email,
      subscription_data: { metadata: { supabase_user_id: user.id } },
      success_url: `${origin}/settings?billing=success`,
      cancel_url: `${origin}/pricing?billing=cancelled`,
    });

    if (!session.url) return jsonResp({ error: "Failed to create checkout session" }, 500);
    return jsonResp({ url: session.url });
  } catch (e) {
    console.error("stripe-checkout error:", e);
    return jsonResp({ error: "Internal error" }, 500);
  }
});
