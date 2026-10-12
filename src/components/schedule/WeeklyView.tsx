import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SessionCard } from './SessionCard';
import { dayLabels, getDiscipline, intensityConfig } from './config';
import { TrendingUp, Bike, Footprints } from 'lucide-react';
import { motion } from 'framer-motion';
import { StravaDayItems, useStravaRange } from './StravaWeekItems';
import { activityDate } from '@/lib/stravaLink';

import { useTranslation } from 'react-i18next';
interface WeeklyViewProps {
  sessions: any[];
  weekNumber: number;
  weeklySummary?: any;
  completedSessions?: any[];
  substitutionMap?: Record<string, any>;
}

export default function WeeklyView({ sessions, weekNumber, weeklySummary, completedSessions = [], substitutionMap = {} }: WeeklyViewProps) {
  const { t } = useTranslation();
  const weekSessions = sessions.filter(s => s.week_number === weekNumber);

  const completedPlanIds = useMemo(
    () => new Set(completedSessions.filter(c => c.planned_session_id).map(c => c.planned_session_id)),
    [completedSessions]
  );

  const weekRange = useMemo(() => {
    const dates = weekSessions.map(s => s.date).filter(Boolean).sort() as string[];
    if (!dates.length) return { start: null, end: null, byDow: {} as Record<number, string> };
    const first = new Date(`${dates[0]}T00:00:00`);
    const dowFirst = (first.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(first.getTime() - dowFirst * 86400000);
    const byDow: Record<number, string> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getTime() + i * 86400000);
      byDow[i + 1] = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return { start: byDow[1], end: byDow[7], byDow };
  }, [weekSessions]);
  const { data: stravaWeek = [] } = useStravaRange(weekRange.start, weekRange.end);
  const completionToSessionName = useMemo(() => {
    const nameById = new Map(weekSessions.map(s => [s.id, s.session_name]));
    const m: Record<string, string> = {};
    completedSessions.forEach(c => { if (c.planned_session_id && nameById.has(c.planned_session_id)) m[c.id] = nameById.get(c.planned_session_id)!; });
    return m;
  }, [weekSessions, completedSessions]);
  const openWeekSessions = weekSessions.filter(s => !completedPlanIds.has(s.id));

  // Planned vs actual for the displayed week: session counts and hours.
  const adherence = useMemo(() => {
    const weekIds = new Set(weekSessions.map(s => s.id));
    const plannedCount = weekSessions.length;
    const plannedHours = weekSessions.reduce((sum, s) => sum + (Number(s.duration_min) || 0), 0) / 60;
    const doneForWeek = completedSessions.filter(c => c.planned_session_id && weekIds.has(c.planned_session_id));
    const doneIds = new Set(doneForWeek.map(c => c.planned_session_id));
    const doneHours = doneForWeek.reduce((sum, c) => sum + (Number(c.actual_duration_min) || 0), 0) / 60;
    const pct = plannedCount > 0 ? Math.round((doneIds.size / plannedCount) * 100) : null;
    return {
      plannedCount,
      doneCount: doneIds.size,
      plannedHours: Math.round(plannedHours * 10) / 10,
      doneHours: Math.round(doneHours * 10) / 10,
      pct,
    };
  }, [weekSessions, completedSessions]);

  return (
    <motion.div
      key={weekNumber}
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-3"
    >
      {/* Week strip: planned dots + Strava dots */}
      {weekRange.start && (
        <div className="grid grid-cols-7 gap-1 rounded-xl border border-border/60 p-2">
          {dayLabels.map((d, i) => {
            const date = weekRange.byDow[i + 1];
            const planned = weekSessions.filter(s => s.day_of_week === i + 1);
            const strava = stravaWeek.filter(a => activityDate(a) === date);
            const isToday = date === new Date().toISOString().slice(0, 10);
            return (
              <div key={d} className="flex flex-col items-center gap-1">
                <span className="text-[9px] uppercase text-muted-foreground">{d}</span>
                <span className={`text-xs font-medium h-6 w-6 flex items-center justify-center rounded-full ${isToday ? 'bg-foreground text-background' : ''}`}>
                  {date ? Number(date.slice(8)) : ''}
                </span>
                <div className="flex gap-0.5 flex-wrap justify-center min-h-[6px]">
                  {planned.map(s => (
                    <span key={s.id} className={`h-1.5 w-1.5 rounded-sm ${completedPlanIds.has(s.id) ? 'bg-success' : 'bg-primary'}`} />
                  ))}
                  {strava.map(a => <span key={a.id} className="h-1.5 w-1.5 rounded-sm bg-muted-foreground" />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Planned vs actual strip */}
      {adherence.plannedCount > 0 && (
        <Card className="glass">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />  {t('auto.k405')}
              </span>
              {adherence.pct !== null && (
                <Badge variant={adherence.pct >= 70 ? 'outline' : 'destructive'} className="text-[10px]">
                  {adherence.pct}%
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span>
                <span className="font-medium">{adherence.doneCount}</span>
                <span className="text-muted-foreground">/{adherence.plannedCount} sessions</span>
              </span>
              <span>
                <span className="font-medium">{adherence.doneHours}h</span>
                <span className="text-muted-foreground">/{adherence.plannedHours}h</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, adherence.pct ?? 0)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly summary bar */}
      {weeklySummary && (
        <Card className="glass border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {weeklySummary.run_km_target && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Footprints className="h-3.5 w-3.5 text-blue-500" />
                    <span className="font-medium">{weeklySummary.run_km_target}km</span>
                    <span className="text-muted-foreground">run</span>
                  </div>
                )}
                {weeklySummary.bike_z2_min_target && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Bike className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="font-medium">{weeklySummary.bike_z2_min_target}′</span>
                    <span className="text-muted-foreground">{t('auto.k97')}</span>
                  </div>
                )}
              </div>
              {weeklySummary.notes && (
                <Badge variant="outline" className="text-[10px] max-w-[160px] truncate">
                  {weeklySummary.notes}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day-by-day sessions */}
      {dayLabels.map((day, i) => {
        const daySessions = weekSessions.filter(s => s.day_of_week === i + 1);
        const dayDate = weekRange.byDow[i + 1];
        const dayStrava = dayDate ? stravaWeek.filter(a => activityDate(a) === dayDate) : [];
        const stravaBlock = (
          <StravaDayItems activities={dayStrava} openSessions={openWeekSessions} linkedNames={completionToSessionName} />
        );

        if (daySessions.length === 0 && dayStrava.length > 0) {
          return (
            <div key={i} className="space-y-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">{day}</span>
              {stravaBlock}
            </div>
          );
        }

        if (daySessions.length === 0) {
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg opacity-40"
            >
              <span className="text-xs font-medium w-8 text-muted-foreground">{day}</span>
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground">Rest</span>
            </div>
          );
        }

        return (
          <div key={i} className="space-y-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {day}
            </span>
            {daySessions.map(session => (
              <SessionCard key={session.id} session={session} showDay={false} isCompleted={completedPlanIds.has(session.id)} substitution={substitutionMap[session.id] || null} />
            ))}
            {stravaBlock}
          </div>
        );
      })}

      {weekSessions.length === 0 && (
        <p className="text-center text-muted-foreground py-12 text-sm">{t('auto.k353')}</p>
      )}
    </motion.div>
  );
}
