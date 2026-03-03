import type { ShareSessionData } from './types';
import { getDiscipline } from '@/components/schedule/config';

export default function ShareCardNeon({ data }: { data: ShareSessionData }) {
  const disc = getDiscipline(data.discipline);
  const dateStr = new Date(data.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div
      className="w-[360px] h-[480px] relative overflow-hidden flex flex-col justify-end p-6"
      style={{
        background: '#0a0a0a',
        fontFamily: "'Space Grotesk', sans-serif",
        color: '#fff',
      }}
    >
      {/* Neon glow accents */}
      <div
        className="absolute top-0 left-0 w-full h-1"
        style={{ background: 'linear-gradient(90deg, hsl(15 100% 55%), hsl(200 90% 48%), hsl(15 100% 55%))' }}
      />
      <div
        className="absolute top-10 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full blur-[80px] opacity-30"
        style={{ background: 'hsl(15 100% 55%)' }}
      />
      <div
        className="absolute bottom-20 right-0 w-32 h-32 rounded-full blur-[60px] opacity-20"
        style={{ background: 'hsl(200 90% 48%)' }}
      />

      {/* Big discipline name */}
      <div className="absolute top-16 left-6 right-6">
        <p className="text-[10px] tracking-[0.3em] uppercase opacity-40">{dateStr}</p>
        <h2
          className="text-5xl font-bold mt-2 leading-none"
          style={{
            background: 'linear-gradient(135deg, hsl(15 100% 55%), hsl(200 90% 48%))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {disc.label}
        </h2>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-3 mb-6">
        {data.durationMin != null && <NeonPill label="Time" value={`${data.durationMin}m`} />}
        {data.distanceKm != null && <NeonPill label="Dist" value={`${data.distanceKm}km`} />}
        {data.avgHr != null && <NeonPill label="HR" value={`${data.avgHr}`} />}
        {data.avgPace && <NeonPill label="Pace" value={data.avgPace} />}
        {data.rpe != null && <NeonPill label="RPE" value={`${data.rpe}/10`} />}
      </div>

      {/* RPE bar */}
      {data.rpe != null && (
        <div className="mb-6">
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${(data.rpe / 10) * 100}%`,
                background: 'linear-gradient(90deg, hsl(15 100% 55%), hsl(200 90% 48%))',
              }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-bold tracking-wider"
          style={{
            background: 'linear-gradient(90deg, hsl(15 100% 55%), hsl(200 90% 48%))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          HYBRID ATHLETICS
        </span>
        <span className="text-[10px] opacity-30">hybridathletics.app</span>
      </div>
    </div>
  );
}

function NeonPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5">
      <span className="text-[9px] uppercase tracking-wider opacity-40 mr-1.5">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
