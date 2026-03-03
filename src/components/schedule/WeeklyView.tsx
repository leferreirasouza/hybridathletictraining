import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SessionCard } from './SessionCard';
import { dayLabels, getDiscipline, intensityConfig } from './config';
import { TrendingUp, Bike, Footprints } from 'lucide-react';
import { motion } from 'framer-motion';

interface WeeklyViewProps {
  sessions: any[];
  weekNumber: number;
  weeklySummary?: any;
  completedSessions?: any[];
  substitutionMap?: Record<string, any>;
}

export default function WeeklyView({ sessions, weekNumber, weeklySummary, completedSessions = [], substitutionMap = {} }: WeeklyViewProps) {
  const weekSessions = sessions.filter(s => s.week_number === weekNumber);

  const completedPlanIds = useMemo(
    () => new Set(completedSessions.filter(c => c.planned_session_id).map(c => c.planned_session_id)),
    [completedSessions]
  );

  return (
    <motion.div
      key={weekNumber}
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-3"
    >
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
                    <span className="text-muted-foreground">bike Z2</span>
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
          </div>
        );
      })}

      {weekSessions.length === 0 && (
        <p className="text-center text-muted-foreground py-12 text-sm">No sessions this week.</p>
      )}
    </motion.div>
  );
}
