import type { ShareSessionData } from './types';
import { getDiscipline } from '@/components/schedule/config';

export default function ShareCardMinimal({ data }: { data: ShareSessionData }) {
  const disc = getDiscipline(data.discipline);
  const dateStr = new Date(data.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const stats = [
    data.durationMin != null && { label: 'Duration', value: `${data.durationMin} min` },
    data.distanceKm != null && { label: 'Distance', value: `${data.distanceKm} km` },
    data.avgPace && { label: 'Pace', value: `${data.avgPace} /km` },
    data.avgHr != null && { label: 'Heart Rate', value: `${data.avgHr} bpm` },
    data.rpe != null && { label: 'Effort', value: `${data.rpe}/10` },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div
      className="w-[360px] h-[480px] flex flex-col justify-between p-8"
      style={{
        background: '#fafafa',
        fontFamily: "'Space Grotesk', sans-serif",
        color: '#1a1a1a',
      }}
    >
      {/* Top */}
      <div>
        <p className="text-xs tracking-widest uppercase opacity-40 mb-6">Session Report</p>
        <h2 className="text-4xl font-bold leading-none">{disc.label}</h2>
        <p className="text-sm opacity-40 mt-2">{dateStr}</p>
      </div>

      {/* Stats list */}
      <div className="space-y-3">
        {stats.map((s, i) => (
          <div key={i} className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#e5e5e5' }}>
            <span className="text-xs uppercase tracking-wider opacity-40">{s.label}</span>
            <span className="text-lg font-semibold">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold tracking-wider" style={{ color: 'hsl(15, 100%, 55%)' }}>
          HYBRID ATHLETICS
        </span>
        <div className="h-6 w-6 rounded-full" style={{ background: 'hsl(15, 100%, 55%)' }} />
      </div>
    </div>
  );
}
