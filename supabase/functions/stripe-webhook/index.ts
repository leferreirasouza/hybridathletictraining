// Stripe webhook receiver. Public endpoint (no JWT — Stripe calls this
// directly). Unlike strava-webhook's unsigned payloads, a forged event here
// is a security hole (fake "paid" status), not just a wasted retry — so the
// signature is verified BEFORE acking, and an invalid signature is rejected
// outright rather than acked-and-ignored.
//
// One-time setup after this function is deployed: create a webhook endpoint
// in the Stripe Dashboard pointing at
// https://<project>.functions.supabase.co/stripe-webhook, subscribed to
// checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted, invoice.payment_failed. Copy its signing
// secret into STRIPE_WEBHOOK_SECRET.
//
// Required secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@17.4.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, stripe-signature",
};

function runInBackground(promise: Promise<unknown>) {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  const guarded = promise.catch((e) => console.error("stripe-webhook background error:", e));
  if (rt?.waitUntil) rt.waitUntil(guarded);
}

/** Returns false if this event was already processed (idempotency). */
async function claimEvent(service: SupabaseClient, event: Stripe.Event): Promise<boolean> {
  const { error } = await service
    .from("stripe_webhook_events")
    .insert({ stripe_event_id: event.id, event_type: event.type });
  if (error) {
    if (error.code === "23505") return false; // already processed
    console.error("stripe-webhook: failed to record event, processing anyway:", error);
  }
  return true;
}

function toIso(unixSeconds: number | null | undefined): string | null {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

async function handleCheckoutCompleted(
  service: SupabaseClient,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) {
  const athleteId = session.client_reference_id;
  if (!athleteId) {
    console.error("stripe-webhook: checkout.session.completed missing client_reference_id");
    return;
  }
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!customerId || !subscriptionId) {
    console.error("stripe-webhook: checkout.session.completed missing customer/subscription id");
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const { error } = await service.from("subscriptions").upsert(
    {
      athlete_id: athleteId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      tier: "paid",
      status: subscription.status,
      current_period_end: toIso(subscription.current_period_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: "athlete_id" },
  );
  if (error) console.error("stripe-webhook: failed to upsert subscription", error);
}

async function handleSubscriptionUpdated(service: SupabaseClient, subscription: Stripe.Subscription) {
  const athleteId = subscription.metadata?.supabase_user_id;
  if (!athleteId) {
    console.error("stripe-webhook: subscription update missing supabase_user_id metadata", subscription.id);
    return;
  }
  const { error } = await service
    .from("subscriptions")
    .update({
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_end: toIso(subscription.current_period_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq("athlete_id", athleteId);
  if (error) console.error("stripe-webhook: failed to update subscription", error);
}

async function handleSubscriptionDeleted(service: SupabaseClient, subscription: Stripe.Subscription) {
  const athleteId = subscription.metadata?.supabase_user_id;
  if (!athleteId) return;
  const { error } = await service
    .from("subscriptions")
    .update({ status: "canceled", cancel_at_period_end: false })
    .eq("athlete_id", athleteId);
  if (error) console.error("stripe-webhook: failed to mark subscription canceled", error);
}

async function handlePaymentFailed(service: SupabaseClient, invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  // Only flag past_due — Stripe's Smart Retries run for ~2-3 weeks before the
  // subscription itself transitions, and customer.subscription.updated is
  // what actually gates access via status, not this handler.
  const { error } = await service
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_customer_id", customerId);
  if (error) console.error("stripe-webhook: failed to mark past_due", error);
}

async function processEvent(service: SupabaseClient, stripe: Stripe, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(service, stripe, event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(service, event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(service, event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(service, event.data.object as Stripe.Invoice);
      break;
    default:
      console.log("stripe-webhook: ignoring unhandled event type", event.type);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!webhookSecret || !secretKey) {
    console.error("stripe-webhook: STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY not configured");
    return new Response(JSON.stringify({ error: "Not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
  const cryptoProvider = Stripe.createSubtleCryptoProvider();

  let event: Stripe.Event;
  try {
    // Signature verification happens BEFORE acking: a forged event must be
    // rejected outright, not silently swallowed like an unsigned Strava payload.
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret, undefined, cryptoProvider);
  } catch (e) {
    console.error("stripe-webhook: signature verification failed", e);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Ack immediately once the event is verified; do the real work in the
  // background (same pattern as strava-webhook).
  const response = new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  runInBackground(
    (async () => {
      const isNew = await claimEvent(service, event);
      if (!isNew) {
        console.log("stripe-webhook: duplicate delivery, skipping", event.id);
        return;
      }
      await processEvent(service, stripe, event);
    })(),
  );

  return response;
});
