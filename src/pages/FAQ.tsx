import { motion } from 'framer-motion';
import { Dumbbell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useTranslation } from 'react-i18next';

export default function FAQ() {
  const { t } = useTranslation();
  const items = t('faq.items', { returnObjects: true }) as Array<{ q: string; a: string }>;

  return (
    <div className="min-h-screen bg-background page-container py-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-hyrox flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold">{t('faq.title')}</h1>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {items.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-sm">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" asChild>
            <Link to="/auth">{t('faq.backToLogin')}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/contact">{t('faq.contactUs')}</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
