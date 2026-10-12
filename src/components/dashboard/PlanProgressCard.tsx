import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronDown, CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDiscipline, dayLabels } from '@/components/schedule/config';
import PlanSuggestions from '@/components/dashboard/PlanSuggestions';
import { buildWeekProgress, type ProgressSession, type ProgressCompletion, type WeekProgress } from '@/lib/planProgress';

interface Props {
  planName?: string | null;
  sessions: ProgressSession[];
  completions: ProgressCompletion[];
}

function fmtRange(start: string | null, end: string | null, locale: string) {
  if (!start || !end) return null;
  const f = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' }).toUpperCase();
  return `${f(start)} - ${f(end)}`;
}

function Segments({ count, filled, partial }: { count: number; filled: number; partial?: boolean }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full',
            i < filled ? 'bg-foreground' : partial && i === filled ? 'bg-primary/60' : 'bg-muted',
          )}
        />
      ))}
    </div>
  );
}

function WeekCard({ w, open, onToggle, locale }: { w: WeekProgress; open: boolean; onToggle: () => void; locale: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const range = fmtRange(w.start, w.end, locale);
  return (
    <div className={cn('rounded-xl border p-3 transition-colors', w.isCurrent ? 'border-foreground/60' : 'border-border/60')}>
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="flex items-start justify-between">
          <div>
            {range && <p className="text-[10px] font-semibold tracking-wider text-muted-foreground">{range}</p>}
            <p className="font-display font-bold text-base">{t('planProgress.week', { n: w.week })}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {w.isCurrent && <Badge variant="outline" className="text-[9px]">{t('planProgress.thisWeek')}</Badge>}
            {w.total > 0 && w.done === w.total && (
              <span className="h-6 w-6 rounded-md bg-muted flex items-center justify-center"><Check className="h-3.5 w-3.5" /></span>
            )}
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
          </div>
        </div>
        <div className="mt-2"><Segments count={w.total} filled={w.done} /></div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {t('planProgress.workouts')}: <span className="text-foreground font-medium">{w.done}/{w.total}</span>
          {w.plannedKm > 0 && (
            <> · {t('planProgress.distance')}: <span className="text-foreground font-medium">{w.doneKm}/{w.plannedKm} km</span></>
          )}
        </p>
      </button>
      {open && (
        <div className="mt-3 space-y-1.5">
          {w.sessions.map(s => {
            const disc = getDiscipline(s.discipline);
            const Icon = disc.icon;
            const detail = s.distance_km ? `${s.distance_km}km` : s.duration_min ? `${s.duration_min}m` : '';
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate('/schedule')}
                className={cn('w-full flex items-center gap-3 text-left rounded-md px-1 py-1 hover:bg-muted/40', s.state === 'missed' && 'opacity-50')}
              >
                <span
                  className={cn(
                    'h-6 w-6 rounded-md flex items-center justify-center shrink-0',
                    s.state === 'completed' ? 'bg-success text-success-foreground' : disc.color,
                    s.state === 'in_progress' && 'ring-2 ring-primary',
                  )}
                >
                  {s.state === 'completed' ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </span>
                <span className="text-xs text-muted-foreground w-8">{dayLabels[s.day_of_week - 1] ?? ''}</span>
                <span className={cn('text-sm flex-1 truncate', s.state === 'completed' && 'text-muted-foreground')}>
                  {s.session_name}{detail && <span className="text-muted-foreground"> · {detail}</span>}
                </span>
                <span className="text-[10px] text-muted-foreground">{t(`planProgress.state.${s.state}`)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PlanProgressCard({ planName, sessions, completions }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'pt-BR' ? 'pt-BR' : 'en-US';
  const todayStr = new Date().toISOString().slice(0, 10);
  const weeks = useMemo(() => buildWeekProgress(sessions, completions, todayStr), [sessions, completions, todayStr]);
  const current = weeks.find(w => w.isCurrent);
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (!weeks.length) return null;

  const weeksDone = weeks.filter(w => w.isComplete).length;
  const plannedKm = Math.round(weeks.reduce((s, w) => s + w.plannedKm, 0) * 10) / 10;
  const doneKm = Math.round(weeks.reduce((s, w) => s + w.doneKm, 0) * 10) / 10;
  const effectiveOpen = openWeek ?? current?.week ?? weeks[0].week;
  const anchorIdx = Math.max(0, weeks.findIndex(w => w.week === (current?.week ?? weeks[0].week)));
  const visible = showAll ? weeks : weeks.slice(Math.max(0, anchorIdx - 1), anchorIdx + 2);

  return (
    <Card className="glass">
      <CardContent className="p-4 space-y-4">
        <div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5 text-primary" /> {t('planProgress.title')}
          </p>
          {planName && <h3 className="font-display font-bold text-lg leading-tight mt-1">{planName}</h3>}
        </div>
        <PlanSuggestions sessions={sessions as any} />
        <Segments count={weeks.length} filled={weeksDone} partial={!!current} />
        <div className="flex justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground">{t('planProgress.weeksCompleted')}</p>
            <p className="font-display font-bold text-xl">{weeksDone}/{weeks.length}</p>
          </div>
          {plannedKm > 0 && (
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">{t('planProgress.distance')}</p>
              <p className="font-display font-bold text-xl">{doneKm}/{plannedKm} km</p>
            </div>
          )}
        </div>
        <div className="space-y-2">
          {visible.map(w => (
            <WeekCard
              key={w.week}
              w={w}
              locale={locale}
              open={effectiveOpen === w.week}
              onToggle={() => setOpenWeek(effectiveOpen === w.week ? -1 : w.week)}
            />
          ))}
        </div>
        {weeks.length > visible.length || showAll ? (
          <button type="button" className="text-xs text-primary w-full" onClick={() => setShowAll(v => !v)}>
            {showAll ? t('planProgress.showLess') : t('planProgress.showAll', { n: weeks.length })}
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}
