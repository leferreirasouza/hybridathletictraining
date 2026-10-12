// Admin-only: view or register the app's single Strava push subscription.
// GET  -> lists current subscription(s) from Strava.
// POST -> registers callback to strava-webhook (Strava calls the GET handshake).
// DELETE ?id= -> removes a subscription.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Not authenticated" }, 401);
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: isAdmin } = await service.rpc("has_role", { _user_id: user.id, _role: "master_admin" });
  if (!isAdmin) return json({ error: "Access denied" }, 403);

  const clientId = Deno.env.get("STRAVA_CLIENT_ID")!;
  const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET")!;
  const base = "https://www.strava.com/api/v3/push_subscriptions";

  if (req.method === "GET") {
    const r = await fetch(`${base}?client_id=${clientId}&client_secret=${clientSecret}`);
    return json({ status: r.status, body: await r.json().catch(() => null) });
  }
  if (req.method === "POST") {
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("client_secret", clientSecret);
    fd.set("callback_url", `${url}/functions/v1/strava-webhook`);
    fd.set("verify_token", Deno.env.get("STRAVA_WEBHOOK_VERIFY_TOKEN")!);
    const r = await fetch(base, { method: "POST", body: fd });
    return json({ status: r.status, body: await r.json().catch(() => null) });
  }
  if (req.method === "DELETE") {
    const id = new URL(req.url).searchParams.get("id");
    if (!id || !/^\d+$/.test(id)) return json({ error: "id required" }, 400);
    const r = await fetch(`${base}/${id}?client_id=${clientId}&client_secret=${clientSecret}`, { method: "DELETE" });
    return json({ status: r.status });
  }
  return json({ error: "Method not allowed" }, 405);
});
