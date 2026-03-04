import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Calendar, Loader2, CalendarPlus, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useScheduleData } from '@/hooks/useScheduleData';
import WeeklyView from '@/components/schedule/WeeklyView';
import MonthlyView from '@/components/schedule/MonthlyView';
import DailyView from '@/components/schedule/DailyView';
import TargetsPanel from '@/components/schedule/TargetsPanel';
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
  const {
    plans, activePlanId, setSelectedPlanId,
    sessions, weeklySummaries, targets, completedSessions,
    substitutionMap, maxWeek, isLoading, noPlan,
  } = useScheduleData();

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(1);
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const defaultProvider = getDefaultCalendarProvider();

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
          {targets.length > 0 && <TargetsPanel targets={targets} />}
          {plans && plans.length > 1 && (
            <Select value={activePlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder={t('schedule.selectPlan')} />
              </SelectTrigger>
              <SelectContent>
                {plans.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {noPlan ? (
        <Card className="glass border-primary/20 overflow-hidden">
          <div className="h-1 gradient-hyrox" />
          <CardContent className="p-8 text-center space-y-3">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-display font-bold">{t('schedule.noPlan')}</p>
            <p className="text-sm text-muted-foreground">{t('schedule.noPlanDesc')}</p>
            <div className="flex gap-2 justify-center">
              <Button className="gradient-hyrox" onClick={() => navigate('/plans')}>
                {t('schedule.generateAiPlan')}
              </Button>
              <Button variant="outline" onClick={() => navigate('/plans')}>
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
                  const hasSessions = sessions.some(s => s.week_number === displayWeek && s.day_of_week === i + 1);
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
                  <DailyView sessions={sessions} weekNumber={displayWeek} dayOfWeek={selectedDay} completedSessions={completedSessions} substitutionMap={substitutionMap} />
                </TabsContent>
                <TabsContent value="week" className="mt-3">
                  <WeeklyView sessions={sessions} weekNumber={displayWeek} weeklySummary={weeklySummary} completedSessions={completedSessions} substitutionMap={substitutionMap} />
                </TabsContent>
                <TabsContent value="month" className="mt-3">
                  <MonthlyView sessions={sessions} completedSessions={completedSessions} maxWeek={maxWeek} currentWeek={displayWeek} onSelectWeek={(w) => { setWeekOffset(w - 1); setView('week'); }} />
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
        </>
      )}
    </div>
  );
}
