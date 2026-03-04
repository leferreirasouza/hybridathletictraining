import { useMemo, useState } from 'react';
import { Shield, ChevronDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { analyzeWeeklyLoad, type LoadWarning, type RiskLevel } from '@/lib/trainingGuardrails';

interface TrainingLoadBannerProps {
  sessions: Array<{
    week_number: number;
    day_of_week: number;
    discipline: string;
    intensity?: string | null;
    distance_km?: number | null;
    duration_min?: number | null;
  }>;
  weekNumber: number;
  experience?: string;
}

const riskColors: Record<RiskLevel, string> = {
  safe: 'text-green-500',
  caution: 'text-amber-500',
  danger: 'text-destructive',
};

const riskBg: Record<RiskLevel, string> = {
  safe: 'bg-green-500/10 border-green-500/30',
  caution: 'bg-amber-500/10 border-amber-500/30',
  danger: 'bg-destructive/10 border-destructive/30',
};

export default function TrainingLoadBanner({ sessions, weekNumber, experience = 'intermediate' }: TrainingLoadBannerProps) {
  const [open, setOpen] = useState(false);

  const { metrics, warnings } = useMemo(
    () => analyzeWeeklyLoad(sessions, weekNumber, experience),
    [sessions, weekNumber, experience]
  );

  if (metrics.totalSessions === 0) return null;

  const overallRisk: RiskLevel = warnings.some(w => w.risk === 'danger')
    ? 'danger'
    : warnings.some(w => w.risk === 'caution')
      ? 'caution'
      : 'safe';

  const summaryText = overallRisk === 'safe'
    ? 'All Safe'
    : `${warnings.length} Warning${warnings.length > 1 ? 's' : ''}`;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`rounded-lg border ${riskBg[overallRisk]} overflow-hidden`}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <Shield className={`h-3.5 w-3.5 ${riskColors[overallRisk]}`} />
              <span>Training Load — Wk {weekNumber}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`font-semibold ${riskColors[overallRisk]}`}>{summaryText}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <MetricRow label="Sessions" value={metrics.totalSessions} />
              <MetricRow label="Run km" value={metrics.totalRunKm.toFixed(1)} />
              <MetricRow label="Duration" value={`${Math.round(metrics.totalDurationMin)}min`} />
              <MetricRow label="High-Int." value={metrics.highIntensitySessions} />
              <MetricRow label="Strength" value={metrics.strengthSessions} />
              <MetricRow label="Easy/Hard" value={`${metrics.easyPct}/${metrics.hardPct}%`} />
            </div>

            {warnings.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-border/50">
                <TooltipProvider>
                  {warnings.map((w) => (
                    <WarningRow key={w.metric} warning={w} />
                  ))}
                </TooltipProvider>
              </div>
            )}

            {overallRisk === 'safe' && (
              <p className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> All metrics within safe limits
              </p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}

function WarningRow({ warning }: { warning: LoadWarning }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center justify-between text-[11px] px-1.5 py-0.5 rounded ${
          warning.risk === 'danger' ? 'bg-destructive/10' : 'bg-amber-500/10'
        }`}>
          <span className="flex items-center gap-1">
            <AlertTriangle className={`h-3 w-3 ${riskColors[warning.risk]}`} />
            <span className="font-medium">{warning.label}</span>
          </span>
          <span className="font-mono">
            {warning.current}{warning.unit ? ` ${warning.unit}` : ''}{' '}
            <span className="text-muted-foreground">/ {warning.limit}</span>
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[200px]">
        {warning.risk === 'danger'
          ? '⛔ Exceeds safe limit. Risk of injury or overtraining.'
          : '⚠️ Approaching limit. Monitor for fatigue.'}
      </TooltipContent>
    </Tooltip>
  );
}
