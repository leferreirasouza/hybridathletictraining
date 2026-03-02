import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Check, AlertTriangle } from 'lucide-react';

const disciplines = [
  'Run', 'Bike', 'Row', 'SkiErg', 'Stairs',
  'Sled Push', 'Sled Pull', 'Burpee Broad Jumps', 'Farmers Carry',
  'Sandbag Lunges', 'Wall Balls', 'Strength', 'Mobility', 'Custom',
];

export default function LogSession() {
  const [discipline, setDiscipline] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [rpe, setRpe] = useState([6]);
  const [painFlag, setPainFlag] = useState(false);
  const [painNotes, setPainNotes] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Session logged! Great work 💪');
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <h1 className="text-xl font-display font-bold">Log Session</h1>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Discipline</Label>
              <Select value={discipline} onValueChange={setDiscipline}>
                <SelectTrigger><SelectValue placeholder="Select discipline" /></SelectTrigger>
                <SelectContent>
                  {disciplines.map(d => <SelectItem key={d} value={d.toLowerCase().replace(/ /g, '_')}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="45" />
              </div>
              <div className="space-y-2">
                <Label>Distance (km)</Label>
                <Input type="number" step="0.1" value={distance} onChange={e => setDistance(e.target.value)} placeholder="8.0" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Effort & Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>RPE (Rate of Perceived Exertion)</Label>
                <Badge variant="secondary" className="font-mono">{rpe[0]}/10</Badge>
              </div>
              <Slider value={rpe} onValueChange={setRpe} min={1} max={10} step={1} className="py-2" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <Label htmlFor="pain-flag" className="text-sm">Pain / Injury Flag</Label>
              </div>
              <Switch id="pain-flag" checked={painFlag} onCheckedChange={setPainFlag} />
            </div>

            {painFlag && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <Textarea
                  value={painNotes}
                  onChange={e => setPainNotes(e.target.value)}
                  placeholder="Describe the pain location and severity…"
                  rows={2}
                />
              </motion.div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="How did the session feel?" rows={3} />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full gradient-hyrox" size="lg">
          <Check className="h-4 w-4 mr-2" /> Log Session
        </Button>
      </motion.form>
    </div>
  );
}
