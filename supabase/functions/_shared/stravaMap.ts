// Shared Strava mapping + matching engine.
//
// Both strava-webhook (single new event) and strava-sync (paginated pull /
// backfill) go through these helpers so a row imported either way is
// identical and matched by the same rules. Everything here is idempotent:
// re-running over the same activity never produces a second completion.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/** Activities shorter than this are stored but never become completions. */
export const MIN_COMPLETION_SECONDS = 5 * 60;

/** Cross-source dedup window against Garmin-sourced data. */
const CROSS_SOURCE_WINDOW_MS = 10 * 60 * 1000;

const HYROX_NAME_HINT = /hyrox|brick|sled|wall\s*ball|sandbag/i;

export interface StravaActivityLike {
  id?: number;
  type?: string;
  sport_type?: string;
  name?: string;
  start_date?: string;
  start_date_local?: string;
  moving_time?: number;
  elapsed_time?: number;
  distance?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;
  total_elevation_gain?: number;
  [key: string]: unknown;
}

/**
 * Maps Strava's sport_type (falling back to the legacy `type`) onto our
 * discipline enum. Generic workout types are read as strength unless the
 * activity name looks like HYROX-specific station work.
 */
export function mapStravaDiscipline(activity: StravaActivityLike): string | null {
  const sport = (activity.sport_type || activity.type || "").trim();
  if (!sport) return null;
  const name = activity.name || "";

  switch (sport) {
    case "Run":
    case "TrailRun":
    case "VirtualRun":
      return "run";
    case "Ride":
    case "MountainBikeRide":
    case "GravelRide":
    case "EBikeRide":
    case "VirtualRide":
      return "bike";
    case "Rowing":
      return "rowing";
    case "WeightTraining":
      return "strength";
    case "Workout":
    case "HighIntensityIntervalTraining":
    case "Crossfit":
      return HYROX_NAME_HINT.test(name) ? "hyrox_station" : "strength";
    case "Yoga":
    case "Pilates":
      return "mobility";
    default:
      return "custom";
  }
}

/** Planned-session disciplines an imported activity may legitimately fill. */
function compatibleDisciplines(discipline: string): string[] {
  switch (discipline) {
    case "strength":
      return ["strength", "accessories", "hyrox_station"];
    case "hyrox_station":
      return ["hyrox_station", "strength", "custom"];
    case "mobility":
      return ["mobility", "prehab"];
    case "custom":
      return ["custom"];
    default:
      return [discipline];
  }
}

export function paceMinPerKm(distanceM?: number, seconds?: number): number | null {
  if (!distanceM || !seconds || distanceM <= 0 || seconds <= 0) return null;
  return seconds / 60 / (distanceM / 1000);
}

/** "4:32" style pace label, or null when it can't be computed. */
export function paceLabel(distanceM?: number, seconds?: number): string | null {
  const pace = paceMinPerKm(distanceM, seconds);
  if (pace === null) return null;
  const mins = Math.floor(pace);
  const secs = Math.round((pace - mins) * 60);
  const norm = secs === 60 ? [mins + 1, 0] : [mins, secs];
  return `${norm[0]}:${String(norm[1]).padStart(2, "0")}`;
}

export interface MappedStravaRow {
  user_id: string;
  strava_activity_id: number;
  activity_type: string | null;
  sport_type: string | null;
  name: string | null;
  start_date_utc: string | null;
  start_date_local: string | null;
  duration_sec: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_speed_mps: number | null;
  avg_pace_min_per_km: number | null;
  elevation_gain_m: number | null;
  discipline: string | null;
  raw: StravaActivityLike;
}

/** Single source of truth for the strava_activities row shape. */
export function mapStravaActivityRow(userId: string, a: StravaActivityLike): MappedStravaRow {
  const duration = a.moving_time ?? a.elapsed_time ?? null;
  return {
    user_id: userId,
    strava_activity_id: Number(a.id),
    activity_type: a.type ?? null,
    sport_type: a.sport_type ?? null,
    name: a.name ?? null,
    start_date_utc: a.start_date ?? null,
    start_date_local: a.start_date_local ?? null,
    duration_sec: duration,
    distance_m: a.distance ?? null,
    avg_hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    max_hr: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    avg_speed_mps: a.average_speed ?? null,
    avg_pace_min_per_km: a.average_speed && a.average_speed > 0 ? 1000 / a.average_speed / 60 : null,
    elevation_gain_m: a.total_elevation_gain ?? null,
    discipline: mapStravaDiscipline(a),
    raw: a,
  };
}

export type MatchOutcome =
  | "skipped_short"
  | "skipped_no_discipline"
  | "already_linked"
  | "enriched"
  | "linked_existing"
  | "created"
  | "unmatched";

export interface MatchResult {
  outcome: MatchOutcome;
  completedSessionId: string | null;
}

/** Fills only the NULL columns of an existing completion. */
function enrichmentPatch(
  existing: Record<string, unknown>,
  row: MappedStravaRow,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (existing.avg_hr === null && row.avg_hr !== null) patch.avg_hr = row.avg_hr;
  if (existing.max_hr === null && row.max_hr !== null) patch.max_hr = row.max_hr;
  if (existing.actual_duration_min === null && row.duration_sec)
    patch.actual_duration_min = Math.round(row.duration_sec / 60);
  if (existing.actual_distance_km === null && row.distance_m)
    patch.actual_distance_km = Number((row.distance_m / 1000).toFixed(2));
  if (existing.avg_pace === null) {
    const label = paceLabel(row.distance_m ?? undefined, row.duration_sec ?? undefined);
    if (label) patch.avg_pace = label;
  }
  return patch;
}

/**
 * Stores nothing itself — call after the strava_activities row exists.
 * Links the activity to a completion, enriching or creating one as needed,
 * and returns what happened so callers can report sync counts.
 */
export async function matchStravaActivity(
  service: SupabaseClient,
  userId: string,
  row: MappedStravaRow,
  stravaActivityRowId: string,
  alreadyLinkedCompletionId: string | null,
): Promise<MatchResult> {
  if (alreadyLinkedCompletionId) {
    return { outcome: "already_linked", completedSessionId: alreadyLinkedCompletionId };
  }
  if (!row.discipline) return { outcome: "skipped_no_discipline", completedSessionId: null };
  if (!row.duration_sec || row.duration_sec < MIN_COMPLETION_SECONDS) {
    return { outcome: "skipped_short", completedSessionId: null };
  }
  if (!row.start_date_local) return { outcome: "unmatched", completedSessionId: null };

  const localDate = row.start_date_local.slice(0, 10);
  const compatible = compatibleDisciplines(row.discipline);
  const startMs = row.start_date_utc ? Date.parse(row.start_date_utc) : NaN;

  const link = async (completedSessionId: string) => {
    await service
      .from("strava_activities")
      .update({ completed_session_id: completedSessionId })
      .eq("id", stravaActivityRowId);
  };

  // 1) Cross-source dedup: the same workout may already have arrived from
  // Garmin. Prefer linking to it over creating a second completion.
  if (!Number.isNaN(startMs)) {
    const { data: garminActs } = await service
      .from("garmin_activities")
      .select("start_time_utc, discipline, completed_session_id")
      .eq("user_id", userId)
      .not("completed_session_id", "is", null);

    const garminMatch = (garminActs ?? []).find((g: Record<string, any>) => {
      if (!g.start_time_utc || g.discipline !== row.discipline) return false;
      return Math.abs(Date.parse(g.start_time_utc) - startMs) <= CROSS_SOURCE_WINDOW_MS;
    });
    if (garminMatch?.completed_session_id) {
      await link(garminMatch.completed_session_id);
      return { outcome: "linked_existing", completedSessionId: garminMatch.completed_session_id };
    }

    const { data: garminCompletions } = await service
      .from("completed_sessions")
      .select("id, completed_at, discipline")
      .eq("athlete_id", userId)
      .eq("source", "garmin")
      .eq("date", localDate);

    const completionMatch = (garminCompletions ?? []).find((c: Record<string, any>) => {
      if (c.discipline !== row.discipline || !c.completed_at) return false;
      return Math.abs(Date.parse(c.completed_at) - startMs) <= CROSS_SOURCE_WINDOW_MS;
    });
    if (completionMatch?.id) {
      await link(completionMatch.id);
      return { outcome: "linked_existing", completedSessionId: completionMatch.id };
    }
  }

  // 2) Candidate planned sessions on the same local date, closest planned
  // duration first, then plan order.
  const { data: candidates } = await service
    .from("planned_sessions")
    .select("id, duration_min, order_index, discipline")
    .eq("athlete_id", userId)
    .eq("date", localDate)
    .in("discipline", compatible);

  const activityMinutes = row.duration_sec / 60;
  const ordered = [...(candidates ?? [])].sort((a: any, b: any) => {
    const da = a.duration_min === null ? Number.MAX_SAFE_INTEGER : Math.abs(Number(a.duration_min) - activityMinutes);
    const db = b.duration_min === null ? Number.MAX_SAFE_INTEGER : Math.abs(Number(b.duration_min) - activityMinutes);
    if (da !== db) return da - db;
    return (a.order_index ?? 0) - (b.order_index ?? 0);
  });

  for (const candidate of ordered) {
    const { data: existing } = await service
      .from("completed_sessions")
      .select("id, avg_hr, max_hr, actual_duration_min, actual_distance_km, avg_pace")
      .eq("planned_session_id", (candidate as any).id)
      .limit(1)
      .maybeSingle();

    if (!existing) {
      const { data: created } = await service
        .from("completed_sessions")
        .insert({
          athlete_id: userId,
          planned_session_id: (candidate as any).id,
          date: localDate,
          discipline: row.discipline,
          source: "strava",
          actual_duration_min: Math.round(row.duration_sec / 60),
          actual_distance_km: row.distance_m ? Number((row.distance_m / 1000).toFixed(2)) : null,
          avg_hr: row.avg_hr,
          max_hr: row.max_hr,
          avg_pace: paceLabel(row.distance_m ?? undefined, row.duration_sec ?? undefined),
          notes: row.name ?? null,
          completed_at: row.start_date_utc ?? new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();
      if (created?.id) {
        await link(created.id);
        return { outcome: "created", completedSessionId: created.id };
      }
      continue;
    }

    // One activity per planned session: if another Strava activity already
    // owns this completion, try the next candidate instead.
    const { data: owner } = await service
      .from("strava_activities")
      .select("id")
      .eq("completed_session_id", (existing as any).id)
      .neq("id", stravaActivityRowId)
      .limit(1)
      .maybeSingle();
    if (owner?.id) continue;

    // Enrich in place — only NULL fields, never the source or manual values.
    const patch = enrichmentPatch(existing as Record<string, unknown>, row);
    if (Object.keys(patch).length > 0) {
      await service.from("completed_sessions").update(patch).eq("id", (existing as any).id);
    }
    await link((existing as any).id);
    return { outcome: "enriched", completedSessionId: (existing as any).id };
  }

  // 3) No planned session to attach to — still record it so history and
  // training load see the work.
  const { data: unplanned } = await service
    .from("completed_sessions")
    .insert({
      athlete_id: userId,
      planned_session_id: null,
      date: localDate,
      discipline: row.discipline,
      source: "strava",
      actual_duration_min: Math.round(row.duration_sec / 60),
      actual_distance_km: row.distance_m ? Number((row.distance_m / 1000).toFixed(2)) : null,
      avg_hr: row.avg_hr,
      max_hr: row.max_hr,
      avg_pace: paceLabel(row.distance_m ?? undefined, row.duration_sec ?? undefined),
      notes: row.name ?? null,
      completed_at: row.start_date_utc ?? new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (unplanned?.id) {
    await link(unplanned.id);
    return { outcome: "created", completedSessionId: unplanned.id };
  }
  return { outcome: "unmatched", completedSessionId: null };
}

/**
 * Upserts the activity and runs the matcher. Returns the match result so
 * webhook and sync can share identical behaviour.
 */
export async function ingestStravaActivity(
  service: SupabaseClient,
  userId: string,
  activity: StravaActivityLike,
): Promise<MatchResult> {
  const row = mapStravaActivityRow(userId, activity);
  const { data: saved, error } = await service
    .from("strava_activities")
    .upsert(row, { onConflict: "user_id,strava_activity_id" })
    .select("id, completed_session_id, ignored")
    .maybeSingle();

  if (error || !saved) {
    console.error("strava ingest: upsert failed", error);
    return { outcome: "unmatched", completedSessionId: null };
  }
  if ((saved as any).ignored) {
    return { outcome: "already_linked", completedSessionId: (saved as any).completed_session_id ?? null };
  }

  return await matchStravaActivity(
    service,
    userId,
    row,
    (saved as any).id,
    (saved as any).completed_session_id ?? null,
  );
}
