import { motion } from 'framer-motion';
import { Dumbbell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Privacy() {
  const { t } = useTranslation();
  const s2items = t('privacy.s2items', { returnObjects: true }) as string[];
  const s5items = t('privacy.s5items', { returnObjects: true }) as string[];

  return (
    <div className="min-h-screen bg-background page-container py-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-hyrox flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold">{t('privacy.title')}</h1>
        </div>

        <p className="text-sm text-muted-foreground">{t('privacy.lastUpdated')}</p>

        <div className="prose prose-sm dark:prose-invert space-y-4 text-sm text-foreground">
          <h2 className="text-lg font-display font-bold">{t('privacy.s1title')}</h2>
          <p>{t('privacy.s1body')}</p>

          <h2 className="text-lg font-display font-bold">{t('privacy.s2title')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            {s2items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>

          <h2 className="text-lg font-display font-bold">{t('privacy.s3title')}</h2>
          <p>{t('privacy.s3body')}</p>

          <h2 className="text-lg font-display font-bold">{t('privacy.s4title')}</h2>
          <p>{t('privacy.s4body')}</p>

          <h2 className="text-lg font-display font-bold">{t('privacy.s5title')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            {s5items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>

          <h2 className="text-lg font-display font-bold">{t('privacy.s6title')}</h2>
          <p>{t('privacy.s6body')}</p>

          <h2 className="text-lg font-display font-bold">{t('privacy.s7title')}</h2>
          <p>{t('privacy.s7body')}</p>

          <h2 className="text-lg font-display font-bold">{t('privacy.s8title')}</h2>
          <p>{t('privacy.s8body')}</p>

          <h2 className="text-lg font-display font-bold">{t('privacy.s9title')}</h2>
          <p>{t('privacy.s9body')}</p>

          <h2 className="text-lg font-display font-bold">{t('privacy.s10title')}</h2>
          <p>{t('privacy.s10body')}</p>
        </div>
      </motion.div>
    </div>
  );
}
