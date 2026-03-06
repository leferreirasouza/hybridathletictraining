import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, Dumbbell, Clock, Target, TrendingUp, ChevronRight, CheckCircle2, Users, EyeOff, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useScheduleData } from '@/hooks/useScheduleData';
import { getDiscipline } from '@/components/schedule/config';
import GoalRaceCard from '@/components/dashboard/GoalRaceCard';
import ProfileCompletionCard from '@/components/dashboard/ProfileCompletionCard';
import CoachInfoCard from '@/components/dashboard/CoachInfoCard';
import FirstPlanCTA from '@/components/dashboard/FirstPlanCTA';
import { useTranslation } from 'react-i18next';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user, currentRole, effectiveRole } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || t('roles.athlete');
  const isCoachOrAdmin = effectiveRole && ['master_admin', 'admin', 'coach'].includes(effectiveRole);
  const [showAthletePlans, setShowAthletePlans] = useState(true);

  const { sessions: plannedSessions, completedSessions: completedPlanned, targets, maxWeek, noPlan } = useScheduleData();

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayDow = today.getDay() === 0 ? 7 : today.getDay();

  const completedPlanIds = new Set(completedPlanned.filter(c => c.planned_session_id).map(c => c.planned_session_id));

  const todaySessions = plannedSessions.filter(s => {
    if (s.date === todayStr) return true;
    if (!s.date && s.day_of_week === todayDow) return true;
    return false;
  });

  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
  const weekStart = startOfWeek.toISOString().split('T')[0];

  const { data: completedSessions } = useQuery({
    queryKey: ['completed-sessions-week', user?.id, weekStart],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('completed_sessions')
        .select('*')
        .eq('athlete_id', user.id)
        .gte('date', weekStart)
        .order('date', { ascending: true });
      return error ? [] : data || [];
    },
    enabled: !!user,
  });

  const totalKm = completedSessions?.reduce((sum, s) => sum + (Number(s.actual_distance_km) || 0), 0) || 0;
  const avgRpe = completedSessions?.length
    ? (completedSessions.reduce((sum, s) => sum + (s.rpe || 0), 0) / completedSessions.length).toFixed(1)
    : '—';
  const sessionCount = completedSessions?.length || 0;

  const planStats = useMemo(() => {
    const totalPlanned = plannedSessions.length;
    const totalCompleted = completedPlanned.filter(c => c.planned_session_id).length;
    const completionPct = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;
    const currentWeekSessions = plannedSessions.filter(s => {
      if (s.date === todayStr) return true;
      if (!s.date && s.day_of_week <= todayDow) return true;
      return false;
    });
    const currentWeekCompleted = currentWeekSessions.filter(s => completedPlanIds.has(s.id)).length;
    const weekPct = currentWeekSessions.length > 0 ? Math.round((currentWeekCompleted / currentWeekSessions.length) * 100) : 0;
    return { totalPlanned, totalCompleted, completionPct, currentWeekCompleted, currentWeekTotal: currentWeekSessions.length, weekPct };
  }, [plannedSessions, completedPlanned, completedPlanIds, todayStr, todayDow]);

  const locale = i18n.language === 'pt-BR' ? 'pt-BR' : 'en-US';

  return (
    <div className="page-container py-6">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
        {/* Greeting */}
        <motion.div variants={item}>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="text-2xl font-display font-bold mt-1">
            {t('dashboard.hey', { name: firstName })}
          </h1>
          {isCoachOrAdmin && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate('/athletes')}
              >
                <Users className="h-3.5 w-3.5" />
                Coach Dashboard
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={showAthletePlans ? 'ghost' : 'secondary'}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setShowAthletePlans(prev => !prev)}
              >
                {showAthletePlans ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showAthletePlans ? 'Hide My Plans' : 'Show My Plans'}
              </Button>
            </div>
          )}
        </motion.div>

        {/* Desktop: two-column layout for top cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div variants={item}>
            <ProfileCompletionCard />
          </motion.div>
          <motion.div variants={item}>
            <GoalRaceCard />
          </motion.div>
        </div>

        {/* Plan Completion */}
        {showAthletePlans && !noPlan && planStats.totalPlanned > 0 && (
          <motion.div variants={item}>
            <Card className="glass">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    {t('dashboard.planCompletion')}
                  </p>
                  <span className="text-xs font-mono font-bold text-primary">{planStats.completionPct}%</span>
                </div>
                <Progress value={planStats.completionPct} className="h-2" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{t('dashboard.sessionsDone', { done: planStats.totalCompleted, total: planStats.totalPlanned })}</span>
                  <span>{t('dashboard.thisWeekProgress', { done: planStats.currentWeekCompleted, total: planStats.currentWeekTotal })}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {showAthletePlans && noPlan && (
          <motion.div variants={item}>
            <FirstPlanCTA />
          </motion.div>
        )}

        {/* Desktop: Today's Training + Week Overview / Stats side-by-side */}
        {showAthletePlans && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Today's Sessions — takes 2 cols on large screens */}
          <motion.div variants={item} className="lg:col-span-2">
            <Card className="glass overflow-hidden border-primary/20 h-full">
              <div className="h-1 gradient-hyrox" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-display">{t('dashboard.todaysTraining')}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {noPlan
                        ? t('dashboard.noPlanYet')
                        : todaySessions.length > 0
                          ? t('dashboard.sessionsPlanned', { count: todaySessions.length })
                          : t('dashboard.restDay')}
                    </p>
                  </div>
                  {todaySessions.length > 0 && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                      {t('dashboard.active')}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {todaySessions.length > 0 ? (
                  <>
                    {todaySessions.map(session => {
                      const disc = getDiscipline(session.discipline);
                      const DiscIcon = disc.icon;
                      const isDone = completedPlanIds.has(session.id);
                      return (
                        <div key={session.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${isDone ? 'bg-success/5 border-success/20' : 'bg-muted/30 border-border/50'}`}>
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${disc.color}`}>
                            <DiscIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{session.session_name}</p>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span>{disc.label}</span>
                              {session.duration_min && <span>· {session.duration_min} {t('common.min')}</span>}
                              {session.intensity && <span>· {session.intensity.replace('_', ' ')}</span>}
                            </div>
                          </div>
                          {isDone ? (
                            <Badge variant="secondary" className="text-[10px] bg-success/10 text-success border-0 shrink-0">{t('dashboard.done')}</Badge>
                          ) : (
                            <Button size="sm" variant="ghost" className="shrink-0 text-xs" onClick={() => navigate('/log')}>
                              {t('nav.log')}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex gap-2">
                      <Button className="flex-1 gradient-hyrox" onClick={() => navigate('/schedule')}>
                        <Calendar className="h-4 w-4 mr-2" /> {t('dashboard.viewSchedule')}
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => navigate('/log')}>
                        <Dumbbell className="h-4 w-4 mr-2" /> {t('dashboard.logSession')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2">
                    {noPlan ? (
                      <Button className="flex-1 gradient-hyrox" onClick={() => navigate('/plans')}>
                        {t('dashboard.generatePlan')}
                      </Button>
                    ) : (
                      <>
                        <Button className="flex-1 gradient-hyrox" onClick={() => navigate('/schedule')}>
                          <Calendar className="h-4 w-4 mr-2" /> {t('dashboard.viewSchedule')}
                        </Button>
                        <Button variant="outline" className="flex-1" onClick={() => navigate('/log')}>
                          <Dumbbell className="h-4 w-4 mr-2" /> {t('dashboard.logSession')}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Right column: Week Overview + Quick Stats + Coach */}
          <div className="space-y-4">
            <motion.div variants={item}>
              <Card className="glass">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-display">{t('dashboard.thisWeek')}</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/schedule')}>
                      {t('dashboard.viewAll')} <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                      const isToday = i === ((new Date().getDay() + 6) % 7);
                      const dayDate = new Date(startOfWeek);
                      dayDate.setDate(dayDate.getDate() + i);
                      const dateStr = dayDate.toISOString().split('T')[0];
                      const hasCompleted = completedSessions?.some(s => s.date === dateStr);

                      return (
                        <div
                          key={i}
                          className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs transition-colors ${
                            isToday ? 'bg-primary/10 ring-1 ring-primary/30' : ''
                          }`}
                        >
                          <span className="text-muted-foreground">{day}</span>
                          <div className={`h-2.5 w-2.5 rounded-full ${
                            hasCompleted ? 'bg-success' : 'bg-muted-foreground/20'
                          }`} />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={item} className="grid grid-cols-3 gap-3">
              {[
                { label: t('dashboard.weekVolume'), value: `${totalKm.toFixed(1)} ${t('common.km')}`, icon: TrendingUp },
                { label: t('dashboard.sessions'), value: `${sessionCount}`, icon: Calendar },
                { label: t('dashboard.avgRpe'), value: avgRpe, icon: Target },
              ].map((stat) => (
                <Card key={stat.label} className="glass">
                  <CardContent className="p-3 text-center">
                    <stat.icon className="h-4 w-4 mx-auto text-primary mb-1" />
                    <p className="text-lg font-display font-bold">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </motion.div>

            <motion.div variants={item}>
              <CoachInfoCard />
            </motion.div>
          </div>
        </div>
        )}

        {/* Bottom CTAs — side by side on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div variants={item}>
            <Card className="glass border-accent/20 overflow-hidden cursor-pointer hover:border-accent/40 transition-colors h-full" onClick={() => navigate('/reports')}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-display font-bold">{t('dashboard.weeklyReport')}</p>
                  <p className="text-xs text-muted-foreground">{t('dashboard.weeklyReportDesc')}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="glass border-accent/20 overflow-hidden cursor-pointer hover:border-accent/40 transition-colors h-full" onClick={() => navigate('/ai')}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl gradient-hyrox flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">🤖</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-display font-bold">{t('dashboard.aiCoach')}</p>
                  <p className="text-xs text-muted-foreground">{t('dashboard.aiCoachDesc')}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
