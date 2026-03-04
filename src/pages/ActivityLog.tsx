import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Activity, Dumbbell, Calendar, Shield, Trophy, ArrowRightLeft, LogIn, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const ACTION_META: Record<string, { label: string; icon: typeof Activity; color: string }> = {
  'session.completed': { label: 'Session Logged', icon: Dumbbell, color: 'text-success' },
  'session.deleted': { label: 'Session Deleted', icon: Dumbbell, color: 'text-destructive' },
  'plan.created': { label: 'Plan Created', icon: Calendar, color: 'text-primary' },
  'plan.imported': { label: 'Plan Imported', icon: Calendar, color: 'text-primary' },
  'plan.ai_generated': { label: 'AI Plan Generated', icon: Calendar, color: 'text-accent-foreground' },
  'substitution.created': { label: 'Swap Requested', icon: ArrowRightLeft, color: 'text-warning' },
  'substitution.approved': { label: 'Swap Approved', icon: ArrowRightLeft, color: 'text-success' },
  'substitution.rejected': { label: 'Swap Rejected', icon: ArrowRightLeft, color: 'text-destructive' },
  'assignment.created': { label: 'Athlete Assigned', icon: Shield, color: 'text-primary' },
  'race.added': { label: 'Race Added', icon: Trophy, color: 'text-primary' },
  'race.deleted': { label: 'Race Deleted', icon: Trophy, color: 'text-destructive' },
  'auth.login': { label: 'Logged In', icon: LogIn, color: 'text-muted-foreground' },
  'auth.signup': { label: 'Account Created', icon: UserPlus, color: 'text-success' },
  'auth.password_reset': { label: 'Password Reset', icon: Shield, color: 'text-warning' },
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

export default function ActivityLog() {
  const { user, effectiveRole } = useAuth();
  const isCoachOrAdmin = effectiveRole === 'coach' || effectiveRole === 'admin' || effectiveRole === 'master_admin';

  const { data: logs, isLoading } = useQuery({
    queryKey: ['activity-logs', user?.id, isCoachOrAdmin],
    queryFn: async () => {
      if (!user) return [];
      // Admins see all, athletes see only their own (via RLS)
      const query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Athletes can't read audit_logs due to RLS, so we only show for coaches/admins
      if (!isCoachOrAdmin) {
        // For athletes: build from their own completed_sessions as a lightweight feed
        const { data, error } = await supabase
          .from('completed_sessions')
          .select('id, date, discipline, actual_duration_min, actual_distance_km, completed_at, planned_session_id')
          .eq('athlete_id', user.id)
          .order('completed_at', { ascending: false })
          .limit(50);

        return (data || []).map(s => ({
          id: s.id,
          action: 'session.completed',
          entity_type: 'completed_session',
          entity_id: s.id,
          created_at: s.completed_at,
          details: {
            discipline: s.discipline,
            duration: s.actual_duration_min,
            distance: s.actual_distance_km,
            linked: !!s.planned_session_id,
          },
        }));
      }

      const { data, error } = await query;
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
    <div className="page-container py-6">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={item}>
          <h1 className="text-xl font-display font-bold">Activity Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isCoachOrAdmin ? 'All team activity' : 'Your recent activity'}
          </p>
        </motion.div>

        {logs && logs.length === 0 && (
          <motion.div variants={item}>
            <Card className="glass">
              <CardContent className="p-8 text-center space-y-2">
                <Activity className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="font-display font-bold">No Activity Yet</p>
                <p className="text-sm text-muted-foreground">Actions will appear here as you use the app.</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {logs && logs.length > 0 && (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-1">
              {logs.map((log: any) => {
                const meta = ACTION_META[log.action] || { label: log.action, icon: Activity, color: 'text-muted-foreground' };
                const Icon = meta.icon;
                const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;

                return (
                  <motion.div key={log.id} variants={item} className="relative flex items-start gap-3 pl-2 py-2">
                    <div className={`relative z-10 h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center shrink-0`}>
                      <Icon className={`h-3 w-3 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{meta.label}</p>
                        {details?.discipline && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0">{details.discipline}</Badge>
                        )}
                      </div>
                      {details && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                          {details.duration && <span>{details.duration} min</span>}
                          {details.distance && <span>{details.distance} km</span>}
                          {details.plan_name && <span>"{details.plan_name}"</span>}
                          {details.sessions_count && <span>{details.sessions_count} sessions</span>}
                          {details.athlete_name && <span>{details.athlete_name}</span>}
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
