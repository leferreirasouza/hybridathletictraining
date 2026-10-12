# Plan: finish pending work (decisions received)

## Your decisions
1. Suggestion rules: hand-written by you / Claude Code. I build display and storage only, no rule logic.
2. Athletes can Accept or Dismiss their own suggestions (coaches and admins too).
3. No "In progress" label on the plan progress card.

## What I will build
1. Athlete accept/dismiss: PlanSuggestions card shows Accept / Dismiss to athletes too, instead of "waiting for coach". Check the database permissions first: the athlete must be allowed to update their own suggestion row and their own planned session. Add a small permission change only if missing (flagged for your hand review).
2. Portuguese translations: Athletes & Strava admin tab, Week Builder, Plan suggestions card (reason labels, Accept, Dismiss), Plan progress card, Share dialog. Add keys to en.json and pt-BR.json.
3. roadmap.md: mark decisions made; keep open items (hand-written suggestion rules, Stripe secrets, Strava live test, secret rotation, Garmin blocked, unverified engines, hand reviews).
4. Verify: type check, run planProgress and weekBuilder tests, open the dashboard signed in and confirm cards render in Portuguese.

## Not built (needs you)
- The rules that create suggestions (what counts as missed or much harder, how much to change). Suggestion inserts stay blocked for the app until those rules exist.
- Stripe secrets and webhook, Strava live test with a real workout, secret rotation, hand reviews.

## Technical details
- src/components/dashboard/PlanSuggestions.tsx: drop the canRespond gate; keep audit logging.
- Check RLS on periodization_adjustments (UPDATE) and planned_sessions (athlete UPDATE) before relying on it.
- Locale files: src/i18n/locales/en.json, pt-BR.json.
