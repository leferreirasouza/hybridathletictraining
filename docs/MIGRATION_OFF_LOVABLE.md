# Migration off Lovable (website + backend), then the iPhone app

_Written 2026-10-26. Status markers: ✅ done (with the PR), ⏳ waiting on the owner._

## Context
The owner wants Hybrid Athletics (to become "Hybrid Engine") to run outside Lovable. They also want an App Store app, because Apple Health and Apple Watch need native code (see `Wearables_Plan_Apple_Health_Garmin.md` §3 and §5).

Lovable has caused the project's worst incidents:
- a migration reported as applied that never ran, for 2.5 months;
- a merge to `main` that is not live until someone remembers to republish;
- post-publish checks that only ever load the logged-out page (the dark screen of 2026-10-26);
- unreviewed direct-chat changes in hand-coded categories (Stripe);
- secrets pasted into chat.

Owning the stack gives repeatable deploys from git, real CI, our own secrets, and stable URLs. Apple sign-in, Universal Links, Strava callbacks and HealthKit all need those stable URLs anyway, so the App Store app is built on top of the move, not before it.

**Live inventory (queried 2026-10-26):**
- **Database:** Postgres 17.6, 50 MB, 40 public tables, 21 public functions.
- **Extensions:** pg_cron, pg_net, vector, pgcrypto, uuid-ossp, supabase_vault, pg_stat_statements.
- **Scheduled jobs:** 5 pg_cron jobs, calling `cron-dispatcher` with `x-cron-secret`.
- **Users:** 16 auth users (16 email identities, 2 also Google).
- **Storage:** 3 buckets holding 1 object in total.
- **Edge functions:** 24.
- **Migration files:** 60 in `supabase/migrations` and 4 in `drizzle/migrations`. Neither folder is authoritative.

**Lovable-specific code to replace:**

| Where | What it does today | Replacement |
|---|---|---|
| `src/integrations/lovable/index.ts` + `@lovable.dev/cloud-auth-js`, used in `src/pages/Auth.tsx` (Google/Apple buttons) | Lovable's managed OAuth broker | `supabase.auth.signInWithOAuth({ provider })`, with our own Google OAuth client and Apple Services ID configured in Supabase Auth |
| `LOVABLE_API_KEY` + `ai.gateway.lovable.dev` in 7 functions: generate-plan, hyrox-ai-coach, ingest-knowledge, parse-exercise-screenshot, parse-race-screenshot, seed-exercise-library, weekly-report | Gemini models via Lovable's gateway | A new `_shared/aiClient.ts` that calls Google's OpenAI-compatible Gemini endpoint with `GEMINI_API_KEY`. It keeps the same models and the same streaming shape, and is a one-file switch if the Anthropic/OpenAI decision in `docs/LOVABLE_HANDOVER.md` changes the provider later |
| `src/integrations/supabase/previewAuthStorage.ts` | Brokers auth storage for the Lovable editor preview | Delete it and use plain `localStorage` |
| `lovable-tagger` in `vite.config.ts` | Dev-only plugin | Remove |
| `@lovable.dev/mcp-js` Vite plugin (generates `supabase/functions/mcp/index.ts` from `src/lib/mcp/`), consent route `/.lovable/oauth/consent` | MCP server and its OAuth consent screen | Keep it if it builds standalone (it is a normal npm package; verify in step 1). Otherwise freeze the generated bundle in git. Move the route to `/oauth/consent` and set it as the consent URL in the new project's Auth settings |
| Supabase URL and anon key hard-coded in `vite.config.ts` and `supabase/config.toml` `project_id` | Points at Lovable Cloud | Per-environment `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Auth emails (signup confirmation, password reset) | Sent by Lovable Cloud | Our own SMTP (Resend) on the new domain, with SPF/DKIM |

**Gaps found while planning (both ✅ fixed in PR #27, 2026-10-26):**
- **Self-service account deletion was missing.** The Settings button only showed a "request sent" toast. Now `delete-user` `{ self: true }` deletes the account (App Store 5.1.1(v), LGPD).
- **RLS leak.** Any org member could read other athletes' assigned sessions, blocks and plan names. Now gated by `can_view_plan()`; unassigned team plans stay org-visible by design.

## Target architecture (recommended defaults; the owner can override)
- **Backend:** our own Supabase organisation.
  - Production project on the **Pro plan** (US$25/month: daily backups, no pausing) in **sa-east-1 (São Paulo)**, which keeps data close to users and simplifies the LGPD story.
  - A separate **staging** project (free tier) used for rehearsals and PR testing.
- **Frontend:** **Cloudflare Pages**. Free, commercial use allowed (Vercel's free tier is not), fast in Brazil, with a preview URL per PR.
- **Domain:** the final domain from the business plan (`hybridengine.com.br` + `.com`, pending the trademark check).
  - `app.<domain>` serves the web app.
  - The apex domain serves the marketing site later.
  - `api` is not needed: functions are served from `*.supabase.co`, and a Supabase custom domain is an optional add-on.
- **CI/CD (GitHub Actions):**
  - **On every PR:** `tsc`, vitest, `npm run build`, and `supabase db lint` against staging. Cloudflare posts the preview URL.
  - **On merge to `main`:**
    1. `supabase db push` (migrations);
    2. `supabase functions deploy` (all functions; deploying all 24 is cheap and removes the "redeploy importers of `_shared/`" trap);
    3. Cloudflare deploys the frontend.
  - **Afterwards:** a smoke job checks the health endpoint and the signed-in page via Playwright with a dedicated test athlete.
  - **Secrets:** stored in GitHub Environments (`staging`, `production`; production requires the owner's approval). Function secrets are set with `supabase secrets set`, never in chat.
- **Monitoring:** Sentry (free tier) in the frontend and edge functions, Better Stack uptime checks (free), and Supabase log drains.
- **Monthly cost:** about US$25 (Supabase) plus Gemini usage, plus domains (about R$40/year for `.com.br`, about US$12/year for `.com`). Everything else starts free.

## Step 0: Owner prerequisites (accounts only; no code)
1. Make the GitHub repo **private**. CI secrets will live next to it, and the business docs need a home.
2. Create:
   - a Supabase organisation, with the company once a CNPJ exists, else personal and transferred later;
   - a Cloudflare account;
   - a Resend account;
   - a Sentry account.
3. Buy the domain(s) and point DNS at Cloudflare.
4. Create the provider keys and credentials:
   - a **Gemini API key** in Google AI Studio, with billing on;
   - a **Google OAuth client** (Web);
   - an **Apple Services ID + key** for Sign in with Apple, which needs the Apple Developer account from the App Store track (until then, launch with Google and email only);
   - in the Strava app settings, an extra callback domain (Strava allows one domain, so it changes at cutover).
5. Write down which secrets exist today, by name only, from Lovable's Secrets UI. The new project gets **fresh values for every one of them**. That closes the 102-day-old exposure of `TOKEN_ENCRYPTION_KEY`, `TOKEN_LOOKUP_HMAC_KEY` and `STRAVA_WEBHOOK_VERIFY_TOKEN` (task #5) as a side effect.

## Step 1: De-Lovable the code (Claude, hand-coded; one PR, deployable to staging only)
1. ✅ `_shared/aiClient.ts` (`aiFetch`, `aiConfigured`): all 7 functions call it. Setting `GEMINI_API_KEY` switches to Google's OpenAI-compatible endpoint (same models); unset keeps the Lovable gateway. One log line per call (function, provider, model, status, latency).
2. ✅ Auth switch: `src/lib/oauthSignIn.ts` uses plain Supabase OAuth when `VITE_AUTH_MODE=supabase`, else Lovable's broker. ⏳ At cutover: remove `src/integrations/lovable/`, `previewAuthStorage.ts`, `lovable-tagger` and `@lovable.dev/cloud-auth-js`.
3. MCP:
   - ✅ `@lovable.dev/mcp-js` builds outside Lovable (`npm run build` regenerates the bundle in any environment; CI runs it).
   - ✅ `/oauth/consent` route added next to `/.lovable/oauth/consent`. ⏳ At cutover: set it as the consent URL in the new project's Auth settings.
   - Update the consent copy in `OAuthConsent.tsx` if needed.
4. Env-driven config: no hard-coded project URL or key. Create `.env.example`.
5. ✅ "Delete my account" in Settings (PR #27).
6. ✅ RLS leak fixed (PR #27), verified by impersonating all 15 users before/after.
7. Cron: store `CRON_SECRET` and the project URL in **Vault**, and have the 5 jobs read them (`vault.decrypted_secrets`) instead of embedding them in `cron.job.command`.
8. Schema baseline:
   - Generate the new project's schema from the **live** DB (`supabase db dump --schema public,storage` through a temporary connection, or reconstructed via `query_database` if Lovable Cloud gives no direct connection).
   - Commit it as `supabase/migrations/<date>_baseline.sql`.
   - Move the 60 old files plus `drizzle/` to `supabase/migrations_archive/` and delete `drizzle.config.ts`.
   - From then on, `supabase/migrations` is the single source of truth and CI applies it.
9. `supabase/config.toml`: new `project_id`, keep the 13 `[functions.*] verify_jwt` overrides, and add the auth redirect URLs.
10. Run `supabase gen types` in CI, replacing Lovable's `types.ts` regen.
11. ✅ `.github/workflows/ci.yml` (tsc, vitest, build on every PR and on main). ⏳ Deploy jobs once the new project exists.

## Step 2: Data export (verified before anything is deleted)
1. **Path A (official):** Lovable Cloud's database export. Limits: DB ≤ 15 GB, export file ≤ 5 GB, once per 24 h, project must be running. Then download the storage files.
2. **Check whether password hashes come along.** Sources disagree, so verify against the dump itself: count rows in `auth.users` with a non-null `encrypted_password` and never print the values.
3. **Path B (fallback, already proven possible):** `query_database` can read the `auth` schema, so `auth.users` and `auth.identities` (16 + 18 rows) and every public table can be copied as `INSERT`s from inside the session. At 50 MB this is practical.
4. If neither path yields hashes, users get a one-time "set your password" email at cutover. Google sign-in users are unaffected, because their identity is keyed by email and provider id.
5. **Strava tokens:** don't migrate the encrypted tokens (old key). Delete the `strava_connections` row(s) (1 today, the owner's) and reconnect after cutover. `strava_activities` and completions are kept, so no history is lost.

## Step 3: Staging rehearsal (the whole cutover, end to end, on throwaway data)
1. Apply the baseline to staging, import the export, recreate the buckets and object, enable the extensions, and create the cron jobs (disabled).
2. Set staging secrets, deploy all 24 functions from CI, and deploy the frontend preview.
3. **Checklist (Playwright and manual; each item checks the DB, not the UI message):**
   - **Sign-in:**
     - password sign-in with a migrated user;
     - Google sign-in;
     - signup sends an email via Resend;
     - password reset.
   - **Training features:**
     - Dashboard, /schedule, /races and /ai render signed in;
     - AI coach replies and writes an `ai_messages` row;
     - `generate-plan` creates sessions with `library_session_id`.
   - **Background jobs and integrations:**
     - each cron job fired once with the expected side effect (`training_load_daily.computed_at` advances);
     - Strava connect plus `strava-sync` on the owner's test account;
     - the MCP consent flow.
   - **Data and security:**
     - row counts match production for every table;
     - RLS impersonation tests pass (session library, the `planned_sessions` fix, `direct_messages`).
4. Record the timings, which set the length of the production freeze window.

## Step 4: Production cutover (about 2 h, low-traffic evening; 16 users)
1. Announce it a day ahead (email plus an in-app banner shipped through Lovable).
2. **Freeze:** disable the Lovable cron jobs, and set the Lovable site to a maintenance banner (one last Lovable change).
3. Do the final export, import into the new production project, and verify per-table row counts plus spot checks (latest CTL/ATL/TSB, 6 `roxfit` results, 28 library entries).
4. Set production secrets, deploy functions, enable the 5 cron jobs, and point DNS for `app.<domain>`.
5. Re-point the external services:
   - **Strava:** change the callback domain, then delete the old push subscription and register the new webhook via `strava-subscribe` (only one subscription per app is allowed);
   - **Google OAuth:** set the redirect URIs;
   - **Stripe:** configure the webhook directly on the new project (not live yet);
   - **Garmin:** use the new URLs in the Starter application;
   - **MCP clients:** re-authorise.
6. **Smoke test:** the full staging checklist, signed in, on production, plus one real Strava activity arriving through the push webhook. That also closes the open "real-time push unconfirmed" item.
7. Replace the old `*.lovable.app` site with a "we moved" redirect to the new domain. Then disconnect Lovable's GitHub sync so `main` no longer feeds it.
8. **Rollback:** until step 5 completes, re-enable the Lovable crons and remove the banner. Nothing was deleted, so the old stack is untouched. After step 5, rolling back means re-pointing Strava/DNS and accepting the loss of data written since the cutover (minutes to hours at this scale).
9. Keep the Lovable Cloud project intact but idle for **30 days**, then delete its data (LGPD data minimisation) and cancel the credits.

## Step 5: Governance after the move
- Rewrite CLAUDE.md's "How deployment works":
  - git plus CI is the only deploy path;
  - migrations live only in `supabase/migrations`;
  - "merged = deployed", with smoke tests as the proof.
  The "Lovable-safe" column becomes "any reviewed PR". `docs/LOVABLE_HANDOVER.md` is archived.
- Lovable can still be used as a **prototyping sandbox** (a remix with no production secrets) if the owner likes its UI speed, but it never touches production.

## Step 6: App Store track (starts after the cutover; details in the wearables doc §5)
**Prerequisites (owner, in parallel with steps 0–4):**
- CNPJ → D-U-N-S → Apple Developer as the company (US$99/year);
- a Mac with Xcode, or Codemagic;
- the final name and domain;
- the iPhone payment model. Recommendation: **(a)** web purchase, companion app with no buy button. Stripe gating isn't live yet anyway, so v1 is simply free in the app.

**Build steps:**
1. **Capacitor shell** (`@capacitor/core`, `@capacitor/ios`, bundle ID `br.com.hybridengine.app`).
   - Bundle the web build into the app, not a remote URL; that also avoids a 4.2 "wrapped website" rejection.
   - Disable the PWA service worker in the native build (`VITE_NATIVE=1`).
   - Add safe areas, status bar and keyboard plugins.
2. **Native auth (hand-coded):**
   - native Sign in with Apple → `supabase.auth.signInWithIdToken`;
   - Google and Strava OAuth through `ASWebAuthenticationSession` (Capacitor Browser), returning via **Universal Links** (`apple-app-site-association` served by Cloudflare Pages) to `/auth/callback`;
   - add the new redirect URLs to Supabase Auth and the Strava callback domain.
3. **HealthKit (hand-coded; feeds training-load math):**
   - read workouts, HR, HRV, resting HR and sleep, with a 2-year history import and background delivery;
   - a new `healthkit-ingest` function writes `completed_sessions` (`source='apple_health'`, with the same `activityQuality.ts` flags and a Strava/Garmin dedup window) and a unified `health_daily` table;
   - `readinessGates.ts`'s `mergeGarminDays` generalises to that table, so **readiness switches on for iPhone users**.
4. **Push notifications** (APNs key → the existing `session-reminders` cron).
5. **Compliance:**
   - the in-app delete account from step 1.5;
   - `PrivacyInfo.xcprivacy`;
   - HealthKit purpose strings;
   - a privacy policy section on Apple Health data (never used for ads, never sold);
   - the App Privacy label;
   - a demo athlete account for review.
6. **TestFlight** with the owner and a few HYROX athletes for 1–2 weeks, then submission and a phased release.
7. **Apple Watch workouts (WorkoutKit Swift plugin):** v1.1, after launch, so the first review stays simple.

**Rough timeline (part-time):**
- **Weeks 1–2:** steps 0–1.
- **Week 3:** steps 2–3 (staging rehearsal).
- **Week 4:** cutover.
- **Weeks 4–6:** Capacitor shell and native auth, running in parallel with company and Apple enrolment.
- **Weeks 6–8:** HealthKit and push.
- **Weeks 8–10:** TestFlight, then the App Store.
- **Garmin Starter:** whenever Garmin approves, independent of everything above.

## Verification (summary)
- Each code step: tsc, vitest, build in CI, then the staging deploy, then the checklist in step 3.
- Data migration: per-table row-count parity, plus spot checks of computed values, plus a signed-in login by a migrated password user.
- Cutover: the production smoke run, signed in; one real Strava push event; cron side effects on the next day; Sentry clean for 48 h.
- App: TestFlight install on the owner's iPhone; HealthKit workouts appear as `completed_sessions` with the right flags; readiness gates evaluate on real `health_daily` rows.

