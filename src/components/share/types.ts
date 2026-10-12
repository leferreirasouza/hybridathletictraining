export interface ShareSessionData {
  discipline: string;
  date: string;
  durationMin: number | null;
  distanceKm: number | null;
  avgHr: number | null;
  avgPace: string | null;
  rpe: number | null;
  sessionName?: string | null;
  elevationM?: number | null;
  calories?: number | null;
  /** When set, the dialog looks up a linked Strava route for the map. */
  completedSessionId?: string | null;
}

export type CardStyle = 'bold' | 'minimal' | 'neon' | 'photo';
export type CardSize = 'story' | 'square' | 'feed';
export type MetricKey = 'distance' | 'duration' | 'pace' | 'hr' | 'rpe' | 'elevation' | 'calories';

export const CARD_SIZES: Record<CardSize, { w: number; h: number; label: string }> = {
  story: { w: 360, h: 640, label: '9:16' },
  square: { w: 360, h: 360, label: '1:1' },
  feed: { w: 360, h: 450, label: '4:5' },
};

export const MAX_METRICS = 4;
