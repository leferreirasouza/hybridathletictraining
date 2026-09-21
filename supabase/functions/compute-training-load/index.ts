import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Server-to-server only (invoked by a scheduled cron job, not by end users).
// Auth is a shared secret header rather than a user JWT, since there is no
// user session in a cron context.
serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { data: athleteRoles, error } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "athlete");
    if (error) throw error;

    // Anyone with logged sessions needs a load series, whatever their role
    // and whichever source (manual, Garmin, Strava) produced the rows. The
    // recompute function aggregates completed_sessions per date, so a
    // session enriched by a second source is still counted exactly once.
    const { data: loggers, error: logErr } = await supabase
      .from("completed_sessions")
      .select("athlete_id");
    if (logErr) throw logErr;

    const athleteIds = [
      ...new Set([
        ...(athleteRoles ?? []).map((r) => r.user_id),
        ...(loggers ?? []).map((r) => r.athlete_id),
      ]),
    ];
    let succeeded = 0;
    let failed = 0;

    for (const athleteId of athleteIds) {
      const { error: rpcError } = await supabase.rpc("recompute_training_load", {
        _athlete_id: athleteId,
      });
      if (rpcError) {
        console.error("recompute_training_load failed for", athleteId, rpcError);
        failed++;
      } else {
        succeeded++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, athletes: athleteIds.length, succeeded, failed }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("compute-training-load error:", e);
    return new Response(JSON.stringify({ error: "An error occurred processing the request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
