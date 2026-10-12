// Pure helpers for the coach week builder. Days are 1=Mon … 7=Sun.

export interface TemplateSession {
  day_of_week: number;
  discipline: string;
  session_name: string;
  duration_min: number | null;
  distance_km: number | null;
  intensity: string | null;
  workout_details: string | null;
  notes: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** Monday on or before the given yyyy-mm-dd date. */
export function toMonday(dateStr: string): string {
  const d = parse(dateStr);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Mon
  d.setUTCDate(d.getUTCDate() - dow);
  return fmt(d);
}

/** Calendar date for a plan week/day given the plan's first Monday. */
export function sessionDate(startMonday: string, week: number, day: number): string {
  const d = parse(startMonday);
  d.setUTCDate(d.getUTCDate() + (week - 1) * 7 + (day - 1));
  return fmt(d);
}

/** Infer the plan's first Monday from any dated session. */
export function inferStartMonday(
  sessions: { date: string | null; week_number: number }[],
): string | null {
  const s = sessions.find((x) => x.date);
  if (!s || !s.date) return null;
  const d = parse(toMonday(s.date));
  d.setUTCDate(d.getUTCDate() - (s.week_number - 1) * 7);
  return fmt(d);
}

/** Strip a session down to the reusable template shape. */
export function toTemplateSession(s: TemplateSession): TemplateSession {
  return {
    day_of_week: s.day_of_week,
    discipline: s.discipline,
    session_name: s.session_name,
    duration_min: s.duration_min ?? null,
    distance_km: s.distance_km ?? null,
    intensity: s.intensity ?? null,
    workout_details: s.workout_details ?? null,
    notes: s.notes ?? null,
  };
}
