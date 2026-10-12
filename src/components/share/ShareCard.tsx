import { getDiscipline } from '@/components/schedule/config';
import { CARD_SIZES, type CardSize, type CardStyle, type MetricKey, type ShareSessionData } from './types';

import { useTranslation } from 'react-i18next';
/** Google encoded polyline -> [lat, lng][] */
export function decodePolyline(str: string): [number, number][] {
  let i = 0, lat = 0, lng = 0;
  const out: [number, number][] = [];
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && i < str.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta; else lng += delta;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

function RouteSvg({ polyline, color, w, h }: { polyline: string; color: string; w: number; h: number }) {
  const pts = decodePolyline(polyline);
  if (pts.length < 2) return null;
  const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1]);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const cos = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const spanX = (maxLng - minLng) * cos || 1e-6, spanY = maxLat - minLat || 1e-6;
  const pad = 12, scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const ox = (w - spanX * scale) / 2, oy = (h - spanY * scale) / 2;
  const d = pts.map(([la, ln], k) => `${k ? 'L' : 'M'}${(ox + (ln - minLng) * cos * scale).toFixed(1)},${(oy + (maxLat - la) * scale).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function metricValue(data: ShareSessionData, key: MetricKey): { label: string; value: string } | null {
  switch (key) {
    case 'distance': return data.distanceKm != null ? { label: 'Distance', value: `${data.distanceKm} km` } : null;
    case 'duration': return data.durationMin != null ? { label: 'Time', value: `${data.durationMin} min` } : null;
    case 'pace': return data.avgPace ? { label: 'Pace', value: `${data.avgPace} /km` } : null;
    case 'hr': return data.avgHr != null ? { label: t('auto.k75'), value: `${data.avgHr} bpm` } : null;
    case 'rpe': return data.rpe != null ? { label: 'Effort', value: `${data.rpe}/10` } : null;
    case 'elevation': return data.elevationM != null ? { label: 'Elevation', value: `${Math.round(data.elevationM)} m` } : null;
    case 'calories': return data.calories != null ? { label: 'Calories', value: `${data.calories}` } : null;
  }
}

// Exported-image palettes: fixed colors are intentional so the saved PNG looks the same in any app theme.
const THEMES: Record<CardStyle, { bg: string; fg: string; sub: string; accent: string }> = {
  bold: { bg: 'linear-gradient(145deg, hsl(220 25% 8%) 0%, hsl(220 30% 14%) 50%, hsl(15 80% 20%) 100%)', fg: '#fff', sub: 'rgba(255,255,255,0.55)', accent: 'hsl(15 100% 55%)' },
  minimal: { bg: '#fafafa', fg: '#1a1a1a', sub: 'rgba(0,0,0,0.45)', accent: '#1a1a1a' },
  neon: { bg: '#0a0a0a', fg: '#fff', sub: 'rgba(255,255,255,0.5)', accent: 'hsl(200 90% 55%)' },
  photo: { bg: '#000', fg: '#fff', sub: 'rgba(255,255,255,0.75)', accent: 'hsl(15 100% 60%)' },
};

interface Props {
  data: ShareSessionData;
  style: CardStyle;
  size: CardSize;
  metrics: MetricKey[];
  showName: boolean;
  showDate: boolean;
  photoUrl?: string | null;
  polyline?: string | null;
}

export default function ShareCard({ data, style, size, metrics, showName, showDate, photoUrl, polyline }: Props) {
  const { t } = useTranslation();
  const { w, h } = CARD_SIZES[size];
  const th = THEMES[style];
  const disc = getDiscipline(data.discipline);
  const dateStr = new Date(`${data.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const stats = metrics.map(k => metricValue(data, k)).filter(Boolean) as { label: string; value: string }[];
  const routeH = Math.round(h * (size === 'square' ? 0.38 : 0.42));

  return (
    <div
      className="relative overflow-hidden flex flex-col justify-between p-6"
      style={{ width: w, height: h, background: th.bg, color: th.fg, fontFamily: "'Space Grotesk', sans-serif" }}
    >
      {style === 'photo' && photoUrl && (
        <>
          <img src={photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.75) 100%)' }} />
        </>
      )}
      {style === 'neon' && (
        <div className="absolute top-0 left-0 w-full h-1" style={{ background: 'linear-gradient(90deg, hsl(15 100% 55%), hsl(200 90% 48%), hsl(15 100% 55%))' }} />
      )}

      <div className="relative">
        {showDate && <p className="text-[11px] tracking-widest uppercase" style={{ color: th.sub }}>{dateStr}</p>}
        <h2 className="text-3xl font-bold leading-tight mt-1">{showName && data.sessionName ? data.sessionName : disc.label}</h2>
        {showName && data.sessionName && <p className="text-sm mt-0.5" style={{ color: th.sub }}>{disc.label}</p>}
      </div>

      {polyline && (
        <div className="relative flex justify-center">
          <RouteSvg polyline={polyline} color={th.accent} w={w - 48} h={routeH} />
        </div>
      )}

      <div className="relative">
        <div className={`grid gap-4 ${stats.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {stats.map(s => (
            <div key={s.label}>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: th.sub }}>{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] tracking-[0.3em] uppercase mt-5" style={{ color: th.sub }}>{t('auto.k247')}</p>
      </div>
    </div>
  );
}
