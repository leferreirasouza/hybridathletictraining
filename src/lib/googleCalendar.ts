import { disciplineConfig, dayLabelsFull } from '@/components/schedule/config';

interface PlannedSession {
  id: string;
  session_name: string;
  discipline: string;
  week_number: number;
  day_of_week: number;
  duration_min?: number | null;
  distance_km?: number | null;
  intensity?: string | null;
  notes?: string | null;
  workout_details?: string | null;
  date?: string | null;
}

/**
 * Build a Google Calendar "Add Event" URL for a single session.
 * Uses the plan's week_start + week/day offsets if no explicit date.
 */
export function buildGoogleCalendarUrl(
  session: PlannedSession,
  planStartDate?: Date,
): string {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';

  const discLabel = disciplineConfig[session.discipline]?.label || session.discipline;
  const title = encodeURIComponent(
    session.session_name || `${discLabel} Session`
  );

  // Determine the date
  let eventDate: Date;
  if (session.date) {
    eventDate = new Date(session.date + 'T00:00:00');
  } else if (planStartDate) {
    eventDate = new Date(planStartDate);
    // Add weeks and days offset (day_of_week is 1=Mon, 7=Sun)
    eventDate.setDate(
      eventDate.getDate() + (session.week_number - 1) * 7 + (session.day_of_week - 1)
    );
  } else {
    // Fallback: use next occurrence of that weekday
    const today = new Date();
    const todayDay = today.getDay(); // 0=Sun, 1=Mon
    const targetDay = session.day_of_week % 7; // Convert 1-7 Mon-Sun to 0=Sun based
    const adjustedTarget = session.day_of_week === 7 ? 0 : session.day_of_week;
    const diff = ((adjustedTarget - todayDay + 7) % 7) || 7;
    eventDate = new Date(today);
    eventDate.setDate(today.getDate() + diff + (session.week_number - 1) * 7);
  }

  // Format date as YYYYMMDD
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateStr = `${eventDate.getFullYear()}${pad(eventDate.getMonth() + 1)}${pad(eventDate.getDate())}`;

  // Duration → end time (default 60min, start at 7am)
  const durationMin = session.duration_min ? Number(session.duration_min) : 60;
  const startHour = 7;
  const startMin = 0;
  const endTotalMin = startHour * 60 + startMin + durationMin;
  const endHour = Math.floor(endTotalMin / 60);
  const endMin = endTotalMin % 60;

  const startTime = `${dateStr}T${pad(startHour)}${pad(startMin)}00`;
  const endTime = `${dateStr}T${pad(endHour)}${pad(endMin)}00`;

  // Build description
  const parts: string[] = [];
  parts.push(`📋 ${discLabel}`);
  if (session.intensity) parts.push(`Intensity: ${session.intensity.replace(/_/g, ' ')}`);
  if (session.duration_min) parts.push(`Duration: ${session.duration_min} min`);
  if (session.distance_km) parts.push(`Distance: ${session.distance_km} km`);
  if (session.workout_details) parts.push(`\n${session.workout_details}`);
  if (session.notes) parts.push(`\nNotes: ${session.notes}`);
  parts.push('\n— Hybrid Athletics');

  const details = encodeURIComponent(parts.join('\n'));

  return `${base}&text=${title}&dates=${startTime}/${endTime}&details=${details}`;
}

/**
 * Export all sessions for a given week to Google Calendar
 * Opens each in a new tab (limited to avoid popup blockers).
 */
export function exportWeekToGoogleCalendar(
  sessions: PlannedSession[],
  weekNumber: number,
  planStartDate?: Date,
) {
  const weekSessions = sessions.filter(s => s.week_number === weekNumber);
  if (weekSessions.length === 0) return;

  // Open first one directly, rest via small delay
  weekSessions.forEach((session, i) => {
    const url = buildGoogleCalendarUrl(session, planStartDate);
    setTimeout(() => {
      window.open(url, '_blank', 'noopener');
    }, i * 300);
  });
}
