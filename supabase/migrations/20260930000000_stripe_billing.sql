-- Stripe billing: 2-tier subscriptions (free / paid).
-- Gates only generate-plan and hyrox-ai-coach (the LLM-cost-bearing
-- features). Strava sync and everything else stays free for every athlete.
--
-- No subscriptions row = free tier. Only the stripe-webhook edge function
-- (service-role) ever writes to these tables; athletes get read-only access
-- to their own row via RLS, same posture as strava_connections/garmin_connections.

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text UNIQUE,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired')),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (athlete_id = auth.uid());

CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions (stripe_customer_id);

-- Idempotency for the webhook: Stripe documents at-least-once delivery.
-- The handler inserts here before processing and skips on unique-conflict.
CREATE TABLE public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies for `authenticated` — service-role only, same as
-- strava_webhook has no equivalent table needing one.
