# Runna-style plan progress, Strava linking and better sharing

Built from your Runna screenshots: week strip with colored dots, week-by-week plan cards, a calendar with synced workouts beside planned ones, and a "Link activity" button on each session.

## Part 1 — Plan progress card on the dashboard (new request)

```text
HYROX São Paulo Plan            Race: NOV 21
[====][====][----][----][----][----][----][----]
Weeks completed 1/8          Run distance 40 / 369 km
```

- **Top card:** plan name, race date, one bar segment per week (filled = week done, half-lit = current week), weeks completed, and run km done vs planned. Matches Runna's "Your Plan" card.
- **Week cards below** (current week open, others collapsed, tap to expand):
  - Date range and "Week 2", a bar with one segment per session.
  - "Workouts 1/7 · Distance 11.5 / 53 km".
  - Each day: colored square by session type, with a check when completed.
- **Three states per session:**
  - **Completed:** logged by hand or linked from Strava. Filled square with a check.
  - **In progress:** today's session, not logged yet. Outlined and highlighted.
  - **Planned:** future sessions. Plain square. Past sessions not done show as **Missed** (dimmed).
- Tapping a session opens it in the schedule.

## Part 2 — Strava workouts in the calendar

- **Week strip at the top of the schedule** (Runna's "Week 2/8" header): 7 days, colored dots for each planned session and a gray dot for each Strava workout.
- **Calendar day rows:** planned sessions and Strava workouts sit side by side. Linked ones merge into one card showing the real numbers ("25.0 km · 2h 2m") with a check.
- **Suggested match, you confirm:** when a Strava workout lands on a day with an open session of the same type, the card shows "Looks like your Easy Run — Link?" with Link / Not this.
- **"Link activity" button on each session** (like Runna): opens your Strava workouts from that week and lets you pick one. Also **Unlink**.
- **Unplanned Strava workouts** (e.g. "Treadmill Running") show as gray cards on that day and count toward the week's km.
- **Adapt the plan (suggest only):** if a key session was missed or a workout ran far longer or harder than planned, suggest a change (move it, make tomorrow easy). It goes through the existing swap approval and never changes the plan by itself.
- The Strava inbox stays as a catch-all list.

## Part 3 — Better workout sharing

- **Pick your metrics:** toggle distance, duration, pace, avg HR, RPE, elevation, calories, session name, date. Up to 4 on the card, with a live preview.
- **Route map:** Strava workouts with GPS get their route drawn on the card as a plain line.
- **Your own photo:** use a phone photo as the background with a dark overlay. The photo stays on the device.
- **Sizes:** Story 9:16, Square 1:1, Feed 4:5. Keeps Bold, Minimal and Neon and adds Photo.
- A share button on Strava-synced workouts in History too.

## Order
1. Plan progress card. 2. Strava linking in the calendar. 3. Sharing.

## Technical details

- Progress card: new `PlanProgressCard` on Dashboard, reading the athlete's `planned_sessions` for the active plan and `completed_sessions` (own `athlete_id` only). Session state is a pure function (completed / in progress / planned / missed) with unit tests. Colors come from the existing discipline config in `schedule/config.ts`, using theme tokens only.
- Calendar: `useScheduleData` also loads `strava_activities` for the visible range. Suggestion scoring mirrors `_shared/stravaMap.ts` rules (same date, discipline, closest duration) client-side, for display only.
- One shared link/unlink helper, reused by StravaInbox, keeping the duplicate-link guard. Unlink removes only Strava-sourced completions, never manual entries. Training load recalculates via the existing trigger.
- Adaptation suggestions are written as pending `session_substitutions`. The "missed / much harder" rules count as hand-coded training logic per the project rules and should be reviewed.
- Share: extend `ShareSessionData` with optional metrics and `polyline`; decode `map.summary_polyline` from `strava_activities.raw` (check it is stored first); photo via local `FileReader`, no upload.
- All new text in English and Portuguese. Tasks are recorded in roadmap.md once building starts.
