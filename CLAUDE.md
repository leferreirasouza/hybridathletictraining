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
| Training-load math (CTL/ATL/TSB, VDOT, pace zones, run-volume progression) | Hand-coded (Claude) |
| Periodization logic (phase model, slot allocation, interference rules) | Hand-coded (Claude) |
| OAuth token storage/encryption, webhook signature/verification handshakes | Hand-coded (Claude) |
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
- `runVolumeProgression.ts` — `buildRunVolumePlan()`: deterministic weekly running-volume ramp from the athlete's reported current km/week, respecting the 10%-rule week-over-week (`baseline * 1.1^(week-1)`) and an absolute 2.75x ceiling, scaled by `phaseModel.ts`'s per-week `volumeMultiplier`. Injected into `generate-plan`'s prompt as the authoritative per-week/per-slot km source of truth. The wizard's `RunDaysCountStep.tsx` preview math must stay aligned to this exact formula — they drifted once already (frontend showed `Week 1 max` 10% higher than what the backend actually delivered; fixed, but re-check both sides if either changes).
- `tokenCrypto.ts` — `encryptToken()`/`decryptToken()` (AES-256-GCM via Web Crypto, `enc:v1:`-prefixed so legacy plaintext rows transition safely — `decryptToken()` returns non-prefixed values as-is) and `hashToken()` (HMAC-SHA256, non-secret lookup key, separate key from the encryption key). Used for all Garmin/Strava OAuth token storage.
- `stravaToken.ts` — `getValidStravaAccessToken()` (decrypt/refresh-if-near-expiry/re-encrypt), `findUserIdByStravaAthleteId()`.

## Key edge functions (live, Lovable-managed)

- `generate-plan` — AI plan generation. Accepts optional `athleteId` + `organizationId` for coach-on-behalf-of-athlete flow, verified via `coach_athlete_assignments`. Uses `effectiveAthleteId` throughout (not raw `user.id`). Injects pace zones, phase table, slot table, run-volume table into prompt. Non-blocking `session_blocks` insert after `planned_sessions`.
- `hyrox-ai-coach` — Streaming chat with RAG (pgvector knowledge base).
- `weekly-report` — AI commentary on weekly summaries.
- `compute-training-load` — Banister TRIMP + CTL/ATL/TSB EWMA computation (daily cron).
- `strava-connect` / `strava-activities` — OAuth2 connect + activity-list proxy fetch. Tokens encrypted at rest.
- `strava-webhook` — Real-time Strava sync: GET handshake (Strava subscription verification) + POST event delivery, acks within Strava's 2s window and does the activity-fetch/match/insert in the background via `EdgeRuntime.waitUntil`. Auto-matches activities to `planned_sessions` by same-date+discipline, inserts `completed_sessions` with `source: 'strava'`. **Written and migrated (2026-07-02), not yet deployed** — needs `STRAVA_WEBHOOK_VERIFY_TOKEN`/`TOKEN_ENCRYPTION_KEY`/`TOKEN_LOOKUP_HMAC_KEY` secrets set, pasted into Lovable's chat, and a one-time Strava `push_subscriptions` registration (curl command in the file's header comment) before it does anything.
- `garmin-oauth` / `garmin-webhook` — OAuth1.0a handshake + push-notification receiver; same same-date+discipline auto-match pattern as Strava (this is the pattern `strava-webhook` was templated from). Code-complete, HMAC bug fixed, tokens encrypted at rest — but **inert**: blocked on Garmin's Connect Developer Program (covers both Health API pull-sync and Training API push-to-watch), which is currently suspended for new applications with no announced reopening date. Not a code gap — see roadmap status below.

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
- `strava_connections` / `garmin_connections` — OAuth token storage, encrypted at rest (`enc:v1:`-prefixed). `garmin_connections.access_token_hash` is a non-secret HMAC lookup key — `garmin-webhook` resolves which user a payload belongs to via this hash, not by comparing ciphertext.
- `strava_activities` / `garmin_activities` — synced activity data; `completed_session_id` back-reference used for match dedup/idempotency on webhook retries.
- `completed_sessions.source` — `manual` | `garmin` | `strava` provenance column.

## Key frontend files

- `src/pages/CoachDashboard.tsx` — coach hub; renders `PeriodizationAdjustmentsPanel`, `AthleteLoadAlertsPanel`, `SwapRequestsPanel`
- `src/pages/PlanBuilder.tsx` — coach plan management: `CurrentPlansTab` (active/archived plans, "New Plan" entry point) + "Fine-tune a Plan" mode (diff-based editor on an existing AI-generated plan, gated behind plan selection)
- `src/pages/PlanCreationWizard.tsx` + `src/components/plan-wizard/` — the athlete/coach-facing plan-creation flow (replaced the old single-form `AthletePlanForm.tsx`). Data-driven step sequence (`wizardSteps.config.ts`), autosaves to `localStorage` per-user, shows a real post-generation plan preview (session list from `session_blocks`, not just a toast) before handing off to `/schedule`.
- `src/lib/calendarExport.ts` — Google/Outlook "quick-add" URL builders + Apple `.ics` download. One-shot, unauthenticated, client-side only — not a real Calendar API integration, no two-way sync (by design, not a gap).
- `src/lib/trainingGuardrails.ts` — deterministic safety rules (10%-rule, weekly caps, 80/20 check); complementary to, not replaced by, the load engine
- `src/lib/auditLog.ts` — `AuditAction` type; add new action types here when adding approval flows
- `src/components/ui/progress.tsx` — used by the plan wizard's top progress bar.

## Current roadmap status (as of 2026-07-02)

**Done and deployed:**
- Phase 0/1: `training_load_daily` table, Banister TRIMP + CTL/ATL/TSB engine, TSB charts, fatigue badges on CoachDashboard
- Phase 2 backend: `periodization_adjustments` table, `interferenceRules.ts`, TSB-aware prompt injection in `generate-plan`, post-gen interference detection, `PeriodizationAdjustmentsPanel`
- Plan Generator Rework (Phase A + B): `paceZones.ts`, `phaseModel.ts`, `sessionSlots.ts`, `runVolumeProgression.ts` wired into `generate-plan`; coach-on-behalf-of-athlete auth; `session_blocks` structured output
- **Full step-wizard shipped and live** (`PlanCreationWizard.tsx`), then hardened in a dedicated bug-fix pass: strength-days dead-end that could block wizard completion, frontend/backend volume-math mismatch, missing mobility days-of-week picker, post-generation plan preview (previously `session_blocks` was write-only from the athlete's perspective), accessibility/responsive/autosave/error-message polish
- "New Plan" entry point + archive/restore controls on `CurrentPlansTab`; `PlanBuilder.tsx`'s manual grid demoted to a gated "Fine-tune a Plan" diff-save mode
- Strava real-time sync backend: `strava-webhook`, `strava_activities` table, `completed_sessions.source`, same-date+discipline auto-match (same pattern `garmin-webhook` already had) — **written and migrated, not yet deployed**, see below
- Garmin + Strava OAuth token encryption at rest (was plaintext, contrary to the original integration plan)
- Calendar export bug fixes: Outlook timezone offset, missing `DTSTAMP`, date-drift risk when `planStartDate` wasn't passed

**Blocked on external vendor action, not a code gap:**
- Garmin OAuth/live-sync and Training API (push-to-watch): code is complete and correct (confirmed via git history + manual review), but Garmin's Connect Developer Program — the single program covering both the Health API (pull-sync) and Training API (push-to-watch) — is currently suspended for new applications, with the signup form removed and no announced reopening date. User has never applied. **Nothing to build here until Garmin reopens the program** — don't re-litigate this without checking developer.garmin.com first (it blocks automated fetches, so this needs a human check).
- Oura/Whoop: not started, was always sequenced after Garmin.

**Needs manual follow-up before Strava sync (above) actually works:**
1. Set 3 new Edge Function secrets in Lovable: `STRAVA_WEBHOOK_VERIFY_TOKEN` (any random string), `TOKEN_ENCRYPTION_KEY`, `TOKEN_LOOKUP_HMAC_KEY` (both 32-byte base64)
2. Paste `strava-webhook`, the updated `garmin-oauth`/`garmin-webhook`/`strava-connect`/`strava-activities`, and the new `_shared/tokenCrypto.ts`/`_shared/stravaToken.ts` into Lovable's Build-mode chat to deploy
3. Run the one-time Strava subscription registration (curl command documented in `strava-webhook/index.ts`'s header) — Strava allows exactly one subscription per app
4. Run `scripts/backfill-token-encryption.ts` once locally against prod to re-encrypt existing plaintext Garmin rows (Strava self-heals on its next refresh cycle)
5. Functionally verify `garmin-webhook` actually receives Garmin's calls now that `config.toml` has its `verify_jwt = false` entry (was previously missing — may mean Garmin's calls, if any occurred, were silently 401ing before this fix)

**Not started:**
- Phase 4: Stripe/billing
- Phase 5: Native watch apps (contractor track) — folds into the Garmin Training API blocker above, same vendor dependency
- Full i18n key extraction for the wizard — every string is hardcoded English while the rest of the app uses `react-i18next` throughout (including `pt-BR`). Explicitly deferred as its own large, translation-quality-sensitive pass, not bundled into other work.

## Full plan

See `/root/.claude/plans/toasty-soaring-gosling.md` for the complete decision log, architecture detail, and verification checklists.
