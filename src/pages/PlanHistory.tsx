import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, RotateCcw, FileSpreadsheet, Sparkles, PenTool, Loader2, History, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const sourceIcon: Record<string, typeof FileSpreadsheet> = {
  spreadsheet: FileSpreadsheet,
  ai_generated: Sparkles,
  manual: PenTool,
};

const sourceLabel: Record<string, string> = {
  spreadsheet: 'Spreadsheet Import',
  ai_generated: 'AI Generated',
  manual: 'Manual',
};

export default function PlanHistory() {
  const { t } = useTranslation();
  const { user, currentOrg, effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const [acting, setActing] = useState<string | null>(null);
  const isCoachOrAdmin = effectiveRole === 'coach' || effectiveRole === 'admin' || effectiveRole === 'master_admin';

  // Fetch ALL plans (active + archived)
  const { data: allPlans, isLoading } = useQuery({
    queryKey: ['all-plans-history', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('training_plans')
        .select('id, name, created_at, source, archived_at, created_by, is_template')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });
      return error ? [] : (data || []) as any[];
    },
    enabled: !!currentOrg,
  });

  // Fetch plan history events
  const { data: historyEvents } = useQuery({
    queryKey: ['plan-history-events', currentOrg?.id],
    queryFn: async () => {
      if (!allPlans?.length) return [];
      const planIds = allPlans.map(p => p.id);
      const { data, error } = await supabase
        .from('plan_history' as any)
        .select('*')
        .in('plan_id', planIds)
        .order('created_at', { ascending: false })
        .limit(50);
      return error ? [] : (data as any[]) || [];
    },
    enabled: (allPlans?.length ?? 0) > 0,
  });

  // Fetch session counts per plan version
  const { data: sessionCounts } = useQuery({
    queryKey: ['plan-session-counts', allPlans?.map(p => p.id).join(',')],
    queryFn: async () => {
      if (!allPlans?.length) return {};
      const counts: Record<string, number> = {};
      for (const plan of allPlans) {
        const { data: version } = await supabase
          .from('plan_versions')
          .select('id')
          .eq('plan_id', plan.id)
          .order('version_number', { ascending: false })
          .limit(1)
          .single();
        if (version) {
          const { count } = await supabase
            .from('planned_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('plan_version_id', version.id);
          counts[plan.id] = count || 0;
        }
      }
      return counts;
    },
    enabled: (allPlans?.length ?? 0) > 0,
  });

  const handleArchive = async (planId: string) => {
    setActing(planId);
    try {
      const { error } = await supabase
        .from('training_plans')
        .update({ archived_at: new Date().toISOString() } as any)
        .eq('id', planId);
      if (error) throw error;

      // Log history
      await supabase.from('plan_history' as any).insert({
        plan_id: planId,
        action: 'archived',
        performed_by: user!.id,
      });

      toast.success('Plan archived — it can be restored anytime');
      queryClient.invalidateQueries({ queryKey: ['all-plans-history'] });
      queryClient.invalidateQueries({ queryKey: ['org-plans'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to archive');
    } finally {
      setActing(null);
    }
  };

  const handleRestore = async (planId: string) => {
    setActing(planId);
    try {
      const { error } = await supabase
        .from('training_plans')
        .update({ archived_at: null } as any)
        .eq('id', planId);
      if (error) throw error;

      await supabase.from('plan_history' as any).insert({
        plan_id: planId,
        action: 'restored',
        performed_by: user!.id,
      });

      toast.success('Plan restored and now active again');
      queryClient.invalidateQueries({ queryKey: ['all-plans-history'] });
      queryClient.invalidateQueries({ queryKey: ['org-plans'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to restore');
    } finally {
      setActing(null);
    }
  };

  const activePlans = allPlans?.filter(p => !p.archived_at) || [];
  const archivedPlans = allPlans?.filter(p => !!p.archived_at) || [];

  if (isLoading) {
    return (
      <div className="page-container py-6 flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="page-container py-6 space-y-6">
      <div className="flex items-center gap-3">
        <History className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-display font-bold">Plan History</h1>
      </div>

      {/* Protection notice */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-600 dark:text-amber-400">Plan Protection Active</p>
            <p className="text-muted-foreground mt-1">
              Coach-imported plans are never deleted or overwritten. AI-generated athlete plans are added alongside existing plans.
              Archived plans retain all sessions and can be restored at any time.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Active Plans */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Plans ({activePlans.length})</h2>
        {activePlans.length === 0 && (
          <p className="text-sm text-muted-foreground">No active plans</p>
        )}
        {activePlans.map((plan, i) => {
          const Icon = sourceIcon[plan.source] || PenTool;
          return (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="glass">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{plan.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {sourceLabel[plan.source] || plan.source}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(plan.created_at), 'dd MMM yyyy')}
                        </span>
                        {sessionCounts?.[plan.id] !== undefined && (
                          <span className="text-[10px] text-muted-foreground">
                            · {sessionCounts[plan.id]} sessions
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isCoachOrAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-destructive"
                          disabled={acting === plan.id}>
                          {acting === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Archive "{plan.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This plan will be hidden from the schedule but all data is preserved. You can restore it anytime from this page.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleArchive(plan.id)}>Archive</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </section>

      {/* Archived Plans */}
      {archivedPlans.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Archived Plans ({archivedPlans.length})</h2>
          {archivedPlans.map((plan, i) => {
            const Icon = sourceIcon[plan.source] || PenTool;
            return (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="glass opacity-70">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate text-muted-foreground">{plan.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {sourceLabel[plan.source] || plan.source}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            Archived {format(new Date(plan.archived_at), 'dd MMM yyyy')}
                          </span>
                          {sessionCounts?.[plan.id] !== undefined && (
                            <span className="text-[10px] text-muted-foreground">
                              · {sessionCounts[plan.id]} sessions
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isCoachOrAdmin && (
                      <Button variant="outline" size="sm" className="shrink-0" onClick={() => handleRestore(plan.id)}
                        disabled={acting === plan.id}>
                        {acting === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                        Restore
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </section>
      )}

      {/* Recent History Events */}
      {(historyEvents?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Activity</h2>
          <Card className="glass">
            <CardContent className="p-4 space-y-2">
              {historyEvents!.slice(0, 20).map((evt: any) => (
                <div key={evt.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{format(new Date(evt.created_at), 'dd/MM HH:mm')}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{evt.action}</Badge>
                  {evt.details?.plan_name && <span className="truncate">— {evt.details.plan_name}</span>}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
