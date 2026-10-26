import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getValidStravaAccessToken } from "../_shared/stravaToken.ts";
import { getStripeClient } from "../_shared/subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Buckets whose objects are stored under a `<user id>/` prefix.
const USER_BUCKETS = ["avatars", "race-screenshots"];

/**
 * Everything that must happen before auth.admin.deleteUser (self-delete
 * and master-admin delete alike). Database rows cascade from auth.users; this
 * covers what doesn't: plans the user created for themselves, storage
 * objects, and the external Strava/Stripe links. External steps are
 * best-effort (logged, never block the deletion the user asked for).
 */
async function cleanUpAccount(admin: SupabaseClient, userId: string) {
  // Strava's API agreement: revoke our access when the athlete leaves.
  try {
    const token = await getValidStravaAccessToken(admin, userId);
    if (token) {
      const resp = await fetch("https://www.strava.com/oauth/deauthorize", {
        method: "POST",
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });
      if (!resp.ok) console.error("delete-user: Strava deauthorize failed", resp.status);
    }
  } catch (e) {
    console.error("delete-user: Strava deauthorize error", e);
  }

  // An active subscription must stop billing.
  try {
    const { data: sub, error } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id, status")
      .eq("athlete_id", userId)
      .maybeSingle();
    if (error) console.error("delete-user: subscription lookup failed", error);
    if (sub?.stripe_subscription_id && !["canceled", "incomplete_expired"].includes(sub.status) && Deno.env.get("STRIPE_SECRET_KEY")) {
      await getStripeClient().subscriptions.cancel(sub.stripe_subscription_id);
    }
  } catch (e) {
    console.error("delete-user: Stripe cancel error", e);
  }

  // Plans the user created only for themselves go too. Templates and plans
  // with unassigned or other athletes' sessions stay (created_by -> NULL).
  const { data: plans, error: plansErr } = await admin
    .from("training_plans")
    .select("id")
    .eq("created_by", userId)
    .eq("is_template", false);
  if (plansErr) throw new Error(`plan lookup failed: ${plansErr.message}`);
  const planIds = (plans ?? []).map((p) => p.id);
  if (planIds.length > 0) {
    const { data: versions, error: vErr } = await admin.from("plan_versions").select("id, plan_id").in("plan_id", planIds);
    if (vErr) throw new Error(`version lookup failed: ${vErr.message}`);
    const planOfVersion = new Map((versions ?? []).map((v) => [v.id, v.plan_id]));
    const shared = new Set<string>();
    if (planOfVersion.size > 0) {
      const { data: foreign, error: sErr } = await admin
        .from("planned_sessions")
        .select("plan_version_id")
        .in("plan_version_id", [...planOfVersion.keys()])
        .or(`athlete_id.is.null,athlete_id.neq.${userId}`);
      if (sErr) throw new Error(`session lookup failed: ${sErr.message}`);
      (foreign ?? []).forEach((s) => shared.add(planOfVersion.get(s.plan_version_id)!));
    }
    const own = planIds.filter((id) => !shared.has(id));
    if (own.length > 0) {
      const { error: delErr } = await admin.from("training_plans").delete().in("id", own);
      if (delErr) throw new Error(`plan delete failed: ${delErr.message}`);
    }
  }

  for (const bucket of USER_BUCKETS) {
    const { data: files, error } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
    if (error) {
      console.error(`delete-user: listing ${bucket} failed`, error);
      continue;
    }
    if (files?.length) {
      const { error: rmErr } = await admin.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
      if (rmErr) console.error(`delete-user: removing ${bucket} objects failed`, rmErr);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const self = body?.self === true;
    const userId: string | undefined = body?.userId;
    if (!self && !userId) return json({ error: "userId required" }, 400);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: callerError } = await userClient.auth.getUser();
    if (callerError || !caller) return json({ error: "Invalid token" }, 401);

    const { data: masterRows, error: rolesErr } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "master_admin");
    if (rolesErr) return json({ error: rolesErr.message }, 500);
    const callerIsMaster = (masterRows ?? []).some((r) => r.user_id === caller.id);

    if (self) {
      // A user deletes their own account (Settings). The last master admin
      // can't, or nobody could administer the platform afterwards.
      const otherMasters = (masterRows ?? []).filter((r) => r.user_id !== caller.id).length;
      if (callerIsMaster && otherMasters === 0) {
        return json({ error: "You are the only master admin. Make someone else a master admin first." }, 409);
      }
      await cleanUpAccount(adminClient, caller.id);
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(caller.id);
      if (deleteError) {
        console.error("delete-user: self delete failed", deleteError);
        return json({ error: deleteError.message }, 500);
      }
      return json({ ok: true });
    }

    if (!callerIsMaster) return json({ error: "Only master admins can delete user accounts" }, 403);

    if (userId === caller.id) return json({ error: "You cannot delete your own account" }, 400);

    await cleanUpAccount(adminClient, userId!);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId!);
    if (deleteError) return json({ error: deleteError.message }, 500);

    return json({ ok: true });
  } catch (e: any) {
    console.error("delete-user: unexpected error", e);
    return json({ error: e.message || "Unexpected error" }, 500);
  }
});
