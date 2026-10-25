import { supabase } from '@/integrations/supabase/client';

export interface StravaActivityLite {
  id: string;
  name: string | null;
  sport_type: string | null;
  discipline: string | null;
  start_date_local: string | null;
  start_date_utc: string | null;
  duration_sec: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  completed_session_id: string | null;
  data_flags?: string[] | null;
}

export const STRAVA_SELECT =
  'id, name, sport_type, discipline, start_date_local, start_date_utc, duration_sec, distance_m, avg_hr, max_hr, completed_session_id, data_flags';

export const activityDate = (a: StravaActivityLite) => (a.start_date_local ?? a.start_date_utc ?? '').slice(0, 10);

/**
 * Display-only suggestion: same date + same discipline, closest duration wins.
 * Mirrors the server matcher in _shared/stravaMap.ts; never links on its own.
 */
export function suggestPlannedMatch<T extends { id: string; date?: string | null; discipline: string; duration_min?: number | null }>(
  a: StravaActivityLite,
  openSessions: T[],
): T | null {
  const d = activityDate(a);
  const candidates = openSessions.filter(s => s.date === d && s.discipline === a.discipline);
  if (!candidates.length) return null;
  const mins = (a.duration_sec ?? 0) / 60;
  return [...candidates].sort(
    (x, y) => Math.abs((Number(x.duration_min) || 0) - mins) - Math.abs((Number(y.duration_min) || 0) - mins),
  )[0];
}

/** Link (plannedSessionId) or log as unplanned (null). Refuses to double-link a planned session. */
export async function linkStravaActivity(userId: string, a: StravaActivityLite, plannedSessionId: string | null) {
  if (plannedSessionId) {
    const { data: existing } = await supabase
      .from('completed_sessions')
      .select('id')
      .eq('athlete_id', userId)
      .eq('planned_session_id', plannedSessionId)
      .limit(1);
    if (existing?.length) throw new Error('already_logged');
  }
  const { data, error } = await supabase
    .from('completed_sessions')
    .insert({
      athlete_id: userId,
      planned_session_id: plannedSessionId,
      date: activityDate(a) || new Date().toISOString().slice(0, 10),
      discipline: (a.discipline ?? 'custom') as any,
      source: 'strava',
      actual_duration_min: a.duration_sec ? Math.round(a.duration_sec / 60) : null,
      actual_distance_km: a.distance_m ? Number((a.distance_m / 1000).toFixed(2)) : null,
      avg_hr: a.avg_hr,
      max_hr: a.max_hr,
      notes: a.name,
      completed_at: a.start_date_utc ?? new Date().toISOString(),
      data_flags: a.data_flags ?? [],
    })
    .select('id')
    .maybeSingle();
  if (error || !data?.id) throw error ?? new Error('insert_failed');
  await supabase.from('strava_activities' as any).update({ completed_session_id: data.id }).eq('id', a.id);
  return data.id as string;
}

/**
 * Unlink: detaches the Strava activity and removes only a Strava-sourced
 * completion (never manual logs) — and only when no other recording of the
 * same effort still points at it.
 */
export async function unlinkStravaActivity(userId: string, a: StravaActivityLite) {
  const completionId = a.completed_session_id;
  await supabase
    .from('strava_activities' as any)
    .update({ completed_session_id: null, duplicate_of: null })
    .eq('id', a.id);
  if (completionId) {
    const { data: others } = await supabase
      .from('strava_activities' as any)
      .select('id')
      .eq('completed_session_id', completionId)
      .limit(1);
    if (others?.length) return;
    await supabase
      .from('completed_sessions')
      .delete()
      .eq('id', completionId)
      .eq('athlete_id', userId)
      .eq('source', 'strava');
  }
}

export const fmtStrava = (a: StravaActivityLite) => {
  const parts: string[] = [];
  if (a.distance_m) parts.push(`${(a.distance_m / 1000).toFixed(1)} km`);
  if (a.duration_sec) {
    const m = Math.round(a.duration_sec / 60);
    parts.push(m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
  }
  return parts.join(' · ');
};
