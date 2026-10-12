import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Activity, RefreshCw } from 'lucide-react';

interface Row {
  athlete_id: string;
  full_name: string | null;
  organization_name: string | null;
  strava_connected: boolean;
  strava_athlete_name: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_count: number | null;
  strava_activities: number;
  last_activity_received_at: string | null;
  last_activity_start: string | null;
  unmatched_activities: number;
  load_date: string | null;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  load_computed_at: string | null;
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString() : '—');
const n1 = (v: number | null) => (v == null ? '—' : Number(v).toFixed(1));

export default function AthleteSyncTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_athlete_sync_status' as any);
    if (error) toast.error(error.message);
    else setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const recompute = async (r: Row) => {
    setBusy(r.athlete_id);
    const { data, error } = await supabase.rpc('admin_recompute_training_load' as any, { _athlete_id: r.athlete_id });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    const d = data as any;
    toast.success(`${r.full_name || 'Athlete'}: CTL ${n1(d?.ctl)} · ATL ${n1(d?.atl)} · TSB ${n1(d?.tsb)}`);
    load();
  };

  const filtered = rows.filter((r) => (r.full_name ?? '').toLowerCase().includes(q.toLowerCase()));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" /> Athletes & Strava ({rows.length})
        </CardTitle>
        <div className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search athlete" className="h-9 w-44" />
          <Button size="sm" variant="outline" onClick={load} className="gap-1.5">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-8"><div className="h-6 w-6 rounded-lg gradient-hyrox animate-pulse" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No athletes found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Athlete</TableHead>
                <TableHead>Strava</TableHead>
                <TableHead>Last sync</TableHead>
                <TableHead>Latest workout received</TableHead>
                <TableHead>Activities</TableHead>
                <TableHead>CTL / ATL / TSB</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.athlete_id}>
                  <TableCell>
                    <div className="font-medium">{r.full_name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{r.organization_name}</div>
                  </TableCell>
                  <TableCell>
                    {r.strava_connected
                      ? <Badge variant="secondary">Connected{r.strava_athlete_name ? ` · ${r.strava_athlete_name}` : ''}</Badge>
                      : <Badge variant="outline">Not connected</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{fmt(r.last_sync_at)}</div>
                    {r.last_sync_status && <div className="text-muted-foreground">{r.last_sync_status}{r.last_sync_count != null ? ` · ${r.last_sync_count}` : ''}</div>}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{fmt(r.last_activity_received_at)}</div>
                    {r.last_activity_start && <div className="text-muted-foreground">workout: {fmt(r.last_activity_start)}</div>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.strava_activities}
                    {r.unmatched_activities > 0 && <div className="text-muted-foreground">{r.unmatched_activities} in inbox</div>}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-mono">{n1(r.ctl)} / {n1(r.atl)} / {n1(r.tsb)}</div>
                    <div className="text-muted-foreground">computed {fmt(r.load_computed_at)}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={busy === r.athlete_id} onClick={() => recompute(r)}>
                      {busy === r.athlete_id ? 'Recalculating…' : 'Recalculate'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
