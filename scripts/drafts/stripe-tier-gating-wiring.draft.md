# Stripe tier-gating wiring — draft, held for approval

Not applied. `generate-plan/index.ts` and `hyrox-ai-coach/index.ts` are both
untouched on the live repo as of this draft. `getAthleteTier`/`tierAtLeast`
in `supabase/functions/_shared/subscription.ts` exist but nothing calls
them yet — this is exactly the mechanical wiring, held until the open
questions below are answered.

## What's already decided, in the code itself

`_shared/subscription.ts`'s own header comment states the intended scope:

> Only generate-plan and hyrox-ai-coach gate on tier (the two LLM-cost-
> bearing features) — Strava sync and everything else stays free for every
> athlete, so this module is deliberately small.

That's a real design decision already made by whoever wrote the module (it
predates this draft) — not something I'm inventing. The diffs below wire
exactly that: a hard paid/free gate on those two functions, nothing else.

## What is NOT decided, and genuinely needs a yes before this ships

**1. Hard gate vs soft quota.** `tierAtLeast()` is binary — free or paid,
nothing in between. The diffs below implement a hard gate: a `free`-tier
athlete gets a `402 upgrade_required` on every call to either function, from
the moment this ships. There is no "N free generations" quota mechanism
anywhere in the schema today — building one would mean a new counter (a
column on `profiles`, or a small `usage_counters` table keyed by athlete +
month) and a second decision (what N is, and whether it resets monthly or
is lifetime). That's a real second piece of work, not a toggle on top of
this draft — sketched at the bottom, not built, because it's a bigger
decision than "wire the check in."

**2. The 15 existing accounts.** `subscriptions` has 0 rows right now, and
`getAthleteTier()` returns `"free"` for anyone with no row. `auth.users` has
**15 accounts**. If the hard gate below ships as-is, all 15 lose access to
plan generation and the AI coach chat immediately — including you, unless
you seed your own row first. Three ways to handle this, your call:
   - **Grandfather everyone**: one-time `INSERT INTO subscriptions
     (athlete_id, tier, status) SELECT id, 'paid', 'active' FROM
     auth.users` before flipping the gate live, so nobody currently using
     the app loses access until you decide individually to downgrade them.
   - **Grandfather just you**: same insert, `WHERE id = '<your user id>'`
     only — everyone else (presumably test/early accounts) hits the gate
     immediately.
   - **Nobody grandfathered**: ship it as a clean cutover, accept that it
     blocks all 15 the moment it's live.
   None of this is in the diffs below — it's a data decision, separate
   from the code wiring, and I'm not running an INSERT against real user
   rows without you choosing one of these first.

**3. Whether the two functions should share one gate or be independent.**
The module comment bundles them together. An equally common SaaS shape is
"core product (plan generation) stays free, copilot/chat features
(hyrox-ai-coach) are the paid upsell" — the opposite emphasis. The diffs
below follow the module's own stated intent (both gated, same tier), but
that's worth a deliberate "yes, both" rather than inheriting it by default
because it was already half-written.

## Diff 1 — `supabase/functions/generate-plan/index.ts`

Import, alongside the existing `_shared` imports near the top of the file:

```diff
 import { detectInterferenceConflicts, downgradeIntensity, tsbAdjustmentFactor } from "../_shared/interferenceRules.ts";
+import { getAthleteTier, tierAtLeast } from "../_shared/subscription.ts";
```

Gate check: placed after `effectiveAthleteId` is resolved and the
coach-on-behalf-of / organization-membership authorization block finishes,
but before `LOVABLE_API_KEY` is read and before any AI call — so it fails
fast, before spending anything, and after auth errors have already had
their chance to fire (a blocked non-member should still see "Forbidden",
not "upgrade required"). Applies to BOTH `predictionOnly` and full
generation, since both paths run after this point:

```diff
+    // Tier gate — plan generation is an LLM-cost-bearing feature per
+    // _shared/subscription.ts. Checked after authorization (so an
+    // unauthorized coach-on-behalf-of call still gets "Forbidden", not
+    // "upgrade required") and before any AI Gateway spend.
+    const tier = await getAthleteTier(supabase, effectiveAthleteId);
+    if (!tierAtLeast(tier, "paid")) {
+      return new Response(
+        JSON.stringify({ error: "upgrade_required", message: "Plan generation requires a paid subscription." }),
+        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
+      );
+    }
+
     const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
     if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
```

(`supabase` here is the existing service-role client already in scope —
`createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`, declared near the
top of the handler.)

## Diff 2 — `supabase/functions/hyrox-ai-coach/index.ts`

Import:

```diff
 import { tsbAdjustmentFactor } from "../_shared/interferenceRules.ts";
+import { getAthleteTier, tierAtLeast } from "../_shared/subscription.ts";
```

Gate check: placed right after `serviceClient` is created (so it can be
reused) and before the per-user abuse-rate-limit block, so a free-tier
athlete never reaches the DB queries that block does:

```diff
     const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
 
+    // Tier gate — same reasoning as generate-plan: this is the other
+    // LLM-cost-bearing feature per _shared/subscription.ts.
+    const tier = await getAthleteTier(serviceClient, userId);
+    if (!tierAtLeast(tier, "paid")) {
+      return new Response(
+        JSON.stringify({ error: "upgrade_required", message: "AI coach chat requires a paid subscription." }),
+        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
+      );
+    }
+
     // Per-user abuse limit: 30 requests per rolling hour.
```

## Frontend note (not drafted here)

Neither diff touches `src/`. Whatever calls these two functions today
(plan-generation UI, the AI coach chat panel) will start receiving a `402`
with `{error: "upgrade_required"}` the moment this ships, and needs to
handle it — at minimum a toast pointing at the Stripe checkout flow
(`stripe-checkout` already exists and is sound, per the earlier review; it
just has no `STRIPE_SECRET_KEY`/`STRIPE_PRICE_ID_PAID` set yet, so checkout
itself can't run either until those are configured). Finding and wiring
that call site is a small follow-up, not included here since it depends on
which of the three options in point 2 above gets picked — no sense writing
upgrade-prompt copy for a gate shape that might not be the one you choose.

## Sketch only, not built: soft quota alternative

If the answer to point 1 is "soft limit, not a hard wall": add a
`usage_counters` table (`athlete_id`, `month` (date, truncated to the 1st),
`generations_used int default 0`), increment it inside `generate-plan`
right after a successful insert (not before — a failed generation shouldn't
burn the athlete's quota), and change the gate to `tier === "paid" ||
counters.generations_used < FREE_MONTHLY_LIMIT`. `hyrox-ai-coach` already
has a rate-limit pattern to copy for the counter query shape (the existing
30-requests/hour block above). This is a real second piece of work — a new
table, a migration, a chosen `FREE_MONTHLY_LIMIT` — not something to
half-build alongside the hard-gate diffs above without knowing which model
you want.
