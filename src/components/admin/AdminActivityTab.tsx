import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, ScrollText, CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  user_id: string | null;
  details: any;
  created_at: string;
  profiles?: { full_name: string } | null;
}

const PAGE_SIZE = 25;

export default function AdminActivityTab() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchLogs();
  }, [dateFrom, dateTo]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('audit_logs')
      .select('*, profiles:user_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(500);

    if (dateFrom) {
      query = query.gte('created_at', startOfDay(dateFrom).toISOString());
    }
    if (dateTo) {
      query = query.lte('created_at', endOfDay(dateTo).toISOString());
    }

    const { data } = await query;
    setLogs((data as unknown as AuditEntry[]) ?? []);
    setPage(0);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(l =>
      l.action.toLowerCase().includes(q) ||
      (l.entity_type ?? '').toLowerCase().includes(q) ||
      (l.profiles?.full_name ?? '').toLowerCase().includes(q) ||
      (l.user_id ?? '').toLowerCase().includes(q)
    );
  }, [logs, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const clearDates = () => { setDateFrom(undefined); setDateTo(undefined); };
  const hasDateFilter = dateFrom || dateTo;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ScrollText className="h-5 w-5 text-primary" /> Activity Log
        </CardTitle>
        <span className="text-sm text-muted-foreground">{filtered.length} entries</span>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search action, entity, user..."
              className="pl-9 h-9"
            />
          </div>

          {/* Date From */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-1.5 h-9 text-sm", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, 'MMM d, yyyy') : 'From'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
                disabled={d => (dateTo ? d > dateTo : false)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {/* Date To */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-1.5 h-9 text-sm", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateTo ? format(dateTo, 'MMM d, yyyy') : 'To'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
                disabled={d => (dateFrom ? d < dateFrom : false)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {hasDateFilter && (
            <Button variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground" onClick={clearDates}>
              <X className="h-3.5 w-3.5" /> Clear dates
            </Button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 rounded-lg gradient-hyrox animate-pulse" />
          </div>
        ) : paged.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {logs.length === 0 ? 'No activity yet.' : 'No results match your filters.'}
          </p>
        ) : (
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, HH:mm')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.profiles?.full_name || (
                        <span className="font-mono text-xs text-muted-foreground">
                          {log.user_id?.slice(0, 8) ?? 'system'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{log.action}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.entity_type ? (
                        <span>{log.entity_type}{log.entity_id ? ` #${log.entity_id.slice(0, 6)}` : ''}</span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
