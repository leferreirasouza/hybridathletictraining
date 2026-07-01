
## 1. Add "current weekly running volume" to the run-days step

Volume matters more than day-count for injury-safe progression, so we capture it right next to "how many days do you currently run".

**`src/components/plan-wizard/wizardTypes.ts`**
- Add `currentWeeklyKm?: number` to `WizardAnswers`.

**`src/components/plan-wizard/steps/RunDaysCountStep.tsx`**
- Add a second input above the target slider: **"Current weekly running volume (km)"** — number input, min 0, step 1.
- Rework the warning banner to combine both signals:
  - If the target implies more than **+10% weekly km** relative to `currentWeeklyKm`, show a volume-overshoot warning ("Increasing weekly volume by more than ~10% raises injury risk").
  - Keep the existing day-count overshoot warning (+1 day rule) but demote it — volume overshoot takes precedence when both trigger.
  - When `currentWeeklyKm` is 0/blank, show the neutral copy.
- Estimate implied target volume from `runDaysPerWeek` using a simple heuristic (e.g. current avg per session × target days) purely for the warning message — nothing is persisted beyond `currentWeeklyKm` and `runDaysPerWeek`.

**`src/components/plan-wizard/steps/ReviewStep.tsx`**
- Show `currentWeeklyKm` in the summary block alongside current/target run days.

**`generate-plan` edge function prompt (small addition, no logic change)**
- Include `currentWeeklyKm` in the athlete-context block so the AI respects the 10 %-rule when scheduling weekly mileage. No changes to guardrails or slot allocation.

## 2. Make mobility / physio sessions truly optional

The slider already allows 0, but the flow still forces the user through the focus-weighting step and the review implies a session will happen.

**`src/components/plan-wizard/steps/SessionCountStep.tsx`** (mobility variant only)
- Update copy to make "0 = skip entirely" explicit and rename the header to **"Mobility / physio sessions (optional)"**.
- Default value stays 0 (currently defaults to 0 via `?? 0`).

**`src/components/plan-wizard/wizardSteps.config.ts`**
- In `buildWizardSteps`, only push `'mobilityFocus'` when `answers.mobilitySessionsPerWeek && answers.mobilitySessionsPerWeek > 0`. Users who pick 0 skip straight to Review.

**`src/components/plan-wizard/steps/ReviewStep.tsx`**
- When `mobilitySessionsPerWeek === 0`, show "Mobility: skipped" instead of listing focus weights.

## Out of scope

- No schema changes — `currentWeeklyKm` is a wizard-only input consumed by the AI prompt; we can persist it to `training_preferences` in a follow-up if you want it tracked over time.
- No changes to strength or equipment steps.
