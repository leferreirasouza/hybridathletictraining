// Run this ONCE, locally, whenever TOKEN_ENCRYPTION_KEY / TOKEN_LOOKUP_HMAC_KEY
// are rotated — see CLAUDE.md, "secrets exposed 2026-07-02, still unrotated".
//
// WHY THIS SCRIPT EXISTS, AND backfill-token-encryption.ts DOESN'T COVER IT:
// tokenCrypto.ts's decryptToken()/importAesKey() read a single live
// TOKEN_ENCRYPTION_KEY from the environment, with no key-version support.
// If you simply change that Supabase secret to a new value, every row
// already holding "enc:v1:" ciphertext (encrypted under the OLD key)
// becomes permanently undecryptable the instant the edge functions pick up
// the new one — crypto.subtle.decrypt() throws on AES-GCM auth-tag
// mismatch, with no fallback. Concretely, today that is:
//   - strava_connections: 1 live row, already "enc:v1:" encrypted. Every
//     Strava sync/refresh call for that athlete starts failing immediately.
//   - garmin_connections: 0 rows today, but the moment Leandro (or anyone)
//     connects Garmin before a rotation happens, this becomes real for them
//     too. Worse: garmin-webhook.ts has a legacy fallback path (for rows
//     with access_token_hash IS NULL) that tries decryptToken(), catches
//     the failure, logs it, and silently continues — the webhook still
//     returns {received:true} to Garmin, so a broken decrypt here fails
//     with NO visible error anywhere except the function log.
//
// backfill-token-encryption.ts can't fix any of this either: it only
// treats a value WITHOUT the "enc:v1:" prefix as something to encrypt.
// Old-key ciphertext still has the prefix, so that script skips it
// silently and reports "0 rows to backfill" while every row is quietly
// dead. Don't run that script expecting it to double as a rotation tool.
//
// This script is the only safe way to rotate: for every row, it decrypts
// with the OLD key and immediately re-encrypts with the NEW key (plus
// recomputes the HMAC lookup hash under the NEW HMAC key), so there's no
// window where a row is unreadable by both keys at once.
//
// REQUIRED SEQUENCING (do not change the order):
//   1. Generate two new key values (see "Generating new keys" below). Do
//      NOT touch the live Supabase Edge Function secrets yet.
//   2. Run this script with OLD_TOKEN_ENCRYPTION_KEY set to whatever is
//      CURRENTLY live in Supabase (the exposed value) and NEW_* set to the
//      freshly generated ones.
//   3. Confirm the script's summary reports 0 failures for both tables.
//      If anything failed, STOP — do not touch the live secrets. This script
//      is NOT safely re-runnable against the whole table as-is: a
//      successfully-rotated row is already "enc:v1:"-prefixed again (just
//      under the new key), so a blind re-run would try to decrypt it with
//      OLD_TOKEN_ENCRYPTION_KEY and fail. Either fix the cause and re-run
//      only against the row(s) that failed, or re-run with OLD_* pointed at
//      the NEW_* value you just used if you genuinely need to redo the
//      whole table.
//   4. Only now: in Supabase -> Project Settings -> Edge Functions ->
//      Secrets, set TOKEN_ENCRYPTION_KEY and TOKEN_LOOKUP_HMAC_KEY to the
//      NEW_* values used in step 2.
//   5. Spot-check: trigger a real Strava sync for one athlete and confirm
//      it succeeds (exercises the decrypt-with-new-key path for real,
//      not just this script's own round-trip).
//   6. Rotate STRAVA_WEBHOOK_VERIFY_TOKEN separately — it is NOT an
//      encryption key covered by this script, it's the token Strava echoes
//      back at webhook SUBSCRIPTION CREATION. Changing the Supabase secret
//      alone does nothing to an already-registered subscription; after
//      updating the secret you must delete the existing Strava push
//      subscription and recreate it (via the strava-subscribe admin
//      endpoint, DELETE then POST) so the new value is what Strava
//      actually verifies against on the new subscription.
//
// Generating new keys (32 random bytes, base64 — the format both edge
// functions and this script expect):
//   deno eval 'console.log(btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))))'
//   (run it twice — once for TOKEN_ENCRYPTION_KEY, once for TOKEN_LOOKUP_HMAC_KEY;
//   never reuse one value for both, per tokenCrypto.ts's own warning.)
//
// Run:
//   OLD_TOKEN_ENCRYPTION_KEY=<currently-live value> \
//   NEW_TOKEN_ENCRYPTION_KEY=<freshly generated value> \
//   NEW_TOKEN_LOOKUP_HMAC_KEY=<freshly generated value> \
//   SUPABASE_URL=https://<project>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   deno run --allow-env --allow-net scripts/rotate-token-encryption-keys.ts
//
// Note OLD_TOKEN_LOOKUP_HMAC_KEY is deliberately NOT an input: HMAC isn't
// reversible, so there is nothing to "decrypt" from an old hash. The new
// hash is simply recomputed from the plaintext this script already
// recovers via the AES decrypt step, using the NEW HMAC key.
//
// Never deployed as an edge function. Never commit real key values.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ENC_PREFIX = "enc:v1:";

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function importAesKey(base64Key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", base64ToBytes(base64Key), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}
async function importHmacKey(base64Key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    base64ToBytes(base64Key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function decryptWithKey(value: string, aesKey: CryptoKey): Promise<string> {
  const combined = base64ToBytes(value.slice(ENC_PREFIX.length));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ciphertext);
  return new TextDecoder().decode(plaintext);
}

async function encryptWithKey(plaintext: string, aesKey: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, new TextEncoder().encode(plaintext)),
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return ENC_PREFIX + bytesToBase64(combined);
}

async function hashWithKey(plaintext: string, hmacKey: CryptoKey): Promise<string> {
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(plaintext)));
  return bytesToBase64(sig);
}

/**
 * Rotates one field: old-key ciphertext -> plaintext -> new-key ciphertext.
 * Leaves legacy plaintext (no "enc:v1:" prefix) and empty/null values
 * untouched — that's backfill-token-encryption.ts's job, not this script's.
 * Don't conflate the two migrations, or a plaintext row could end up
 * skipped by both scripts if someone assumes this one is a superset.
 */
async function rotateField(
  value: string | null,
  oldAes: CryptoKey,
  newAes: CryptoKey,
): Promise<{ newValue: string; plaintext: string } | null> {
  if (!value || !value.startsWith(ENC_PREFIX)) return null;
  const plaintext = await decryptWithKey(value, oldAes);
  const newValue = await encryptWithKey(plaintext, newAes);
  return { newValue, plaintext };
}

async function rotateGarmin(
  client: ReturnType<typeof createClient>,
  oldAes: CryptoKey,
  newAes: CryptoKey,
  newHmac: CryptoKey,
): Promise<number> {
  const { data: rows, error } = await client
    .from("garmin_connections")
    .select("id, access_token, access_token_secret, request_token, request_token_secret");
  if (error) throw error;

  let updated = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    try {
      const patch: Record<string, string> = {};

      // access_token_hash must be recomputed in lockstep with access_token:
      // garmin-webhook.ts resolves incoming pushes by hashing Garmin's
      // plaintext token with the LIVE HMAC key and matching it against this
      // column. If access_token moves to the new AES key but the hash isn't
      // recomputed under the new HMAC key in the same update, every future
      // webhook for that row falls through to the legacy NULL-hash path
      // (slower, and only triggers at all for rows where the hash is
      // actually NULL) instead of resolving normally.
      const access = await rotateField(row.access_token, oldAes, newAes);
      if (access) {
        patch.access_token = access.newValue;
        patch.access_token_hash = await hashWithKey(access.plaintext, newHmac);
      }
      const accessSecret = await rotateField(row.access_token_secret, oldAes, newAes);
      if (accessSecret) patch.access_token_secret = accessSecret.newValue;
      const requestTok = await rotateField(row.request_token, oldAes, newAes);
      if (requestTok) patch.request_token = requestTok.newValue;
      const requestSecret = await rotateField(row.request_token_secret, oldAes, newAes);
      if (requestSecret) patch.request_token_secret = requestSecret.newValue;

      if (Object.keys(patch).length === 0) continue;

      const { error: updErr } = await client.from("garmin_connections").update(patch).eq("id", row.id);
      if (updErr) throw updErr;
      updated++;
    } catch (e) {
      failed++;
      console.error(
        `garmin_connections row ${row.id} FAILED to rotate — still on the OLD key. ` +
          `Do not flip the live Supabase secret until this is fixed:`,
        e,
      );
    }
  }
  console.log(`garmin_connections: ${updated}/${rows?.length ?? 0} rows rotated, ${failed} failed`);
  return failed;
}

async function rotateStrava(
  client: ReturnType<typeof createClient>,
  oldAes: CryptoKey,
  newAes: CryptoKey,
): Promise<number> {
  const { data: rows, error } = await client.from("strava_connections").select("id, access_token, refresh_token");
  if (error) throw error;

  let updated = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    try {
      const patch: Record<string, string> = {};
      const access = await rotateField(row.access_token, oldAes, newAes);
      if (access) patch.access_token = access.newValue;
      const refresh = await rotateField(row.refresh_token, oldAes, newAes);
      if (refresh) patch.refresh_token = refresh.newValue;

      if (Object.keys(patch).length === 0) continue;

      const { error: updErr } = await client.from("strava_connections").update(patch).eq("id", row.id);
      if (updErr) throw updErr;
      updated++;
    } catch (e) {
      failed++;
      console.error(
        `strava_connections row ${row.id} FAILED to rotate — still on the OLD key. ` +
          `Do not flip the live Supabase secret until this is fixed:`,
        e,
      );
    }
  }
  console.log(`strava_connections: ${updated}/${rows?.length ?? 0} rows rotated, ${failed} failed`);
  return failed;
}

const url = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const oldAesRaw = Deno.env.get("OLD_TOKEN_ENCRYPTION_KEY");
const newAesRaw = Deno.env.get("NEW_TOKEN_ENCRYPTION_KEY");
const newHmacRaw = Deno.env.get("NEW_TOKEN_LOOKUP_HMAC_KEY");

if (!url || !serviceKey || !oldAesRaw || !newAesRaw || !newHmacRaw) {
  console.error(
    "Missing one of: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OLD_TOKEN_ENCRYPTION_KEY, " +
      "NEW_TOKEN_ENCRYPTION_KEY, NEW_TOKEN_LOOKUP_HMAC_KEY. See the header comment for the " +
      "full required sequencing before running this.",
  );
  Deno.exit(1);
}
if (newAesRaw === oldAesRaw) {
  console.error("NEW_TOKEN_ENCRYPTION_KEY equals OLD_TOKEN_ENCRYPTION_KEY — this isn't a rotation. Generate a real new value first.");
  Deno.exit(1);
}

const [oldAes, newAes, newHmac] = await Promise.all([
  importAesKey(oldAesRaw),
  importAesKey(newAesRaw),
  importHmacKey(newHmacRaw),
]);

const client = createClient(url, serviceKey);
const garminFailed = await rotateGarmin(client, oldAes, newAes, newHmac);
const stravaFailed = await rotateStrava(client, oldAes, newAes);

if (garminFailed > 0 || stravaFailed > 0) {
  console.error(
    `\nSTOP: ${garminFailed + stravaFailed} row(s) failed to rotate. Do NOT update the live ` +
      "TOKEN_ENCRYPTION_KEY/TOKEN_LOOKUP_HMAC_KEY secrets in Supabase yet — flipping them now " +
      "would permanently strand every row still on the OLD key (the edge functions would stop " +
      "accepting it), on top of whatever caused the failure above. Investigate, fix, and re-run " +
      "before touching the live secrets.",
  );
  Deno.exit(1);
}

console.log(
  "\nAll rows rotated cleanly. Safe to now set TOKEN_ENCRYPTION_KEY and TOKEN_LOOKUP_HMAC_KEY to " +
    "the NEW_* values in Supabase -> Project Settings -> Edge Functions -> Secrets, then spot-check " +
    "a real Strava sync (and a real Garmin webhook delivery, once Garmin connections exist) before " +
    "considering the rotation done. Also rotate STRAVA_WEBHOOK_VERIFY_TOKEN separately — see the " +
    "header comment, step 6; it is not covered by this script.",
);
