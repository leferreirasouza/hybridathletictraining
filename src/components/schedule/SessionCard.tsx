import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { getDiscipline, intensityConfig, formatIntensity, dayLabelsFull } from './config';
import { Clock, MapPin, ChevronRight, Flame } from 'lucide-react';
import { motion } from 'framer-motion';

interface Session {
  id: string;
  session_name: string;
  discipline: string;
  day_of_week: number;
  week_number: number;
  duration_min?: number | null;
  distance_km?: number | null;
  intensity?: string | null;
  workout_details?: string | null;
  notes?: string | null;
  date?: string | null;
}

export function SessionCard({ session, showDay = true }: { session: Session; showDay?: boolean }) {
  const disc = getDiscipline(session.discipline);
  const IntIcon = disc.icon;
  const intConf = session.intensity ? intensityConfig[session.intensity] : null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="cursor-pointer"
        >
          <Card className="glass hover:border-primary/30 transition-all group">
            <CardContent className="p-3.5">
              <div className="flex items-start gap-3">
                {/* Discipline icon */}
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${disc.color}`}>
                  <IntIcon className="h-4.5 w-4.5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{session.session_name}</p>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {showDay && (
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {dayLabelsFull[session.day_of_week - 1]}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">{disc.label}</span>
                    {session.duration_min && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />{session.duration_min}′
                      </span>
                    )}
                    {session.distance_km && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />{session.distance_km}km
                      </span>
                    )}
                  </div>
                </div>

                {intConf && (
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 shrink-0 border ${intConf.class}`}>
                    {intConf.label}
                  </Badge>
                )}
              </div>

              {session.workout_details && (
                <p className="text-[11px] text-muted-foreground mt-2 pl-12 line-clamp-2">
                  {session.workout_details}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </SheetTrigger>

      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SessionDetailSheet session={session} />
      </SheetContent>
    </Sheet>
  );
}

function SessionDetailSheet({ session }: { session: Session }) {
  const disc = getDiscipline(session.discipline);
  const IntIcon = disc.icon;
  const intConf = session.intensity ? intensityConfig[session.intensity] : null;

  return (
    <div className="space-y-5 pb-6">
      <SheetHeader>
        <div className="flex items-center gap-3">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${disc.color}`}>
            <IntIcon className="h-5 w-5" />
          </div>
          <div>
            <SheetTitle className="text-left font-display">{session.session_name}</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dayLabelsFull[session.day_of_week - 1]} · Week {session.week_number}
              {session.date && ` · ${session.date}`}
            </p>
          </div>
        </div>
      </SheetHeader>

      {/* Meta row */}
      <div className="flex gap-3 flex-wrap">
        <MetaPill icon={<IntIcon className="h-3.5 w-3.5" />} label={disc.label} />
        {session.duration_min && <MetaPill icon={<Clock className="h-3.5 w-3.5" />} label={`${session.duration_min} min`} />}
        {session.distance_km && <MetaPill icon={<MapPin className="h-3.5 w-3.5" />} label={`${session.distance_km} km`} />}
        {intConf && (
          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${intConf.class}`}>
            <Flame className="h-3 w-3" />
            {intConf.label}
          </span>
        )}
      </div>

      {/* Workout Details */}
      {session.workout_details && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Workout</h3>
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{session.workout_details}</p>
          </div>
        </div>
      )}

      {/* Notes */}
      {session.notes && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</h3>
          <p className="text-sm text-muted-foreground">{session.notes}</p>
        </div>
      )}
    </div>
  );
}

function MetaPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground">
      {icon}{label}
    </span>
  );
}
