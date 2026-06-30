import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TrainingLoadPoint {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
}

export type FatigueRisk = 'fresh' | 'neutral' | 'fatigued' | 'high_risk';

// Thresholds follow common TrainingPeaks/Coggan TSB interpretation bands.
export function fatigueRiskFromTsb(tsb: number): FatigueRisk {
  if (tsb >= 5) return 'fresh';
  if (tsb >= -10) return 'neutral';
  if (tsb >= -20) return 'fatigued';
  return 'high_risk';
}

export function useTrainingLoad(athleteId: string | undefined, days = 90) {
  return useQuery({
    queryKey: ['training-load', athleteId, days],
    queryFn: async (): Promise<TrainingLoadPoint[]> => {
      if (!athleteId) return [];
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('training_load_daily')
        .select('date, ctl, atl, tsb')
        .eq('athlete_id', athleteId)
        .gte('date', since.toISOString().slice(0, 10))
        .order('date', { ascending: true });

      if (error || !data) return [];
      return data.map((d) => ({
        date: d.date,
        ctl: Number(d.ctl),
        atl: Number(d.atl),
        tsb: Number(d.tsb),
      }));
    },
    enabled: !!athleteId,
  });
}

// Fetches just the most recent TSB per athlete, for badges/alerts where the
// full trend series isn't needed.
export function useLatestTsbByAthlete(athleteIds: string[]) {
  return useQuery({
    queryKey: ['latest-tsb', [...athleteIds].sort().join(',')],
    queryFn: async (): Promise<Map<string, number>> => {
      if (!athleteIds.length) return new Map();

      const { data, error } = await supabase
        .from('training_load_daily')
        .select('athlete_id, date, tsb')
        .in('athlete_id', athleteIds)
        .order('date', { ascending: false });

      if (error || !data) return new Map();

      const latest = new Map<string, number>();
      for (const row of data) {
        if (!latest.has(row.athlete_id)) latest.set(row.athlete_id, Number(row.tsb));
      }
      return latest;
    },
    enabled: athleteIds.length > 0,
  });
}
