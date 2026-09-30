# HYROX Coach OS — Claude Code Reference

## Project overview

A multi-tenant HYROX coaching platform. Coaches manage athletes; athletes self-serve training plans and session logs. Built on React + TypeScript (Vite), Supabase (Postgres + Edge Functions), shadcn/ui, Recharts.

Live app managed by Lovable (project ID `32016a2e-7fa6-4e0d-9b0a-1626d38df80c`). GitHub repo: `leferreirasouza/hybridathletictraining`.

## CRITICAL: How deployment works

**Git push alone does NOT deploy Supabase Edge Functions — and "Lovable says it deployed" is not sufficient proof either.**

- **Database migrations**: Apply via Lovable MCP tool (`mcp__Lovable__query_database`) or paste SQL into Lovable's chat. Migrations in `supabase/migrations/` are committed for record-keeping only.
- **Edge Functions**: Must be pasted into Lovable's Build-mode chat. Lovable's agent deploys them. The Edge Functions dashboard timestamp is unreliable — only functional verification (query the DB for expected side effects) confirms a deploy is live.
- **Frontend/UI**: Lovable auto-syncs from the `main` branch. Merge to main, then ask Lovable to redeploy if needed.
- **Branch strategy**: Claude Code remote sessions auto-create a branch (`claude/access-github-project-a0Qer`). Work there, open a PR, merge to main when done. Do not accumulate long-lived feature branches. When the branch's last PR was merged, restart it from `origin/main` before starting new work — `main` regularly moves ahead of this branch via direct Lovable-chat sessions the user runs without Claude Code.
- **Verified incident (2026-09-21):** the 2026-07-02 migration (`strava_sync_and_token_encryption.sql`) was reported deployed but **silently never applied to the live database for ~2.5 months**. Dependent Edge Functions (`strava-webhook`, `garmin-webhook`, `garmin-oauth`) ran against tables/columns that didn't exist that whole time. It was only caught when someone re-queried `information_schema.tables` directly. **Lesson: after any migration or function "deploy," independently re-verify against the live DB/behavior — don't trust the deploy confirmation message alone**, whether it comes from Lovable's agent or from Claude.

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

**Known governance gap (2026-07 to 2026-09):** the MCP/OAuth server (below) and several auth/security-adjacent fixes were built directly by Lovable, without hand-review at build time, during a 3-month stretch this project ran without Claude Code involvement. A 2026-09-30 audit found the implementation solid (see MCP section below) but it had not received the human/hand-coded review this table calls for. Treat any Lovable-authored change touching auth, tokens, or cross-tenant data access as needing a retroactive review pass if one hasn't happened yet — check git history/commit dates before assuming a security-sensitive area is already vetted.

## Key shared modules (all in `supabase/functions/_shared/`)

- `paceZones.ts` — Daniels VDOT: `estimateVDOT()`, `paceZonesFromVDOT()`, `decomposeHyroxTarget()`. Injected into prompt as "COMPUTED PACE ZONES (do not invent your own)."
- `phaseModel.ts` — Periodization: `buildPhaseSchedule(planWeeks, experience)` → base/build/peak/taper per-week table injected into prompt.
- `sessionSlots.ts` — Slot allocation: `assignWeeklySlots()` → deterministic run/strength/mobility_technique counts per week. `validateSlotCompliance()` → post-gen check writing to `periodization_adjustments`.
- `interferenceRules.ts` — `detectInterferenceConflicts()` (Hickson same-day/adjacent-day flagging), `tsbAdjustmentFactor(tsb)` (fresh/neutral/fatigued/high_risk bands → intensity/volume caps). **`periodization_adjustments` has zero rows in production, ever, as of 2026-09-30** — this module has never been functionally confirmed to fire in the live app. Needs a deliberate test (seed a conflict, regenerate a plan, check for a row) before trusting it's actually active.
- `runVolumeProgression.ts` — `buildRunVolumePlan()`: deterministic weekly running-volume ramp from the athlete's reported current km/week, respecting the 10%-rule week-over-week (`baseline * 1.1^(week-1)`) and an absolute 2.75x ceiling, scaled by `phaseModel.ts`'s per-week `volumeMultiplier`. Injected into `generate-plan`'s prompt as the authoritative per-week/per-slot km source of truth. Extended (2026-09) with a `week1CapKm` guardrail that clamps a self-reported baseline to 1.10x the athlete's *verified* trailing 4-week average (sourced from `recentTraining.ts`), plus return-from-layoff easing when no recent runs are detected. The wizard's `RunDaysCountStep.tsx` preview math must stay aligned to this exact formula — they drifted once already; re-check both sides if either changes.
- `recentTraining.ts` — 8-week trailing training summary from `completed_sessions` (weekly run km, discipline hours, avg pace/HR, days since last run, layoff detection at ≥14 days). **Deliberately duplicated** between here and the client copy at `src/lib/recentTraining.ts` (one runs server-side in Deno, one client-side) — kept aligned only by a code comment, no automated check. This is the same failure class that caused the `session_trimp()` bug below; if you touch one copy, touch both.
- `stravaMap.ts` — `mapStravaDiscipline()` (sport_type/type → discipline, with a HYROX-name-hint regex fallback for generic "Workout"/HIIT types), `matchStravaActivity()`/`ingestStravaActivity()`: the shared matching engine used by both `strava-webhook` and `strava-sync`. Dedups against Garmin-sourced completions within a 10-minute window, picks the closest-duration planned-session candidate (not just first same-date match), only enriches NULL fields on existing completions (never overwrites manual data), falls back to an unplanned completion so history/load still sees the work.
- `tokenCrypto.ts` — `encryptToken()`/`decryptToken()` (AES-256-GCM via Web Crypto, `enc:v1:`-prefixed so legacy plaintext rows transition safely — `decryptToken()` returns non-prefixed values as-is) and `hashToken()` (HMAC-SHA256, non-secret lookup key, separate key from the encryption key). Used for all Garmin/Strava OAuth token storage. **`TOKEN_ENCRYPTION_KEY`/`TOKEN_LOOKUP_HMAC_KEY`/`STRAVA_WEBHOOK_VERIFY_TOKEN` were pasted as literal plaintext values into a Lovable chat message on 2026-07-02** — rotating them (and re-running the backfill script) is recommended, not yet done as of 2026-09-30.
- `stravaToken.ts` — `getValidStravaAccessToken()` (decrypt/refresh-if-near-expiry/re-encrypt), `findUserIdByStravaAthleteId()`. **Note:** as of mid-2026 `hyrox-ai-coach` had its own separate, independently-written token-refresh code path that bypassed this helper, read tokens without decrypting, and wrote refreshed tokens back in plaintext — silently reintroducing the exposure this module exists to prevent. Fixed 2026-09-21 (that function now sources context from the DB instead of live Strava calls). If any other function ever needs live Strava token access, it must go through this module, not a bespoke implementation.

## Key edge functions (live, Lovable-managed)

- `generate-plan` — AI plan generation. Accepts optional `athleteId` + `organizationId` for coach-on-behalf-of-athlete flow, verified via `coach_athlete_assignments`. Uses `effectiveAthleteId` throughout (not raw `user.id`). Injects pace zones, phase table, slot table, run-volume table into prompt. Non-blocking `session_blocks` insert after `planned_sessions`.
- `hyrox-ai-coach` — Streaming chat with RAG (pgvector knowledge base). Hardened 2026-09-21: removed hard-coded per-athlete system prompts previously selected by matching the user's (editable) `full_name` — any user could rename themselves to obtain another athlete's personal AI context; replaced with a `coach_context` table. Also added request rate-limiting (30/hr) and message-length truncation, and removed the plaintext-token Strava bypass noted above.
- `weekly-report` — AI commentary on weekly summaries.
- `compute-training-load` — Banister TRIMP + CTL/ATL/TSB EWMA computation (daily cron). `session_trimp()` was fixed 2026-09-21 after being found to return **0** whenever a session had both `resting_hr` and `rpe` NULL — true for essentially every Strava-synced session, which had silently zeroed out training-load data for the engine's entire real-world usage window. Now falls back to `COALESCE(resting_hr,60)`/`COALESCE(max_hr,190)` and an RPE- or duration-based estimate. All historical data was recomputed after the fix.
- `strava-connect` / `strava-activities` — OAuth2 connect + activity-list proxy fetch. Tokens encrypted at rest. `strava-connect` now fires an async `strava-sync` backfill immediately after first token exchange.
- `strava-sync` — **(new, 2026-09)** Historical backfill + resumable cron sync, sharing `_shared/stravaMap.ts` with the webhook. Two auth modes: user JWT (syncs caller) or `x-cron-secret` (loops all connected users). First run backfills 180 days; later runs resume from `last_sync_at` with a 6h overlap. Respects Strava rate-limit headers, 90s soft deadline with resumable cursoring, fetches full detail only for the most recent 30 activities per run. **Confirmed live and working**: 210 rows in `strava_activities`, 202 `completed_sessions` with `source='strava'` as of 2026-09-30.
- `strava-webhook` — Real-time Strava sync: GET handshake + POST event delivery, acks within Strava's 2s window, does activity-fetch/match/insert in the background via `EdgeRuntime.waitUntil`. Rewritten 2026-09 to share matching logic with `strava-sync` via `stravaMap.ts`, add malformed-body tolerance, an optional `STRAVA_WEBHOOK_SUBSCRIPTION_ID` check, and — importantly — the deauth handler no longer trusts an unsigned `authorized:false` payload; it now probes Strava's `/athlete` endpoint with the stored token and only deletes the connection on a confirmed 401 (previously spoofable). **Whether the Strava push-subscription registration (`push_subscriptions`, one per app) was actually completed was never confirmed** — the 210 synced activities above could be entirely from `strava-sync`'s backfill/manual path, not proof the real-time webhook is receiving live pushes. Needs a direct check.
- `garmin-oauth` / `garmin-webhook` — OAuth1.0a handshake + push-notification receiver; same same-date+discipline auto-match pattern as Strava. Code-complete, tokens encrypted at rest. `garmin-webhook` got a legacy-row fallback (2026-07-06): for `garmin_connections` rows where `access_token_hash` is still NULL (pre-dating the hash column), it decrypts and plaintext-compares against incoming tokens, then backfills the hash — self-healing, bounded to old rows, doesn't weaken the primary hash-lookup path. Minor: uses a non-constant-time `Array.includes` for that fallback comparison (low severity, not yet fixed). **Still fully inert in production**: 0 rows in `garmin_connections`/`garmin_activities` — blocked on Garmin's Connect Developer Program, which was confirmed suspended for new applications in July 2026 with no announced reopening date. Re-check developer.garmin.com before re-litigating (it blocks automated fetches, needs a human check) — last checked 2026-07, not re-checked since.
- `mcp` — **(new, 2026-07/09)** An MCP (Model Context Protocol) server exposing 7 read-only tools to external AI agents: `get_todays_session`, `list_upcoming_sessions`, `list_recent_completions`, `get_training_load`, `get_goal_race`, `list_strava_activities`, `get_weekly_rollup`. This file is an auto-generated bundle of `src/lib/mcp/index.ts` + `src/lib/mcp/tools/*.ts` (edit the source there, not this file directly). Auth via `@lovable.dev/mcp-js`'s `auth.oauth.issuer`, validating real Supabase-issued JWTs (audience `authenticated`) — not a bespoke API key scheme. Every tool handler forwards the caller's own bearer token (not service-role) so Postgres RLS applies, *and* additionally filters explicitly by the caller's own user/athlete id — defense in depth. A 2026-09-30 audit found no cross-user leakage in any of the 7 tools. `config.toml` has `verify_jwt = false` (expected — the SDK does its own JWT verification internally, same as other public functions here). Consent flow: `src/pages/OAuthConsent.tsx`, backed by Supabase Auth's own hosted OAuth-provider feature (not custom-built token storage — no `oauth_clients`/`oauth_tokens` tables exist in this app's schema, that state lives in Supabase's managed auth service). **Per the governance policy above, this whole area has been code-audited but not yet given an explicit human sign-off** — do that before treating it as fully trusted, especially the product question of whether exposing training/health-adjacent data to third-party AI clients needs its own privacy sign-off independent of the code being well-scoped.
- `cron-dispatcher` — scheduled job dispatcher (`session-reminders`, `weekly-reports`, `race-scrape`, `compute-training-load`), all jobs correctly use `x-cron-secret`.
- `ingest-knowledge` — hardened 2026-09-21 with SSRF/path validation on the URL scraper.
- `import-plan`, `parse-exercise-screenshot`, `parse-race-screenshot`, `scrape-hyrox-races`, `seed-exercise-library`, `invite-user`, `delete-user` — unchanged since the last review pass, still live.

## Key database tables

- `profiles` — athlete/coach identity, `goal_race_date`, `goal_race_name`, `goal_finish_time_seconds`, `goal_run_split_seconds_per_km`
- `training_preferences` — per-athlete training config: `available_days`, `strength_days`, `mobility_days`, `run_type_weights`, `strength_sessions_per_week`, `mobility_technique_sessions_per_week`, `muscle_focus`, `mobility_tech_weights`, `equipment` (shape: `{preset, items: {...}}` — read defensively as `equipment.items ?? equipment` for old flat rows)
- `training_load_daily` — daily CTL/ATL/TSB actuals (computed by cron). 413 rows live as of 2026-09-30; values were wrong (often literally 0) before the `session_trimp()` fix — see above.
- `planned_sessions` — AI-generated sessions; always set `athlete_id: effectiveAthleteId` (bug if missing)
- `session_blocks` — structured warmup/sets/cooldown per session; block_type includes `superset`; columns: `part_number`, `superset_group`, `repeat_count`, `equipment`, `muscle_group`, `target_pace_label`
- `periodization_adjustments` — pending coach-review suggestions from interference/TSB checks; status: `pending_coach` | `active` | `cancelled`. **0 rows ever, as of 2026-09-30 — functionally unverified in production**, see `interferenceRules.ts` note above.
- `weekly_summaries` — plan-template targets per week (not actuals); has `phase` column
- `coach_athlete_assignments` — RLS join used by coach-on-behalf-of-athlete auth pattern
- `session_substitutions` — swap requests; approval pattern is the reference for `periodization_adjustments`
- `strava_connections` / `garmin_connections` — OAuth token storage, encrypted at rest (`enc:v1:`-prefixed). `garmin_connections.access_token_hash` is a non-secret HMAC lookup key — `garmin-webhook` resolves which user a payload belongs to via this hash, not by comparing ciphertext.
- `strava_activities` / `garmin_activities` — synced activity data; `completed_session_id` back-reference used for match dedup/idempotency on webhook retries. `strava_activities` also has an `ignored` flag (athlete-owned UPDATE policy) for `StravaInbox.tsx`'s review queue.
- `completed_sessions.source` — `manual` | `garmin` | `strava` provenance column.
- `parq_responses` / `fitness_assessments` — **(new, 2026-09)** pre-participation health-screening intake, filled during `Onboarding.tsx` (`ParqStep.tsx`, `FitnessAssessmentStep.tsx`). RLS was found and fixed to be org-scoped for admin reads (2026-09-21; previously any admin/master_admin could read any org's rows). **0 rows in production as of 2026-09-30 — never smoke-tested with a real signup**, worth confirming the save path actually works given this is a safety-relevant screening form.
- `coach_context` — **(new, 2026-09)** per-athlete AI coaching context, replacing the hard-coded name-matched system prompts removed from `hyrox-ai-coach` (see above).
- `direct_messages` — **(new, undocumented until now)** backs `src/pages/Messages.tsx`, a direct-messaging feature between coach and athlete. Not previously planned/tracked; confirm current scope/intent before extending it.
- `knowledge_documents` / `knowledge_chunks` — RAG knowledge base for `hyrox-ai-coach`. RLS tightened 2026-07/09 to require org-scoped admin/coach roles (previously a global role check let any org's coach/admin write into another org's knowledge base).
- `audit_logs` — admin-read RLS also fixed to be org-scoped 2026-09-21 (same bug class as `parq_responses`/`fitness_assessments` above).
- `plan_history` — INSERT policy fixed 2026-09-21 to require `performed_by = auth.uid()` plus verified ownership/staff role on the parent plan (previously any signed-in user could forge history rows for any plan).

## Key frontend files

- `src/pages/CoachDashboard.tsx` — coach hub; renders `PeriodizationAdjustmentsPanel`, `AthleteLoadAlertsPanel`, `SwapRequestsPanel`
- `src/pages/PlanBuilder.tsx` — coach plan management: `CurrentPlansTab` (active/archived plans, "New Plan" entry point) + "Fine-tune a Plan" mode (diff-based editor on an existing AI-generated plan, gated behind plan selection)
- `src/pages/PlanCreationWizard.tsx` + `src/components/plan-wizard/` — the athlete/coach-facing plan-creation flow. Data-driven step sequence (`wizardSteps.config.ts`), autosaves to `localStorage` per-user, shows a real post-generation plan preview before handing off to `/schedule`.
- `src/pages/Onboarding.tsx` — signup flow; now includes `ParqStep.tsx` and `FitnessAssessmentStep.tsx` (health-screening intake, see tables above).
- `src/pages/Messages.tsx` — **(new)** direct messaging between coach/athlete, backed by `direct_messages`.
- `src/pages/OAuthConsent.tsx` — **(new)** third-party MCP OAuth consent screen, see `mcp` edge function above. Shows a static hardcoded description of tool access rather than rendering actual requested scopes — will go stale as tools are added; worth revisiting if the scope list grows.
- `src/components/strava/StravaInbox.tsx` — **(new)** review queue for Strava activities that didn't auto-match a planned session (`completed_session_id IS NULL`, last 60 days): link to a session, log unplanned, or ignore.
- `src/components/profile/StravaCard.tsx` — connection card, extended with a manual "Sync Now" button (calls `strava-sync`) and `last_sync_at`/`last_sync_status`/`last_sync_count` display.
- `src/lib/calendarExport.ts` — Google/Outlook "quick-add" URL builders + Apple `.ics` download. One-shot, unauthenticated, client-side only — not a real Calendar API integration, no two-way sync (by design, not a gap).
- `src/lib/trainingGuardrails.ts` — deterministic safety rules (10%-rule, weekly caps, 80/20 check); complementary to, not replaced by, the load engine
- `src/lib/recentTraining.ts` — client-side copy of `_shared/recentTraining.ts`, see duplication note above.
- `src/lib/mcp/` — source for the `mcp` edge function bundle, see above.
- `src/lib/auditLog.ts` — `AuditAction` type; add new action types here when adding approval flows
- `src/components/ui/progress.tsx` — used by the plan wizard's top progress bar.

## Current roadmap status (as of 2026-09-30)

**Confirmed working in production (verified via live DB query, not just code review):**
- Strava sync end-to-end: OAuth connect → auto-triggered historical backfill (`strava-sync`) → real-time webhook → shared match engine (`stravaMap.ts`) → manual review UI (`StravaInbox.tsx`). 210 synced activities, 202 auto-matched completions.
- Training-load engine (CTL/ATL/TSB), after the `session_trimp()` fix — 413 days of computed load data.
- Race calendar scraper (1,466 races), wizard plan generation (7 plans / 265 sessions across 15 profiles).
- MCP server + OAuth consent flow (code-audited, see `mcp` section — needs the explicit human sign-off noted there).
- A major security-hardening pass (2026-09-21): fixed cross-org admin-read leaks on `parq_responses`/`fitness_assessments`/`audit_logs`, fixed a name-based AI-prompt impersonation bug, fixed unrestricted `plan_history` inserts, hardened `ingest-knowledge` against SSRF, added `hyrox-ai-coach` rate limiting, removed a second plaintext-token exposure.

**Shipped but functionally unverified — check before relying on these:**
- `periodization_adjustments` (interference/TSB-cap engine) — 0 rows, ever. See verification plan below.
- `parq_responses`/`fitness_assessments` onboarding intake — 0 rows, ever, despite being wired into signup.
- Strava real-time webhook push subscription — sync data exists, but could be entirely from backfill; the actual push-subscription registration was never confirmed done.

**Blocked on external vendor action, not a code gap:**
- Garmin OAuth/live-sync and Training API (push-to-watch): code complete, tokens encrypted, but Garmin's Connect Developer Program is suspended for new applications (confirmed July 2026, not re-checked since). User has never applied.
- Oura/Whoop: not started, sequenced after Garmin.

**Security hygiene still open:**
- `TOKEN_ENCRYPTION_KEY`/`TOKEN_LOOKUP_HMAC_KEY`/`STRAVA_WEBHOOK_VERIFY_TOKEN` were pasted in plaintext into a Lovable chat message (2026-07-02) — rotation recommended, not yet done.
- `recentTraining.ts` client/edge duplication — no automated drift check.
- Non-constant-time token comparison in `garmin-webhook`'s legacy fallback path.

**Not started:**
- Phase 4: Stripe/billing — zero code, zero dependencies.
- Phase 5: Native watch apps (contractor track) — folds into the Garmin Training API blocker above.
- Full i18n key extraction for the wizard — every string is hardcoded English while the rest of the app uses `react-i18next` throughout (including `pt-BR`).

## Full plan

See `/root/.claude/plans/toasty-soaring-gosling.md` for the complete decision log, architecture detail, and the current prioritized 10-item backlog.
