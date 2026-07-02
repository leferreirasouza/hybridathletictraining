// Hand-coded token-at-rest encryption for OAuth credentials (Garmin, Strava).
// Deliberately not Lovable-prompted — this guards real third-party access
// tokens, so getting it wrong is a real security incident, not a UX bug.
//
// AES-256-GCM via Web Crypto (same primitive family already used for HMAC
// request-signing in garmin-oauth), not Supabase Vault/pgsodium — every
// token read/write already flows exclusively through service-role edge
// functions, so the RPC-wrapper plumbing Vault needs buys nothing here.
//
// Encrypted values are prefixed "enc:v1:" so legacy plaintext rows already
// in the database are trivially distinguishable on read — no fragile
// try/catch-based heuristic, and every write path naturally re-encrypts,
// so most rows self-heal over time.
//
// Required secrets:
//   TOKEN_ENCRYPTION_KEY   - 32-byte key, base64-encoded (AES-256-GCM)
//   TOKEN_LOOKUP_HMAC_KEY  - 32-byte key, base64-encoded (HMAC-SHA256), used
//                            only for the non-secret access_token_hash
//                            lookup column — never reuse the encryption key
//                            for a second, different crypto primitive.

const ENC_PREFIX = "enc:v1:";

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function importAesKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY not configured");
  return crypto.subtle.importKey("raw", base64ToBytes(raw), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function importHmacKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("TOKEN_LOOKUP_HMAC_KEY");
  if (!raw) throw new Error("TOKEN_LOOKUP_HMAC_KEY not configured");
  return crypto.subtle.importKey(
    "raw",
    base64ToBytes(raw),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** Encrypts a plaintext token. Always returns an "enc:v1:"-prefixed value. */
export async function encryptToken(plaintext: string): Promise<string> {
  const key = await importAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)),
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return ENC_PREFIX + bytesToBase64(combined);
}

/**
 * Decrypts a token. Values without the "enc:v1:" prefix are treated as
 * legacy plaintext and returned as-is — safe transitional behavior while
 * old rows haven't been rewritten/backfilled yet.
 */
export async function decryptToken(value: string | null | undefined): Promise<string | null> {
  if (value == null) return null;
  if (!value.startsWith(ENC_PREFIX)) return value;
  const key = await importAesKey();
  const combined = base64ToBytes(value.slice(ENC_PREFIX.length));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

/**
 * Non-secret HMAC-SHA256 digest of a plaintext token, used only as a lookup
 * key (e.g. garmin-webhook resolving which user a payload's access token
 * belongs to) — never used as, or derived from, the encryption key.
 */
export async function hashToken(plaintext: string): Promise<string> {
  const key = await importHmacKey();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(plaintext)));
  return bytesToBase64(sig);
}
