// Shared Stripe client + tier resolution. Only generate-plan and
// hyrox-ai-coach gate on tier (the two LLM-cost-bearing features) — Strava
// sync and everything else stays free for every athlete, so this module is
// deliberately small.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@17.4.0?target=deno";

export type SubscriptionTier = "free" | "paid";

const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, paid: 1 };

let stripeClient: Stripe | null = null;

/** Lazily-constructed Stripe client, reused across calls within a request. */
export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  stripeClient = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
  return stripeClient;
}

/**
 * Returns the athlete's current tier. No `subscriptions` row, or a row
 * whose status isn't active/trialing, is free — mirrors Stripe's own
 * definition of "currently has access" rather than "ever subscribed."
 */
export async function getAthleteTier(
  service: SupabaseClient,
  athleteId: string,
): Promise<SubscriptionTier> {
  const { data } = await service
    .from("subscriptions")
    .select("tier, status")
    .eq("athlete_id", athleteId)
    .maybeSingle();
  if (!data) return "free";
  if (data.status !== "active" && data.status !== "trialing") return "free";
  return (data.tier as SubscriptionTier) ?? "free";
}

export function tierAtLeast(tier: SubscriptionTier, required: SubscriptionTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[required];
}
