import { useState, useRef, useCallback, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Download, Share2, Loader2, ImagePlus, Map } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CARD_SIZES, MAX_METRICS, type CardSize, type CardStyle, type MetricKey, type ShareSessionData } from './types';
import ShareCard, { metricValue } from './ShareCard';

import { useTranslation } from 'react-i18next';
const STYLES: { key: CardStyle; label: string }[] = [
  { key: 'bold', label: 'Bold' },
  { key: 'minimal', label: 'Minimal' },
  { key: 'neon', label: 'Neon' },
  { key: 'photo', label: 'Photo' },
];
const SIZES: { key: CardSize; label: string }[] = [
  { key: 'story', label: 'Story 9:16' },
  { key: 'feed', label: 'Feed 4:5' },
  { key: 'square', label: 'Square 1:1' },
];
const ALL_METRICS: { key: MetricKey; label: string }[] = [
  { key: 'distance', label: 'Distance' },
  { key: 'duration', label: 'Time' },
  { key: 'pace', label: 'Pace' },
  { key: 'hr', label: 'Avg HR' },
  { key: 'rpe', label: 'Effort' },
  { key: 'elevation', label: 'Elevation' },
  { key: 'calories', label: 'Calories' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ShareSessionData;
}

export default function ShareWorkoutDialog({ open, onOpenChange, session }: Props) {
  const { t } = useTranslation();
  const [style, setStyle] = useState<CardStyle>('bold');
  const [size, setSize] = useState<CardSize>('story');
  const [showName, setShowName] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Linked Strava route + extra metrics (only for completions that came from / were linked to Strava).
  const { data: strava } = useQuery({
    queryKey: ['share-strava', session.completedSessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('strava_activities' as any)
        .select('elevation_gain_m, raw')
        .eq('completed_session_id', session.completedSessionId!)
        .maybeSingle();
      const row = data as any;
      if (!row) return null;
      return {
        polyline: (row.raw?.map?.summary_polyline as string) || null,
        elevationM: row.elevation_gain_m != null ? Number(row.elevation_gain_m) : null,
        calories: row.raw?.calories != null ? Math.round(Number(row.raw.calories)) : null,
      };
    },
    enabled: open && !!session.completedSessionId,
  });

  const data: ShareSessionData = {
    ...session,
    elevationM: session.elevationM ?? strava?.elevationM ?? null,
    calories: session.calories ?? strava?.calories ?? null,
  };
  const available = ALL_METRICS.filter(m => metricValue(data, m.key));
  const [metrics, setMetrics] = useState<MetricKey[]>([]);

  useEffect(() => {
    setMetrics(prev => (prev.length ? prev.filter(k => metricValue(data, k)) : available.slice(0, MAX_METRICS).map(m => m.key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available.length]);

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  const toggleMetric = (k: MetricKey) => {
    setMetrics(prev => {
      if (prev.includes(k)) return prev.filter(x => x !== k);
      if (prev.length >= MAX_METRICS) { toast.info(`Up to ${MAX_METRICS} metrics`); return prev; }
      return [...prev, k];
    });
  };

  const onPhoto = (f?: File) => {
    if (!f) return;
    setPhotoUrl(URL.createObjectURL(f)); // stays on the device, never uploaded
    setStyle('photo');
  };

  const generateImage = useCallback(async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 3, useCORS: true, backgroundColor: null, logging: false });
      return new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png', 1));
    } catch {
      return null;
    }
  }, []);

  const fileName = `hybrid-session-${session.date}-${size}.png`;

  const handleDownload = async () => {
    setExporting(true);
    const blob = await generateImage();
    setExporting(false);
    if (!blob) { toast.error(t('auto.k189')); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
    toast.success(t('auto.k254'));
  };

  const handleShare = async () => {
    setExporting(true);
    const blob = await generateImage();
    setExporting(false);
    if (!blob) { toast.error(t('auto.k189')); return; }
    const file = new File([blob], fileName, { type: 'image/png' });
    try {
      await navigator.share({ title: t('auto.k314'), files: [file] });
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast.error(t('auto.k513'));
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare;
  const polyline = showRoute ? strava?.polyline ?? null : null;
  const { w, h } = CARD_SIZES[size];
  const previewScale = size === 'story' ? 0.6 : 0.75;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm sm:max-w-md p-0 overflow-hidden max-h-[92vh] overflow-y-auto">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="font-display text-base">{t('auto.k514')}</DialogTitle>
        </DialogHeader>

        <div className="flex justify-center px-4">
          <div style={{ width: w * previewScale, height: h * previewScale }}>
            <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
              <div ref={cardRef}>
                <ShareCard data={data} style={style} size={size} metrics={metrics} showName={showName} showDate={showDate} photoUrl={photoUrl} polyline={polyline} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          <Section title="Style">
            {STYLES.map(s => (
              <Chip key={s.key} active={style === s.key} onClick={() => (s.key === 'photo' && !photoUrl ? fileRef.current?.click() : setStyle(s.key))}>{s.label}</Chip>
            ))}
            <Chip active={false} onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-3 w-3 mr-1" /> {photoUrl ? 'Change photo' : 'Your photo'}
            </Chip>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => onPhoto(e.target.files?.[0])} />
          </Section>

          <Section title="Size">
            {SIZES.map(s => <Chip key={s.key} active={size === s.key} onClick={() => setSize(s.key)}>{s.label}</Chip>)}
          </Section>

          <Section title={`Metrics (up to ${MAX_METRICS})`}>
            {available.length ? available.map(m => (
              <Chip key={m.key} active={metrics.includes(m.key)} onClick={() => toggleMetric(m.key)}>{m.label}</Chip>
            )) : <span className="text-xs text-muted-foreground">{t('auto.k340')}</span>}
          </Section>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Toggle label={t('auto.k502')} checked={showName} onChange={setShowName} />
            <Toggle label="Date" checked={showDate} onChange={setShowDate} />
            {strava?.polyline && <Toggle label={<span className="flex items-center gap-1"><Map className="h-3 w-3" />  {t('auto.k456')}</span>} checked={showRoute} onChange={setShowRoute} />}
          </div>
        </div>

        <div className="flex gap-2 p-4 pt-0">
          <Button variant="outline" className="flex-1" onClick={handleDownload} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            
            {t('auto.k472')}
          </Button>
          {canNativeShare && (
            <Button className="flex-1 gradient-hyrox" onClick={handleShare} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
              Share
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Badge variant={active ? 'default' : 'outline'} className="cursor-pointer select-none px-2.5 py-1 flex items-center" onClick={onClick}>
      {children}
    </Badge>
  );
}

function Toggle({ label, checked, onChange }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
