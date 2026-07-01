import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Archive, RotateCcw, FileSpreadsheet, Sparkles, PenTool, Loader2, ListChecks, AlertTriangle, Trash2, Eye, EyeOff, CalendarDays } from 'lucide-react';
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

function readHidden(userId?: string): Set<string> {
  if (!userId) return new Set();
  try {
    const raw = localStorage.getItem(`ha-hidden-plans:${userId}`);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function writeHidden(userId: string, set: Set<string>) {
  const key = `ha-hidden-plans:${userId}`;
  const value = JSON.stringify([...set]);
  localStorage.setItem(key, value);
  // Trigger cross-tab + intra-tab listeners
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
}

export default function PlanHistory() {
  useTranslation();
  const { user, currentOrg, effectiveRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [acting, setActing] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => readHidden(user?.id));
  const isCoachOrAdmin = effectiveRole === 'coach' || effectiveRole === 'admin' || effectiveRole === 'master_admin';

  useEffect(() => { setHidden(readHidden(user?.id)); }, [user?.id]);

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

  const toggleVisibility = (planId: string) => {
    if (!user?.id) return;
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId); else next.add(planId);
      writeHidden(user.id, next);
      return next;
    });
  };

  const handleArchive = async (planId: string) => {
    setActing(planId);
    try {
      const { error } = await supabase
        .from('training_plans')
        .update({ archived_at: new Date().toISOString() } as any)
        .eq('id', planId);
      if (error) throw error;
      await supabase.from('plan_history' as any).insert({
        plan_id: planId, action: 'archived', performed_by: user!.id,
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
        plan_id: planId, action: 'restored', performed_by: user!.id,
      });
      toast.success('Plan restored');
      queryClient.invalidateQueries({ queryKey: ['all-plans-history'] });
      queryClient.invalidateQueries({ queryKey: ['org-plans'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to restore');
    } finally {
      setActing(null);
    }
  };

  const handleDelete = async (planId: string) => {
    setActing(planId);
    try {
      // Find versions to clean up dependent rows
      const { data: versions } = await supabase.from('plan_versions').select('id').eq('plan_id', planId);
      const versionIds = (versions || []).map(v => v.id);
      if (versionIds.length > 0) {
        await supabase.from('planned_sessions').delete().in('plan_version_id', versionIds);
        await supabase.from('targets').delete().in('plan_version_id', versionIds);
        await supabase.from('plan_versions').delete().in('id', versionIds);
      }
      const { error } = await supabase.from('training_plans').delete().eq('id', planId);
      if (error) throw error;
      // Remove from hidden set too
      if (user?.id) {
        const next = new Set(hidden); next.delete(planId);
        writeHidden(user.id, next);
        setHidden(next);
      }
      toast.success('Plan deleted permanently');
      queryClient.invalidateQueries({ queryKey: ['all-plans-history'] });
      queryClient.invalidateQueries({ queryKey: ['org-plans'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
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

  const canDelete = (plan: any) => isCoachOrAdmin || plan.created_by === user?.id;

  return (
    <div className="page-container py-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <ListChecks className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-display font-bold">My Plans</h1>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate('/schedule')} className="gap-1.5">
          <CalendarDays className="h-4 w-4" /> Open Schedule
        </Button>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            Toggle <strong>Show on Schedule</strong> to hide a plan from your calendar without deleting it.
            <strong> Archive</strong> keeps everything safe and reversible.
            <strong> Delete</strong> is permanent and removes all sessions.
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
          const isHidden = hidden.has(plan.id);
          return (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={`glass ${isHidden ? 'opacity-60' : ''}`}>
                <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{plan.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                      {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>Show on Schedule</span>
                      <Switch checked={!isHidden} onCheckedChange={() => toggleVisibility(plan.id)} />
                    </label>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" disabled={acting === plan.id}>
                          {acting === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Archive "{plan.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Hidden from your schedule; all sessions preserved and restorable anytime.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleArchive(plan.id)}>Archive</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {canDelete(plan) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={acting === plan.id}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete "{plan.name}" permanently?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This removes the plan and all its sessions. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDelete(plan.id)}
                            >
                              Delete permanently
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
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
                  <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate text-muted-foreground">{plan.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => handleRestore(plan.id)} disabled={acting === plan.id}>
                        {acting === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                        Restore
                      </Button>
                      {canDelete(plan) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={acting === plan.id}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete "{plan.name}" permanently?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This removes the plan and all its sessions. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDelete(plan.id)}
                              >
                                Delete permanently
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </section>
      )}
    </div>
  );
}
