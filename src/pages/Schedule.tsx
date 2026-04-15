import { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Calendar, Loader2, CalendarPlus, Download, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useScheduleData } from '@/hooks/useScheduleData';
import { useAuth } from '@/contexts/AuthContext';
import WeeklyView from '@/components/schedule/WeeklyView';
import MonthlyView from '@/components/schedule/MonthlyView';
import DailyView from '@/components/schedule/DailyView';
import TargetsPanel from '@/components/schedule/TargetsPanel';
import TrainingLoadCard from '@/components/schedule/TrainingLoadCard';
import TrainingLoadBanner from '@/components/schedule/TrainingLoadBanner';
import { dayLabels } from '@/components/schedule/config';
import { exportWeekToCalendar, exportFullPlanToCalendar, CalendarProvider } from '@/lib/calendarExport';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';

function getDefaultCalendarProvider(): CalendarProvider | null {
  const v = localStorage.getItem('ha-default-calendar');
  return v === 'google' || v === 'outlook' || v === 'apple' ? v : null;
}

export default function Schedule() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentRole, effectiveRole, user, currentOrg } = useAuth();
  const isCoachOrAdmin = effectiveRole && ['master_admin', 'admin', 'coach'].includes(effectiveRole);
  const canManagePlans = !!currentRole && ['master_admin', 'admin', 'coach'].includes(currentRole);
  const {
    authReady,
    authLoading,
    plans, activePlanId, setSelectedPlanId, isAllPlans,
    sessions, weeklySummaries, targets, completedSessions,
    substitutionMap, maxWeek, isLoading, noPlan, planColorMap,
  } = useScheduleData();

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(1);
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [hiddenPlanIds, setHiddenPlanIds] = useState<Set<string>>(new Set());
  const [showAthletePlans, setShowAthletePlans] = useState(true);
  const defaultProvider = getDefaultCalendarProvider();
  const hasAutoScrolled = useRef(false);

  useEffect(() => {
    hasAutoScrolled.current = false;
  }, [user?.id, currentOrg?.id, activePlanId, isAllPlans]);

  useEffect(() => {
    if (!authReady || authLoading || isLoading || noPlan || hasAutoScrolled.current || !sessions.length) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (weeklySummaries.length > 0) {
      for (const ws of weeklySummaries) {
        if (ws.week_start && ws.week_end) {
          const start = new Date(ws.week_start);
          const end = new Date(ws.week_end);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);

          if (today >= start && today <= end) {
            setWeekOffset(ws.week_number - 1);
            setSelectedDay(today.getDay() === 0 ? 7 : today.getDay());
            hasAutoScrolled.current = true;
            return;
          }
        }
      }
    }

    const sessionsWithDate = sessions.filter((session: any) => session.date);
    if (sessionsWithDate.length > 0) {
      let bestWeek = 1;
      let bestDist = Infinity;

      for (const session of sessionsWithDate) {
        const sessionDate = new Date(session.date);
        sessionDate.setHours(0, 0, 0, 0);

        const distance = Math.abs(sessionDate.getTime() - today.getTime());
        if (distance < bestDist) {
          bestDist = distance;
          bestWeek = session.week_number;
        }
      }

      setWeekOffset(bestWeek - 1);
      setSelectedDay(today.getDay() === 0 ? 7 : today.getDay());
      hasAutoScrolled.current = true;
      return;
    }

    if (plans?.length) {
      const oldestPlanDate = plans.reduce((oldest, plan) => {
        const planDate = new Date(plan.created_at);
        return planDate < oldest ? planDate : oldest;
      }, new Date(plans[0].created_at));

      const weeksSinceCreation = Math.floor((today.getTime() - oldestPlanDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const estimatedWeek = Math.max(1, Math.min(maxWeek, weeksSinceCreation + 1));
      setWeekOffset(estimatedWeek - 1);
      setSelectedDay(today.getDay() === 0 ? 7 : today.getDay());
      hasAutoScrolled.current = true;
    }
  }, [authReady, authLoading, isLoading, noPlan, sessions, weeklySummaries, plans, maxWeek]);

  const togglePlanVisibility = (planId: string) => {
    setHiddenPlanIds(prev => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId); else next.add(planId);
      return next;
    });
  };

  const visibleSessions = useMemo(() => {
    if (!isAllPlans || hiddenPlanIds.size === 0) return sessions;
    return sessions.filter((s: any) => !hiddenPlanIds.has(s._planId));
  }, [sessions, isAllPlans, hiddenPlanIds]);

  const handleCalendarExport = (provider: CalendarProvider) => {
    exportWeekToCalendar(provider, sessions, displayWeek);
    const count = sessions.filter(s => s.week_number === displayWeek).length;
    toast.success(`${count} sessions → ${provider === 'apple' ? '.ics downloaded' : provider.charAt(0).toUpperCase() + provider.slice(1) + ' Calendar'}`);
  };

  const handleFullPlanExport = (provider: CalendarProvider) => {
    const planName = plans?.find(p => p.id === activePlanId)?.name;
    exportFullPlanToCalendar(provider, sessions, planName);
    const label = provider === 'apple' ? '.ics downloaded' : `${provider.charAt(0).toUpperCase() + provider.slice(1)} Calendar`;
    toast.success(t('schedule.fullPlanExported', { count: sessions.length }) + ` → ${label}`);
  };

  const displayWeek = Math.max(1, Math.min(maxWeek, 1 + weekOffset));
  const weeklySummary = weeklySummaries.find((ws: any) => ws.week_number === displayWeek);

  return (
    <div className="page-container py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-bold">{t('schedule.title')}</h1>
        <div className="flex items-center gap-2">
          {isCoachOrAdmin && (
            <Button
              variant={showAthletePlans ? 'ghost' : 'secondary'}
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setShowAthletePlans(prev => !prev)}
            >
              {showAthletePlans ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showAthletePlans ? 'Hide My Plans' : 'Show My Plans'}
            </Button>
          )}
          {targets.length > 0 && <TargetsPanel targets={targets} />}
          {plans && plans.length > 1 && (
            <Select value={isAllPlans ? 'all' : activePlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder={t('schedule.selectPlan')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-r from-primary to-blue-500" />
                    All Plans
                  </span>
                </SelectItem>
                {plans.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {!showAthletePlans && isCoachOrAdmin ? (
        <Card className="glass border-border">
          <CardContent className="p-8 text-center space-y-3">
            <EyeOff className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-display font-bold">Personal plans hidden</p>
            <p className="text-sm text-muted-foreground">Toggle "Show My Plans" to view your athlete schedule.</p>
          </CardContent>
        </Card>
      ) : noPlan ? (
        <Card className="glass border-primary/20 overflow-hidden">
          <div className="h-1 gradient-hyrox" />
          <CardContent className="p-8 text-center space-y-3">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-display font-bold">{t('schedule.noPlan')}</p>
            <p className="text-sm text-muted-foreground">{t('schedule.noPlanDesc')}</p>
            <div className="flex gap-2 justify-center">
              <Button className="gradient-hyrox" onClick={() => navigate(canManagePlans ? '/plans?tab=build' : '/plans')}>
                {t('schedule.generateAiPlan')}
              </Button>
              <Button variant="outline" onClick={() => navigate('/plans?tab=import')}>
                {t('schedule.importPlan')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {plans && plans.length === 1 && (
            <p className="text-xs text-muted-foreground">{plans[0].name}</p>
          )}

          {isAllPlans && plans && plans.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 px-1">
              {plans.map(p => {
                const isHidden = hiddenPlanIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlanVisibility(p.id)}
                    className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-all ${
                      isHidden
                        ? 'opacity-40 border-border bg-muted line-through'
                        : 'border-border/50 bg-background hover:bg-accent'
                    }`}
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0 transition-opacity"
                      style={{ backgroundColor: planColorMap[p.id], opacity: isHidden ? 0.3 : 1 }}
                    />
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}

          <div className="lg:hidden">
            <TrainingLoadBanner sessions={sessions} weekNumber={displayWeek} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Main schedule area */}
            <div className="lg:col-span-3">
              <Tabs value={view} onValueChange={v => setView(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="day">{t('schedule.day')}</TabsTrigger>
                  <TabsTrigger value="week">{t('schedule.week')}</TabsTrigger>
                  <TabsTrigger value="month">{t('schedule.month')}</TabsTrigger>
                </TabsList>

                {view !== 'month' && (
                  <div className="flex items-center justify-between mt-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => Math.max(0, w - 1))} disabled={displayWeek <= 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium font-display">
                      {t('schedule.week')} {displayWeek} <span className="text-muted-foreground font-normal">/ {maxWeek}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      {defaultProvider ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title={`Add to ${defaultProvider} calendar`} onClick={() => handleCalendarExport(defaultProvider)}>
                          <CalendarPlus className="h-4 w-4 text-primary" />
                        </Button>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Add week to calendar">
                              <CalendarPlus className="h-4 w-4 text-primary" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-48">
                            {(['google', 'outlook', 'apple'] as CalendarProvider[]).map(provider => (
                              <DropdownMenuItem key={provider} onClick={() => handleCalendarExport(provider)}>
                                {provider === 'google' && 'Google Calendar'}
                                {provider === 'outlook' && 'Outlook Calendar'}
                                {provider === 'apple' && 'Apple Calendar (.ics)'}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)} disabled={displayWeek >= maxWeek}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {view === 'day' && (
                  <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1">
                    {dayLabels.map((d, i) => {
                      const hasSessions = visibleSessions.some(s => s.week_number === displayWeek && s.day_of_week === i + 1);
                      return (
                        <Button key={i} variant={selectedDay === i + 1 ? 'default' : 'ghost'} size="sm" className={`relative min-w-[40px] h-8 text-xs ${selectedDay === i + 1 ? 'gradient-hyrox text-primary-foreground' : ''}`} onClick={() => setSelectedDay(i + 1)}>
                          {d}
                          {hasSessions && selectedDay !== i + 1 && (
                            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                        </Button>
                      );
                    })}
                  </div>
                )}

                {isLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <TabsContent value="day" className="mt-3">
                      <DailyView sessions={visibleSessions} weekNumber={displayWeek} dayOfWeek={selectedDay} completedSessions={completedSessions} substitutionMap={substitutionMap} />
                    </TabsContent>
                    <TabsContent value="week" className="mt-3">
                      <WeeklyView sessions={visibleSessions} weekNumber={displayWeek} weeklySummary={weeklySummary} completedSessions={completedSessions} substitutionMap={substitutionMap} />
                    </TabsContent>
                    <TabsContent value="month" className="mt-3">
                      <MonthlyView sessions={visibleSessions} completedSessions={completedSessions} maxWeek={maxWeek} currentWeek={displayWeek} onSelectWeek={(w) => { setWeekOffset(w - 1); setView('week'); }} />
                    </TabsContent>
                  </>
                )}
                {!isLoading && sessions.length > 0 && (
                  <div className="flex justify-center pt-2">
                    {defaultProvider ? (
                      <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => handleFullPlanExport(defaultProvider)}>
                        <Download className="h-3.5 w-3.5" />
                        {t('schedule.exportFullPlan')}
                      </Button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="text-xs gap-1.5">
                            <Download className="h-3.5 w-3.5" />
                            {t('schedule.exportFullPlan')}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-48">
                          {(['google', 'outlook', 'apple'] as CalendarProvider[]).map(provider => (
                            <DropdownMenuItem key={provider} onClick={() => handleFullPlanExport(provider)}>
                              {provider === 'google' && 'Google Calendar'}
                              {provider === 'outlook' && 'Outlook Calendar'}
                              {provider === 'apple' && 'Apple Calendar (.ics)'}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}
              </Tabs>
            </div>

            {/* Desktop sidebar: Weekly summary + Targets */}
            <div className="hidden lg:block space-y-4">
              {weeklySummary && (
                <Card className="glass sticky top-16">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-display">{t('schedule.week')} {displayWeek}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    {weeklySummary.run_km_target && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Run Target</span>
                        <span className="font-mono font-bold">{weeklySummary.run_km_target} km</span>
                      </div>
                    )}
                    {weeklySummary.bike_z2_min_target && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bike Z2</span>
                        <span className="font-mono font-bold">{weeklySummary.bike_z2_min_target} min</span>
                      </div>
                    )}
                    {weeklySummary.run_days && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Run Days</span>
                        <span className="font-medium">{weeklySummary.run_days}</span>
                      </div>
                    )}
                    {weeklySummary.notes && (
                      <p className="text-muted-foreground pt-1 border-t border-border/50">{weeklySummary.notes}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {targets.length > 0 && (
                <Card className="glass">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-display">Targets</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {targets.map((target: any) => (
                      <div key={target.id} className="space-y-1">
                        <p className="text-xs font-medium capitalize">{target.type.replace('_', ' ')}</p>
                        <p className="text-xs text-primary font-mono">{target.primary_target}</p>
                        {target.secondary_guardrail && (
                          <p className="text-[10px] text-muted-foreground">{target.secondary_guardrail}</p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <TrainingLoadCard
                sessions={sessions}
                weekNumber={displayWeek}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
