import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldCheck, AlertTriangle, Activity, HeartPulse, Users } from 'lucide-react';
import { GUARDRAILS, analyzeWeeklyLoad, type LoadWarning } from '@/lib/trainingGuardrails';

interface AthleteGuardrailData {
  athleteId: string;
  athleteName: string;
  fitnessLevel: string;
  hasParqRisks: boolean;
  parqAcknowledged: boolean;
  currentInjuries: string | null;
  weeklyWarnings: LoadWarning[];
}

export default function GuardrailDashboard() {
  const { user, currentOrg } = useAuth();

  const { data: athletes = [], isLoading } = useQuery({
    queryKey: ['guardrail-dashboard', user?.id, currentOrg?.id],
    queryFn: async () => {
      if (!user || !currentOrg) return [];

      // Get assigned athletes
      const { data: assignments } = await supabase
        .from('coach_athlete_assignments')
        .select('athlete_id')
        .eq('coach_id', user.id)
        .eq('organization_id', currentOrg.id);

      if (!assignments?.length) return [];
      const athleteIds = assignments.map(a => a.athlete_id);

      // Fetch profiles, PAR-Q, fitness assessments, and sessions in parallel
      const [profilesRes, parqRes, assessmentsRes, sessionsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, fitness_level').in('id', athleteIds),
        supabase.from('parq_responses' as any).select('athlete_id, has_risk_flags, risk_acknowledged').in('athlete_id', athleteIds),
        supabase.from('fitness_assessments' as any).select('athlete_id, current_injuries').in('athlete_id', athleteIds),
        // Get active plan sessions for load analysis
        supabase.from('planned_sessions')
          .select('athlete_id, week_number, day_of_week, discipline, intensity, distance_km, duration_min, plan_version_id')
          .in('athlete_id', athleteIds),
      ]);

      const profiles = profilesRes.data || [];
      const parqMap = new Map((parqRes.data || []).map((p: any) => [p.athlete_id, p]));
      const assessMap = new Map((assessmentsRes.data || []).map((a: any) => [a.athlete_id, a]));

      // Group sessions by athlete
      const sessionsByAthlete = new Map<string, any[]>();
      for (const s of (sessionsRes.data || [])) {
        const id = s.athlete_id || 'unknown';
        if (!sessionsByAthlete.has(id)) sessionsByAthlete.set(id, []);
        sessionsByAthlete.get(id)!.push(s);
      }

      return profiles.map(profile => {
        const parq = parqMap.get(profile.id);
        const assessment = assessMap.get(profile.id);
        const sessions = sessionsByAthlete.get(profile.id) || [];
        const fitnessLevel = profile.fitness_level || 'intermediate';

        // Analyze current week's load
        const weeks = [...new Set(sessions.map(s => s.week_number))];
        const latestWeek = Math.max(...weeks, 1);
        const { warnings } = analyzeWeeklyLoad(sessions, latestWeek, fitnessLevel);

        return {
          athleteId: profile.id,
          athleteName: profile.full_name || 'Unknown',
          fitnessLevel,
          hasParqRisks: parq?.has_risk_flags || false,
          parqAcknowledged: parq?.risk_acknowledged || false,
          currentInjuries: assessment?.current_injuries || null,
          weeklyWarnings: warnings,
        } as AthleteGuardrailData;
      });
    },
    enabled: !!user && !!currentOrg,
  });

  const athletesWithWarnings = athletes.filter(a => a.weeklyWarnings.length > 0 || a.hasParqRisks || a.currentInjuries);
  const dangerCount = athletes.filter(a => a.weeklyWarnings.some(w => w.risk === 'danger')).length;
  const cautionCount = athletes.filter(a => a.weeklyWarnings.some(w => w.risk === 'caution') && !a.weeklyWarnings.some(w => w.risk === 'danger')).length;
  const healthFlagCount = athletes.filter(a => a.hasParqRisks || a.currentInjuries).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> AI Guardrail Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3 rounded-lg border bg-muted/30 text-center">
            <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold tabular-nums">{athletes.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Athletes</p>
          </div>
          <div className="p-3 rounded-lg border bg-destructive/5 text-center">
            <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-destructive" />
            <p className="text-2xl font-bold tabular-nums text-destructive">{dangerCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Danger</p>
          </div>
          <div className="p-3 rounded-lg border bg-amber-500/5 text-center">
            <Activity className="h-4 w-4 mx-auto mb-1 text-amber-600" />
            <p className="text-2xl font-bold tabular-nums text-amber-600">{cautionCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Caution</p>
          </div>
          <div className="p-3 rounded-lg border bg-primary/5 text-center">
            <HeartPulse className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold tabular-nums">{healthFlagCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Health Flags</p>
          </div>
        </div>

        <Tabs defaultValue="alerts">
          <TabsList className="w-full">
            <TabsTrigger value="alerts" className="flex-1 text-xs">Active Alerts ({athletesWithWarnings.length})</TabsTrigger>
            <TabsTrigger value="all" className="flex-1 text-xs">All Athletes ({athletes.length})</TabsTrigger>
            <TabsTrigger value="limits" className="flex-1 text-xs">Safety Limits</TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 rounded-lg gradient-hyrox animate-pulse" />
              </div>
            ) : athletesWithWarnings.length === 0 ? (
              <div className="text-center py-8">
                <ShieldCheck className="h-10 w-10 mx-auto text-emerald-500/40 mb-3" />
                <p className="text-sm text-muted-foreground">All athletes are within safe training limits</p>
              </div>
            ) : (
              <div className="space-y-3">
                {athletesWithWarnings.map(athlete => (
                  <div key={athlete.athleteId} className="p-3 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{athlete.athleteName}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{athlete.fitnessLevel}</p>
                      </div>
                      <div className="flex gap-1">
                        {athlete.hasParqRisks && (
                          <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
                            PAR-Q Risk
                          </Badge>
                        )}
                        {athlete.currentInjuries && (
                          <Badge variant="outline" className="text-[10px] border-destructive text-destructive">
                            Injury
                          </Badge>
                        )}
                      </div>
                    </div>
                    {athlete.currentInjuries && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Current injuries:</span> {athlete.currentInjuries}
                      </p>
                    )}
                    {athlete.weeklyWarnings.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {athlete.weeklyWarnings.map((w, i) => (
                          <Badge
                            key={i}
                            variant={w.risk === 'danger' ? 'destructive' : 'secondary'}
                            className="text-[10px]"
                          >
                            {w.label}: {w.current}{w.unit} / {w.limit}{w.unit}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Athlete</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Warnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {athletes.map(a => (
                  <TableRow key={a.athleteId}>
                    <TableCell className="text-sm font-medium">{a.athleteName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">{a.fitnessLevel}</Badge>
                    </TableCell>
                    <TableCell>
                      {a.hasParqRisks ? (
                        <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
                          {a.parqAcknowledged ? 'Risk (ack)' : 'Risk'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500">Clear</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {a.weeklyWarnings.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        <div className="flex gap-1">
                          {a.weeklyWarnings.filter(w => w.risk === 'danger').length > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                              {a.weeklyWarnings.filter(w => w.risk === 'danger').length} danger
                            </Badge>
                          )}
                          {a.weeklyWarnings.filter(w => w.risk === 'caution').length > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {a.weeklyWarnings.filter(w => w.risk === 'caution').length} caution
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="limits" className="mt-4">
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                These evidence-based limits are applied to all AI-generated and imported plans. They are enforced by experience level.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>Beginner</TableHead>
                    <TableHead>Intermediate</TableHead>
                    <TableHead>Advanced</TableHead>
                    <TableHead>Elite</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-sm font-medium">Max Weekly Running (km)</TableCell>
                    {['beginner', 'intermediate', 'advanced', 'elite'].map(l => (
                      <TableCell key={l} className="tabular-nums text-sm">{GUARDRAILS.MAX_WEEKLY_RUN_KM[l]}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm font-medium">Max Weekly Sessions</TableCell>
                    {['beginner', 'intermediate', 'advanced', 'elite'].map(l => (
                      <TableCell key={l} className="tabular-nums text-sm">{GUARDRAILS.MAX_WEEKLY_SESSIONS[l]}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm font-medium">Max Weekly Duration (min)</TableCell>
                    {['beginner', 'intermediate', 'advanced', 'elite'].map(l => (
                      <TableCell key={l} className="tabular-nums text-sm">{GUARDRAILS.MAX_WEEKLY_DURATION_MIN[l]}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm font-medium">Max High-Intensity/week</TableCell>
                    {['beginner', 'intermediate', 'advanced', 'elite'].map(l => (
                      <TableCell key={l} className="tabular-nums text-sm">{GUARDRAILS.MAX_HIGH_INTENSITY_PER_WEEK[l]}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm font-medium">Max Mileage Increase</TableCell>
                    <TableCell colSpan={4} className="tabular-nums text-sm">{GUARDRAILS.MAX_WEEKLY_MILEAGE_INCREASE_PCT}% week-over-week</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm font-medium">Max Consecutive Days</TableCell>
                    <TableCell colSpan={4} className="tabular-nums text-sm">{GUARDRAILS.MAX_CONSECUTIVE_DAYS} days</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm font-medium">Min Strength/week</TableCell>
                    <TableCell colSpan={4} className="tabular-nums text-sm">{GUARDRAILS.MIN_STRENGTH_PER_WEEK} session</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm font-medium">Intensity Distribution</TableCell>
                    <TableCell colSpan={4} className="text-sm">{GUARDRAILS.TARGET_EASY_PCT}% easy / {GUARDRAILS.TARGET_HARD_PCT}% hard</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
