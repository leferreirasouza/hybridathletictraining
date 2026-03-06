

## Plan: Assign Athletes to Plans from Current Plans Tab

### Problem
The Current Plans tab shows plans with archive/delete controls but no way to assign or reassign a plan to a specific athlete.

### Approach
Enhance the `CurrentPlansTab` component in `PlanBuilder.tsx` to:

1. **Fetch current assignments** — Query `planned_sessions` for each plan to show which athlete(s) are currently assigned (via `athlete_id` on sessions).

2. **Fetch org members** — Reuse the same assignee query pattern (from `user_roles` + `profiles`) to populate an athlete dropdown.

3. **Add "Assign Athlete" UI per plan card** — Show the currently assigned athlete name as a badge, plus a Select dropdown to reassign. On selection, bulk-update all `planned_sessions` rows for that plan's versions to the new `athlete_id`.

4. **Bulk update function** — `UPDATE planned_sessions SET athlete_id = ? WHERE plan_version_id IN (SELECT id FROM plan_versions WHERE plan_id = ?)`.

### UI Changes (CurrentPlansTab)
- Each plan card gets a new row below the metadata showing `Assigned to: [athlete name]` with a small Select to change.
- Uses the same `user_roles` + `profiles` query already in the parent component, passed as a prop or duplicated in `CurrentPlansTab`.
- The `UserCircle` icon indicates assignment status; unassigned plans show "Unassigned" in muted text.

### Files to Edit
- `src/pages/PlanBuilder.tsx` — Enhance `CurrentPlansTab` with assignee data, dropdown, and update logic.

### No Database Changes Needed
The `planned_sessions.athlete_id` column and relevant RLS policies already exist.

