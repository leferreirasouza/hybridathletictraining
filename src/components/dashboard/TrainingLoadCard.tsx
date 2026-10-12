import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useTrainingLoad, fatigueRiskFromTsb } from '@/hooks/useTrainingLoad';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useTranslation } from 'react-i18next';

const BAND_KEY = { fresh: 'bandFresh', neutral: 'bandNeutral', fatigued: 'bandFatigued', high_risk: 'bandHighRisk' } as const;

export default function TrainingLoadCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data = [], isLoading } = useTrainingLoad(user?.id, 90);
  const latest = data[data.length - 1];
  const band = latest ? fatigueRiskFromTsb(latest.tsb) : null;

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display">
            {t('dashboard.trainingLoad', { defaultValue: 'Fitness & fatigue' })}
          </CardTitle>
          {band && <Badge variant="secondary">{t(`dashboard.${BAND_KEY[band]}`)}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-lg bg-muted/30" />
        ) : !latest ? (
          <p className="text-sm text-muted-foreground">
            {t('dashboard.trainingLoadEmpty', { defaultValue: 'Log or sync a few workouts and your fitness (CTL), fatigue (ATL) and form (TSB) will appear here.' })}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { k: 'fitnessCtl', l: t('dashboard.fitnessCtl', { defaultValue: 'Fitness (CTL)' }), v: latest.ctl },
                { k: 'fatigueAtl', l: t('dashboard.fatigueAtl', { defaultValue: 'Fatigue (ATL)' }), v: latest.atl },
                { k: 'formTsb', l: t('dashboard.formTsb', { defaultValue: 'Form (TSB)' }), v: latest.tsb },
              ].map((s) => (
                <div key={s.k}>
                  <p className="text-lg font-display font-bold">{s.v.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">{s.l}</p>
                </div>
              ))}
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={30} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                  <Line type="monotone" dataKey="ctl" name="CTL" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="atl" name="ATL" stroke="hsl(var(--destructive))" dot={false} strokeWidth={1.5} />
                  <Line type="monotone" dataKey="tsb" name="TSB" stroke="hsl(var(--muted-foreground))" dot={false} strokeWidth={1.5} strokeDasharray="4 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
