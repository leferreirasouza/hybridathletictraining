import { useState, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ShareSessionData, CardStyle } from './types';
import ShareCardBold from './ShareCardBold';
import ShareCardMinimal from './ShareCardMinimal';
import ShareCardNeon from './ShareCardNeon';

const STYLES: { key: CardStyle; label: string }[] = [
  { key: 'bold', label: 'Bold' },
  { key: 'minimal', label: 'Minimal' },
  { key: 'neon', label: 'Neon' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ShareSessionData;
}

export default function ShareWorkoutDialog({ open, onOpenChange, session }: Props) {
  const [style, setStyle] = useState<CardStyle>('bold');
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare;

  const generateImage = useCallback(async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png', 1);
      });
    } catch {
      return null;
    }
  }, []);

  const handleDownload = async () => {
    setExporting(true);
    const blob = await generateImage();
    setExporting(false);
    if (!blob) { toast.error('Failed to generate image'); return; }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hybrid-session-${session.date}.png`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Image downloaded!');
  };

  const handleShare = async () => {
    setExporting(true);
    const blob = await generateImage();
    setExporting(false);
    if (!blob) { toast.error('Failed to generate image'); return; }

    const file = new File([blob], `hybrid-session-${session.date}.png`, { type: 'image/png' });
    try {
      await navigator.share({
        title: 'My Training Session — Hybrid Athletics',
        text: `Just crushed a ${session.discipline} session! 💪`,
        files: [file],
      });
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast.error('Share failed');
    }
  };

  const CardComponent = style === 'bold' ? ShareCardBold : style === 'minimal' ? ShareCardMinimal : ShareCardNeon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="font-display text-base">Share Your Workout</DialogTitle>
        </DialogHeader>

        {/* Style selector */}
        <div className="flex gap-2 px-4">
          {STYLES.map((s) => (
            <Badge
              key={s.key}
              variant={style === s.key ? 'default' : 'outline'}
              className="cursor-pointer select-none px-3 py-1"
              onClick={() => setStyle(s.key)}
            >
              {s.label}
            </Badge>
          ))}
        </div>

        {/* Card preview */}
        <div className="flex justify-center px-4 py-3 overflow-auto">
          <div className="transform scale-[0.75] origin-top" ref={cardRef}>
            <CardComponent data={session} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 pt-0">
          <Button variant="outline" className="flex-1" onClick={handleDownload} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Save Image
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
