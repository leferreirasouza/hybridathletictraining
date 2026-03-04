

## Coach Athlete Load Alerts

### What it does
A new panel on the Coach Dashboard that fetches all assigned athletes' planned sessions across all their active plans, runs `analyzeWeeklyLoad` for the current week, and displays athletes whose combined load is in "caution" or "danger" zones.

### Implementation

**1. New component: `src/components/coach/AthleteLoadAlertsPanel.tsx`**
- Query `coach_athlete_assignments` to get all athlete IDs for the current coach
- For each athlete, fetch all their `training_plans` (via org membership) -> latest `plan_versions` -> `planned_sessions`
- Also fetch each athlete's `profiles.fitness_level` for experience-based thresholds
- Determine "current week" by computing which week_number maps to today's date (same logic used in Schedule page)
- Run `analyzeWeeklyLoad()` from `trainingGuardrails.ts` per athlete per current week
- Filter to athletes with any warnings at "caution" or "danger" level
- Render a card with:
  - Red/amber header based on worst risk level across all athletes
  - Per-athlete row: avatar/initials, name, risk badge, top warning summary (e.g., "Weekly Mileage 62/55km"), expandable detail
  - Click navigates to a future athlete detail view (or no-op for now)

**2. Update `src/pages/CoachDashboard.tsx`**
- Import and render `<AthleteLoadAlertsPanel />` between the summary stats grid and the swap requests panel
- Wrapped in `motion.div variants={item}` for consistent animation

**3. Data flow**
```text
coach_athlete_assignments (coach_id = me)
  -> athlete_ids[]
  -> for each athlete:
       training_plans (org match) -> plan_versions (latest per plan) -> planned_sessions
       profiles.fitness_level
  -> analyzeWeeklyLoad(allSessions, currentWeek, fitnessLevel)
  -> filter warnings.length > 0
  -> render alerts
```

**4. Translation keys**
- Add `coachDashboard.loadAlerts`, `coachDashboard.loadAlertsDanger`, `coachDashboard.loadAlertsCaution`, `coachDashboard.noLoadAlerts` to `en.json` and `pt-BR.json`

### No database changes needed
All data already exists in `planned_sessions`, `profiles`, and `coach_athlete_assignments`. The `analyzeWeeklyLoad` function handles all computation client-side.

