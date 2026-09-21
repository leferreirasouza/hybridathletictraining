import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

function sportEmoji(sport?: string): string {
  if (!sport) return '🏋️';
  if (sport.includes('Run') || sport === 'TrailRun') return '🏃';
  if (sport.includes('Ride') || sport === 'VirtualRide' || sport === 'EBikeRide') return '🚴';
  if (sport.includes('Swim')) return '🏊';
  if (sport.includes('Walk') || sport.includes('Hike')) return '🥾';
  if (sport.includes('Row')) return '🚣';
  if (sport.includes('Workout') || sport.includes('Weight')) return '💪';
  return '🏋️';
}

function formatDistance(m: number): string {
  if (!m) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}

function formatDuration(s: number): string {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m} min`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

async function callEdge(path: string, init: RequestInit = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const projectId = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID;
  const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.error || `Request failed: ${resp.status}`);
  return json;
}

export default function StravaCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['strava-status', user?.id],
    queryFn: () => callEdge('strava-activities'),
    enabled: !!user,
  });

  const { data: syncInfo } = useQuery({
    queryKey: ['strava-sync-status', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: row } = await supabase
        .from('strava_connections' as any)
        .select('last_sync_at, last_sync_status, last_sync_count')
        .eq('user_id', user.id)
        .maybeSingle();
      return (row as any) ?? null;
    },
    enabled: !!user,
  });

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await callEdge('strava-connect', { method: 'GET' });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message || t('strava.connectFailed'));
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await callEdge('strava-sync', { method: 'POST', body: '{}' });
      toast.success(
        t('strava.syncResult', {
          synced: result.stored ?? 0,
          matched: (result.matched ?? 0) + (result.enriched ?? 0),
          unmatched: result.unmatched ?? 0,
        }),
      );
      qc.invalidateQueries({ queryKey: ['strava-sync-status'] });
      qc.invalidateQueries({ queryKey: ['strava-inbox'] });
      qc.invalidateQueries({ queryKey: ['session-history'] });
    } catch (e: any) {
      toast.error(e.message || t('strava.syncFailed'));
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    if (!confirm(t('strava.disconnectConfirm'))) return;
    setDisconnecting(true);
    const { error } = await supabase.from('strava_connections' as any).delete().eq('user_id', user.id);
    setDisconnecting(false);
    if (error) {
      toast.error(t('strava.disconnectFailed'));
      return;
    }
    toast.success(t('strava.disconnected'));
    qc.invalidateQueries({ queryKey: ['strava-status', user.id] });
  };

  const connected = data?.connected;
  const status = syncInfo?.last_sync_status as string | undefined;
  const statusLabel = !status
    ? null
    : status === 'ok'
      ? t('strava.statusOk')
      : status === 'rate_limited'
        ? t('strava.statusRateLimited')
        : t('strava.statusError');

  return (
    <Card className="glass">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Strava
        </CardTitle>
        {connected && (
          <Button variant="ghost" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
            {disconnecting ? '…' : t('strava.disconnect')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 bg-muted/40 rounded animate-pulse" />
            <div className="h-4 bg-muted/40 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-muted/40 rounded animate-pulse w-5/6" />
          </div>
        ) : !connected ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t('strava.connectDesc')}</p>
            <Button className="w-full gradient-hyrox" onClick={handleConnect} disabled={connecting}>
              {connecting ? t('strava.connecting') : t('strava.connect')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {data.athlete && (
              <div className="text-sm">
                <p className="font-medium">{data.athlete.name || t('strava.athlete')}</p>
                {data.athlete.username && (
                  <p className="text-xs text-muted-foreground">@{data.athlete.username}</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">
                  {t('strava.lastSync')}:{' '}
                  {syncInfo?.last_sync_at
                    ? new Date(syncInfo.last_sync_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : t('strava.never')}
                </p>
                {statusLabel && (
                  <Badge
                    variant="outline"
                    className={`mt-1 text-[9px] px-1 py-0 ${status === 'ok' ? 'border-success/30 text-success' : 'border-amber-500/30 text-amber-500'}`}
                  >
                    {statusLabel}
                    {typeof syncInfo?.last_sync_count === 'number' ? ` · ${syncInfo.last_sync_count}` : ''}
                  </Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? t('strava.syncing') : t('strava.syncNow')}
              </Button>
            </div>

            <div className="space-y-2">
              {(data.activities || []).slice(0, 3).map((a: any) => (
                <div key={a.id} className="flex items-center gap-2 text-xs py-1 border-t border-border/40 first:border-t-0 pt-2 first:pt-0">
                  <span className="text-base">{sportEmoji(a.sport_type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{a.name}</p>
                    <p className="text-muted-foreground">
                      {formatDate(a.start_date)} · {formatDistance(a.distance)} · {formatDuration(a.moving_time)}
                      {a.average_heartrate ? ` · ${Math.round(a.average_heartrate)} bpm` : ''}
                    </p>
                  </div>
                </div>
              ))}
              {(!data.activities || data.activities.length === 0) && (
                <p className="text-xs text-muted-foreground">{t('strava.noRecent')}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
