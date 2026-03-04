import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Flag, MapPin, Calendar, Plus, ExternalLink, Trophy, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface Race {
  id: string;
  race_type: string;
  race_name: string;
  race_date: string;
  race_end_date?: string;
  city?: string;
  country: string;
  continent?: string;
  external_url?: string;
  source: string;
}

interface RacePickerProps {
  onSelect: (race: Race) => void;
  selectedRaceId?: string;
}

const RACE_TYPE_LABELS: Record<string, string> = {
  hyrox: 'HYROX',
  '5k': '5K',
  '10k': '10K',
  '21k': 'Half Marathon',
  marathon: 'Marathon',
  other: 'Other',
};

const RACE_TYPE_COLORS: Record<string, string> = {
  hyrox: 'bg-primary/20 text-primary',
  '5k': 'bg-green-500/20 text-green-400',
  '10k': 'bg-blue-500/20 text-blue-400',
  '21k': 'bg-purple-500/20 text-purple-400',
  marathon: 'bg-amber-500/20 text-amber-400',
  other: 'bg-muted text-muted-foreground',
};

const COUNTRIES = [
  'All', 'Argentina', 'Australia', 'Belgium', 'Brazil', 'Canada', 'China',
  'Denmark', 'Finland', 'France', 'Germany', 'Hong Kong', 'India', 'Indonesia',
  'Italy', 'Latvia', 'Mexico', 'Netherlands', 'Poland', 'Portugal', 'Singapore',
  'South Africa', 'South Korea', 'Spain', 'Sweden', 'Thailand',
  'United Kingdom', 'USA',
];

export default function RacePicker({ onSelect, selectedRaceId }: RacePickerProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('All');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customRace, setCustomRace] = useState({
    race_name: '', race_type: 'other', race_date: '', city: '', country: 'Brazil',
  });

  const { data: races = [], refetch } = useQuery({
    queryKey: ['races-calendar'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('races_calendar')
        .select('*')
        .gte('race_date', new Date().toISOString().split('T')[0])
        .order('race_date', { ascending: true });
      if (error) throw error;
      return (data || []) as Race[];
    },
  });

  const filtered = useMemo(() => {
    return races.filter((r: Race) => {
      if (typeFilter !== 'all' && r.race_type !== typeFilter) return false;
      if (countryFilter !== 'All' && r.country !== countryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.race_name.toLowerCase().includes(q) ||
          (r.city?.toLowerCase().includes(q)) ||
          r.country.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [races, typeFilter, countryFilter, search]);

  const handleSelectRace = (race: Race) => {
    onSelect(race);
    setOpen(false);
  };

  const handleCreateCustom = async () => {
    if (!customRace.race_name.trim() || !customRace.race_date) {
      toast.error(t('racePicker.fillRequired'));
      return;
    }
    const { data, error } = await (supabase as any).from('races_calendar').insert({
      race_name: customRace.race_name.trim(),
      race_type: customRace.race_type,
      race_date: customRace.race_date,
      city: customRace.city.trim() || null,
      country: customRace.country,
      source: 'user',
      created_by: user?.id,
      is_verified: false,
    } as any).select().single();

    if (error) {
      toast.error('Failed to create race');
      return;
    }
    toast.success(t('racePicker.raceCreated'));
    refetch();
    setShowCustomForm(false);
    if (data) handleSelectRace(data as any);
  };

  const selectedRace = races.find(r => r.id === selectedRaceId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start h-auto py-2 text-left">
          {selectedRace ? (
            <div className="flex items-center gap-2 min-w-0">
              <Trophy className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{selectedRace.race_name}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(selectedRace.race_date + 'T00:00:00'), 'MMM d, yyyy')} · {selectedRace.city || selectedRace.country}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Search className="h-4 w-4" />
              <span className="text-sm">{t('racePicker.searchRaces')}</span>
            </div>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="font-display">{t('racePicker.findRace')}</DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="px-4 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('racePicker.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(RACE_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Race List */}
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-1.5 py-2">
            {filtered.length === 0 && !showCustomForm && (
              <div className="text-center py-8 space-y-3">
                <p className="text-sm text-muted-foreground">{t('racePicker.noRacesFound')}</p>
                <Button variant="outline" size="sm" onClick={() => setShowCustomForm(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> {t('racePicker.addCustom')}
                </Button>
              </div>
            )}
            {filtered.map((race: Race) => (
              <button
                key={race.id}
                onClick={() => handleSelectRace(race)}
                className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-accent/50 ${
                  selectedRaceId === race.id ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 shrink-0 ${RACE_TYPE_COLORS[race.race_type] || RACE_TYPE_COLORS.other}`}>
                        {RACE_TYPE_LABELS[race.race_type] || race.race_type}
                      </Badge>
                      <p className="text-sm font-medium truncate">{race.race_name}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(race.race_date + 'T00:00:00'), 'MMM d, yyyy')}
                      </span>
                      {race.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {race.city}, {race.country}
                        </span>
                      )}
                    </div>
                  </div>
                  {race.external_url && (
                    <a
                      href={race.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-muted-foreground hover:text-primary shrink-0 mt-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Custom Race Form / Add Button */}
        <div className="border-t p-4">
          {showCustomForm ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">{t('racePicker.createCustomRace')}</p>
              <Input
                placeholder={t('racePicker.raceNamePlaceholder')}
                value={customRace.race_name}
                onChange={e => setCustomRace(f => ({ ...f, race_name: e.target.value }))}
                className="h-8"
              />
              <div className="grid grid-cols-2 gap-2">
                <Select value={customRace.race_type} onValueChange={v => setCustomRace(f => ({ ...f, race_type: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(RACE_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={customRace.race_date}
                  onChange={e => setCustomRace(f => ({ ...f, race_date: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="City"
                  value={customRace.city}
                  onChange={e => setCustomRace(f => ({ ...f, city: e.target.value }))}
                  className="h-8 text-xs"
                />
                <Select value={customRace.country} onValueChange={v => setCustomRace(f => ({ ...f, country: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.filter(c => c !== 'All').map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCustomForm(false)}>{t('profile.cancel')}</Button>
                <Button size="sm" className="gradient-hyrox" onClick={handleCreateCustom}>{t('racePicker.createRace')}</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowCustomForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> {t('racePicker.cantFindRace')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
