

## Mobile Training Load Banner

### Problem
The `TrainingLoadCard` currently only renders in the desktop sidebar (`hidden lg:block`), so mobile users have no visibility into training load warnings.

### Solution
Create a new `TrainingLoadBanner` component — a compact, collapsible bar shown only on mobile (`lg:hidden`) placed just above the Tabs in `Schedule.tsx`.

### Implementation

**1. New component: `src/components/schedule/TrainingLoadBanner.tsx`**
- Accepts same props as `TrainingLoadCard` (sessions, weekNumber, experience)
- Runs `analyzeWeeklyLoad` to get metrics + warnings
- **Collapsed state** (default): Single-line bar showing Shield icon, risk level text ("All Safe" / "2 Warnings"), and a chevron toggle. Background color matches risk level (green/amber/red).
- **Expanded state**: Shows the same metrics grid and warning badges as `TrainingLoadCard`, using `Collapsible` from Radix.
- Returns null if no sessions for the week.

**2. Update `src/pages/Schedule.tsx`**
- Import `TrainingLoadBanner`
- Render `<div className="lg:hidden"><TrainingLoadBanner sessions={sessions} weekNumber={displayWeek} /></div>` just before the `<div className="grid grid-cols-1 lg:grid-cols-4">` block (inside the non-noPlan branch)

No database changes, no new translations needed (reuses existing risk labels).

