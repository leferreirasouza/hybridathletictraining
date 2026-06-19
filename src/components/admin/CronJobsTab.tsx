import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, RefreshCw, CheckCircle2, XCircle, History, Activity } from 'lucide-react';
import { toast } from 'sonner';
// @ts-expect-error - cron-parser ships with its own typings; fallback if absent
import cronParser from 'cron-parser';

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_duration_ms: number | null;
  last_message: string | null;
  success_count: number;
  failure_count: number;
  total_runs: number;
}

interface CronRun {
  runid: number;
  start_time: string;
  end_time: string | null;
  status: string;
  return_message: string | null;
  duration_ms: number | null;
}

interface AuditEntry {
  id: string;
  action: string;
  created_at: string;
  details: Record<string, unknown> | null;
}

function nextRun(schedule: string): string {
  try {
    const it = cronParser.parseExpression(schedule, { utc: true });
    return it.next().toDate().toISOString();
  } catch {
    return '—';
  }
}

function fmt(ts: string | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  if (mins < 1) return diff >= 0 ? 'just now' : 'imminent';
  if (mins < 60) return diff >= 0 ? `${mins}m ago` : `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return diff >= 0 ? `${hrs}h ago` : `in ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return diff >= 0 ? `${days}d ago` : `in ${days}d`;
}

export default function CronJobsTab() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CronJob | null>(null);
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [jobsRes, logsRes] = await Promise.all([
      supabase.rpc('admin_get_cron_jobs' as any),
      supabase
        .from('audit_logs')
        .select('id, action, created_at, details')
        .like('action', 'cron.%')
        .order('created_at', { ascending: false })
        .limit(30),
    ]);
    if (jobsRes.error) toast.error(jobsRes.error.message);
    else setJobs((jobsRes.data as CronJob[]) ?? []);
    if (logsRes.error) toast.error(logsRes.error.message);
    else setLogs((logsRes.data as AuditEntry[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openRuns = async (job: CronJob) => {
    setSelected(job);
    setLoadingRuns(true);
    const { data, error } = await supabase.rpc('admin_get_cron_runs' as any, {
      _jobname: job.jobname,
      _limit: 25,
    });
    if (error) toast.error(error.message);
    else setRuns((data as CronRun[]) ?? []);
    setLoadingRuns(false);
  };

  const statusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">never run</Badge>;
    if (status === 'succeeded')
      return (
        <Badge className="bg-success/15 text-success border-success/30 gap-1">
          <CheckCircle2 className="h-3 w-3" /> ok
        </Badge>
      );
    if (status === 'failed')
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> failed
        </Badge>
      );
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" /> Scheduled Jobs ({jobs.length})
          </CardTitle>
          <Button size="sm" variant="outline" onClick={fetchAll} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 rounded-lg gradient-hyrox animate-pulse" />
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No scheduled jobs.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Last run</TableHead>
                    <TableHead>Next run</TableHead>
                    <TableHead className="text-right">Success / Fail</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => (
                    <TableRow key={j.jobid}>
                      <TableCell>
                        <div className="font-medium">{j.jobname}</div>
                        <div className="text-xs text-muted-foreground">
                          {j.active ? 'active' : 'paused'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{j.schedule}</code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {statusBadge(j.last_status)}
                          <span className="text-xs text-muted-foreground">{fmt(j.last_run_at)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {j.active ? fmt(nextRun(j.schedule)) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="text-success">{j.success_count}</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className={j.failure_count > 0 ? 'text-destructive' : 'text-muted-foreground'}>
                          {j.failure_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openRuns(j)}>
                          <History className="h-3.5 w-3.5" /> History
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" /> Recent Audit Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No cron audit entries yet.</p>
          ) : (
            <ScrollArea className="max-h-96 pr-2">
              <div className="space-y-2">
                {logs.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs font-medium">{l.action}</code>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString()}
                      </span>
                    </div>
                    {l.details && (
                      <pre className="text-xs text-muted-foreground mt-1 overflow-x-auto">
                        {JSON.stringify(l.details, null, 0)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.jobname} — recent runs</DialogTitle>
          </DialogHeader>
          {loadingRuns ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 rounded-lg gradient-hyrox animate-pulse" />
            </div>
          ) : runs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No runs recorded yet.</p>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.runid}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(r.start_time).toLocaleString()}
                      </TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {r.duration_ms != null ? `${r.duration_ms} ms` : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {r.return_message || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
