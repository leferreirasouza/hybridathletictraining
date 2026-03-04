import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertTriangle, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { analyzeWeeklyLoad, type LoadWarning, type RiskLevel } from '@/lib/trainingGuardrails';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AthleteAlert {
  athleteId: string;
  name: string;
  fitnessLevel: string;
  warnings: LoadWarning[];
  worstRisk: RiskLevel;
  weekNumber: number;
}

export default function AthleteLoadAlertsPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['coach-load-alerts', user?.id],
    queryFn: async (): Promise<AthleteAlert[]> => {
      if (!user) return [];

      // 1. Get assigned athletes
      const { data: assignments } = await supabase
        .from('coach_athlete_assignments')
        .select('athlete_id, organization_id')
        .eq('coach_id', user.id);
      if (!assignments?.length) return [];

      const athleteIds = [...new Set(assignments.map(a => a.athlete_id))];
      const orgIds = [...new Set(assignments.map(a => a.organization_id))];

      // 2. Fetch profiles for fitness_level
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, fitness_level')
        .in('id', athleteIds);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // 3. Fetch all training plans in the orgs
      const { data: plans } = await supabase
        .from('training_plans')
        .select('id, organization_id')
        .in('organization_id', orgIds);
      if (!plans?.length) return [];

      // 4. Get latest plan versions
      const { data: versions } = await supabase
        .from('plan_versions')
        .select('id, plan_id')
        .in('plan_id', plans.map(p => p.id))
        .order('version_number', { ascending: false });
      if (!versions?.length) return [];

      // Keep only latest version per plan
      const latestVersions = new Map<string, string>();
      for (const v of versions) {
        if (!latestVersions.has(v.plan_id)) latestVersions.set(v.plan_id, v.id);
      }
      const versionIds = [...latestVersions.values()];

      // 5. Fetch all planned sessions for these versions assigned to our athletes
      const { data: sessions } = await supabase
        .from('planned_sessions')
        .select('week_number, day_of_week, discipline, intensity, distance_km, duration_min, athlete_id')
        .in('plan_version_id', versionIds)
        .in('athlete_id', athleteIds);

      // Also fetch unassigned sessions (athlete_id is null) — they apply to all athletes in the org
      const { data: sharedSessions } = await supabase
        .from('planned_sessions')
        .select('week_number, day_of_week, discipline, intensity, distance_km, duration_min, plan_version_id')
        .in('plan_version_id', versionIds)
        .is('athlete_id', null);

      // Build a map: version_id -> org_id
      const versionToOrg = new Map<string, string>();
      for (const [planId, verId] of latestVersions) {
        const plan = plans.find(p => p.id === planId);
        if (plan) versionToOrg.set(verId, plan.organization_id);
      }

      // Determine current week (use week 1 as fallback — real logic depends on plan start dates)
      // For now, find the max week_number that has sessions as a reasonable heuristic
      const allSessions = [...(sessions || []), ...(sharedSessions || [])];
      const allWeeks = [...new Set(allSessions.map(s => s.week_number))].sort((a, b) => a - b);
      const currentWeek = allWeeks.length > 0 ? allWeeks[Math.floor(allWeeks.length / 2)] || 1 : 1;

      // 6. Analyze per athlete
      const results: AthleteAlert[] = [];
      for (const athleteId of athleteIds) {
        const profile = profileMap.get(athleteId);
        const fitnessLevel = profile?.fitness_level || 'intermediate';

        // Combine athlete-specific + shared sessions for this athlete's orgs
        const athleteOrgs = assignments.filter(a => a.athlete_id === athleteId).map(a => a.organization_id);
        const athleteSessions = [
          ...(sessions || []).filter(s => s.athlete_id === athleteId),
          ...(sharedSessions || []).filter(s => {
            const orgId = versionToOrg.get(s.plan_version_id);
            return orgId && athleteOrgs.includes(orgId);
          }),
        ].map(s => ({
          week_number: s.week_number,
          day_of_week: s.day_of_week,
          discipline: s.discipline,
          intensity: s.intensity,
          distance_km: s.distance_km ? Number(s.distance_km) : null,
          duration_min: s.duration_min ? Number(s.duration_min) : null,
        }));

        if (athleteSessions.length === 0) continue;

        // Analyze each week that has sessions, find worst
        const weeksForAthlete = [...new Set(athleteSessions.map(s => s.week_number))];
        let worstWarnings: LoadWarning[] = [];
        let worstRisk: RiskLevel = 'safe';
        let worstWeek = currentWeek;

        for (const week of weeksForAthlete) {
          const { warnings } = analyzeWeeklyLoad(athleteSessions, week, fitnessLevel);
          if (warnings.length > 0) {
            const hasDanger = warnings.some(w => w.risk === 'danger');
            const thisRisk: RiskLevel = hasDanger ? 'danger' : 'caution';
            if (thisRisk === 'danger' && worstRisk !== 'danger') {
              worstWarnings = warnings;
              worstRisk = thisRisk;
              worstWeek = week;
            } else if (worstWarnings.length === 0) {
              worstWarnings = warnings;
              worstRisk = thisRisk;
              worstWeek = week;
            }
          }
        }

        if (worstWarnings.length > 0) {
          results.push({
            athleteId,
            name: profile?.full_name || 'Unknown',
            fitnessLevel,
            warnings: worstWarnings,
            worstRisk,
            weekNumber: worstWeek,
          });
        }
      }

      // Sort: danger first, then caution
      return results.sort((a, b) => (a.worstRisk === 'danger' ? 0 : 1) - (b.worstRisk === 'danger' ? 0 : 1));
    },
    enabled: !!user?.id,
    refetchInterval: 60_000,
  });

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (isLoading || !alerts?.length) return null;

  const hasDanger = alerts.some(a => a.worstRisk === 'danger');

  return (
    <Card className={`glass ${hasDanger ? 'border-destructive/30' : 'border-warning/30'}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display flex items-center gap-2">
            {hasDanger ? (
              <ShieldAlert className="h-4 w-4 text-destructive" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-warning" />
            )}
            {t('coachDashboard.loadAlerts')}
          </CardTitle>
          <Badge
            variant="secondary"
            className={`text-xs ${hasDanger ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}
          >
            {alerts.length} {hasDanger ? t('coachDashboard.loadAlertsDanger') : t('coachDashboard.loadAlertsCaution')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map(alert => {
          const isExpanded = expandedIds.has(alert.athleteId);
          const topWarning = alert.warnings[0];

          return (
            <Collapsible key={alert.athleteId} open={isExpanded} onOpenChange={() => toggleExpand(alert.athleteId)}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left border">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-secondary">
                        {alert.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{alert.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Wk {alert.weekNumber} · {topWarning.label} {topWarning.current}{topWarning.unit ? `/${topWarning.limit}${topWarning.unit}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${
                        alert.worstRisk === 'danger'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-warning/10 text-warning'
                      }`}
                    >
                      {alert.worstRisk === 'danger' ? '🔴' : '🟡'} {alert.warnings.length}
                    </Badge>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-2 pt-1 space-y-1">
                  {alert.warnings.map((w, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1">
                      <span className="text-muted-foreground">{w.label}</span>
                      <span className={w.risk === 'danger' ? 'text-destructive font-medium' : 'text-warning font-medium'}>
                        {w.current}{w.unit ? ` / ${w.limit}${w.unit}` : ` → max ${w.limit}`}
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
