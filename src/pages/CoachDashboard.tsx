import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, AlertTriangle, CheckCircle, TrendingUp, ChevronRight, Plus, ArrowLeftRight, Check, X, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';

const mockAthletes = [
  { id: '1', name: 'Sarah Mitchell', compliance: 92, sessions: '5/6', flag: false, lastActive: '2h ago' },
  { id: '2', name: 'James Carter', compliance: 67, sessions: '3/5', flag: true, lastActive: '1d ago' },
  { id: '3', name: 'Emma Wilson', compliance: 100, sessions: '6/6', flag: false, lastActive: '30m ago' },
  { id: '4', name: 'Lucas Brown', compliance: 45, sessions: '2/5', flag: false, lastActive: '3d ago' },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

function SwapRequestsPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [approveDialog, setApproveDialog] = useState<any | null>(null);
  const [workoutDetails, setWorkoutDetails] = useState('');
  const [saving, setSaving] = useState(false);

  const reasonLabels: Record<string, string> = {
    no_equipment: t('coachDashboard.noEquipment'),
    less_time: t('coachDashboard.lessTime'),
    other: t('coachDashboard.other'),
  };

  const { data: pendingSwaps, isLoading } = useQuery({
    queryKey: ['coach-pending-swaps', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: assignments } = await supabase
        .from('coach_athlete_assignments')
        .select('athlete_id')
        .eq('coach_id', user.id);
      if (!assignments?.length) return [];
      const athleteIds = assignments.map(a => a.athlete_id);
      const { data, error } = await supabase
        .from('session_substitutions' as any)
        .select('*')
        .in('athlete_id', athleteIds)
        .eq('status', 'pending_coach')
        .order('created_at', { ascending: false });
      if (error) return [];
      const enriched = await Promise.all((data as any[]).map(async (swap) => {
        const [profileRes, sessionRes] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', swap.athlete_id).single(),
          supabase.from('planned_sessions').select('session_name, discipline, duration_min, workout_details').eq('id', swap.original_session_id).single(),
        ]);
        return { ...swap, athlete_name: profileRes.data?.full_name || 'Unknown', original_session: sessionRes.data };
      }));
      return enriched;
    },
    enabled: !!user?.id,
  });

  const handleApprove = async (swap: any) => {
    setSaving(true);
    const { error } = await supabase
      .from('session_substitutions' as any)
      .update({
        status: 'active',
        substitute_session_name: swap.substitute_session_name?.replace('[Pending] ', '') || swap.original_session?.session_name,
        substitute_workout_details: workoutDetails || swap.original_session?.workout_details || '',
        substitute_notes: 'Approved by coach',
      })
      .eq('id', swap.id);
    setSaving(false);
    if (error) { toast.error('Failed to approve: ' + error.message); }
    else { toast.success('Swap approved! ✅'); setApproveDialog(null); setWorkoutDetails(''); queryClient.invalidateQueries({ queryKey: ['coach-pending-swaps'] }); }
  };

  const handleReject = async (swapId: string) => {
    const { error } = await supabase.from('session_substitutions' as any).update({ status: 'cancelled' }).eq('id', swapId);
    if (error) { toast.error('Failed to reject'); }
    else { toast.success('Swap rejected'); queryClient.invalidateQueries({ queryKey: ['coach-pending-swaps'] }); }
  };

  if (isLoading || !pendingSwaps?.length) return null;

  return (
    <>
      <Card className="glass border-amber-500/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-amber-500" /> {t('coachDashboard.swapRequests')}
            </CardTitle>
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 text-xs">
              {t('coachDashboard.pendingCount', { count: pendingSwaps.length })}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendingSwaps.map((swap: any) => (
            <div key={swap.id} className="p-3 rounded-lg border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{swap.athlete_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('coachDashboard.wantsToSwap')} <span className="font-medium text-foreground">{swap.original_session?.session_name || 'session'}</span>
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500">
                  {reasonLabels[swap.reason] || swap.reason}
                </Badge>
              </div>
              {swap.reason_details && (
                <p className="text-xs text-muted-foreground italic">"{swap.reason_details}"</p>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 text-destructive" onClick={() => handleReject(swap.id)}>
                  <X className="h-3.5 w-3.5 mr-1" /> {t('coachDashboard.reject')}
                </Button>
                <Button size="sm" className="flex-1 gradient-hyrox" onClick={() => { setApproveDialog(swap); setWorkoutDetails(swap.original_session?.workout_details || ''); }}>
                  <Check className="h-3.5 w-3.5 mr-1" /> {t('coachDashboard.approve')}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!approveDialog} onOpenChange={v => { if (!v) { setApproveDialog(null); setWorkoutDetails(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{t('coachDashboard.approveSwap')}</DialogTitle>
          </DialogHeader>
          {approveDialog && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-lg bg-muted/40 border text-sm space-y-1">
                <p><span className="text-muted-foreground">Athlete:</span> {approveDialog.athlete_name}</p>
                <p><span className="text-muted-foreground">Original:</span> {approveDialog.original_session?.session_name}</p>
                <p><span className="text-muted-foreground">Reason:</span> {reasonLabels[approveDialog.reason] || approveDialog.reason}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('coachDashboard.substituteWorkout')}</Label>
                <Textarea value={workoutDetails} onChange={e => setWorkoutDetails(e.target.value)} placeholder="Write the substitute workout here..." rows={4} />
                <p className="text-[10px] text-muted-foreground">{t('coachDashboard.substituteHint')}</p>
              </div>
              <Button className="w-full gradient-hyrox" onClick={() => handleApprove(approveDialog)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('coachDashboard.approveAndSend')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function CoachDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
        <motion.div variants={item} className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold">{t('coachDashboard.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('coachDashboard.athletes', { count: mockAthletes.length })}</p>
          </div>
          <Button size="sm" className="gradient-hyrox">
            <Plus className="h-4 w-4 mr-1" /> {t('coachDashboard.invite')}
          </Button>
        </motion.div>

        <motion.div variants={item} className="grid grid-cols-3 gap-3">
          <Card className="glass">
            <CardContent className="p-3 text-center">
              <CheckCircle className="h-4 w-4 mx-auto text-success mb-1" />
              <p className="text-lg font-display font-bold">76%</p>
              <p className="text-[10px] text-muted-foreground">{t('coachDashboard.avgCompliance')}</p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-3 text-center">
              <AlertTriangle className="h-4 w-4 mx-auto text-warning mb-1" />
              <p className="text-lg font-display font-bold">1</p>
              <p className="text-[10px] text-muted-foreground">{t('coachDashboard.painFlags')}</p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-4 w-4 mx-auto text-accent mb-1" />
              <p className="text-lg font-display font-bold">16</p>
              <p className="text-[10px] text-muted-foreground">{t('coachDashboard.sessionsWeek')}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}><SwapRequestsPanel /></motion.div>

        <motion.div variants={item}>
          <Card className="glass">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <Users className="h-4 w-4" /> {t('nav.athletes')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {mockAthletes.map(athlete => (
                <button key={athlete.id} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left" onClick={() => {}}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs bg-secondary">
                        {athlete.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{athlete.name}</span>
                        {athlete.flag && <AlertTriangle className="h-3 w-3 text-destructive" />}
                      </div>
                      <span className="text-xs text-muted-foreground">{athlete.sessions} sessions · {athlete.lastActive}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={`text-xs ${
                      athlete.compliance >= 80 ? 'bg-success/10 text-success' :
                      athlete.compliance >= 60 ? 'bg-warning/10 text-warning' :
                      'bg-destructive/10 text-destructive'
                    }`}>{athlete.compliance}%</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass border-primary/20 overflow-hidden cursor-pointer hover:border-primary/40 transition-colors" onClick={() => navigate('/reports')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display font-bold text-sm">{t('dashboard.weeklyReport')}</p>
                  <p className="text-xs text-muted-foreground">{t('coachDashboard.weeklyReportsDesc')}</p>
                </div>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate('/reports'); }}>
                  {t('coachDashboard.view')} <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass border-primary/20 overflow-hidden">
            <div className="h-1 gradient-hyrox" />
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display font-bold text-sm">{t('planBuilder.title')}</p>
                  <p className="text-xs text-muted-foreground">{t('coachDashboard.planBuilderDesc')}</p>
                </div>
                <Button size="sm" className="gradient-hyrox" onClick={() => navigate('/plans')}>
                  {t('coachDashboard.open')} <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
