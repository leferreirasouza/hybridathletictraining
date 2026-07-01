
Two focused UX fixes.

## 1. Month + race-day navigation in Schedule (`src/pages/Schedule.tsx`)

Today the only way to move through a 12–24 week plan is the single-week `<` / `>` chevrons. Add coarser jumps next to them:

- Add `«` / `»` buttons that jump ±4 weeks (one "month"), clamped to `[1, maxWeek]`.
- Add a **"Race day"** button (target/flag icon) beside the existing **Today** button. Behavior:
  - If a goal race date exists on the profile (or the last week's `week_end`), jump `weekOffset` to that week and set `selectedDay` to the race weekday.
  - Otherwise jump to `maxWeek` (last week of the plan) with a small tooltip "Jump to final week".
- Show a compact "Week X / Y · ~Month M" label so the user can see plan progress at a glance.
- Same controls appear in `day` and `week` views (they share the nav row); `month` view already lists all weeks so no change there.

No changes to data fetching or plan generation — this is pure navigation state (`weekOffset` / `selectedDay`).

## 2. Plan management page for athletes

Athletes currently see `/plan-history` (archive + restore only). Coaches get the full `/plans` PlanBuilder with delete. Extend `PlanHistory.tsx` so athletes can also:

- **Toggle visibility on Schedule** — a "Show on Schedule" switch per plan. Persist the hidden set in `localStorage` (key `ha-hidden-plans:{userId}`), and have `useScheduleData` read it so hidden plans are filtered out of both the selector and the "All Plans" merged view.
- **Select / deselect as active** — a "View on Schedule" primary action per active plan that navigates to `/schedule` with the plan pre-selected (reuse existing `setSelectedPlanId`).
- **Delete permanently** — a destructive button behind a confirm dialog (same pattern as PlanBuilder's `handleDelete`, lines 267+). RLS already allows athletes to delete plans they created; for coach-assigned plans, hide the delete button and show only Archive.

Rename the page title/nav label from "History" to **"My Plans"** for athletes so it's discoverable as a management surface.

## Technical notes

- New Schedule nav buttons: reuse `Button variant="ghost" size="icon"`, icons `ChevronsLeft`, `ChevronsRight`, `Flag` from lucide-react.
- Race date source: `profiles.goal_race_date` (already selected elsewhere) — add a small query in `Schedule.tsx` or lift into `useScheduleData`.
- Hidden-plans persistence: read once on mount, write on toggle, broadcast via a simple `storage` event listener so Schedule updates live when the user comes back from PlanHistory.
- No DB migration needed. No edge function changes.

## Out of scope

- Bulk delete / multi-select.
- Reordering plans.
- Changing coach-side PlanBuilder behavior.
