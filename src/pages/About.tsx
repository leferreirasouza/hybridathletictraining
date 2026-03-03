import { motion } from 'framer-motion';
import { Dumbbell, Target, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function About() {
  return (
    <div className="min-h-screen bg-background px-4 py-10 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-hyrox flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold">About Hybrid Athletics</h1>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Hybrid Athletics is the all-in-one training platform built for HYROX athletes and their coaches.
          We combine smart scheduling, AI-powered coaching insights, and detailed race analytics so you can
          train smarter, race faster, and track every step of your progress.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          {[
            { icon: Target, title: 'Mission', desc: 'Empower every hybrid athlete — from first-timer to elite — with the tools and data they need to reach their potential.' },
            { icon: Users, title: 'For Athletes & Coaches', desc: 'Whether you train solo or with a team, our platform connects athletes and coaches with shared plans, schedules, and performance data.' },
            { icon: Zap, title: 'AI-Driven Insights', desc: 'Our AI coach analyses your race results, training logs, and targets to deliver personalised recommendations.' },
            { icon: Dumbbell, title: 'Purpose-Built for HYROX', desc: 'Every feature — from station tracking to run splits — is designed around the unique demands of hybrid fitness racing.' },
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
