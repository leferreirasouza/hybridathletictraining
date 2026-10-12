
- Strava push subscription is managed only via the master_admin-only `strava-subscribe` function (Strava client secret never leaves the backend); strava-webhook rejects deliveries whose subscription_id differs from STRAVA_WEBHOOK_SUBSCRIPTION_ID.
- Reusable coach week templates live in public.week_templates (org-scoped, sessions as jsonb with day_of_week 1=Mon); applying one copies rows into planned_sessions with dates computed from the plan's first Monday — templates never link back to live plans so editing a template can't silently change an athlete's plan.
