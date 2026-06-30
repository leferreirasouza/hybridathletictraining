# HYROX Coach OS — Claude Code Reference

## Project overview

A multi-tenant HYROX coaching platform. Coaches manage athletes; athletes self-serve training plans and session logs. Built on React + TypeScript (Vite), Supabase (Postgres + Edge Functions), shadcn/ui, Recharts.

Live app managed by Lovable (project ID `32016a2e-7fa6-4e0d-9b0a-1626d38df80c`). GitHub repo: `leferreirasouza/hybridathletictraining`.

## CRITICAL: How deployment works

**Git push alone does NOT deploy Supabase Edge Functions.**

- **Database migrations**: Apply via Lovable MCP tool (`mcp__Lovable__query_database`) or paste SQL into Lovable's chat. Migrations in `supabase/migrations/` are committed for record-keeping only.
- **Edge Functions**: Must be pasted into Lovable's Build-mode chat. Lovable's agent deploys them. The Edge Functions dashboard timestamp is unreliable — only functional verification (query the DB for expected side effects) confirms a deploy is live.
- **Frontend/UI**: Lovable auto-syncs from the `main` branch. Merge to main, then ask Lovable to redeploy if needed.
- **Branch strategy**: Claude Code remote sessions auto-create a branch (`claude/access-github-project-a0Qer`). Work there, open a PR, merge to main when done. Do not accumulate long-lived feature branches.

## Governance policy

| Work type | Who writes it |
|-----------|--------------|
| Auth, OAuth, Stripe/billing | Hand-coded (Claude) |
| Training-load math (CTL/ATL/TSB, VDOT, pace zones) | Hand-coded (Claude) |
| Periodization logic (phase model, slot allocation, interference rules) | Hand-coded (Claude) |
| SQL migrations | Hand-coded (Claude) |
| Read-only dashboards, charts, approval-workflow UI reusing existing patterns | Lovable-safe |
| Wizard/onboarding step components | Lovable-safe |
| shadcn/ui component wiring | Lovable-safe |

When in doubt: if it's wrong and silently corrupts athlete safety data, it's hand-coded.

## Key shared modules (all in `supabase/functions/_shared/`)

- `paceZones.ts` — Daniels VDOT: `estimateVDOT()`, `paceZonesFromVDOT()`, `decomposeHyroxTarget()`. Injected into prompt as "COMPUTED PACE ZONES (do not invent your own)."
- `phaseModel.ts` — Periodization: `buildPhaseSchedule(planWeeks, experience)` → base/build/peak/taper per-week table injected into prompt.
- `sessionSlots.ts` — Slot allocation: `assignWeeklySlots()` → deterministic run/strength/mobility_technique counts per week. `validateSlotCompliance()` → post-gen check writing to `periodization_adjustments`.
- `interferenceRules.ts` — `detectInterferenceConflicts()` (Hickson same-day/adjacent-day flagging), `tsbAdjustmentFactor(tsb)` (fresh/neutral/fatigued/high_risk bands → intensity/volume caps).

## Key edge functions (live, Lovable-managed)

- `generate-plan` — AI plan generation. Accepts optional `athleteId` + `organizationId` for coach-on-behalf-of-athlete flow, verified via `coach_athlete_assignments`. Uses `effectiveAthleteId` throughout (not raw `user.id`). Injects pace zones, phase table, slot table into prompt. Non-blocking `session_blocks` insert after `planned_sessions`.
- `hyrox-ai-coach` — Streaming chat with RAG (pgvector knowledge base).
- `weekly-report` — AI commentary on weekly summaries.
- `compute-training-load` — Banister TRIMP + CTL/ATL/TSB EWMA computation (daily cron).

## Key database tables

- `profiles` — athlete/coach identity, `goal_race_date`, `goal_race_name`, `goal_finish_time_seconds`, `goal_run_split_seconds_per_km`
- `training_preferences` — per-athlete training config: `available_days`, `strength_days`, `mobility_days`, `run_type_weights`, `strength_sessions_per_week`, `mobility_technique_sessions_per_week`, `muscle_focus`, `mobility_tech_weights`, `equipment` (shape: `{preset, items: {...}}` — read defensively as `equipment.items ?? equipment` for old flat rows)
- `training_load_daily` — daily CTL/ATL/TSB actuals (computed by cron)
- `planned_sessions` — AI-generated sessions; always set `athlete_id: effectiveAthleteId` (bug if missing)
- `session_blocks` — structured warmup/sets/cooldown per session; block_type includes `superset`; columns: `part_number`, `superset_group`, `repeat_count`, `equipment`, `muscle_group`, `target_pace_label`
- `periodization_adjustments` — pending coach-review suggestions from interference/TSB checks; status: `pending_coach` | `active` | `cancelled`
- `weekly_summaries` — plan-template targets per week (not actuals); has `phase` column
- `coach_athlete_assignments` — RLS join used by coach-on-behalf-of-athlete auth pattern
- `session_substitutions` — swap requests; approval pattern is the reference for `periodization_adjustments`

## Key frontend files

- `src/pages/CoachDashboard.tsx` — coach hub; renders `PeriodizationAdjustmentsPanel`, `AthleteLoadAlertsPanel`, `SwapRequestsPanel`
- `src/pages/PlanBuilder.tsx` — manual plan editor (being demoted to "Fine-tune a Plan" secondary mode)
- `src/pages/AthletePlanForm.tsx` — current athlete plan creation form (being replaced by wizard)
- `src/pages/Onboarding.tsx` — step-state pattern reference for the new wizard
- `src/pages/TrainingPreferences.tsx` — training preferences page (Lovable-built)
- `src/lib/trainingGuardrails.ts` — deterministic safety rules (10%-rule, weekly caps, 80/20 check); complementary to, not replaced by, the load engine
- `src/lib/auditLog.ts` — `AuditAction` type; add new action types here when adding approval flows
- `src/components/ui/progress.tsx` — unused until the new wizard (first real usage goes there)

## Current roadmap status (as of 2026-06-30)

**Done and deployed:**
- Phase 0/1: `training_load_daily` table, Banister TRIMP + CTL/ATL/TSB engine, TSB charts, fatigue badges on CoachDashboard
- Phase 2 backend: `periodization_adjustments` table, `interferenceRules.ts`, TSB-aware prompt injection in `generate-plan`, post-gen interference detection, `PeriodizationAdjustmentsPanel`
- Plan Generator Rework Phase A: `paceZones.ts`, `phaseModel.ts`, `sessionSlots.ts` wired into `generate-plan`
- Phase B backend: coach auth (`athleteId` param + `coach_athlete_assignments` verify), `planned_sessions.athlete_id` bug fixed, equipment injected into prompt, `session_blocks` non-blocking insert, migration `20260623000000_wizard_and_session_blocks.sql` live

**In progress (Lovable building):**
- Step-wizard UI (`PlanCreationWizard.tsx` + `steps/*.tsx`) — Message 2 sent to Lovable
- Equipment preset-card UI — Message 3 to send after wizard confirmed
- `PlanBuilder.tsx` demotion to "Fine-tune a Plan" — Message 4 to send after equipment confirmed

**Pending (Claude's role after Lovable ships wizard):**
- Verification pass: wizard fields → `training_preferences`, coach athleteId flow, `session_blocks` population, equipment round-trip, PlanBuilder diff-save

**Paused (resume after wizard ships):**
- Phase 3: Garmin live-sync OAuth, Oura/Whoop
- Phase 4: Stripe/billing
- Phase 5: Native watch apps (contractor track)

## Full plan

See `/root/.claude/plans/toasty-soaring-gosling.md` for the complete decision log, architecture detail, and verification checklists.
