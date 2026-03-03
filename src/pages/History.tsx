import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Clock, MapPin, Flame, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { getDiscipline } from '@/components/schedule/config';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export default function History() {
  const { user } = useAuth();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['session-history', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('completed_sessions')
        .select('*')
        .eq('athlete_id', user.id)
        .order('date', { ascending: false })
        .limit(100);
      return error ? [] : data || [];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-display font-bold">Session History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {sessions?.length || 0} sessions logged
        </p>
      </div>

      {!sessions?.length ? (
        <Card className="glass">
          <CardContent className="p-8 text-center space-y-2">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-display font-bold">No Sessions Yet</p>
            <p className="text-sm text-muted-foreground">Your completed sessions will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
          {sessions.map((s) => {
            const disc = getDiscipline(s.discipline);
            const DiscIcon = disc.icon;
            return (
              <motion.div key={s.id} variants={item}>
                <Card className="glass">
                  <CardContent className="p-3.5">
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${disc.color}`}>
                        <DiscIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{disc.label}</p>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {s.actual_duration_min && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />{s.actual_duration_min} min
                            </span>
                          )}
                          {s.actual_distance_km && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />{s.actual_distance_km} km
                            </span>
                          )}
                          {s.rpe && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <Target className="h-3 w-3" />RPE {s.rpe}
                            </span>
                          )}
                          {s.avg_hr && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <Flame className="h-3 w-3" />{s.avg_hr} bpm
                            </span>
                          )}
                        </div>
                        {s.notes && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-1">{s.notes}</p>
                        )}
                      </div>
                      {s.pain_flag && (
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0.5 shrink-0">Pain</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
