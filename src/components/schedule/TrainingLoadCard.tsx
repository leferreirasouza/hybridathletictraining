import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Shield, Activity } from 'lucide-react';
import { analyzeWeeklyLoad, type LoadWarning, type RiskLevel } from '@/lib/trainingGuardrails';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TrainingLoadCardProps {
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
  safe: 'bg-green-500/10 border-green-500/20',
  caution: 'bg-amber-500/10 border-amber-500/20',
  danger: 'bg-destructive/10 border-destructive/20',
};

export default function TrainingLoadCard({ sessions, weekNumber, experience = 'intermediate' }: TrainingLoadCardProps) {
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

  const StatusIcon = overallRisk === 'safe' ? CheckCircle : AlertTriangle;

  return (
    <Card className={`border ${riskBg[overallRisk]}`}>
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs font-display flex items-center gap-1.5">
          <Shield className={`h-3.5 w-3.5 ${riskColors[overallRisk]}`} />
          Training Load — Week {weekNumber}
          <StatusIcon className={`h-3.5 w-3.5 ml-auto ${riskColors[overallRisk]}`} />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2">
        {/* Metrics summary */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <MetricRow label="Sessions" value={metrics.totalSessions} />
          <MetricRow label="Run km" value={metrics.totalRunKm.toFixed(1)} />
          <MetricRow label="Bike km" value={metrics.totalBikeKm.toFixed(1)} />
          <MetricRow label="Duration" value={`${Math.round(metrics.totalDurationMin)}min`} />
          <MetricRow label="High-Int." value={metrics.highIntensitySessions} />
          <MetricRow label="Strength" value={metrics.strengthSessions} />
          <MetricRow label="Easy/Hard" value={`${metrics.easyPct}/${metrics.hardPct}%`} />
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-border/50">
            <TooltipProvider>
              {warnings.map((w) => (
                <WarningBadge key={w.metric} warning={w} />
              ))}
            </TooltipProvider>
          </div>
        )}

        {overallRisk === 'safe' && (
          <p className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> All metrics within safe limits
          </p>
        )}
      </CardContent>
    </Card>
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

function WarningBadge({ warning }: { warning: LoadWarning }) {
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
      <TooltipContent side="left" className="text-xs max-w-[200px]">
        {warning.risk === 'danger'
          ? `⛔ Exceeds safe limit. Risk of injury or overtraining.`
          : `⚠️ Approaching limit. Monitor for fatigue.`}
      </TooltipContent>
    </Tooltip>
  );
}
