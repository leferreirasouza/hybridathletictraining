import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Activity, Link2, PlusCircle, Unlink, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  STRAVA_SELECT, activityDate, fmtStrava, linkStravaActivity, unlinkStravaActivity, suggestPlannedMatch,
  type StravaActivityLite,
} from '@/lib/stravaLink';

export function useStravaRange(start: string | null, end: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['strava-range', user?.id, start, end],
    queryFn: async (): Promise<StravaActivityLite[]> => {
      if (!user || !start || !end) return [];
      const { data, error } = await supabase
        .from('strava_activities' as any)
        .select(STRAVA_SELECT)
        .eq('user_id', user.id)
        .eq('ignored', false)
        .gte('start_date_local', `${start}T00:00:00`)
        .lte('start_date_local', `${end}T23:59:59`)
        .order('start_date_local', { ascending: true });
      return error ? [] : ((data as unknown as StravaActivityLite[]) || []);
    },
    enabled: !!user && !!start && !!end,
  });
}

export function useRefreshTraining() {
  const qc = useQueryClient();
  return () => {
    ['strava-range', 'strava-inbox', 'completed-sessions', 'session-history', 'completed-sessions-week', 'training-load']
      .forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  };
}

interface PlannedLite { id: string; session_name: string; discipline: string; date?: string | null; duration_min?: number | null }

/** Strava workouts for one day: linked (with Unlink), suggested match (Link / Not this), or unplanned (Log / Link). */
export function StravaDayItems({
  activities, openSessions, linkedNames,
}: { activities: StravaActivityLite[]; openSessions: PlannedLite[]; linkedNames: Record<string, string> }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const refresh = useRefreshTraining();
  const [busy, setBusy] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [picker, setPicker] = useState<StravaActivityLite | null>(null);

  if (!activities.length || !user) return null;

  const run = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try { await fn(); toast.success(ok); refresh(); }
    catch { toast.error(t('strava.actionFailed')); }
    finally { setBusy(null); setPicker(null); }
  };

  return (
    <>
      {activities.map(a => {
        const linkedTo = a.completed_session_id ? linkedNames[a.completed_session_id] : undefined;
        const suggestion = !a.completed_session_id && !dismissed.has(a.id) ? suggestPlannedMatch(a, openSessions) : null;
        return (
          <div key={a.id} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs space-y-1.5">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium truncate flex-1">{a.name || a.sport_type}</span>
              <span className="text-muted-foreground shrink-0">{fmtStrava(a)}</span>
            </div>
            {a.completed_session_id ? (
              <div className="flex items-center justify-between">
                <span className="text-success flex items-center gap-1">
                  <Check className="h-3 w-3" /> {linkedTo ? t('stravaCal.linkedTo', { name: linkedTo }) : t('stravaCal.logged')}
                </span>
                <Button size="sm" variant="ghost" className="h-6 text-[11px]" disabled={busy === a.id}
                  onClick={() => run(a.id, () => unlinkStravaActivity(user.id, a), t('stravaCal.unlinked'))}>
                  <Unlink className="h-3 w-3 mr-1" /> {t('stravaCal.unlink')}
                </Button>
              </div>
            ) : suggestion ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-primary flex items-center gap-1 min-w-0">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span className="truncate">{t('stravaCal.suggest', { name: suggestion.session_name })}</span>
                </span>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" className="h-6 text-[11px]" disabled={busy === a.id}
                    onClick={() => run(a.id, () => linkStravaActivity(user.id, a, suggestion.id), t('strava.linked'))}>
                    {t('strava.link')}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[11px]"
                    onClick={() => setDismissed(s => new Set(s).add(a.id))}>
                    {t('stravaCal.notThis')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('stravaCal.unplanned')}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-6 text-[11px]" disabled={busy === a.id} onClick={() => setPicker(a)}>
                    <Link2 className="h-3 w-3 mr-1" /> {t('strava.link')}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[11px]" disabled={busy === a.id}
                    onClick={() => run(a.id, () => linkStravaActivity(user.id, a, null), t('strava.logged'))}>
                    <PlusCircle className="h-3 w-3 mr-1" /> {t('strava.logUnplanned')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <Dialog open={!!picker} onOpenChange={o => !o && setPicker(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{t('strava.linkTitle')}</DialogTitle>
            <DialogDescription className="text-xs">{t('strava.linkDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {!openSessions.length ? (
              <p className="text-xs text-muted-foreground">{t('strava.noPlannedSessions')}</p>
            ) : openSessions.map(p => (
              <button key={p.id} type="button" disabled={!!busy}
                className="w-full text-left p-2.5 rounded-lg border border-border/60 hover:border-primary/40"
                onClick={() => picker && run(picker.id, () => linkStravaActivity(user.id, picker, p.id), t('strava.linked'))}>
                <p className="text-sm font-medium">{p.session_name}</p>
                <p className="text-[11px] text-muted-foreground">{p.date} · {p.discipline}{p.duration_min ? ` · ${p.duration_min}′` : ''}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "Link activity" for a planned session: pick from this week's unlinked Strava workouts. */
export function LinkStravaActivityButton({ session }: { session: PlannedLite }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const refresh = useRefreshTraining();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const d = session.date ? new Date(`${session.date}T00:00:00`) : null;
  const start = d ? new Date(d.getTime() - 3 * 86400000).toISOString().slice(0, 10) : null;
  const end = d ? new Date(d.getTime() + 3 * 86400000).toISOString().slice(0, 10) : null;
  const { data } = useStravaRange(open ? start : null, open ? end : null);
  const options = (data || []).filter(a => !a.completed_session_id);
  if (!user || !session.date) return null;

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Link2 className="h-4 w-4 mr-2" /> {t('stravaCal.linkActivity')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{t('stravaCal.linkActivity')}</DialogTitle>
            <DialogDescription className="text-xs">{t('stravaCal.linkActivityDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {!options.length ? (
              <p className="text-xs text-muted-foreground">{t('stravaCal.noActivities')}</p>
            ) : options.map(a => (
              <button key={a.id} type="button" disabled={busy}
                className="w-full text-left p-2.5 rounded-lg border border-border/60 hover:border-primary/40"
                onClick={async () => {
                  setBusy(true);
                  try { await linkStravaActivity(user.id, a, session.id); toast.success(t('strava.linked')); refresh(); setOpen(false); }
                  catch { toast.error(t('strava.actionFailed')); }
                  finally { setBusy(false); }
                }}>
                <p className="text-sm font-medium">{a.name || a.sport_type}</p>
                <p className="text-[11px] text-muted-foreground">{activityDate(a)} · {fmtStrava(a)}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
