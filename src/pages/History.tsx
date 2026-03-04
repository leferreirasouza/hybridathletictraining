import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Calendar, Clock, MapPin, Flame, Target, Pencil, Trash2, Dumbbell, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { getDiscipline } from '@/components/schedule/config';
import ShareWorkoutDialog from '@/components/share/ShareWorkoutDialog';
import type { ShareSessionData } from '@/components/share/types';
import { useTranslation } from 'react-i18next';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

interface CompletedSession {
  id: string;
  date: string;
  discipline: string;
  actual_duration_min: number | null;
  actual_distance_km: number | null;
  avg_hr: number | null;
  avg_pace: string | null;
  rpe: number | null;
  notes: string | null;
  pain_flag: boolean;
  pain_notes: string | null;
}

export default function History() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editSession, setEditSession] = useState<CompletedSession | null>(null);
  const [editForm, setEditForm] = useState({ duration: '', distance: '', avgHr: '', avgPace: '', rpe: [6], notes: '' });
  const [saving, setSaving] = useState(false);
  const [shareData, setShareData] = useState<ShareSessionData | null>(null);
  const navigate = useNavigate();

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

  const openEdit = (s: CompletedSession) => {
    setEditSession(s);
    setEditForm({
      duration: s.actual_duration_min ? String(s.actual_duration_min) : '',
      distance: s.actual_distance_km ? String(s.actual_distance_km) : '',
      avgHr: s.avg_hr ? String(s.avg_hr) : '',
      avgPace: s.avg_pace || '',
      rpe: [s.rpe || 6],
      notes: s.notes || '',
    });
  };

  const handleUpdate = async () => {
    if (!editSession) return;
    setSaving(true);
    const { error } = await supabase.from('completed_sessions').update({
      actual_duration_min: editForm.duration ? parseFloat(editForm.duration) : null,
      actual_distance_km: editForm.distance ? parseFloat(editForm.distance) : null,
      avg_hr: editForm.avgHr ? parseInt(editForm.avgHr) : null,
      avg_pace: editForm.avgPace || null,
      rpe: editForm.rpe[0],
      notes: editForm.notes || null,
    }).eq('id', editSession.id);

    setSaving(false);
    if (error) {
      toast.error('Failed to update: ' + error.message);
    } else {
      toast.success(t('history.sessionUpdated'));
      setEditSession(null);
      queryClient.invalidateQueries({ queryKey: ['session-history'] });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('completed_sessions').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete: ' + error.message);
    } else {
      toast.success(t('history.sessionDeleted'));
      queryClient.invalidateQueries({ queryKey: ['session-history'] });
    }
  };

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
        <h1 className="text-xl font-display font-bold">{t('history.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('history.sessionsLogged', { count: sessions?.length || 0 })}
        </p>
      </div>

      {!sessions?.length ? (
        <Card className="glass">
          <CardContent className="p-8 text-center space-y-3">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-display font-bold">{t('history.noSessions')}</p>
            <p className="text-sm text-muted-foreground">{t('history.noSessionsDesc')}</p>
            <div className="flex gap-2 justify-center">
              <Button className="gradient-hyrox" onClick={() => navigate('/log')}>
                <Dumbbell className="h-4 w-4 mr-2" /> {t('history.logASession')}
              </Button>
              <Button variant="outline" onClick={() => navigate('/schedule')}>
                {t('dashboard.viewSchedule')}
              </Button>
            </div>
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
                              <Clock className="h-3 w-3" />{s.actual_duration_min} {t('common.min')}
                            </span>
                          )}
                          {s.actual_distance_km && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />{s.actual_distance_km} {t('common.km')}
                            </span>
                          )}
                          {s.rpe && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <Target className="h-3 w-3" />RPE {s.rpe}
                            </span>
                          )}
                          {s.avg_hr && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <Flame className="h-3 w-3" />{s.avg_hr} {t('common.bpm')}
                            </span>
                          )}
                        </div>
                        {s.notes && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-1">{s.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {s.pain_flag && (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0.5">{t('history.pain')}</Badge>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShareData({
                          discipline: s.discipline,
                          date: s.date,
                          durationMin: s.actual_duration_min,
                          distanceKm: s.actual_distance_km,
                          avgHr: s.avg_hr,
                          avgPace: s.avg_pace,
                          rpe: s.rpe,
                        })}>
                          <Share2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('history.deleteSession')}</AlertDialogTitle>
                              <AlertDialogDescription>{t('history.deleteSessionDesc')}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(s.id)} className="bg-destructive text-destructive-foreground">{t('common.delete')}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editSession} onOpenChange={(open) => !open && setEditSession(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{t('history.editSession')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('logSession.durationMin')}</Label>
                <Input type="number" value={editForm.duration} onChange={e => setEditForm(f => ({ ...f, duration: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('logSession.distanceKm')}</Label>
                <Input type="number" step="0.1" value={editForm.distance} onChange={e => setEditForm(f => ({ ...f, distance: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('logSession.avgHrBpm')}</Label>
                <Input type="number" value={editForm.avgHr} onChange={e => setEditForm(f => ({ ...f, avgHr: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('logSession.avgPace')}</Label>
                <Input value={editForm.avgPace} onChange={e => setEditForm(f => ({ ...f, avgPace: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">RPE</Label>
                <Badge variant="secondary" className="font-mono text-[10px]">{editForm.rpe[0]}/10</Badge>
              </div>
              <Slider value={editForm.rpe} onValueChange={v => setEditForm(f => ({ ...f, rpe: v }))} min={1} max={10} step={1} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('logSession.notes')}</Label>
              <Textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSession(null)}>{t('common.cancel')}</Button>
            <Button className="gradient-hyrox" onClick={handleUpdate} disabled={saving}>
              {saving ? t('common.saving') : t('history.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {shareData && (
        <ShareWorkoutDialog
          open={!!shareData}
          onOpenChange={(open) => !open && setShareData(null)}
          session={shareData}
        />
      )}
    </div>
  );
}
