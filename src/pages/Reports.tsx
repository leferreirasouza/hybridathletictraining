import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Activity, Target, Flame, AlertTriangle, ArrowLeftRight, Brain, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';

/* ─── Athlete report card ─── */
function AthleteWeekReport({ weekNumber, planVersionId, userId, userName }: {
  weekNumber: number;
  planVersionId: string;
  userId: string;
  userName?: string;
}) {
  const { t } = useTranslation();

  const { data: planned = [] } = useQuery({
    queryKey: ['report-planned', planVersionId, weekNumber],
    queryFn: async () => {
      const { data } = await supabase
        .from('planned_sessions')
        .select('id, discipline, duration_min, distance_km, session_name')
        .eq('plan_version_id', planVersionId)
        .eq('week_number', weekNumber);
      return data || [];
    },
    enabled: !!planVersionId,
  });

  const { data: completed = [] } = useQuery({
    queryKey: ['report-completed', userId, weekNumber, planVersionId],
    queryFn: async () => {
      const plannedIds = planned.map(p => p.id);
      if (!plannedIds.length) return [];
      const { data } = await supabase
        .from('completed_sessions')
        .select('id, planned_session_id, actual_duration_min, actual_distance_km, rpe, avg_hr, pain_flag, discipline')
        .eq('athlete_id', userId)
        .in('planned_session_id', plannedIds);
      return data || [];
    },
    enabled: planned.length > 0,
  });

  const { data: swaps = [] } = useQuery({
    queryKey: ['report-swaps', userId, weekNumber, planVersionId],
    queryFn: async () => {
      const plannedIds = planned.map(p => p.id);
      if (!plannedIds.length) return [];
      const { data } = await supabase
        .from('session_substitutions')
        .select('id, status')
        .eq('athlete_id', userId)
        .in('original_session_id', plannedIds);
      return (data as any[]) || [];
    },
    enabled: planned.length > 0,
  });

  const stats = useMemo(() => {
    const completedIds = new Set(completed.map(c => c.planned_session_id));
    const missedDisciplines = planned.filter(p => !completedIds.has(p.id)).map(p => p.discipline);
    const totalDuration = completed.reduce((s, c) => s + (c.actual_duration_min || 0), 0);
    const totalDistance = completed.reduce((s, c) => s + (Number(c.actual_distance_km) || 0), 0);
    const rpes = completed.filter(c => c.rpe).map(c => c.rpe!);
    const hrs = completed.filter(c => c.avg_hr).map(c => c.avg_hr!);
    const painFlags = completed.filter(c => c.pain_flag).length;
    return {
      plannedCount: planned.length,
      completedCount: completed.length,
      completionPct: planned.length ? Math.round((completed.length / planned.length) * 100) : 0,
      totalDurationMin: Math.round(totalDuration),
      totalDistanceKm: Math.round(totalDistance * 10) / 10,
      avgRpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
      avgHr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
      painFlags,
      swapCount: swaps.length,
      missedDisciplines: [...new Set(missedDisciplines)],
    };
  }, [planned, completed, swaps]);

  const { data: aiCommentary, isLoading: aiLoading } = useQuery({
    queryKey: ['ai-weekly-report', userId, weekNumber, stats.completedCount],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('weekly-report', {
        body: { athleteName: userName, weekData: { weekNumber, ...stats } },
      });
      if (error) return 'Unable to generate AI commentary.';
      return data?.commentary || 'No commentary.';
    },
    enabled: stats.plannedCount > 0 && completed.length >= 0,
    staleTime: 5 * 60 * 1000,
  });

  const completionColor = stats.completionPct >= 80 ? 'text-green-500' : stats.completionPct >= 50 ? 'text-amber-500' : 'text-destructive';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Card className="glass">
          <CardContent className="p-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">{t('reports.completion')}</p>
              <p className={cn('text-lg font-bold font-display', completionColor)}>{stats.completionPct}%</p>
              <p className="text-[10px] text-muted-foreground">{stats.completedCount}/{stats.plannedCount} {t('dashboard.sessions').toLowerCase()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">{t('reports.volume')}</p>
              <p className="text-sm font-bold">{stats.totalDurationMin} {t('common.min')}</p>
              <p className="text-[10px] text-muted-foreground">{stats.totalDistanceKm} {t('common.km')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-3 flex items-center gap-2">
            <Flame className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">{t('reports.intensity')}</p>
              <p className="text-sm font-bold">RPE {stats.avgRpe ?? '—'}</p>
              <p className="text-[10px] text-muted-foreground">{stats.avgHr ? `${stats.avgHr} ${t('common.bpm')} avg` : t('reports.noHrData')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-3 flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">{t('reports.swaps')}</p>
              <p className="text-sm font-bold">{stats.swapCount}</p>
              {stats.painFlags > 0 && (
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  <p className="text-[10px] text-destructive font-medium">{stats.painFlags} {t('history.pain').toLowerCase()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {stats.missedDisciplines.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground">{t('reports.missed')}:</span>
          {stats.missedDisciplines.map(d => (
            <Badge key={d} variant="outline" className="text-[10px] capitalize">{d.replace('_', ' ')}</Badge>
          ))}
        </div>
      )}

      <Card className="glass border-primary/20">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-primary" />
            {t('reports.aiCoachCommentary')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {aiLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">{t('reports.generatingAnalysis')}</span>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
              <ReactMarkdown>{aiCommentary || ''}</ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Coach per-athlete row ─── */
function CoachAthleteRow({ athlete, weekNumber, planVersionId, onClick }: {
  athlete: { id: string; full_name: string };
  weekNumber: number;
  planVersionId: string;
  onClick: () => void;
}) {
  const { t } = useTranslation();

  const { data: planned = [] } = useQuery({
    queryKey: ['report-planned', planVersionId, weekNumber],
    queryFn: async () => {
      const { data } = await supabase
        .from('planned_sessions')
        .select('id, discipline')
        .eq('plan_version_id', planVersionId)
        .eq('week_number', weekNumber);
      return data || [];
    },
  });

  const { data: completed = [] } = useQuery({
    queryKey: ['report-completed-coach', athlete.id, weekNumber, planVersionId],
    queryFn: async () => {
      const ids = planned.map(p => p.id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from('completed_sessions')
        .select('id, planned_session_id, rpe, pain_flag')
        .eq('athlete_id', athlete.id)
        .in('planned_session_id', ids);
      return data || [];
    },
    enabled: planned.length > 0,
  });

  const { data: swaps = [] } = useQuery({
    queryKey: ['report-swaps-coach', athlete.id, weekNumber, planVersionId],
    queryFn: async () => {
      const ids = planned.map(p => p.id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from('session_substitutions')
        .select('id')
        .eq('athlete_id', athlete.id)
        .in('original_session_id', ids);
      return (data as any[]) || [];
    },
    enabled: planned.length > 0,
  });

  const pct = planned.length ? Math.round((completed.length / planned.length) * 100) : 0;
  const avgRpe = completed.filter(c => c.rpe).length
    ? Math.round(completed.filter(c => c.rpe).reduce((s, c) => s + c.rpe!, 0) / completed.filter(c => c.rpe).length * 10) / 10
    : null;
  const painCount = completed.filter(c => c.pain_flag).length;
  const isAlert = pct < 50 || painCount > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors",
        isAlert ? "bg-destructive/5 hover:bg-destructive/10 border border-destructive/20" : "hover:bg-muted/50"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">{athlete.full_name}</p>
          {isAlert && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className={cn('text-xs font-medium', pct >= 80 ? 'text-green-500' : pct >= 50 ? 'text-amber-500' : 'text-destructive')}>
            {pct}% done
          </span>
          <span className="text-[10px] text-muted-foreground">{completed.length}/{planned.length}</span>
          {avgRpe && <span className="text-[10px] text-muted-foreground">RPE {avgRpe}</span>}
          {painCount > 0 && <span className="text-[10px] text-destructive">{painCount} {t('history.pain').toLowerCase()}</span>}
          {swaps.length > 0 && <span className="text-[10px] text-muted-foreground">{swaps.length} {t('reports.swaps').toLowerCase()}</span>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

/* ─── Main Reports Page ─── */
export default function Reports() {
  const { t } = useTranslation();
  const { user, currentOrg, effectiveRole } = useAuth();
  const isCoach = effectiveRole === 'coach' || effectiveRole === 'admin' || effectiveRole === 'master_admin';
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);

  const { data: plans } = useQuery({
    queryKey: ['report-plans', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data } = await supabase
        .from('training_plans')
        .select('id, name')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!currentOrg,
  });

  const { data: version } = useQuery({
    queryKey: ['report-version', plans?.[0]?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('plan_versions')
        .select('id')
        .eq('plan_id', plans![0].id)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: !!plans?.length,
  });

  const { data: maxWeek = 1 } = useQuery({
    queryKey: ['report-max-week', version?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('planned_sessions')
        .select('week_number')
        .eq('plan_version_id', version!.id)
        .order('week_number', { ascending: false })
        .limit(1)
        .single();
      return data?.week_number || 1;
    },
    enabled: !!version?.id,
  });

  const { data: athletes = [] } = useQuery({
    queryKey: ['report-athletes', user?.id, currentOrg?.id],
    queryFn: async () => {
      if (!user || !currentOrg) return [];
      const { data: assignments } = await supabase
        .from('coach_athlete_assignments')
        .select('athlete_id')
        .eq('coach_id', user.id)
        .eq('organization_id', currentOrg.id);
      if (!assignments?.length) return [];
      const ids = assignments.map(a => a.athlete_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids);
      return profiles || [];
    },
    enabled: isCoach && !!user && !!currentOrg,
  });

  const { data: profile } = useQuery({
    queryKey: ['report-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single();
      return data;
    },
    enabled: !!user && !isCoach,
  });

  const displayWeek = Math.max(1, Math.min(maxWeek, 1 + weekOffset));
  const selectedAthlete = athletes.find(a => a.id === selectedAthleteId);

  if (isCoach && selectedAthleteId && selectedAthlete && version?.id) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedAthleteId(null)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-display font-bold">{selectedAthlete.full_name} — {t('schedule.weekOf', { current: displayWeek, max: maxWeek }).split(' ')[0]} {displayWeek}</h1>
        </div>
        <AthleteWeekReport weekNumber={displayWeek} planVersionId={version.id} userId={selectedAthleteId} userName={selectedAthlete.full_name} />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-display font-bold">{t('reports.title')}</h1>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => Math.max(0, w - 1))} disabled={displayWeek <= 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium font-display">
          {t('schedule.weekOf', { current: displayWeek, max: maxWeek })}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)} disabled={displayWeek >= maxWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {!version?.id ? (
        <Card className="glass">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">{t('reports.noPlanFound')}</p>
          </CardContent>
        </Card>
      ) : isCoach ? (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{athletes.length} athlete{athletes.length !== 1 ? 's' : ''}</p>
          {athletes.length === 0 ? (
            <Card className="glass">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">{t('reports.noAthletesAssigned')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {athletes.map(a => (
                <CoachAthleteRow key={a.id} athlete={a} weekNumber={displayWeek} planVersionId={version.id} onClick={() => setSelectedAthleteId(a.id)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <AthleteWeekReport weekNumber={displayWeek} planVersionId={version.id} userId={user!.id} userName={profile?.full_name} />
      )}
    </div>
  );
}
