# Pending work and decisions

## A. Waiting on your decision
1. Plan-change suggestions (missed / much harder session): who writes the rules?
   - Option 1: I build only display and storage; you (or Claude Code) hand-write the rules that create suggestions. Recommended per project governance.
   - Option 2: I write simple rules (e.g. missed = no completion by end of day; much harder = actual load 30%+ above planned) and you review them afterwards.
2. Should a suggestion ever apply on its own? Current build: only after coach/admin presses Accept (athletes see "waiting for coach"). Confirm, or allow athletes to accept their own.
3. "In progress" status on the plan progress card (today only Done / Today / Planned / Missed). Add it, yes or no?

## B. Built but never opened signed in (needs your eyes)
- Plan progress card, week strip, Strava Link / Unlink / Unplanned log
- New Share card (metrics, sizes, photo, route map)
- Athletes & Strava admin tab
- Week Builder tab (create a test plan, check athlete dashboard)
- Plan suggestions card (empty: nothing creates suggestions yet)
- Onboarding retry fix and Strava inbox duplicate fix

## C. Implementation I can finish now (no decision needed)
- Portuguese translations: Athletes & Strava tab, Week Builder, Plan suggestions, Plan progress card, Share dialog.
- Update roadmap.md so it lists every open item.

## D. Needs your action (not code)
- Stripe: add STRIPE_SECRET_KEY, STRIPE_PRICE_ID_PAID, STRIPE_WEBHOOK_SECRET and create the webhook in Stripe. The paid-tier gate on the AI coach is deferred until go-live.
- Strava live updates: save a short workout on Strava, then check "Latest workout received" in the admin tab (should be within minutes, not 02:45 UTC).
- Rotate the secrets pasted into chat earlier (token encryption, lookup HMAC, Strava verify token), then re-run the backfill script.
- Hand review: strava-subscribe function, admin athlete RPCs, week_templates table, suggestion update permission.
- Garmin: blocked on Garmin's developer program being suspended.

## E. Unverified engines (need a deliberate test)
- periodization_adjustments has 0 rows ever; interference/TSB rules never confirmed firing.
- parq_responses / fitness_assessments: 0 rows; test one real signup.

## F. Not started
- Oura/Whoop, native watch apps, wizard i18n extraction.
- Strava activity dates (Oct) and plan dates (ended Apr 26) do not overlap: link-testing needs a plan covering recent dates.

## Next step
Answer A1-A3, then I do C and the display/storage part of A.
