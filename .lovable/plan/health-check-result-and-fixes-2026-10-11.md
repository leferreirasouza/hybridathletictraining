# Health check result and fixes

## Status: working
- Live site returns 200 and shows the sign-in page.
- Latest build: OK. No runtime or console errors. Type check passes with no errors.

## To fix (2 pending monitoring findings)
1. Onboarding can get stuck (medium): if saving the health questionnaire or fitness assessment fails, pressing Complete again errors with "Already assigned to this organization", so the athlete can never finish setup.
   - Fix: make the role assignment step tolerate "already assigned" and continue, so retry completes the profile and sets onboarding as done.
2. Strava inbox can duplicate a workout (medium): the Link dialog lists sessions already logged, and linking creates a second completion, double counting training load.
   - Fix: hide planned sessions that already have a completion, and re-check before inserting (enrich the existing one instead, as the server matcher does).

## Still open (not code)
- Stripe secrets not set; Stripe webhook not created.
- Strava push-subscription registration unconfirmed.
- Secrets pasted in chat earlier should be rotated.

## Technical details
- src/pages/Onboarding.tsx handleComplete: catch the "Already assigned" error from assign_onboarding_role and continue.
- src/components/strava/StravaInbox.tsx: filter plannedOptions against completed_sessions.planned_session_id; guard createCompletion.
