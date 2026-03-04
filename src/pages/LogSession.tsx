import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Check, AlertTriangle, Link2, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/auditLog';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useScheduleData } from '@/hooks/useScheduleData';
import { getDiscipline, dayLabelsFull } from '@/components/schedule/config';
import type { Database } from '@/integrations/supabase/types';
import ShareWorkoutDialog from '@/components/share/ShareWorkoutDialog';
import type { ShareSessionData } from '@/components/share/types';
import { useTranslation } from 'react-i18next';

type Discipline = Database['public']['Enums']['discipline'];

const disciplineOptions: { value: Discipline; label: string }[] = [
  { value: 'run', label: 'Run' },
  { value: 'bike', label: 'Bike' },
  { value: 'rowing', label: 'Row' },
  { value: 'skierg', label: 'SkiErg' },
  { value: 'stairs', label: 'Stairs' },
  { value: 'hyrox_station', label: 'HYROX Station' },
  { value: 'strength', label: 'Strength' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'prehab', label: 'Prehab' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'custom', label: 'Custom' },
];

export default function LogSession() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { sessions, completedSessions, isLoading: scheduleLoading } = useScheduleData();

  const [plannedSessionId, setPlannedSessionId] = useState<string>('none');
  const [discipline, setDiscipline] = useState<Discipline>('run');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [avgHr, setAvgHr] = useState('');
  const [avgPace, setAvgPace] = useState('');
  const [rpe, setRpe] = useState([6]);
  const [painFlag, setPainFlag] = useState(false);
  const [painNotes, setPainNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [shareData, setShareData] = useState<ShareSessionData | null>(null);

  // Build set of already-completed planned session IDs
  const completedPlanIds = new Set(
    completedSessions.filter(c => c.planned_session_id).map(c => c.planned_session_id)
  );

  // Available (not yet completed) planned sessions
  const availablePlanned = sessions.filter(s => !completedPlanIds.has(s.id));

  // When a planned session is selected, auto-fill fields
  useEffect(() => {
    if (plannedSessionId === 'none') return;
    const ps = sessions.find(s => s.id === plannedSessionId);
    if (!ps) return;
    setDiscipline(ps.discipline as Discipline);
    if (ps.duration_min) setDuration(String(ps.duration_min));
    if (ps.distance_km) setDistance(String(ps.distance_km));
  }, [plannedSessionId, sessions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error('Not logged in'); return; }
    setSaving(true);

    const { error } = await supabase.from('completed_sessions').insert({
      athlete_id: user.id,
      planned_session_id: plannedSessionId !== 'none' ? plannedSessionId : null,
      discipline,
      actual_duration_min: duration ? parseFloat(duration) : null,
      actual_distance_km: distance ? parseFloat(distance) : null,
      avg_hr: avgHr ? parseInt(avgHr) : null,
      avg_pace: avgPace || null,
      rpe: rpe[0],
      pain_flag: painFlag,
      pain_notes: painFlag ? painNotes : null,
      notes: notes || null,
    });

    setSaving(false);
    if (error) {
      toast.error('Failed to log session: ' + error.message);
    } else {
      logAudit('session.completed', 'completed_session', undefined, {
        discipline,
        duration: duration ? parseFloat(duration) : null,
        distance: distance ? parseFloat(distance) : null,
        linked: plannedSessionId !== 'none',
      });
      toast.success(t('logSession.sessionLogged'));
      setShareData({
        discipline,
        date: new Date().toISOString().split('T')[0],
        durationMin: duration ? parseFloat(duration) : null,
        distanceKm: distance ? parseFloat(distance) : null,
        avgHr: avgHr ? parseInt(avgHr) : null,
        avgPace: avgPace || null,
        rpe: rpe[0],
      });
      setPlannedSessionId('none');
      setDuration('');
      setDistance('');
      setAvgHr('');
      setAvgPace('');
      setRpe([6]);
      setPainFlag(false);
      setPainNotes('');
      setNotes('');
    }
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <h1 className="text-xl font-display font-bold">{t('logSession.title')}</h1>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {/* Link to planned session */}
        {availablePlanned.length > 0 && (
          <Card className="glass border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                {t('logSession.linkPlanned')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={plannedSessionId} onValueChange={setPlannedSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('logSession.selectPlanned')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('logSession.noLink')}</SelectItem>
                  {availablePlanned.map(ps => {
                    const disc = getDiscipline(ps.discipline);
                    const dayLabel = dayLabelsFull[ps.day_of_week - 1] || '';
                    return (
                      <SelectItem key={ps.id} value={ps.id}>
                        <span className="flex items-center gap-2">
                          W{ps.week_number} {dayLabel} · {ps.session_name}
                          <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">{disc.label}</Badge>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {plannedSessionId !== 'none' && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  {t('logSession.preFilled')}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Activity details */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">{t('logSession.activity')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('logSession.discipline')}</Label>
              <Select value={discipline} onValueChange={(v) => setDiscipline(v as Discipline)}>
                <SelectTrigger><SelectValue placeholder={t('logSession.discipline')} /></SelectTrigger>
                <SelectContent>
                  {disciplineOptions.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('logSession.durationMin')}</Label>
                <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="45" />
              </div>
              <div className="space-y-2">
                <Label>{t('logSession.distanceKm')}</Label>
                <Input type="number" step="0.1" value={distance} onChange={e => setDistance(e.target.value)} placeholder="8.0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('logSession.avgHrBpm')}</Label>
                <Input type="number" value={avgHr} onChange={e => setAvgHr(e.target.value)} placeholder="155" />
              </div>
              <div className="space-y-2">
                <Label>{t('logSession.avgPace')}</Label>
                <Input value={avgPace} onChange={e => setAvgPace(e.target.value)} placeholder="5:15" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Effort & Feedback */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">{t('logSession.effortFeedback')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('logSession.rpe')}</Label>
                <Badge variant="secondary" className="font-mono">{rpe[0]}/10</Badge>
              </div>
              <Slider value={rpe} onValueChange={setRpe} min={1} max={10} step={1} className="py-2" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <Label htmlFor="pain-flag" className="text-sm">{t('logSession.painFlag')}</Label>
              </div>
              <Switch id="pain-flag" checked={painFlag} onCheckedChange={setPainFlag} />
            </div>

            {painFlag && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <Textarea
                  value={painNotes}
                  onChange={e => setPainNotes(e.target.value)}
                  placeholder={t('logSession.painDesc')}
                  rows={2}
                />
              </motion.div>
            )}

            <div className="space-y-2">
              <Label>{t('logSession.notes')}</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('logSession.notesPlaceholder')} rows={3} />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full gradient-hyrox" size="lg" disabled={saving}>
          <Check className="h-4 w-4 mr-2" /> {saving ? t('logSession.savingSession') : t('logSession.logSessionBtn')}
        </Button>
      </motion.form>

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
