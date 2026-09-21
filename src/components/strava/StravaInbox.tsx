import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Activity, Link2, EyeOff, PlusCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface StravaActivity {
  id: string;
  name: string | null;
  sport_type: string | null;
  discipline: string | null;
  start_date_local: string | null;
  start_date_utc: string | null;
  duration_sec: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
}

interface PlannedOption {
  id: string;
  session_name: string;
  discipline: string;
  date: string | null;
  duration_min: number | null;
}

const INBOX_DAYS = 60;

function fmtDuration(sec: number | null): string {
  if (!sec) return '—';
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

function fmtDistance(m: number | null): string {
  if (!m) return '—';
  return `${(m / 1000).toFixed(1)} km`;
}

function weekBounds(dateStr: string): { start: string; end: string } {
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  const start = new Date(d);
  start.setDate(d.getDate() - dow);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default function StravaInbox() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [picker, setPicker] = useState<StravaActivity | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const since = new Date(Date.now() - INBOX_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: activities, isLoading } = useQuery({
    queryKey: ['strava-inbox', user?.id],
    queryFn: async (): Promise<StravaActivity[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('strava_activities' as any)
        .select('id, name, sport_type, discipline, start_date_local, start_date_utc, duration_sec, distance_m, avg_hr, max_hr')
        .eq('user_id', user.id)
        .eq('ignored', false)
        .is('completed_session_id', null)
        .gte('start_date_utc', since)
        .order('start_date_utc', { ascending: false });
      return error ? [] : ((data as unknown as StravaActivity[]) || []);
    },
    enabled: !!user,
  });

  const { data: plannedOptions } = useQuery({
    queryKey: ['strava-inbox-planned', user?.id, picker?.id],
    queryFn: async (): Promise<PlannedOption[]> => {
      if (!user || !picker?.start_date_local) return [];
      const { start, end } = weekBounds(picker.start_date_local.slice(0, 10));
      const { data, error } = await supabase
        .from('planned_sessions')
        .select('id, session_name, discipline, date, duration_min')
        .eq('athlete_id', user.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true });
      return error ? [] : ((data as unknown as PlannedOption[]) || []);
    },
    enabled: !!user && !!picker,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['strava-inbox'] });
    qc.invalidateQueries({ queryKey: ['session-history'] });
    qc.invalidateQueries({ queryKey: ['completed-sessions'] });
  };

  const completionPayload = (a: StravaActivity, plannedSessionId: string | null) => ({
    athlete_id: user!.id,
    planned_session_id: plannedSessionId,
    date: (a.start_date_local ?? new Date().toISOString()).slice(0, 10),
    discipline: (a.discipline ?? 'custom') as any,
    source: 'strava',
    actual_duration_min: a.duration_sec ? Math.round(a.duration_sec / 60) : null,
    actual_distance_km: a.distance_m ? Number((a.distance_m / 1000).toFixed(2)) : null,
    avg_hr: a.avg_hr,
    max_hr: a.max_hr,
    notes: a.name,
    completed_at: a.start_date_utc ?? new Date().toISOString(),
  });

  const createCompletion = async (a: StravaActivity, plannedSessionId: string | null) => {
    setBusyId(a.id);
    const { data, error } = await supabase
      .from('completed_sessions')
      .insert(completionPayload(a, plannedSessionId))
      .select('id')
      .maybeSingle();

    if (error || !data?.id) {
      setBusyId(null);
      toast.error(t('strava.actionFailed'));
      return;
    }
    await supabase
      .from('strava_activities' as any)
      .update({ completed_session_id: data.id })
      .eq('id', a.id);
    setBusyId(null);
    setPicker(null);
    toast.success(plannedSessionId ? t('strava.linked') : t('strava.logged'));
    refresh();
  };

  const ignore = async (a: StravaActivity) => {
    setBusyId(a.id);
    const { error } = await supabase
      .from('strava_activities' as any)
      .update({ ignored: true })
      .eq('id', a.id);
    setBusyId(null);
    if (error) {
      toast.error(t('strava.actionFailed'));
      return;
    }
    toast.success(t('strava.ignored'));
    refresh();
  };

  if (!user) return null;

  return (
    <>
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> {t('strava.inboxTitle')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t('strava.inboxDesc')}</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : !activities?.length ? (
            <p className="text-xs text-muted-foreground py-2">{t('strava.inboxEmpty')}</p>
          ) : (
            <div className="space-y-2">
              {activities.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-2 border-t border-border/40 pt-2 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{a.name || a.sport_type}</p>
                      {a.discipline && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">{a.discipline}</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {a.start_date_local
                        ? new Date(a.start_date_local).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        : '—'}{' '}
                      · {fmtDuration(a.duration_sec)} · {fmtDistance(a.distance_m)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      disabled={busyId === a.id}
                      onClick={() => setPicker(a)}
                    >
                      <Link2 className="h-3 w-3 mr-1" /> {t('strava.link')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      disabled={busyId === a.id}
                      onClick={() => createCompletion(a, null)}
                    >
                      <PlusCircle className="h-3 w-3 mr-1" /> {t('strava.logUnplanned')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px]"
                      disabled={busyId === a.id}
                      onClick={() => ignore(a)}
                    >
                      <EyeOff className="h-3 w-3 mr-1" /> {t('strava.ignore')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!picker} onOpenChange={(open) => !open && setPicker(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{t('strava.linkTitle')}</DialogTitle>
            <DialogDescription className="text-xs">{t('strava.linkDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {!plannedOptions?.length ? (
              <p className="text-xs text-muted-foreground">{t('strava.noPlannedSessions')}</p>
            ) : (
              plannedOptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full text-left p-2.5 rounded-lg border border-border/60 hover:border-primary/40 transition-colors"
                  disabled={!!busyId}
                  onClick={() => picker && createCompletion(picker, p.id)}
                >
                  <p className="text-sm font-medium">{p.session_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.date} · {p.discipline}
                    {p.duration_min ? ` · ${p.duration_min}′` : ''}
                  </p>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
