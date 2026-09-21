// Strava pull sync — independent of the webhook subscription.
//
// Two modes:
//   * authenticated user: Authorization: Bearer <user JWT> — syncs the caller.
//   * cron: x-cron-secret header — syncs every connected user.
//
// First run per connection backfills 180 days; later runs start from
// last_sync_at. Strava's rate limits are respected: the X-RateLimit headers
// are read on every response and the run stops cleanly (without advancing
// last_sync_at) so the next run resumes where this one left off.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getValidStravaAccessToken } from "../_shared/stravaToken.ts";
import { ingestStravaActivity, type StravaActivityLike } from "../_shared/stravaMap.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BACKFILL_DAYS = 180;
const PER_PAGE = 100;
const MAX_PAGES = 30;
const DETAIL_FETCH_COUNT = 30;
/** Leave headroom so a sync never consumes the account's whole quota. */
const RATE_LIMIT_HEADROOM = 10;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function service(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** True when we're close enough to Strava's quota that we should stop. */
function rateLimitExhausted(resp: Response): boolean {
  const usage = resp.headers.get("x-ratelimit-usage");
  const limit = resp.headers.get("x-ratelimit-limit");
  if (!usage || !limit) return false;
  const [shortUsed, longUsed] = usage.split(",").map((v) => parseInt(v.trim(), 10));
  const [shortLimit, longLimit] = limit.split(",").map((v) => parseInt(v.trim(), 10));
  if (Number.isFinite(shortUsed) && Number.isFinite(shortLimit) && shortUsed >= shortLimit - RATE_LIMIT_HEADROOM) {
    return true;
  }
  if (Number.isFinite(longUsed) && Number.isFinite(longLimit) && longUsed >= longLimit - RATE_LIMIT_HEADROOM) {
    return true;
  }
  return false;
}

interface SyncCounts {
  fetched: number;
  stored: number;
  matched: number;
  enriched: number;
  unmatched: number;
  skipped: number;
  rate_limited: boolean;
  backfill: boolean;
}

async function syncUser(svc: SupabaseClient, userId: string): Promise<SyncCounts> {
  const counts: SyncCounts = {
    fetched: 0,
    stored: 0,
    matched: 0,
    enriched: 0,
    unmatched: 0,
    skipped: 0,
    rate_limited: false,
    backfill: false,
  };

  const { data: conn } = await svc
    .from("strava_connections")
    .select("last_sync_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!conn) throw new Error("No Strava connection");

  const token = await getValidStravaAccessToken(svc, userId);
  if (!token) throw new Error("Could not obtain a valid Strava token");

  const backfillFloor = Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000;
  const lastSyncMs = (conn as any).last_sync_at ? Date.parse((conn as any).last_sync_at) : NaN;
  counts.backfill = Number.isNaN(lastSyncMs);
  // Re-read a small overlap so an activity edited right after a sync is caught.
  const afterMs = Number.isNaN(lastSyncMs)
    ? backfillFloor
    : Math.max(backfillFloor, lastSyncMs - 6 * 60 * 60 * 1000);
  const after = Math.floor(afterMs / 1000);

  const collected: StravaActivityLike[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://www.strava.com/api/v3/athlete/activities?per_page=${PER_PAGE}&page=${page}&after=${after}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token.accessToken}` } });

    if (resp.status === 429) {
      counts.rate_limited = true;
      break;
    }
    if (!resp.ok) {
      throw new Error(`Strava activity list failed: ${resp.status} ${(await resp.text()).slice(0, 200)}`);
    }
    const batch = (await resp.json()) as StravaActivityLike[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    collected.push(...batch);
    if (rateLimitExhausted(resp)) {
      counts.rate_limited = true;
      break;
    }
    if (batch.length < PER_PAGE) break;
  }

  counts.fetched = collected.length;

  // Oldest → newest, so training-load history builds in order and the
  // earliest activity of a day gets first pick of planned sessions.
  collected.sort((a, b) => Date.parse(a.start_date ?? "") - Date.parse(b.start_date ?? ""));

  // Detailed payloads (laps / splits) for the most recent activities only.
  const detailIds = new Set(
    collected.slice(-DETAIL_FETCH_COUNT).map((a) => Number(a.id)).filter((n) => Number.isFinite(n)),
  );
  const details = new Map<number, StravaActivityLike>();
  if (!counts.rate_limited) {
    for (const id of detailIds) {
      const resp = await fetch(`https://www.strava.com/api/v3/activities/${id}`, {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });
      if (resp.status === 429) {
        counts.rate_limited = true;
        break;
      }
      if (resp.ok) details.set(id, (await resp.json()) as StravaActivityLike);
      if (rateLimitExhausted(resp)) {
        counts.rate_limited = true;
        break;
      }
    }
  }

  // Activities already stored and resolved don't need re-processing — this
  // keeps a resumed backfill from redoing work it finished last run.
  const { data: existingRows } = await svc
    .from("strava_activities")
    .select("strava_activity_id, completed_session_id, ignored")
    .eq("user_id", userId);
  const settled = new Set(
    (existingRows ?? [])
      .filter((r: any) => r.completed_session_id !== null || r.ignored === true)
      .map((r: any) => Number(r.strava_activity_id)),
  );

  let matchedAny = false;
  let lastProcessedStart: string | null = null;
  let partial = false;

  for (const activity of collected) {
    // A long history can exceed the function's wall clock. Stop on the soft
    // deadline and leave the cursor at the last activity processed, so the
    // next run continues instead of starting over.
    if (Date.now() - startedAt > SOFT_DEADLINE_MS) {
      partial = true;
      break;
    }
    if (settled.has(Number(activity.id))) {
      lastProcessedStart = activity.start_date ?? lastProcessedStart;
      continue;
    }

    const enriched = details.get(Number(activity.id)) ?? activity;
    const result = await ingestStravaActivity(svc, userId, enriched);
    counts.stored++;
    lastProcessedStart = activity.start_date ?? lastProcessedStart;

    switch (result.outcome) {
      case "created":
      case "linked_existing":
        counts.matched++;
        break;
      case "enriched":
        counts.enriched++;
        break;
      case "skipped_short":
      case "skipped_no_discipline":
        counts.skipped++;
        break;
      case "unmatched":
        counts.unmatched++;
        break;
      default:
        break;
    }
    if (result.completedSessionId) matchedAny = true;
  }

  // Recompute training load over the imported range.
  if (matchedAny) {
    const { error: rpcErr } = await svc.rpc("recompute_training_load", { _athlete_id: userId });
    if (rpcErr) console.error("recompute_training_load failed for", userId, rpcErr);
  }

  counts.partial = partial;
  const status = counts.rate_limited ? "rate_limited" : partial ? "partial" : "ok";
  // A rate-limited run keeps its old cursor; a partial run advances only as
  // far as it actually got; a clean run moves the cursor to now.
  const cursor = counts.rate_limited
    ? null
    : partial
      ? lastProcessedStart
      : new Date().toISOString();

  await svc
    .from("strava_connections")
    .update({
      ...(cursor ? { last_sync_at: cursor } : {}),
      last_sync_status: status,
      last_sync_count: counts.stored,
    })
    .eq("user_id", userId);


  return counts;
}

async function authedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await client.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (error || !data?.claims) return null;
  return data.claims.sub as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const svc = service();
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");

  try {
    // --- Cron mode: every connected user -------------------------------
    if (cronSecret && providedSecret === cronSecret) {
      const { data: conns } = await svc.from("strava_connections").select("user_id");
      const results: Record<string, unknown>[] = [];
      for (const c of conns ?? []) {
        const uid = (c as any).user_id as string;
        try {
          const counts = await syncUser(svc, uid);
          results.push({ user_id: uid, ...counts });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("strava-sync failed for", uid, msg);
          await svc
            .from("strava_connections")
            .update({ last_sync_status: `error: ${msg.slice(0, 120)}` })
            .eq("user_id", uid);
          results.push({ user_id: uid, error: msg });
        }
      }
      return json({ ok: true, mode: "cron", connections: (conns ?? []).length, results });
    }

    // --- User mode -----------------------------------------------------
    const userId = await authedUserId(req);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    try {
      const counts = await syncUser(svc, userId);
      return json({ ok: true, mode: "user", ...counts });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await svc
        .from("strava_connections")
        .update({ last_sync_status: `error: ${msg.slice(0, 120)}` })
        .eq("user_id", userId);
      console.error("strava-sync user error:", msg);
      return json({ error: msg }, 500);
    }
  } catch (e) {
    console.error("strava-sync error:", e);
    return json({ error: "Internal error" }, 500);
  }
});
