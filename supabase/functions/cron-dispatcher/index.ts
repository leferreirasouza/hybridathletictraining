// Scheduled job dispatcher — invoked by pg_cron with X-Cron-Secret header.
// Jobs: session-reminders, weekly-reports, race-scrape
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function logRun(action: string, details: Record<string, unknown>) {
  await admin.from("audit_logs").insert({
    action,
    entity_type: "cron_job",
    details,
  });
}

// ---- Jobs ----------------------------------------------------------------

async function runSessionReminders() {
  // Find planned sessions for tomorrow (8pm-the-day-before window)
  // and for ~1h from now. Client-side PWA reads these via audit_logs / queries
  // and surfaces local notifications (per project memory).
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const { data: tomorrowSessions, error: e1 } = await admin
    .from("planned_sessions")
    .select("id, athlete_id, session_name, date, discipline")
    .eq("date", tomorrow)
    .not("athlete_id", "is", null);
  if (e1) throw e1;

  const { data: todaySessions, error: e2 } = await admin
    .from("planned_sessions")
    .select("id, athlete_id, session_name, date, discipline")
    .eq("date", today)
    .not("athlete_id", "is", null);
  if (e2) throw e2;

  await logRun("cron.session_reminders", {
    tomorrow_count: tomorrowSessions?.length ?? 0,
    today_count: todaySessions?.length ?? 0,
    ran_at: now.toISOString(),
  });

  return {
    tomorrow_reminders: tomorrowSessions?.length ?? 0,
    today_reminders: todaySessions?.length ?? 0,
  };
}

async function runWeeklyReports() {
  // Only run on Mondays (UTC). pg_cron schedule already restricts this,
  // but guard anyway for safety / manual invocations.
  const dow = new Date().getUTCDay();
  if (dow !== 1) {
    await logRun("cron.weekly_reports.skipped", { reason: "not monday", dow });
    return { skipped: true, reason: "not monday" };
  }

  // Count athletes with activity in the last 7 days
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("completed_sessions")
    .select("athlete_id", { count: "exact", head: false })
    .gte("completed_at", since);
  if (error) throw error;

  const uniqueAthletes = new Set((data ?? []).map((r) => r.athlete_id)).size;
  await logRun("cron.weekly_reports", {
    active_athletes: uniqueAthletes,
    window_start: since,
  });

  return { active_athletes: uniqueAthletes };
}

async function runRaceScrape() {
  const url = `${SUPABASE_URL}/functions/v1/scrape-hyrox-races`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: "{}",
  });
  const body = await res.text();
  await logRun("cron.race_scrape", { status: res.status, body: body.slice(0, 500) });
  if (!res.ok) throw new Error(`scrape failed: ${res.status} ${body.slice(0, 200)}`);
  return { ok: true, status: res.status };
}

async function runComputeTrainingLoad() {
  const url = `${SUPABASE_URL}/functions/v1/compute-training-load`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": CRON_SECRET,
    },
    body: "{}",
  });
  const body = await res.text();
  await logRun("cron.compute_training_load", { status: res.status, body: body.slice(0, 500) });
  if (!res.ok) throw new Error(`compute-training-load failed: ${res.status} ${body.slice(0, 200)}`);
  return { ok: true, status: res.status };
}

// ---- Handler -------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const provided = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || provided !== CRON_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const job = url.searchParams.get("job");

  try {
    let result: unknown;
    switch (job) {
      case "session-reminders":
        result = await runSessionReminders();
        break;
      case "weekly-reports":
        result = await runWeeklyReports();
        break;
      case "race-scrape":
        result = await runRaceScrape();
        break;
      case "compute-training-load":
        result = await runComputeTrainingLoad();
        break;
      default:
        return json({ error: "Unknown job", allowed: ["session-reminders", "weekly-reports", "race-scrape", "compute-training-load"] }, 400);
    }
    return json({ ok: true, job, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`cron-dispatcher job=${job} error:`, msg);
    await logRun("cron.error", { job, error: msg });
    return json({ ok: false, job, error: msg }, 500);
  }
});
