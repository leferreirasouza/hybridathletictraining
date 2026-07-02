// Shared Strava access-token resolution: decrypt the stored token, refresh
// it against Strava's API if it's within 5 minutes of expiry, re-encrypt +
// persist the refreshed pair, and return a ready-to-use plaintext token.
// Extracted because this exact "decrypt, check expiry, refresh, re-encrypt"
// sequence was duplicated between strava-activities and (now) the
// strava-webhook background handler — a third near-identical copy wasn't
// worth carrying forward.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { decryptToken, encryptToken } from "./tokenCrypto.ts";

export interface StravaTokenResult {
  accessToken: string;
  stravaAthleteId: number;
}

/**
 * Returns a valid, decrypted Strava access token for the given user, or
 * null if the user has no Strava connection. Refreshes + persists a new
 * token pair when the stored one is expired or near-expiry.
 */
export async function getValidStravaAccessToken(
  service: SupabaseClient,
  userId: string,
): Promise<StravaTokenResult | null> {
  const { data: conn } = await service
    .from("strava_connections")
    .select("access_token, refresh_token, expires_at, strava_athlete_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!conn) return null;

  if (conn.expires_at < Math.floor(Date.now() / 1000) + 300) {
    const refreshToken = await decryptToken(conn.refresh_token);
    const resp = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Deno.env.get("STRAVA_CLIENT_ID"),
        client_secret: Deno.env.get("STRAVA_CLIENT_SECRET"),
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("Strava token refresh failed:", resp.status, t);
      return null;
    }
    const data = await resp.json();
    await service
      .from("strava_connections")
      .update({
        access_token: await encryptToken(data.access_token),
        expires_at: data.expires_at,
        ...(data.refresh_token ? { refresh_token: await encryptToken(data.refresh_token) } : {}),
      })
      .eq("user_id", userId);
    return { accessToken: data.access_token, stravaAthleteId: conn.strava_athlete_id };
  }

  const accessToken = await decryptToken(conn.access_token);
  if (!accessToken) return null;
  return { accessToken, stravaAthleteId: conn.strava_athlete_id };
}

/** Resolves a Supabase user_id from a Strava athlete id (webhook owner_id). */
export async function findUserIdByStravaAthleteId(
  service: SupabaseClient,
  stravaAthleteId: number,
): Promise<string | null> {
  const { data } = await service
    .from("strava_connections")
    .select("user_id")
    .eq("strava_athlete_id", stravaAthleteId)
    .maybeSingle();
  return data?.user_id ?? null;
}
