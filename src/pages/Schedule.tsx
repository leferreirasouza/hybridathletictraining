import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useScheduleData } from '@/hooks/useScheduleData';
import WeeklyView from '@/components/schedule/WeeklyView';
import MonthlyView from '@/components/schedule/MonthlyView';
import DailyView from '@/components/schedule/DailyView';
import TargetsPanel from '@/components/schedule/TargetsPanel';
import { dayLabels } from '@/components/schedule/config';

export default function Schedule() {
  const navigate = useNavigate();
  const {
    plans, activePlanId, setSelectedPlanId,
    sessions, weeklySummaries, targets,
    maxWeek, isLoading, noPlan,
  } = useScheduleData();

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(1);
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');

  const displayWeek = Math.max(1, Math.min(maxWeek, 1 + weekOffset));

  const weeklySummary = weeklySummaries.find((ws: any) => ws.week_number === displayWeek);

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-bold">Schedule</h1>
        <div className="flex items-center gap-2">
          {targets.length > 0 && <TargetsPanel targets={targets} />}
          {plans && plans.length > 1 && (
            <Select value={activePlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
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
            <p className="text-xs text-muted-foreground">{plans[0].name}</p>
          )}

          {/* View tabs */}
          <Tabs value={view} onValueChange={v => setView(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>

            {/* Week navigator — shown for day and week views */}
            {view !== 'month' && (
              <div className="flex items-center justify-between mt-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
                  disabled={displayWeek <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium font-display">
                  Week {displayWeek} <span className="text-muted-foreground font-normal">of {maxWeek}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setWeekOffset(w => w + 1)}
                  disabled={displayWeek >= maxWeek}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Day selector — only for day view */}
            {view === 'day' && (
              <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1">
                {dayLabels.map((d, i) => {
                  const hasSessions = sessions.some(
                    s => s.week_number === displayWeek && s.day_of_week === i + 1
                  );
                  return (
                    <Button
                      key={i}
                      variant={selectedDay === i + 1 ? 'default' : 'ghost'}
                      size="sm"
                      className={`relative min-w-[40px] h-8 text-xs ${
                        selectedDay === i + 1 ? 'gradient-hyrox text-primary-foreground' : ''
                      }`}
                      onClick={() => setSelectedDay(i + 1)}
                    >
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
                  <DailyView
                    sessions={sessions}
                    weekNumber={displayWeek}
                    dayOfWeek={selectedDay}
                  />
                </TabsContent>

                <TabsContent value="week" className="mt-3">
                  <WeeklyView
                    sessions={sessions}
                    weekNumber={displayWeek}
                    weeklySummary={weeklySummary}
                  />
                </TabsContent>

                <TabsContent value="month" className="mt-3">
                  <MonthlyView
                    sessions={sessions}
                    maxWeek={maxWeek}
                    currentWeek={displayWeek}
                    onSelectWeek={(w) => {
                      setWeekOffset(w - 1);
                      setView('week');
                    }}
                  />
                </TabsContent>
              </>
            )}
          </Tabs>
        </>
      )}
    </div>
  );
}
