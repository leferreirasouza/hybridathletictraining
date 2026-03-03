export interface ShareSessionData {
  discipline: string;
  date: string;
  durationMin: number | null;
  distanceKm: number | null;
  avgHr: number | null;
  avgPace: string | null;
  rpe: number | null;
}

export type CardStyle = 'bold' | 'minimal' | 'neon';
