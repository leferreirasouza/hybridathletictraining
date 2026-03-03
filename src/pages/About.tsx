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

        <p className="text-lg font-medium text-foreground leading-relaxed">
          Our mission is simple: make runners stronger and strength athletes faster — without forcing anyone to choose.
        </p>

        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>
            I'm a hybrid athlete because I refuse the trade-off. I love the simplicity of running — and I love the craft of getting stronger. But most athletes are pushed into a false choice: get fast and feel fragile, or get strong and feel slow.
          </p>
          <p className="text-lg font-semibold text-foreground">This platform exists to end that trade-off.</p>
          <p>
            Most training plans live in extremes — either endurance-only or strength-only. Real performance lives in the middle, where the engine, the muscles, and the connective tissue are trained together with intention. We don't just add running to lifting or lifting to running. We program the combination — sequencing that preserves quality, progressions that respect recovery, and measurable benchmarks that show you're getting better.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-display font-bold text-foreground">Our method is built on four pillars:</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Target, title: 'Engine', desc: 'Aerobic development and durability, with smart use of low-impact conditioning when needed.' },
              { icon: Zap, title: 'Speed', desc: 'Threshold and efficiency work that makes pace sustainable, not just possible.' },
              { icon: Dumbbell, title: 'Strength', desc: 'Progressive strength and power that support performance and protect the body.' },
              { icon: Users, title: 'Resilience', desc: 'Durability work that keeps you training consistently and reduces injury risk.' },
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
            If you're a runner who wants power and durability, we'll build your strength without stealing your speed. If you're a strength athlete who wants to run fast, we'll build your engine while protecting your joints and performance. And if you're somewhere in between — we'll make you better at both, in a coherent system you can sustain.
          </p>
          <p className="font-medium text-foreground">
            This isn't random "do everything" training. It's a method for athletes who want to perform — across disciplines, across seasons, for the long run.
          </p>
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
