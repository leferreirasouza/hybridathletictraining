import { motion } from 'framer-motion';
import { Dumbbell, Target, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

import { useTranslation } from 'react-i18next';
export default function About() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background page-container py-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-hyrox flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold">{t('auto.k19')}</h1>
        </div>

        <p className="text-lg font-medium text-foreground leading-relaxed">
          
          {t('auto.k373')}
        </p>

        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>
            
            {t('auto.k251')}
          </p>
          <p className="text-lg font-semibold text-foreground">{t('auto.k558')}</p>
          <p>
            
            {t('auto.k309')}
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-display font-bold text-foreground">{t('auto.k372')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Target, title: 'Engine', desc: t('auto.k47') },
              { icon: Zap, title: 'Speed', desc: t('auto.k567') },
              { icon: Dumbbell, title: 'Strength', desc: t('auto.k424') },
              { icon: Users, title: 'Resilience', desc: t('auto.k159') },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border bg-card p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <h2 className="font-display font-bold">{title}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>
            
            {t('auto.k253')}
          </p>
          <p className="font-medium text-foreground">
            
            {t('auto.k554')}
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" asChild>
            <Link to="/auth">{t('auto.k2')}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/contact">{t('auto.k122')}</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
