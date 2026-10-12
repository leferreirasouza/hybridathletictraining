export type SessionState = 'completed' | 'in_progress' | 'planned' | 'missed';

export interface ProgressSession {
  id: string;
  week_number: number;
  day_of_week: number;
  date?: string | null;
  discipline: string;
  session_name: string;
  distance_km?: number | null;
  duration_min?: number | null;
}

export interface ProgressCompletion {
  planned_session_id: string | null;
  actual_distance_km?: number | null;
}

/** Completed beats everything; otherwise compare the session date to today (YYYY-MM-DD). */
export function sessionState(session: ProgressSession, completedIds: Set<string>, todayStr: string): SessionState {
  if (completedIds.has(session.id)) return 'completed';
  if (!session.date) return 'planned';
  if (session.date === todayStr) return 'in_progress';
  return session.date < todayStr ? 'missed' : 'planned';
}

export interface WeekProgress {
  week: number;
  start: string | null;
  end: string | null;
  sessions: (ProgressSession & { state: SessionState })[];
  done: number;
  total: number;
  plannedKm: number;
  doneKm: number;
  isCurrent: boolean;
  isComplete: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildWeekProgress(
  sessions: ProgressSession[],
  completions: ProgressCompletion[],
  todayStr: string,
): WeekProgress[] {
  const completedIds = new Set(completions.filter(c => c.planned_session_id).map(c => c.planned_session_id as string));
  const kmByPlan = new Map<string, number>();
  completions.forEach(c => {
    if (c.planned_session_id) kmByPlan.set(c.planned_session_id, Number(c.actual_distance_km) || 0);
  });

  const byWeek = new Map<number, ProgressSession[]>();
  sessions.forEach(s => {
    if (!byWeek.has(s.week_number)) byWeek.set(s.week_number, []);
    byWeek.get(s.week_number)!.push(s);
  });

  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, list]) => {
      const sorted = [...list].sort((a, b) => a.day_of_week - b.day_of_week);
      const withState = sorted.map(s => ({ ...s, state: sessionState(s, completedIds, todayStr) }));
      const dates = sorted.map(s => s.date).filter(Boolean).sort() as string[];
      const start = dates[0] ?? null;
      const end = dates[dates.length - 1] ?? null;
      const done = withState.filter(s => s.state === 'completed').length;
      const plannedKm = sorted.reduce((sum, s) => sum + (Number(s.distance_km) || 0), 0);
      const doneKm = sorted.reduce((sum, s) => sum + (kmByPlan.get(s.id) ?? 0), 0);
      const isCurrent = !!start && !!end && start <= todayStr && todayStr <= end;
      const isComplete = withState.length > 0 && withState.every(s => s.state === 'completed' || s.state === 'missed') && !isCurrent;
      return {
        week, start, end, sessions: withState, done, total: withState.length,
        plannedKm: round1(plannedKm), doneKm: round1(doneKm), isCurrent, isComplete,
      };
    });
}
