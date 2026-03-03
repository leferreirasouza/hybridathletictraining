import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { disciplineConfig } from '@/components/schedule/config';

const STORAGE_KEY_ENABLED = 'ha-notifs';
const STORAGE_KEY_NIGHT = 'ha-notifs-night';
const STORAGE_KEY_HOUR = 'ha-notifs-hour';
const STORAGE_KEY_TRAINING_TIMES = 'ha-training-times';

export const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export type DayTrainingTimes = Record<number, string>; // day index (0=Sun..6=Sat) -> "HH:MM" or ""

export function getTrainingTimes(): DayTrainingTimes {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRAINING_TIMES);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function setTrainingTimes(times: DayTrainingTimes) {
  localStorage.setItem(STORAGE_KEY_TRAINING_TIMES, JSON.stringify(times));
  if (!Object.values(times).some(t => !!t)) {
    localStorage.setItem(STORAGE_KEY_HOUR, 'false');
  }
}

export function hasAnyTrainingTime(): boolean {
  return Object.values(getTrainingTimes()).some(t => !!t);
}

export function getNotifPrefs() {
  return {
    enabled: localStorage.getItem(STORAGE_KEY_ENABLED) !== 'false',
    nightBefore: localStorage.getItem(STORAGE_KEY_NIGHT) !== 'false',
    hourBefore: hasAnyTrainingTime() ? localStorage.getItem(STORAGE_KEY_HOUR) !== 'false' : false,
  };
}

export function setNotifPref(key: 'enabled' | 'nightBefore' | 'hourBefore', value: boolean) {
  const storageKey = key === 'enabled' ? STORAGE_KEY_ENABLED : key === 'nightBefore' ? STORAGE_KEY_NIGHT : STORAGE_KEY_HOUR;
  localStorage.setItem(storageKey, String(value));
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function showNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'ha-reminder-' + Date.now(),
    });
  } catch {
    // Fallback for environments that don't support Notification constructor
  }
}

interface PlannedSession {
  session_name: string;
  discipline: string;
  day_of_week: number;
  week_number: number;
  duration_min?: number | null;
  date?: string | null;
}

/**
 * Hook that checks for upcoming sessions and fires browser notifications.
 * Runs a check every 5 minutes while the app is open.
 */
export function useSessionReminders(userId: string | undefined) {
  const firedRef = useRef<Set<string>>(new Set());

  const checkAndNotify = useCallback(async () => {
    if (!userId) return;
    const prefs = getNotifPrefs();
    if (!prefs.enabled) return;
    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Fetch planned sessions for today and tomorrow
    const { data: sessions, error } = await supabase
      .from('planned_sessions')
      .select('id, session_name, discipline, day_of_week, week_number, duration_min, date')
      .or(`date.eq.${today},date.eq.${tomorrowStr}`);

    if (error || !sessions?.length) return;

    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    for (const session of sessions) {
      const discLabel = disciplineConfig[session.discipline]?.label || session.discipline;

      // Night before reminder (8 PM) for tomorrow's sessions
      if (
        prefs.nightBefore &&
        session.date === tomorrowStr &&
        currentHour === 20 &&
        currentMin < 10
      ) {
        const key = `night-${session.id}-${tomorrowStr}`;
        if (!firedRef.current.has(key)) {
          firedRef.current.add(key);
          showNotification(
            '🏋️ Tomorrow\'s Training',
            `${session.session_name} (${discLabel})${session.duration_min ? ` · ${session.duration_min} min` : ''} — Get ready!`
          );
        }
      }

      // 1 hour before reminder based on per-day training time
      if (prefs.hourBefore && session.date === today) {
        const trainingTimes = getTrainingTimes();
        const dayOfWeek = now.getDay();
        const timeForToday = trainingTimes[dayOfWeek];
        if (timeForToday) {
          const [trainH, trainM] = timeForToday.split(':').map(Number);
          let reminderH = trainH - 1;
          if (reminderH < 0) reminderH = 23;
          if (currentHour === reminderH && Math.abs(currentMin - trainM) < 10) {
            const key = `hour-${session.id}-${today}`;
            if (!firedRef.current.has(key)) {
              firedRef.current.add(key);
              showNotification(
                '⏰ Session in 1 Hour',
                `${session.session_name} (${discLabel})${session.duration_min ? ` · ${session.duration_min} min` : ''} — Time to warm up!`
              );
            }
          }
        }
      }
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    // Initial check
    checkAndNotify();
    // Check every 5 minutes
    const interval = setInterval(checkAndNotify, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId, checkAndNotify]);
}
