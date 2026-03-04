import { disciplineConfig } from '@/components/schedule/config';

export type CalendarProvider = 'google' | 'outlook' | 'apple';

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

function resolveEventDate(session: PlannedSession, planStartDate?: Date): Date {
  if (session.date) return new Date(session.date + 'T00:00:00');
  if (planStartDate) {
    const d = new Date(planStartDate);
    d.setDate(d.getDate() + (session.week_number - 1) * 7 + (session.day_of_week - 1));
    return d;
  }
  const today = new Date();
  const adjustedTarget = session.day_of_week === 7 ? 0 : session.day_of_week;
  const todayDay = today.getDay();
  const diff = ((adjustedTarget - todayDay + 7) % 7) || 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff + (session.week_number - 1) * 7);
  return d;
}

function pad(n: number) { return n.toString().padStart(2, '0'); }

function buildDescription(session: PlannedSession): string {
  const discLabel = disciplineConfig[session.discipline]?.label || session.discipline;
  const parts: string[] = [`📋 ${discLabel}`];
  if (session.intensity) parts.push(`Intensity: ${session.intensity.replace(/_/g, ' ')}`);
  if (session.duration_min) parts.push(`Duration: ${session.duration_min} min`);
  if (session.distance_km) parts.push(`Distance: ${session.distance_km} km`);
  if (session.workout_details) parts.push(`\n${session.workout_details}`);
  if (session.notes) parts.push(`\nNotes: ${session.notes}`);
  parts.push('\n— Hybrid Athletics');
  return parts.join('\n');
}

function getEventTimes(session: PlannedSession, planStartDate?: Date) {
  const eventDate = resolveEventDate(session, planStartDate);
  const durationMin = session.duration_min ? Number(session.duration_min) : 60;
  const dateStr = `${eventDate.getFullYear()}${pad(eventDate.getMonth() + 1)}${pad(eventDate.getDate())}`;
  const startHour = 7, startMin = 0;
  const endTotalMin = startHour * 60 + startMin + durationMin;
  const endHour = Math.floor(endTotalMin / 60);
  const endMin = endTotalMin % 60;
  return {
    eventDate,
    dateStr,
    startTime: `${dateStr}T${pad(startHour)}${pad(startMin)}00`,
    endTime: `${dateStr}T${pad(endHour)}${pad(endMin)}00`,
    durationMin,
    startHour,
    startMin,
    endHour,
    endMin,
  };
}

// ─── Google Calendar ───
export function buildGoogleCalendarUrl(session: PlannedSession, planStartDate?: Date): string {
  const { startTime, endTime } = getEventTimes(session, planStartDate);
  const title = encodeURIComponent(session.session_name || `${disciplineConfig[session.discipline]?.label || session.discipline} Session`);
  const details = encodeURIComponent(buildDescription(session));
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startTime}/${endTime}&details=${details}`;
}

// ─── Outlook Calendar ───
export function buildOutlookCalendarUrl(session: PlannedSession, planStartDate?: Date): string {
  const { eventDate, durationMin, startHour, startMin } = getEventTimes(session, planStartDate);
  const title = encodeURIComponent(session.session_name || `${disciplineConfig[session.discipline]?.label || session.discipline} Session`);
  const desc = encodeURIComponent(buildDescription(session));

  // Outlook uses ISO format
  const start = new Date(eventDate);
  start.setHours(startHour, startMin, 0, 0);
  const end = new Date(start.getTime() + durationMin * 60000);

  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0];
  return `https://outlook.live.com/calendar/0/action/compose?subject=${title}&body=${desc}&startdt=${fmt(start)}&enddt=${fmt(end)}`;
}

// ─── Apple / iCal (.ics download) ───
export function downloadIcsFile(session: PlannedSession, planStartDate?: Date): void {
  const { startTime, endTime } = getEventTimes(session, planStartDate);
  const title = session.session_name || `${disciplineConfig[session.discipline]?.label || session.discipline} Session`;
  const desc = buildDescription(session).replace(/\n/g, '\\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hybrid Athletics//EN',
    'BEGIN:VEVENT',
    `DTSTART:${startTime}`,
    `DTEND:${endTime}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${desc}`,
    `UID:${session.id}@hybridathletics`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Batch export for a week ───
export function downloadIcsWeek(sessions: PlannedSession[], weekNumber: number, planStartDate?: Date): void {
  const weekSessions = sessions.filter(s => s.week_number === weekNumber);
  if (!weekSessions.length) return;

  const events = weekSessions.map(session => {
    const { startTime, endTime } = getEventTimes(session, planStartDate);
    const title = session.session_name || `${disciplineConfig[session.discipline]?.label || session.discipline} Session`;
    const desc = buildDescription(session).replace(/\n/g, '\\n');
    return [
      'BEGIN:VEVENT',
      `DTSTART:${startTime}`,
      `DTEND:${endTime}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${desc}`,
      `UID:${session.id}@hybridathletics`,
      'END:VEVENT',
    ].join('\r\n');
  });

  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hybrid Athletics//EN', ...events, 'END:VCALENDAR'].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `week_${weekNumber}_training.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportWeekToGoogleCalendar(sessions: PlannedSession[], weekNumber: number, planStartDate?: Date) {
  const weekSessions = sessions.filter(s => s.week_number === weekNumber);
  if (!weekSessions.length) return;
  weekSessions.forEach((session, i) => {
    const url = buildGoogleCalendarUrl(session, planStartDate);
    setTimeout(() => window.open(url, '_blank', 'noopener'), i * 300);
  });
}

export function exportWeekToOutlook(sessions: PlannedSession[], weekNumber: number, planStartDate?: Date) {
  const weekSessions = sessions.filter(s => s.week_number === weekNumber);
  if (!weekSessions.length) return;
  weekSessions.forEach((session, i) => {
    const url = buildOutlookCalendarUrl(session, planStartDate);
    setTimeout(() => window.open(url, '_blank', 'noopener'), i * 300);
  });
}

export function addToCalendar(provider: CalendarProvider, session: PlannedSession, planStartDate?: Date) {
  switch (provider) {
    case 'google': window.open(buildGoogleCalendarUrl(session, planStartDate), '_blank', 'noopener'); break;
    case 'outlook': window.open(buildOutlookCalendarUrl(session, planStartDate), '_blank', 'noopener'); break;
    case 'apple': downloadIcsFile(session, planStartDate); break;
  }
}

export function exportWeekToCalendar(provider: CalendarProvider, sessions: PlannedSession[], weekNumber: number, planStartDate?: Date) {
  switch (provider) {
    case 'google': exportWeekToGoogleCalendar(sessions, weekNumber, planStartDate); break;
    case 'outlook': exportWeekToOutlook(sessions, weekNumber, planStartDate); break;
    case 'apple': downloadIcsWeek(sessions, weekNumber, planStartDate); break;
  }
}

// ─── Full plan .ics export ───
export function downloadIcsFullPlan(sessions: PlannedSession[], planName?: string, planStartDate?: Date): void {
  if (!sessions.length) return;

  const events = sessions.map(session => {
    const { startTime, endTime } = getEventTimes(session, planStartDate);
    const title = session.session_name || `${disciplineConfig[session.discipline]?.label || session.discipline} Session`;
    const desc = buildDescription(session).replace(/\n/g, '\\n');
    return [
      'BEGIN:VEVENT',
      `DTSTART:${startTime}`,
      `DTEND:${endTime}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${desc}`,
      `UID:${session.id}@hybridathletics`,
      'END:VEVENT',
    ].join('\r\n');
  });

  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hybrid Athletics//EN', ...events, 'END:VCALENDAR'].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (planName || 'training_plan').replace(/[^a-zA-Z0-9]/g, '_');
  a.download = `${safeName}_full.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
