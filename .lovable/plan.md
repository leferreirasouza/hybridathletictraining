# Share upgrades + Strava-to-plan linking (Runna-style)

Part 2's layout will be adjusted once the Runna screenshots arrive. This draft uses common Runna patterns.

## Part 1 — Better workout sharing

**Choose what to show**
- Toggle each metric on or off: distance, duration, pace, avg HR, RPE, elevation, calories, session name, date.
- Up to 4 metrics on the card at once. A live preview updates as you toggle.

**More visual options**
- **Route map:** if the workout came from Strava and has a GPS route, draw it on the card (a plain line, no map tiles, so it always works and costs nothing).
- **Your own photo:** upload a photo from the phone as the card background, with a dark overlay so the numbers stay readable. The photo stays on the device and is not uploaded.
- **Sizes:** Story (9:16), Square (1:1) and Feed (4:5).
- Keeps the Bold, Minimal and Neon styles, and adds a "Photo" style.

**Where it's available**
- Same places as today, plus on Strava-synced workouts in History.

## Part 2 — Strava workouts in the calendar

```text
Mon  [Easy run 8km]  -> matched: Strava "Morning Run" 8.3km  (green check)
Tue  [Intervals]     -> Suggested: Strava "Lunch Run" 6km?  [Link] [Not this]
Wed  (rest)          -> Unplanned: Strava "Ride" 45min       [Log] [Swap into plan]
```

- **In the calendar day:** each planned session shows its linked Strava workout underneath (name, distance, time, pace) with a planned vs done comparison.
- **Suggestions, you confirm:** when a Strava workout lands on a day with an unmatched planned session, the day shows "Suggested match" with Link / Not this. Nothing links without a tap.
- **Unplanned workouts:** Strava workouts with no plan that day show on that day as an extra card with Log as extra, or Link to a session from another day in the same week.
- **Unlink / relink:** tap a linked workout to unlink or move it to another session.
- **Adapt the plan (suggest only):** if a workout was much harder or longer than planned, or a key session was missed, offer a suggestion (e.g. "make tomorrow easy" or "move intervals to Thursday") that goes to the existing coach/athlete swap approval. Never auto-changes the plan.
- **Today card on the dashboard:** shows "Synced from Strava" when today's session gets matched.
- The separate Strava inbox stays as a catch-all list, but the calendar becomes the main place.

## Technical details

- Share: extend `ShareSessionData` with optional fields + `polyline`; new metric picker and size selector in `ShareWorkoutDialog`; decode Strava `map.summary_polyline` from `strava_activities.raw` (verify it is stored) and render as SVG; photo via local `FileReader`, no storage.
- Calendar: `useScheduleData` also loads the user's `strava_activities` for the visible range; WeeklyView/DailyView/MonthlyView render linked, suggested and unplanned states.
- Suggestion scoring reuses the matching rules in `_shared/stravaMap.ts` (same date, discipline, closest duration), ported client-side for display only.
- Link/unlink writes go through one shared helper, reused by StravaInbox, with the existing duplicate-link guard. Unlink deletes only Strava-sourced completions; manual entries are never removed.
- Adaptation suggestions write to `session_substitutions` as pending. Per governance, the rules deciding "much harder / missed key session" are hand-coded logic and should be reviewed.
- New strings in en and pt-BR.

## Open
- Runna screenshots to refine Part 2 layout.
