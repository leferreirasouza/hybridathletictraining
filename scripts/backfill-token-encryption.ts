// One-time, LOCAL-ONLY backfill: re-encrypts any garmin_connections /
// strava_connections rows still holding plaintext OAuth tokens (rows that
// existed before token encryption shipped).
//
// This script is never deployed as an edge function and must never be
// committed with real credentials. Run it once, locally, with the real
// production values supplied only as environment variables:
//
//   SUPABASE_URL=https://<project>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   TOKEN_ENCRYPTION_KEY=<same value set as the edge function secret> \
//   TOKEN_LOOKUP_HMAC_KEY=<same value set as the edge function secret> \
//   deno run --allow-env --allow-net scripts/backfill-token-encryption.ts
//
// Strava tokens self-heal on their own next refresh cycle (every few hours)
// since every write path now encrypts — backfilling them here too is cheap
// and means the fix takes effect immediately rather than waiting on that
// cycle. Garmin's OAuth1 access_token/access_token_secret are never
// rewritten after initial connect (no refresh flow exists), so those rows
// would otherwise stay plaintext indefinitely without this script.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { encryptToken, hashToken } from "../supabase/functions/_shared/tokenCrypto.ts";

function isPlaintext(value: string | null): value is string {
  return !!value && !value.startsWith("enc:v1:");
}

async function backfillGarmin(client: ReturnType<typeof createClient>) {
  const { data: rows, error } = await client
    .from("garmin_connections")
    .select("id, access_token, access_token_secret, request_token, request_token_secret");
  if (error) throw error;

  let updated = 0;
  for (const row of rows ?? []) {
    const patch: Record<string, string> = {};
    if (isPlaintext(row.access_token)) {
      patch.access_token = await encryptToken(row.access_token);
      patch.access_token_hash = await hashToken(row.access_token);
    }
    if (isPlaintext(row.access_token_secret)) {
      patch.access_token_secret = await encryptToken(row.access_token_secret);
    }
    if (isPlaintext(row.request_token)) {
      patch.request_token = await encryptToken(row.request_token);
    }
    if (isPlaintext(row.request_token_secret)) {
      patch.request_token_secret = await encryptToken(row.request_token_secret);
    }
    if (Object.keys(patch).length === 0) continue;

    const { error: updErr } = await client.from("garmin_connections").update(patch).eq("id", row.id);
    if (updErr) {
      console.error(`garmin_connections row ${row.id} failed:`, updErr.message);
      continue;
    }
    updated++;
  }
  console.log(`garmin_connections: ${updated}/${rows?.length ?? 0} rows re-encrypted`);
}

async function backfillStrava(client: ReturnType<typeof createClient>) {
  const { data: rows, error } = await client
    .from("strava_connections")
    .select("id, access_token, refresh_token");
  if (error) throw error;

  let updated = 0;
  for (const row of rows ?? []) {
    const patch: Record<string, string> = {};
    if (isPlaintext(row.access_token)) patch.access_token = await encryptToken(row.access_token);
    if (isPlaintext(row.refresh_token)) patch.refresh_token = await encryptToken(row.refresh_token);
    if (Object.keys(patch).length === 0) continue;

    const { error: updErr } = await client.from("strava_connections").update(patch).eq("id", row.id);
    if (updErr) {
      console.error(`strava_connections row ${row.id} failed:`, updErr.message);
      continue;
    }
    updated++;
  }
  console.log(`strava_connections: ${updated}/${rows?.length ?? 0} rows re-encrypted`);
}

const url = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const client = createClient(url, serviceKey);
await backfillGarmin(client);
await backfillStrava(client);
console.log("Backfill complete. Spot-check a row by re-reading it through the normal edge-function decrypt path.");
