
- Strava push subscription is managed only via the master_admin-only `strava-subscribe` function (Strava client secret never leaves the backend); strava-webhook rejects deliveries whose subscription_id differs from STRAVA_WEBHOOK_SUBSCRIPTION_ID.
