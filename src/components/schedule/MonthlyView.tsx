import { useMemo } from 'react';
import { getDiscipline, intensityConfig, dayLabels } from './config';
import { motion } from 'framer-motion';

interface MonthlyViewProps {
  sessions: any[];
  maxWeek: number;
  onSelectWeek: (week: number) => void;
  currentWeek: number;
}

export default function MonthlyView({ sessions, maxWeek, onSelectWeek, currentWeek }: MonthlyViewProps) {
  const weeks = useMemo(() => {
    return Array.from({ length: maxWeek }, (_, i) => {
      const weekNum = i + 1;
      const weekSessions = sessions.filter(s => s.week_number === weekNum);
      const days = dayLabels.map((_, di) => {
        return weekSessions.filter(s => s.day_of_week === di + 1);
      });
      return { weekNum, days, totalSessions: weekSessions.length };
    });
  }, [sessions, maxWeek]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-1"
    >
      {/* Day headers */}
      <div className="grid grid-cols-[40px_repeat(7,1fr)] gap-1 px-1">
        <div />
        {dayLabels.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map(({ weekNum, days, totalSessions }) => (
        <button
          key={weekNum}
          onClick={() => onSelectWeek(weekNum)}
          className={`grid grid-cols-[40px_repeat(7,1fr)] gap-1 px-1 py-1.5 rounded-lg transition-colors w-full ${
            currentWeek === weekNum
              ? 'bg-primary/5 ring-1 ring-primary/20'
              : 'hover:bg-muted/40'
          }`}
        >
          <div className="flex items-center justify-center">
            <span className="text-[10px] font-semibold text-muted-foreground">W{weekNum}</span>
          </div>
          {days.map((daySessions, di) => (
            <div key={di} className="flex items-center justify-center min-h-[28px]">
              {daySessions.length === 0 ? (
                <div className="w-2 h-2 rounded-full bg-muted/40" />
              ) : (
                <div className="flex flex-col items-center gap-0.5">
                  {daySessions.slice(0, 2).map(s => {
                    const intConf = s.intensity ? intensityConfig[s.intensity] : null;
                    const disc = getDiscipline(s.discipline);
                    return (
                      <div
                        key={s.id}
                        className={`w-5 h-2 rounded-full ${intConf ? intConf.dot : 'bg-muted-foreground/40'}`}
                        title={`${s.session_name} (${disc.label})`}
                      />
                    );
                  })}
                  {daySessions.length > 2 && (
                    <span className="text-[8px] text-muted-foreground">+{daySessions.length - 2}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </button>
      ))}

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 pt-3 flex-wrap">
        {Object.entries(intensityConfig).map(([key, { label, dot }]) => (
          <div key={key} className="flex items-center gap-1">
            <div className={`w-3 h-1.5 rounded-full ${dot}`} />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
