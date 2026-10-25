// Shared Strava mapping + matching engine.
//
// Both strava-webhook (single new event) and strava-sync (paginated pull /
// backfill) go through these helpers so a row imported either way is
// identical and matched by the same rules. Everything here is idempotent:
// re-running over the same activity never produces a second completion.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  activityFlags,
  effectiveDurationSec,
  HR_FLAGS,
  isHyroxEffort,
  isHyroxRaceImport,
  isSameEffort,
  recordedSpanSec,
  unionFlags,
} from "./activityQuality.ts";

/** Activities shorter than this are stored but never become completions. */
export const MIN_COMPLETION_SECONDS = 5 * 60;

/** Cross-source dedup window against Garmin-sourced data. */
const CROSS_SOURCE_WINDOW_MS = 10 * 60 * 1000;

const HYROX_NAME_HINT = /hyrox|simulad|brick|sled|wall\s*ball|sandbag/i;

/** How far either side of an activity to look for a second recording of it. */
const DUPLICATE_SEARCH_WINDOW_MS = 36 * 60 * 60 * 1000;

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
  external_id?: string | null;
  workout_type?: number | null;
  trainer?: boolean;
  manual?: boolean;
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
  if (isHyroxEffort(activity)) return "hyrox_station";

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
  data_flags: string[];
  raw: StravaActivityLike;
}

/**
 * Single source of truth for the strava_activities row shape. athleteMaxHr
 * (profiles.max_hr) tightens the HR plausibility check when known.
 */
export function mapStravaActivityRow(
  userId: string,
  a: StravaActivityLike,
  athleteMaxHr: number | null = null,
): MappedStravaRow {
  const duration = effectiveDurationSec(a);
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
    data_flags: activityFlags(a, athleteMaxHr),
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

const COMPLETION_COLUMNS =
  "id, source, discipline, avg_hr, max_hr, actual_duration_min, actual_distance_km, avg_pace, data_flags";

/**
 * Fills only the NULL columns of an existing completion and carries the
 * incoming recording's quality flags across — HR flags travel only with the
 * HR values they describe. A HYROX race import is additionally authoritative
 * on discipline and duration, but only over values another Strava import
 * wrote, never over manual or Garmin data.
 */
function enrichmentPatch(
  existing: Record<string, any>,
  row: MappedStravaRow,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const carried = row.data_flags.filter((f) => !(HR_FLAGS as readonly string[]).includes(f));
  if (existing.avg_hr === null && row.avg_hr !== null) {
    patch.avg_hr = row.avg_hr;
    if (row.data_flags.includes("hr_artifact")) carried.push("hr_artifact");
  }
  if (existing.max_hr === null && row.max_hr !== null) {
    patch.max_hr = row.max_hr;
    if (row.data_flags.includes("max_hr_artifact")) carried.push("max_hr_artifact");
  }
  if (existing.actual_duration_min === null && row.duration_sec)
    patch.actual_duration_min = Math.round(row.duration_sec / 60);
  if (existing.actual_distance_km === null && row.distance_m)
    patch.actual_distance_km = Number((row.distance_m / 1000).toFixed(2));
  if (existing.avg_pace === null) {
    const label = paceLabel(row.distance_m ?? undefined, row.duration_sec ?? undefined);
    if (label) patch.avg_pace = label;
  }
  if (existing.source === "strava") {
    if (isHyroxRaceImport(row.raw) && row.duration_sec) {
      patch.actual_duration_min = Math.round(row.duration_sec / 60);
    }
    if (row.discipline === "hyrox_station" && existing.discipline === "run") {
      patch.discipline = "hyrox_station";
    }
  }
  const before = unionFlags(existing.data_flags);
  const after = unionFlags(existing.data_flags, carried);
  if (after.length !== before.length) patch.data_flags = after;
  return patch;
}

/** Inserted completion shape for a recording that starts a new completion. */
function newCompletion(userId: string, plannedSessionId: string | null, localDate: string, row: MappedStravaRow) {
  return {
    athlete_id: userId,
    planned_session_id: plannedSessionId,
    date: localDate,
    discipline: row.discipline,
    source: "strava",
    actual_duration_min: Math.round((row.duration_sec ?? 0) / 60),
    actual_distance_km: row.distance_m ? Number((row.distance_m / 1000).toFixed(2)) : null,
    avg_hr: row.avg_hr,
    max_hr: row.max_hr,
    avg_pace: paceLabel(row.distance_m ?? undefined, row.duration_sec ?? undefined),
    notes: row.name ?? null,
    completed_at: row.start_date_utc ?? new Date().toISOString(),
    data_flags: row.data_flags,
  };
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

  // 1) Same effort recorded twice on Strava (watch + ROXFIT / Peloton /
  // Runna import, usually seconds apart): join the completion the other
  // recording already created instead of double-counting the load.
  if (!Number.isNaN(startMs)) {
    const { data: siblings } = await service
      .from("strava_activities")
      .select("id, start_date_utc, duration_sec, elapsed_time:raw->elapsed_time, completed_session_id, duplicate_of")
      .eq("user_id", userId)
      .neq("id", stravaActivityRowId)
      .not("completed_session_id", "is", null)
      .gte("start_date_utc", new Date(startMs - DUPLICATE_SEARCH_WINDOW_MS).toISOString())
      .lte("start_date_utc", new Date(startMs + DUPLICATE_SEARCH_WINDOW_MS).toISOString());

    const span = recordedSpanSec(row.raw);
    const sibling = (siblings ?? []).find((s: Record<string, any>) => {
      if (!s.start_date_utc) return false;
      const siblingSpan = Math.max(Number(s.duration_sec ?? 0), Number(s.elapsed_time ?? 0));
      return isSameEffort(startMs, span, Date.parse(s.start_date_utc), siblingSpan);
    }) as Record<string, any> | undefined;

    if (sibling) {
      const { data: existing } = await service
        .from("completed_sessions")
        .select(COMPLETION_COLUMNS)
        .eq("id", sibling.completed_session_id)
        .maybeSingle();
      if (existing) {
        const patch = enrichmentPatch(existing as Record<string, any>, row);
        if (Object.keys(patch).length > 0) {
          await service.from("completed_sessions").update(patch).eq("id", (existing as any).id);
        }
        await service
          .from("strava_activities")
          .update({ completed_session_id: (existing as any).id, duplicate_of: sibling.duplicate_of ?? sibling.id })
          .eq("id", stravaActivityRowId);
        return { outcome: "linked_existing", completedSessionId: (existing as any).id };
      }
    }

    // 2) Cross-source dedup: the same workout may already have arrived from
    // Garmin. Prefer linking to it over creating a second completion.
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

  // 3) Candidate planned sessions on the same local date, closest planned
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
      .select(COMPLETION_COLUMNS)
      .eq("planned_session_id", (candidate as any).id)
      .limit(1)
      .maybeSingle();

    if (!existing) {
      const { data: created } = await service
        .from("completed_sessions")
        .insert(newCompletion(userId, (candidate as any).id, localDate, row))
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
    const patch = enrichmentPatch(existing as Record<string, any>, row);
    if (Object.keys(patch).length > 0) {
      await service.from("completed_sessions").update(patch).eq("id", (existing as any).id);
    }
    await link((existing as any).id);
    return { outcome: "enriched", completedSessionId: (existing as any).id };
  }

  // 4) No planned session to attach to — still record it so history and
  // training load see the work.
  const { data: unplanned } = await service
    .from("completed_sessions")
    .insert(newCompletion(userId, null, localDate, row))
    .select("id")
    .maybeSingle();

  if (unplanned?.id) {
    await link(unplanned.id);
    return { outcome: "created", completedSessionId: unplanned.id };
  }
  return { outcome: "unmatched", completedSessionId: null };
}

/** profiles.max_hr, used for HR plausibility; null when not set. */
export async function fetchAthleteMaxHr(service: SupabaseClient, userId: string): Promise<number | null> {
  const { data } = await service.from("profiles").select("max_hr").eq("id", userId).maybeSingle();
  const value = Number((data as any)?.max_hr);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Upserts the activity and runs the matcher. Returns the match result so
 * webhook and sync can share identical behaviour. Pass athleteMaxHr when
 * ingesting a batch to avoid re-reading the profile per activity.
 */
export async function ingestStravaActivity(
  service: SupabaseClient,
  userId: string,
  activity: StravaActivityLike,
  athleteMaxHr?: number | null,
): Promise<MatchResult> {
  const maxHr = athleteMaxHr === undefined ? await fetchAthleteMaxHr(service, userId) : athleteMaxHr;
  const row = mapStravaActivityRow(userId, activity, maxHr);
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
