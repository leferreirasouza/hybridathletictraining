import { SessionCard } from './SessionCard';
import { dayLabelsFull } from './config';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface DailyViewProps {
  sessions: any[];
  weekNumber: number;
  dayOfWeek: number;
  completedSessions?: any[];
}

export default function DailyView({ sessions, weekNumber, dayOfWeek, completedSessions = [] }: DailyViewProps) {
  const daySessions = sessions.filter(
    s => s.week_number === weekNumber && s.day_of_week === dayOfWeek
  );

  const completedPlanIds = useMemo(
    () => new Set(completedSessions.filter(c => c.planned_session_id).map(c => c.planned_session_id)),
    [completedSessions]
  );

  return (
    <motion.div
      key={`${weekNumber}-${dayOfWeek}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="text-center">
        <h2 className="text-lg font-display font-bold">
          {dayLabelsFull[dayOfWeek - 1]}
        </h2>
        <p className="text-xs text-muted-foreground">Week {weekNumber}</p>
      </div>

      {daySessions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">Rest Day 🧘</p>
          <p className="text-xs text-muted-foreground mt-1">No sessions scheduled</p>
        </div>
      ) : (
        <div className="space-y-2">
          {daySessions.map(session => (
            <SessionCard key={session.id} session={session} showDay={false} isCompleted={completedPlanIds.has(session.id)} />
          ))}
        </div>
      )}
    </motion.div>
  );
}
