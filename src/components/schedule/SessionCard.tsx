import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { getDiscipline, intensityConfig, dayLabelsFull } from './config';
import { Clock, MapPin, ChevronRight, Flame, Check, CheckCircle2, CalendarPlus, ArrowLeftRight } from 'lucide-react';
import { SwapSessionDialog } from './SwapSessionDialog';
import { addToCalendar, CalendarProvider } from '@/lib/calendarExport';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Session {
  id: string;
  session_name: string;
  discipline: string;
  day_of_week: number;
  week_number: number;
  duration_min?: number | null;
  distance_km?: number | null;
  intensity?: string | null;
  workout_details?: string | null;
  notes?: string | null;
  date?: string | null;
  _planName?: string;
  _planColor?: string;
}

interface Substitution {
  id: string;
  substitute_session_name: string;
  substitute_discipline: string;
  substitute_duration_min?: number | null;
  substitute_workout_details?: string | null;
  substitute_notes?: string | null;
  status: string;
  reason: string;
  source: string;
}

export function SessionCard({ session, showDay = true, isCompleted = false, substitution }: { session: Session; showDay?: boolean; isCompleted?: boolean; substitution?: Substitution | null }) {
  const disc = getDiscipline(session.discipline);
  const IntIcon = disc.icon;
  const intConf = session.intensity ? intensityConfig[session.intensity] : null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="cursor-pointer"
        >
          <Card className={`glass hover:border-primary/30 transition-all group ${isCompleted ? 'border-success/30 bg-success/5' : ''} ${substitution?.status === 'active' ? 'border-primary/30 bg-primary/5' : ''} ${substitution?.status === 'pending_coach' ? 'border-amber-500/30 bg-amber-500/5' : ''}`}>
            <CardContent className="p-3.5">
              <div className="flex items-start gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isCompleted ? 'bg-success/15 text-success' : disc.color}`}>
                  {isCompleted ? <CheckCircle2 className="h-4.5 w-4.5" /> : <IntIcon className="h-4.5 w-4.5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-medium truncate ${isCompleted ? 'line-through text-muted-foreground' : ''} ${substitution?.status === 'active' ? 'line-through text-muted-foreground' : ''}`}>
                      {substitution?.status === 'active' ? substitution.substitute_session_name : session.session_name}
                    </p>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {showDay && (
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {dayLabelsFull[session.day_of_week - 1]}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">{disc.label}</span>
                    {session.duration_min && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />{session.duration_min}′
                      </span>
                    )}
                    {session.distance_km && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />{session.distance_km}km
                      </span>
                    )}
                    {isCompleted && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-success/30 text-success">Done</Badge>
                    )}
                    {substitution?.status === 'active' && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/30 text-primary">Swapped</Badge>
                    )}
                    {substitution?.status === 'pending_coach' && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/30 text-amber-500">Pending</Badge>
                    )}
                    {session._planName && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 shrink-0"
                        style={{
                          borderColor: session._planColor ? `${session._planColor}40` : undefined,
                          color: session._planColor || undefined,
                        }}
                      >
                        {session._planName}
                      </Badge>
                    )}
                  </div>
                </div>

                {intConf && (
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 shrink-0 border ${intConf.class}`}>
                    {intConf.label}
                  </Badge>
                )}
              </div>

              {session.workout_details && (
                <p className="text-[11px] text-muted-foreground mt-2 pl-12 line-clamp-2">
                  {session.workout_details}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </SheetTrigger>

      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SessionDetailSheet session={session} isCompleted={isCompleted} substitution={substitution} />
      </SheetContent>
    </Sheet>
  );
}

function QuickLogButton({ session }: { session: Session }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState(session.duration_min ? String(session.duration_min) : '');
  const [distance, setDistance] = useState(session.distance_km ? String(session.distance_km) : '');
  const [rpe, setRpe] = useState([6]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) { toast.error('Not logged in'); return; }
    setSaving(true);
    const { error } = await supabase.from('completed_sessions').insert({
      athlete_id: user.id,
      planned_session_id: session.id,
      discipline: session.discipline as any,
      actual_duration_min: duration ? parseFloat(duration) : null,
      actual_distance_km: distance ? parseFloat(distance) : null,
      rpe: rpe[0],
      notes: notes || null,
    });
    setSaving(false);
    if (error) {
      toast.error('Failed to log: ' + error.message);
    } else {
      toast.success('Session logged! 💪');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['completed-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-completed'] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full gradient-hyrox" size="lg">
          <Check className="h-4 w-4 mr-2" /> Mark as Complete
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Log: {session.session_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Duration (min)</Label>
              <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="45" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Distance (km)</Label>
              <Input type="number" step="0.1" value={distance} onChange={e => setDistance(e.target.value)} placeholder="8.0" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">RPE</Label>
              <Badge variant="secondary" className="font-mono text-xs">{rpe[0]}/10</Badge>
            </div>
            <Slider value={rpe} onValueChange={setRpe} min={1} max={10} step={1} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="How did it go?" rows={2} />
          </div>
          <Button className="w-full gradient-hyrox" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SessionDetailSheet({ session, isCompleted, substitution }: { session: Session; isCompleted?: boolean; substitution?: Substitution | null }) {
  const disc = getDiscipline(session.discipline);
  const IntIcon = disc.icon;
  const intConf = session.intensity ? intensityConfig[session.intensity] : null;

  return (
    <div className="space-y-5 pb-6">
      <SheetHeader>
        <div className="flex items-center gap-3">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${disc.color}`}>
            <IntIcon className="h-5 w-5" />
          </div>
          <div>
            <SheetTitle className="text-left font-display">{session.session_name}</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dayLabelsFull[session.day_of_week - 1]} · Week {session.week_number}
              {session.date && ` · ${session.date}`}
            </p>
          </div>
        </div>
      </SheetHeader>

      {/* Meta row */}
      <div className="flex gap-3 flex-wrap">
        <MetaPill icon={<IntIcon className="h-3.5 w-3.5" />} label={disc.label} />
        {session.duration_min && <MetaPill icon={<Clock className="h-3.5 w-3.5" />} label={`${session.duration_min} min`} />}
        {session.distance_km && <MetaPill icon={<MapPin className="h-3.5 w-3.5" />} label={`${session.distance_km} km`} />}
        {intConf && (
          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${intConf.class}`}>
            <Flame className="h-3 w-3" />
            {intConf.label}
          </span>
        )}
      </div>

      {/* Workout Details */}
      {session.workout_details && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Workout</h3>
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{session.workout_details}</p>
          </div>
        </div>
      )}

      {/* Notes */}
      {session.notes && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</h3>
          <p className="text-sm text-muted-foreground">{session.notes}</p>
        </div>
      )}

      {/* Substitution info */}
      {substitution?.status === 'active' && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1">
            <ArrowLeftRight className="h-3 w-3" /> Swapped Session
          </h3>
          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20">
            <p className="text-sm font-medium">{substitution.substitute_session_name}</p>
            {substitution.substitute_workout_details && (
              <p className="text-sm whitespace-pre-wrap leading-relaxed mt-2">{substitution.substitute_workout_details}</p>
            )}
            {substitution.substitute_notes && (
              <p className="text-xs text-muted-foreground italic mt-2">💡 {substitution.substitute_notes}</p>
            )}
          </div>
        </div>
      )}

      {substitution?.status === 'pending_coach' && (
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-center">
          <p className="text-sm text-amber-500 font-medium">⏳ Swap pending coach approval</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {!isCompleted && <QuickLogButton session={session} />}
        {isCompleted && (
          <div className="flex items-center justify-center gap-2 text-success text-sm py-2">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Completed</span>
          </div>
        )}
        {!isCompleted && !substitution && <SwapSessionDialog session={session} />}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full">
              <CalendarPlus className="h-4 w-4 mr-2" /> Add to Calendar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48">
            <DropdownMenuItem onClick={() => addToCalendar('google', session)}>
              Google Calendar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addToCalendar('outlook', session)}>
              Outlook Calendar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addToCalendar('apple', session)}>
              Apple Calendar (.ics)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function MetaPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground">
      {icon}{label}
    </span>
  );
}
