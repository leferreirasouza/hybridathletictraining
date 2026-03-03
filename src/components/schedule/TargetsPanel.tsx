import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Target, ChevronRight, Heart, Gauge, Zap, Footprints } from 'lucide-react';

interface TargetsPanelProps {
  targets: any[];
}

const typeIcons: Record<string, typeof Target> = {
  'Easy': Heart,
  'Z2': Heart,
  'Threshold': Gauge,
  'VO': Zap,
  'Hills': Zap,
  'Strides': Footprints,
  'HYROX': Target,
};

function getIcon(type: string) {
  for (const [key, Icon] of Object.entries(typeIcons)) {
    if (type.toLowerCase().includes(key.toLowerCase())) return Icon;
  }
  return Target;
}

export default function TargetsPanel({ targets }: TargetsPanelProps) {
  if (!targets || targets.length === 0) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Target className="h-3.5 w-3.5" />
          Targets
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Training Targets
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-3 mt-4 pb-6">
          {targets.map((t: any) => {
            const Icon = getIcon(t.type);
            return (
              <Card key={t.id} className="glass">
                <CardContent className="p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-medium">{t.type}</p>
                      <p className="text-xs text-muted-foreground">{t.primary_target}</p>
                      {t.secondary_guardrail && (
                        <p className="text-[11px] text-muted-foreground/70">⚠️ {t.secondary_guardrail}</p>
                      )}
                      {t.current_reference && (
                        <p className="text-[11px] text-blue-500">📊 {t.current_reference}</p>
                      )}
                      {t.usage_guide && (
                        <p className="text-[11px] text-muted-foreground mt-1">{t.usage_guide}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
