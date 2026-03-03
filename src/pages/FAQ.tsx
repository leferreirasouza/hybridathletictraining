import { motion } from 'framer-motion';
import { Dumbbell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const faqs = [
  { q: 'What is Hybrid Athletics?', a: 'Hybrid Athletics is a training platform purpose-built for HYROX athletes. It lets you plan sessions, log workouts, analyse race results, and get AI coaching — all in one place.' },
  { q: 'Is it free to use?', a: 'We offer a free tier that includes core scheduling and logging features. Premium features like AI coaching and advanced analytics are available on paid plans.' },
  { q: 'Can my coach see my training data?', a: 'Yes — when you join an organisation your assigned coach can view your schedule, completed sessions, and race results to give you personalised feedback.' },
  { q: 'How does the AI coach work?', a: 'Our AI analyses your race splits, training history, and targets to suggest session adjustments, pacing strategies, and areas for improvement.' },
  { q: 'Can I import my own training plan?', a: 'Absolutely. You can import plans via CSV/Excel through the Plan Builder, or have our AI generate one based on your goals and available training days.' },
  { q: 'Does it work offline?', a: 'Hybrid Athletics is a Progressive Web App (PWA). Once installed, key features like viewing your schedule are available offline.' },
  { q: 'How do I delete my account?', a: 'Go to Settings → Profile and select "Delete Account". All your data will be permanently removed. You can also contact us for assistance.' },
  { q: 'How do I contact support?', a: 'Visit our Contact page or email us directly. We aim to respond within 24 hours.' },
];

export default function FAQ() {
  return (
    <div className="min-h-screen bg-background px-4 py-10 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-hyrox flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold">Frequently Asked Questions</h1>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-sm">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" asChild>
            <Link to="/auth">← Back to Login</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/contact">Contact Us</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
