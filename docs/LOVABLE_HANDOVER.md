# Hybrid Athletics — Lovable handover (2026-10-25 → Friday)

Written by Claude Code for the owner, to keep the project moving in Lovable while Claude usage is paused. Work through it **stage by stage, in order**.

Each stage gives you:
- **Owner steps**: things only you can do, which cost no Lovable credits.
- **Prompts to paste into Lovable**, in grey boxes. Copy the box exactly.
- **Checks**: how to confirm it really worked. Never trust "deployed successfully" on its own; this project has been burned by that twice.
- **Stop if**: when to pause and wait for Claude instead of pushing on.

Lovable can read this file. Every prompt starts with "Read docs/LOVABLE_HANDOVER.md, stage X", so the agent always has the full context and rules.

---

## 0. One-time setup (do this first, about 2 minutes, no credits)

In Lovable, open **Project settings → Knowledge** and paste the block below. Lovable then follows these rules in every chat, even ones that don't mention this file.

```
PROJECT RULES (from docs/LOVABLE_HANDOVER.md, section 0) — always follow:

1. NEVER paste, print, log or ask for secret values (API keys, tokens, encryption keys) in chat or code. Secrets are set only by the owner in Project Settings → Edge Functions → Secrets.
2. DO NOT modify these hand-coded files unless a prompt from docs/LOVABLE_HANDOVER.md explicitly names the file and the change:
   supabase/functions/_shared/activityQuality.ts, stravaMap.ts, recentTraining.ts (and src/lib/recentTraining.ts),
   roxfitParse.ts, roxfitRaceResult.ts, raceDecomposition.ts, sessionLibrary.ts, readinessGates.ts, maxHrEstimate.ts,
   newSince.ts, paceZones.ts, phaseModel.ts, sessionSlots.ts, interferenceRules.ts, runVolumeProgression.ts,
   tokenCrypto.ts, stravaToken.ts, subscription.ts,
   and the SQL functions recompute_training_load / session_trimp.
   These hold training-load maths, periodization rules, data-quality rules, OAuth and encryption. A wrong change silently corrupts athlete data.
3. Never change a threshold or constant in those files "to make something work". Report the problem instead.
4. Database changes: write them as a migration file in supabase/migrations/ AND show me the SQL before running it. Every new table needs RLS enabled plus explicit policies. Never disable RLS.
5. After any edge-function change, redeploy only the functions named in the prompt, then verify with a SQL query that the expected rows or columns exist.
6. Keep English (src/i18n/locales/en.json) and Portuguese (pt-BR.json) keys in sync. There is an automated parity test.
7. Do not refactor, rename or "clean up" code outside the files a prompt names.
8. After any frontend change, republish and confirm the live sign-in page loads with no errors.
```

---

## 1. Where things stand (so you can explain it to anyone)

**Live and verified today (2026-10-25):**
- **Strava sync with data quality.**
  - Duplicate recordings are merged.
  - HYROX races count as HYROX, not running.
  - Official race durations are used.
  - Treadmill distances and heart-rate spikes are flagged.
- **Automatic race results** from ROXFIT imports, with a per-race analysis on the Race Results page.
- **AI coach**:
  - it knows training load, races, recent sessions and what's new since your last chat;
  - your messages are saved;
  - the 30 messages/hour limit is enforced.
- **Session library** (28 sessions you approved). The plan generator must pick from it, and each planned session shows "Why this session". Coaches can add club sessions, which an admin approves.
- **Readiness gates** (sleep, HRV, resting HR). Built but **inert until Garmin data exists**.
- **Max heart rate estimate and dashboard card.**

**Built but switched off:**
- **Stripe billing.** Checkout, portal and webhook functions are deployed. There are no secrets, no Stripe account link and no billing screens yet, and nothing is gated (stage 5).
- **Garmin.** The code exists but was built for Garmin's old OAuth 1.0a API. It needs a rework once your Starter application is approved; leave that for Claude.

**Which AI the app uses (you asked):** every AI feature goes through **Lovable's AI Gateway** (`ai.gateway.lovable.dev`), and **all of it is Google Gemini**. No OpenAI or Anthropic model is called anywhere.

| Feature | Edge function | Model |
|---|---|---|
| AI coach chat | `hyrox-ai-coach` | `google/gemini-2.5-pro` (streaming) |
| Plan generation + race prediction | `generate-plan` | `google/gemini-2.5-flash` |
| Weekly report commentary | `weekly-report` | `google/gemini-3-flash-preview` |
| Race / exercise screenshot reading | `parse-race-screenshot`, `parse-exercise-screenshot` | `google/gemini-2.5-flash` |
| Knowledge-base ingest, exercise seeding | `ingest-knowledge`, `seed-exercise-library` | Gemini 2.5 Flash / 3 Flash preview |

- The key is `LOVABLE_API_KEY`, managed by Lovable, and usage is billed to your Lovable workspace.
- The coach's knowledge base uses plain Postgres text search, not an AI embeddings service.
- ⚠️ The privacy policy currently says "including Google **and OpenAI** models". That overstates it: there is no OpenAI usage. Stage 3 fixes it.

---

## Stage 1 — Owner checks (15 min, no Lovable credits)

These verify the last three releases end to end. Do them in the live app:

1. **AI coach**: send one message, for example "How did my last race go?". It should mention your São Paulo races by division and break down where time was gained or lost.
2. **Generate one plan** (any short plan is fine). Open a session in Schedule: a **"Why this session"** box should appear.
3. **Dashboard**: the heart-rate card should offer **"Update to 197 bpm"** (your profile says 194; your sessions keep reaching 196–199). Accept it if that feels right. Training load is recalculated overnight.

Then ask Lovable to confirm (read-only, cheap):

```
Read docs/LOVABLE_HANDOVER.md, stage 1. Run these READ-ONLY SQL queries and show me the results; change nothing:
1) SELECT count(*) AS threads FROM ai_threads; SELECT role, count(*) FROM ai_messages GROUP BY role;
2) SELECT count(*) AS total, count(library_session_id) AS with_library
   FROM planned_sessions WHERE created_at > now() - interval '2 days';
3) SELECT p.code, p.slot_type, count(*) FROM planned_sessions ps
   JOIN session_library p ON p.id = ps.library_session_id
   WHERE ps.created_at > now() - interval '2 days' GROUP BY 1,2 ORDER BY 3 DESC;
4) SELECT max_hr FROM profiles WHERE id = auth.uid();  -- or by my user id
```

**Expected:**
- 1 thread and at least 1 `user` message.
- `with_library` at or near `total`, ideally 90% or more.
- No `HYX_FULL_SIM` in the first weeks of the plan.

**Stop if:** `with_library` is under about 70%, or full simulations appear in base weeks. Note it for Claude and don't try to fix the prompt with Lovable; the library rules are hand-coded.

---

## Stage 2 — Security (highest priority)

### 2a. Rotate the secrets that were pasted into chat on 2026-07-02 (owner, about 15 min)

`TOKEN_ENCRYPTION_KEY`, `TOKEN_LOOKUP_HMAC_KEY` and `STRAVA_WEBHOOK_VERIFY_TOKEN` have been exposed in a chat transcript for over 100 days.

**Simple path, valid today:** only **one** Strava connection exists (yours) and **zero** Garmin connections. So instead of re-encrypting, you can rotate and reconnect:

1. On your own computer, generate three random values. On Mac/Linux run `openssl rand -base64 32` three times, or use a password manager's generator (32+ characters). **Never paste them into Lovable chat.**
2. Lovable → Project Settings → Edge Functions → **Secrets**. Replace the three values:
   - `TOKEN_ENCRYPTION_KEY`
   - `TOKEN_LOOKUP_HMAC_KEY`
   - `STRAVA_WEBHOOK_VERIFY_TOKEN`
3. In the app, go to **Profile/Settings → Strava → Disconnect**, then **Connect** again. Your Strava tokens are now stored under the new key, and the first sync re-imports nothing it already has.
4. Ask Lovable:

```
Read docs/LOVABLE_HANDOVER.md, stage 2a. I rotated TOKEN_ENCRYPTION_KEY, TOKEN_LOOKUP_HMAC_KEY and STRAVA_WEBHOOK_VERIFY_TOKEN in the Secrets UI (do NOT ask me for the values) and reconnected Strava.
1) Redeploy, with no code changes: strava-connect, strava-sync, strava-webhook, strava-activities, strava-subscribe, garmin-oauth, garmin-webhook, mcp.
2) The Strava push subscription must be re-registered so Strava uses the new verify token. Add a small master-admin-only "Strava webhook" panel to the existing admin page (src/pages/AdminPanel.tsx). It shows the current subscription (GET strava-subscribe) and has a "Re-register" button that calls DELETE then POST on the existing strava-subscribe function. UI only; do not change strava-subscribe itself.
3) Run read-only: SELECT left(access_token, 7) AS prefix, last_sync_at, last_sync_status FROM strava_connections; — the prefix must be "enc:v1:" and the status must not be an error.
```

Then press **Re-register** in the admin panel, record any workout on Strava, and check that it appears in the app within a few minutes. That also proves real-time sync works, which has never been confirmed.

**Stop if:** anyone else has connected Strava or Garmin before you do this (`SELECT count(*) FROM strava_connections` returns more than 1). In that case, don't rotate; wait for Claude. Those users would need the re-encryption script (`scripts/rotate-token-encryption-keys.ts`).

### 2b. Fresh security scan (Lovable)

Lovable's last scan is from 12 Oct and covers none of this month's work.

```
Read docs/LOVABLE_HANDOVER.md, stage 2b. Run a fresh security scan and list every finding with its severity. Do NOT fix anything yet.
For each finding, tell me: which file or table, whether the fix touches any file in the PROJECT RULES rule 2 list, and the smallest fix.
```

- Fix **only** findings whose fix stays outside the hand-coded list, one finding per message.
- Anything touching auth, RLS on payment tables, OAuth or encryption: write it down for Claude.

### 2c. Health-screening form smoke test (owner, 5 min)

The PAR-Q / fitness-assessment onboarding has **never** saved a real row. Create a test account (for example yourname+test@gmail.com) and complete onboarding. Then ask Lovable to run the query below, read-only:

```
SELECT count(*) FROM parq_responses; SELECT count(*) FROM fitness_assessments;
```

Both should be 1 or more. If they're 0, ask Lovable to find out why the save fails and show the error, without changing RLS policies. This is a safety-relevant form.

---

## Stage 3 — AI transparency and cost visibility (before deciding on providers or pricing)

You can't price a paid tier, or choose between Lovable's gateway and a direct key, without knowing what each user costs. This stage measures that and makes the app honest about the AI.

### 3a. Fix the privacy wording (small, Lovable-safe)

```
Read docs/LOVABLE_HANDOVER.md, stage 3a. In src/i18n/locales/en.json and pt-BR.json, change privacy.s3body so the AI part reads (Portuguese equivalent in pt-BR):
"...and with our AI infrastructure provider (Lovable AI Gateway), which processes it using Google Gemini models to generate personalized training plans and power the AI coach."
Remove the mention of OpenAI (no OpenAI model is used). Update privacy.lastUpdated to the current month. Republish and confirm /privacy shows the new text.
```

### 3b. AI usage log (new table plus one logging helper)

```
Read docs/LOVABLE_HANDOVER.md, stage 3b. Goal: record the size of every AI call so we can see cost per user. Show me the migration SQL before applying it.

1) Migration: table public.ai_usage_log (id uuid pk default gen_random_uuid(), user_id uuid references auth.users on delete cascade, feature text not null, model text not null, prompt_tokens int, completion_tokens int, total_tokens int, estimated boolean not null default false, created_at timestamptz default now()). Enable RLS. Policies: users can SELECT only their own rows; NO insert/update/delete policies for clients (only edge functions using the service role write). Index on (user_id, created_at).

2) New file supabase/functions/_shared/aiUsage.ts exporting logAiUsage(serviceClient, {userId, feature, model, usage, fallbackText}). If the gateway response includes a "usage" object, store prompt_tokens/completion_tokens/total_tokens. Otherwise store total_tokens = ceil(fallbackText.length / 4) with estimated = true. It must never throw (try/catch, console.error).

3) Call logAiUsage after the AI call in: generate-plan (feature 'plan' / 'prediction'), weekly-report ('weekly_report'), parse-race-screenshot and parse-exercise-screenshot ('screenshot'). For these files you may ONLY add the import and the logAiUsage call right after the AI response is read. Change nothing else in them.

4) hyrox-ai-coach streams its answer. Add stream_options: { include_usage: true } to the request body, and in the streaming pass-through, if a final chunk contains "usage", log it. If no usage chunk arrives, log an estimate from the length of the accumulated assistant text (estimated = true). Feature 'coach'. Only add these lines; touch nothing else in the file.

5) Redeploy only: generate-plan, weekly-report, parse-race-screenshot, parse-exercise-screenshot, hyrox-ai-coach. Then send one coach message and run:
   SELECT feature, model, total_tokens, estimated FROM ai_usage_log ORDER BY created_at DESC LIMIT 5;
```

### 3c. Admin view and user transparency (UI, Lovable-safe)

```
Read docs/LOVABLE_HANDOVER.md, stage 3c.
1) In the admin page add an "AI usage" tab: tokens per feature per day for the last 30 days, and top 10 users by tokens this month (master_admin only). Use a SECURITY DEFINER RPC admin_ai_usage_summary() that checks has_role(auth.uid(), 'master_admin') inside its body. Show me the SQL first.
2) In the AI coach page, add a small "About the AI coach" info link opening a dialog (en + pt-BR):
   - The AI coach uses Google Gemini via Lovable AI Gateway.
   - What it sees: your profile, recent sessions, training load, race results and messages you send.
   - It doesn't replace medical advice.
   - Your messages are stored with your account and deleted with it.
   - Usage limit: 30 messages per hour.
```

**After 1–2 weeks of real usage**, the admin tab tells you the real cost per active user. That number drives stage 4 and stage 5.

---

## Stage 4 — Should the AI move to a direct Anthropic / OpenAI / Google key?

**Recommendation: not yet.** Stay on Lovable's AI Gateway until stage 3 has at least 2 weeks of data, then decide with numbers. Note that the model is already Google Gemini, so "switching to Gemini directly" means changing the billing path, not the model.

| Option | Pros | Cons |
|---|---|---|
| **Stay on Lovable AI Gateway** (today) | Zero setup; one bill; key managed for you; already works | Price set by Lovable; usage mixed into your Lovable credits; limited model choice |
| **Google Gemini direct** (Google AI Studio / Vertex key) | Same models as today, so the least behaviour change; per-token billing you control | You manage a key, quotas and billing account |
| **Anthropic (Claude) direct** | Strong at careful, safety-conscious coaching tone; per-token billing | Coach behaviour will change, so re-test answers; a different API format needs an adapter |
| **OpenAI direct** | Large model range; per-token billing | Same adapter and re-test cost as Anthropic |

**If you do migrate later, do it this way and no other.** That also keeps you flexible to switch again:
- One new file `supabase/functions/_shared/aiClient.ts` with a single `chat({model, messages, stream})` function.
- An `AI_PROVIDER` secret selects `lovable | google | anthropic | openai`, and each provider's key is set in the Secrets UI.
- All six AI functions call `aiClient.chat` instead of `fetch(ai.gateway.lovable.dev)`.
- Keep `logAiUsage` (stage 3) so cost stays visible after the switch.
- Migrate **one feature at a time**, starting with `weekly-report` (lowest risk) and **leaving the coach for last**. Compare answers side by side before switching the coach.
- Update the privacy wording (stage 3a) and the "About the AI coach" dialog to the new provider **the same day** you switch.

Check current per-token prices on each provider's own pricing page when you decide. Don't rely on numbers from memory or from this file.

---

## Stage 5 — Payments (Stripe)

Order matters: **prove money can move in test mode before anything is gated.** Gating first would lock all 15 existing accounts out of the plan generator and AI coach.

### 5a. Owner steps in Stripe (no credits)
1. Create or log in to a Stripe account and stay in **Test mode** (toggle top-right).
2. **Products → Add product**: "Hybrid Athletics Paid", recurring monthly price. Copy the **Price ID** (`price_...`).
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://cdrpypapdqbwwiuqvqti.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
   - Copy the **signing secret** (`whsec_...`).
4. Lovable → Secrets: set `STRIPE_SECRET_KEY` (test key, `sk_test_...`), `STRIPE_PRICE_ID_PAID` and `STRIPE_WEBHOOK_SECRET`. **Never in chat.**

### 5b. Billing screens (Lovable-safe UI)
```
Read docs/LOVABLE_HANDOVER.md, stage 5b. The Stripe edge functions stripe-checkout, stripe-portal and stripe-webhook already exist and are reviewed. DO NOT modify them or supabase/functions/_shared/subscription.ts.
Build, en + pt-BR:
1) src/hooks/useSubscriptionTier.ts: reads the signed-in user's own row from public.subscriptions (RLS already allows SELECT own) and returns {tier: 'free'|'paid', status, loading}; no row = 'free'. Add a header comment: UI only, never the real security gate.
2) A public /pricing page with two columns, Free and Paid. Copy is placeholder for now; I'll give final copy. The CTA calls stripe-checkout and redirects to the returned url. Signed-out users go to /auth first.
3) A "Billing" card in Settings: shows the current tier; "Upgrade" calls stripe-checkout; "Manage billing" (paid only) calls stripe-portal; both redirect to the returned url.
4) success_url /settings?billing=success shows a toast; cancel_url /pricing?billing=cancelled.
Do NOT add any gating or "upgrade to unlock" anywhere yet. Republish.
```

### 5c. Test purchase (owner, 5 min)
- In the app: Settings → Upgrade → pay with card `4242 4242 4242 4242`, any future date, any CVC.
- Then ask Lovable, read-only: `SELECT tier, status, current_period_end FROM subscriptions;`. Expected: one row, `paid`, `active`.
- Then test **Manage billing → Cancel** and re-check that the status changes.

**Stop if:** no row appears. The webhook isn't reaching the function: check the webhook URL and events in Stripe, and the function logs in Lovable. Don't gate anything until this works.

### 5d. Decide the business rules (owner, no credits)
Write your answers down before stage 5e:
1. **What's paid?** The existing design gates the two features that cost AI money: plan generation and the AI coach. Strava sync and everything else stays free (your earlier decision).
2. **Hard gate or free allowance?** Recommendation: a **free allowance**, for example 1 plan generation per month and 20 coach messages per month. The `ai_usage_log` from stage 3 already counts usage, so this is cheap to add. A hard gate blocks new users before they see any value.
3. **Existing 15 accounts:** recommendation, mark them all **"founding members" = paid for 3–6 months**, so nobody loses access on launch day.
4. **Coach acting for an athlete:** the athlete's tier decides (already how the code is designed).

### 5e. Turn the gate on

**Preferred: wait for Claude on Friday.** This touches `generate-plan` and `hyrox-ai-coach`, the core of the product, and the governance rules list billing as hand-coded.

If you must do it with Lovable:
```
Read docs/LOVABLE_HANDOVER.md, stage 5e, and scripts/drafts/stripe-tier-gating-wiring.draft.md.
Apply EXACTLY the two diffs in that draft file (generate-plan and hyrox-ai-coach): import getAthleteTier/tierAtLeast and return 402 {error:'upgrade_required'} for free tier, placed exactly where the draft says. Change nothing else in those files.
Before deploying, show me this SQL for my approval, then run it: founding members =
INSERT INTO subscriptions (athlete_id, stripe_customer_id, tier, status, current_period_end)
SELECT id, 'founding_member', 'paid', 'active', now() + interval '6 months' FROM auth.users
ON CONFLICT (athlete_id) DO NOTHING;
Then in the frontend, when the plan generator or AI coach gets a 402, show an "Upgrade" prompt linking to /pricing (en + pt-BR).
Redeploy generate-plan and hyrox-ai-coach. Republish. Then, with a NEW test account (not a founding member), confirm the coach returns the upgrade prompt, and with my account confirm it still works.
```

⚠️ **Check before running that SQL:** `stripe_customer_id` is NOT NULL in the schema. Using the placeholder `founding_member` is fine for access, but `stripe-checkout` reuses that column, so a founding member who later upgrades must get a real Stripe customer. Ask Lovable to make `stripe-checkout` treat `founding_member` as "no customer yet". That's a payment-code change, so **this is the main reason to leave 5e for Claude.**

### 5f. Go live (owner)
Only after test mode works end to end:
1. In Stripe, switch to **Live mode** and recreate the product, price and webhook there.
2. Replace the three secrets with the live values.
3. Make one real purchase with your own card, then refund it.

---

## Stage 6 — Product work that is safe for Lovable

One item per message, each with "follow PROJECT RULES":

1. **Plan wizard translations.** Every string in `src/pages/PlanCreationWizard.tsx` and `src/components/plan-wizard/` is hardcoded English. Move them to `en.json`/`pt-BR.json`. Text only; no logic changes, and don't touch `RunDaysCountStep.tsx`'s calculations.
2. **External AI connection consent screen.** `src/pages/OAuthConsent.tsx` (the screen shown when a third-party AI app asks to read a user's data) hardcodes a description of what can be accessed. Make the list come from one shared array of the 7 data-access tools in `src/lib/mcp/tools/` so it can't go stale.
3. **Race comparison chart.** `src/components/races/RaceComparisonChart.tsx` should exclude `input_method = 'goal'` rows and compare only races with the same `division_key`, matching the race card analysis.
4. **Coach dashboard polish.** Show each athlete's latest race analysis line and their pending plan suggestions on `CoachDashboard.tsx` (read-only UI).
5. **External AI weekly summary labels.** In `src/lib/mcp/tools/get-weekly-rollup.ts` (the weekly summary that external AI apps can read), select `data_flags`. Label treadmill run km "(estimated)" and exclude indoor bike km. That's the same rule the app uses everywhere else. Then rebuild and deploy the `mcp` function.
6. **Athlete max-HR prompt in onboarding.** Onboarding already asks for max HR. Add a "Don't know? Leave blank, we'll estimate it from your workouts" hint (text only).

---

## Stage 7 — Wait for Claude (don't do these in Lovable)

- Anything in the PROJECT RULES rule-2 list (training-load maths, periodization, pace zones, data-quality rules, race parsing, encryption).
- The missed-session / harder-than-planned suggestion engine (`scripts/drafts/compute-plan-suggestions.draft.ts`). Its thresholds need sign-off.
- The Garmin OAuth 2.0 rework, once your Starter application is approved. Send Claude the Garmin developer docs and credentials page (credentials go in Secrets only).
- Stripe gate activation (5e), if you can wait.
- Any change to readiness-gate or max-HR thresholds.

---

## Rollback if something breaks

- **Frontend or code:** Lovable → version history → restore the last good version, then republish. Or on GitHub, revert the merge commit on `main`.
- **Edge function:** ask Lovable to "redeploy <function> from the previous commit <sha>, no code changes".
- **Database:** don't "undo" with ad-hoc SQL. Write down what happened and leave it for Claude, unless Lovable showed you a reviewed reverse migration.
- **Production blank screen:** this happened once before (missing `VITE_SUPABASE_URL` in the published build). Ask Lovable to "check the published build's environment variables and republish".

---

## For Claude on Friday — what to report back

Fill this in as you go (or paste Lovable's replies):

- [ ] Stage 1 results (thread/message counts, library coverage %, max HR decision)
- [ ] 2a: secrets rotated? Strava reconnected? Real-time workout arrived within minutes?
- [ ] 2b: security scan findings, and which ones Lovable fixed
- [ ] 2c: PAR-Q rows saved?
- [ ] 3b: does `ai_usage_log` have rows? Do coach rows have `estimated = false` (real token counts)?
- [ ] 5: test purchase worked? Business rules decided (5d answers)?
- [ ] Anything Lovable changed outside the files a prompt named (check GitHub commits on `main`)
