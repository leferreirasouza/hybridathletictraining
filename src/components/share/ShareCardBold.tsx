import type { ShareSessionData } from './types';
import { getDiscipline } from '@/components/schedule/config';

export default function ShareCardBold({ data }: { data: ShareSessionData }) {
  const disc = getDiscipline(data.discipline);
  const dateStr = new Date(data.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div
      className="w-[360px] h-[480px] relative overflow-hidden flex flex-col justify-between p-6"
      style={{
        background: 'linear-gradient(145deg, hsl(220 25% 8%) 0%, hsl(220 30% 14%) 50%, hsl(15 80% 20%) 100%)',
        fontFamily: "'Space Grotesk', sans-serif",
        color: '#fff',
      }}
    >
      {/* Decorative circle */}
      <div
        className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, hsl(15 100% 55%), transparent 70%)' }}
      />

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: 'hsl(15 100% 55%)' }}
          >
            {disc.label.charAt(0)}
          </div>
          <span className="text-xs tracking-widest uppercase opacity-60">{dateStr}</span>
        </div>
        <h2 className="text-3xl font-bold mt-3 leading-tight">{disc.label}</h2>
        <p className="text-sm opacity-50 mt-1">Training Session Complete</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4">
        {data.durationMin != null && (
          <StatBlock label="Duration" value={`${data.durationMin}`} unit="min" />
        )}
        {data.distanceKm != null && (
          <StatBlock label="Distance" value={`${data.distanceKm}`} unit="km" />
        )}
        {data.avgHr != null && (
          <StatBlock label="Avg HR" value={`${data.avgHr}`} unit="bpm" />
        )}
        {data.avgPace && (
          <StatBlock label="Pace" value={data.avgPace} unit="/km" />
        )}
        {data.rpe != null && (
          <StatBlock label="RPE" value={`${data.rpe}`} unit="/10" />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold tracking-wider" style={{ color: 'hsl(15 100% 55%)' }}>
          HYBRID ATHLETICS
        </span>
        <span className="text-[10px] opacity-40">hybridathletics.app</span>
      </div>
    </div>
  );
}

function StatBlock({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-3 backdrop-blur-sm border border-white/10">
      <p className="text-[10px] uppercase tracking-wider opacity-50">{label}</p>
      <p className="text-2xl font-bold mt-0.5">
        {value}
        <span className="text-xs font-normal opacity-50 ml-1">{unit}</span>
      </p>
    </div>
  );
}
