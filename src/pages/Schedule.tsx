import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const intensityColor: Record<string, string> = {
  easy: 'bg-success/10 text-success',
  moderate: 'bg-blue-500/10 text-blue-500',
  hard: 'bg-warning/10 text-warning',
  race_pace: 'bg-primary/10 text-primary',
  max_effort: 'bg-destructive/10 text-destructive',
};

const formatIntensity = (val: string) =>
  val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function Schedule() {
  const { user, currentOrg } = useAuth();
  const navigate = useNavigate();
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [weekOffset, setWeekOffset] = useState(0);

  // 1. Fetch plans in user's org
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['org-plans', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('training_plans')
        .select('id, name, created_at')
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });
      return error ? [] : data || [];
    },
    enabled: !!currentOrg,
  });

  // Auto-select first plan
  const activePlanId = selectedPlanId || plans?.[0]?.id || '';

  // 2. Fetch latest version of selected plan
  const { data: version } = useQuery({
    queryKey: ['plan-version', activePlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_versions')
        .select('id, version_number')
        .eq('plan_id', activePlanId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();
      return error ? null : data;
    },
    enabled: !!activePlanId,
  });

  // 3. Fetch sessions for that version
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['planned-sessions', version?.id],
    queryFn: async () => {
      if (!version) return [];
      const { data, error } = await supabase
        .from('planned_sessions')
        .select('*')
        .eq('plan_version_id', version.id)
        .order('order_index', { ascending: true });
      return error ? [] : data || [];
    },
    enabled: !!version?.id,
  });

  // Derive max weeks
  const maxWeek = useMemo(() => {
    if (!sessions?.length) return 1;
    return Math.max(...sessions.map(s => s.week_number));
  }, [sessions]);

  const displayWeek = Math.max(1, Math.min(maxWeek, 1 + weekOffset));

  // Sessions for the displayed week
  const weekSessions = useMemo(() => {
    return (sessions || []).filter(s => s.week_number === displayWeek);
  }, [sessions, displayWeek]);

  const isLoading = plansLoading || sessionsLoading;
  const noPlan = !plansLoading && (!plans || plans.length === 0);

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-bold">Schedule</h1>
        {plans && plans.length > 1 && (
          <Select value={activePlanId} onValueChange={setSelectedPlanId}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Select plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {noPlan ? (
        <Card className="glass">
          <CardContent className="p-8 text-center space-y-3">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-display font-bold">No Training Plan Yet</p>
            <p className="text-sm text-muted-foreground">
              Create or import a plan to see your schedule here.
            </p>
            <Button className="gradient-hyrox" onClick={() => navigate('/plans')}>
              Go to Plan Builder
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {plans && plans.length === 1 && (
            <p className="text-sm text-muted-foreground">{plans[0].name}</p>
          )}

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => Math.max(0, w - 1))} disabled={displayWeek <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              Week {displayWeek} of {maxWeek}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w + 1)} disabled={displayWeek >= maxWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="week">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="list">List</TabsTrigger>
              </TabsList>

              <TabsContent value="week" className="mt-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3"
                >
                  {dayLabels.map((day, i) => {
                    const daySessions = weekSessions.filter(s => s.day_of_week === i + 1);
                    if (daySessions.length === 0) {
                      return (
                        <Card key={i} className="glass opacity-50">
                          <CardContent className="p-4 flex items-center justify-between">
                            <span className="text-sm font-medium w-10">{day}</span>
                            <span className="text-sm text-muted-foreground">Rest Day</span>
                            <div className="w-16" />
                          </CardContent>
                        </Card>
                      );
                    }
                    return daySessions.map(session => (
                      <Card key={session.id} className="glass">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col items-center min-w-[32px]">
                                <span className="text-xs text-muted-foreground">{day}</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium">{session.session_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {session.discipline.replace(/_/g, ' ')}
                                  {session.duration_min ? ` · ${session.duration_min}min` : ''}
                                  {session.distance_km ? ` · ${session.distance_km}km` : ''}
                                </p>
                              </div>
                            </div>
                            {session.intensity && (
                              <Badge variant="secondary" className={intensityColor[session.intensity] || ''}>
                                {formatIntensity(session.intensity)}
                              </Badge>
                            )}
                          </div>
                          {session.workout_details && (
                            <p className="text-xs text-muted-foreground mt-2 pl-11 whitespace-pre-wrap">
                              {session.workout_details}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ));
                  })}
                </motion.div>
              </TabsContent>

              <TabsContent value="list" className="mt-4 space-y-3">
                {weekSessions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No sessions this week.</p>
                ) : (
                  weekSessions.map(session => (
                    <Card key={session.id} className="glass">
                      <CardContent className="p-4 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{session.session_name}</p>
                          {session.intensity && (
                            <Badge variant="secondary" className={intensityColor[session.intensity] || ''}>
                              {formatIntensity(session.intensity)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {dayLabels[session.day_of_week - 1]} · {session.discipline.replace(/_/g, ' ')}
                          {session.duration_min ? ` · ${session.duration_min}min` : ''}
                          {session.distance_km ? ` · ${session.distance_km}km` : ''}
                        </p>
                        {session.workout_details && (
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                            {session.workout_details}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}
