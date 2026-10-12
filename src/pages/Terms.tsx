import { motion } from 'framer-motion';
import { Dumbbell } from 'lucide-react';

import { useTranslation } from 'react-i18next';
export default function Terms() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background page-container py-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-hyrox flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold">{t('auto.k548')}</h1>
        </div>

        <p className="text-sm text-muted-foreground">{t('auto.k278')}</p>

        <div className="prose prose-sm dark:prose-invert space-y-4 text-sm text-foreground">
          <h2 className="text-lg font-display font-bold">{t('auto.k6')}</h2>
          <p>{t('auto.k101')}</p>

          <h2 className="text-lg font-display font-bold">{t('auto.k7')}</h2>
          <p>{t('auto.k248')}</p>

          <h2 className="text-lg font-display font-bold">{t('auto.k8')}</h2>
          <p>{t('auto.k647')}</p>

          <h2 className="text-lg font-display font-bold">{t('auto.k10')}</h2>
          <p>You retain ownership of content you submit (workout logs, notes, race results). By submitting content, you grant us a limited license to store, process, and display it as part of the service.</p>

          <h2 className="text-lg font-display font-bold">{t('auto.k11')}</h2>
          <p>{t('auto.k644')}</p>

          <h2 className="text-lg font-display font-bold">{t('auto.k12')}</h2>
          <p>{t('auto.k552')}</p>

          <h2 className="text-lg font-display font-bold">{t('auto.k14')}</h2>
          <p>{t('auto.k573')}</p>

          <h2 className="text-lg font-display font-bold">{t('auto.k17')}</h2>
          <p>{t('auto.k612')}</p>

          <h2 className="text-lg font-display font-bold">{t('auto.k18')}</h2>
          <p>{t('auto.k207')}</p>
        </div>
      </motion.div>
    </div>
  );
}
