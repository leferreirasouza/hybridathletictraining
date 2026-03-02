import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Upload, FileSpreadsheet, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const disciplines = [
  'Run', 'Bike', 'Row', 'SkiErg', 'Stairs', 'Strength',
  'Sled Push', 'Sled Pull', 'Burpee Broad Jumps', 'Farmers Carry',
  'Sandbag Lunges', 'Wall Balls', 'Mobility', 'Custom',
];

interface SessionRow {
  id: string;
  day: number;
  discipline: string;
  name: string;
  duration: string;
  distance: string;
  intensity: string;
  details: string;
  notes: string;
}

const emptyRow = (): SessionRow => ({
  id: crypto.randomUUID(),
  day: 1,
  discipline: '',
  name: '',
  duration: '',
  distance: '',
  intensity: '',
  details: '',
  notes: '',
});

export default function PlanBuilder() {
  const [planName, setPlanName] = useState('');
  const [weekCount, setWeekCount] = useState(1);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [sessions, setSessions] = useState<SessionRow[]>([emptyRow()]);

  const addRow = () => setSessions(prev => [...prev, emptyRow()]);
  const removeRow = (id: string) => setSessions(prev => prev.filter(s => s.id !== id));
  const updateRow = (id: string, field: keyof SessionRow, value: string | number) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        toast.info(`Importing ${file.name}… (file parsing coming with edge function)`);
      }
    };
    input.click();
  };

  const handleSave = () => {
    if (!planName.trim()) {
      toast.error('Please enter a plan name');
      return;
    }
    toast.success('Plan saved! (will persist with database)');
  };

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-bold">Plan Builder</h1>
        <Button variant="outline" size="sm" onClick={handleImport}>
          <Upload className="h-4 w-4 mr-1" /> Import
        </Button>
      </div>

      <Tabs defaultValue="build">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="build">Build from Scratch</TabsTrigger>
          <TabsTrigger value="import">Import File</TabsTrigger>
        </TabsList>

        <TabsContent value="build" className="mt-4 space-y-4">
          <Card className="glass">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Plan Name</Label>
                  <Input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="HYROX 12-Week Prep" />
                </div>
                <div className="space-y-2">
                  <Label>Total Weeks</Label>
                  <Input type="number" min={1} max={52} value={weekCount} onChange={e => setWeekCount(Number(e.target.value))} />
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {Array.from({ length: weekCount }, (_, i) => (
                  <Button
                    key={i}
                    variant={currentWeek === i + 1 ? 'default' : 'outline'}
                    size="sm"
                    className={currentWeek === i + 1 ? 'gradient-hyrox' : ''}
                    onClick={() => setCurrentWeek(i + 1)}
                  >
                    W{i + 1}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Week {currentWeek} Sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sessions.map((row, idx) => (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Session {idx + 1}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(row.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Day</Label>
                      <Select value={String(row.day)} onValueChange={v => updateRow(row.id, 'day', Number(v))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                            <SelectItem key={i} value={String(i + 1)}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Discipline</Label>
                      <Select value={row.discipline} onValueChange={v => updateRow(row.id, 'discipline', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {disciplines.map(d => <SelectItem key={d} value={d.toLowerCase().replace(/ /g, '_')}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Session Name</Label>
                      <Input className="h-8 text-xs" value={row.name} onChange={e => updateRow(row.id, 'name', e.target.value)} placeholder="Tempo Run" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Duration (min)</Label>
                      <Input className="h-8 text-xs" type="number" value={row.duration} onChange={e => updateRow(row.id, 'duration', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Distance (km)</Label>
                      <Input className="h-8 text-xs" type="number" step="0.1" value={row.distance} onChange={e => updateRow(row.id, 'distance', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Intensity</Label>
                      <Select value={row.intensity} onValueChange={v => updateRow(row.id, 'intensity', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {['Easy', 'Moderate', 'Hard', 'Race Pace', 'Max Effort'].map(i => (
                            <SelectItem key={i} value={i.toLowerCase().replace(/ /g, '_')}>{i}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Workout Details</Label>
                    <Textarea className="text-xs min-h-[40px]" rows={1} value={row.details} onChange={e => updateRow(row.id, 'details', e.target.value)} placeholder="8km @ 5:00/km..." />
                  </div>
                </motion.div>
              ))}

              <Button variant="outline" className="w-full" onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" /> Add Session
              </Button>
            </CardContent>
          </Card>

          <Button className="w-full gradient-hyrox" size="lg" onClick={handleSave}>
            Save Plan
          </Button>
        </TabsContent>

        <TabsContent value="import" className="mt-4">
          <Card className="glass">
            <CardContent className="p-8 text-center space-y-4">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-primary" />
              <div>
                <p className="font-display font-bold">Import from Spreadsheet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload your CSV or XLSX file matching the HYROX template format
                </p>
              </div>
              <Button className="gradient-hyrox" onClick={handleImport}>
                <Upload className="h-4 w-4 mr-2" /> Choose File
              </Button>
              <p className="text-xs text-muted-foreground">
                Supports: Plan (Daily), Weekly Summary, Targets, Garmin Workouts sheets
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
