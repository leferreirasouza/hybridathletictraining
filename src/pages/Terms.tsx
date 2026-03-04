import { motion } from 'framer-motion';
import { Dumbbell } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background page-container py-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-hyrox flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold">Terms of Service</h1>
        </div>

        <p className="text-sm text-muted-foreground">Last updated: March 2026</p>

        <div className="prose prose-sm dark:prose-invert space-y-4 text-sm text-foreground">
          <h2 className="text-lg font-display font-bold">1. Acceptance of Terms</h2>
          <p>By accessing or using Hybrid Athletics ("the App"), you agree to be bound by these Terms of Service. If you do not agree, do not use the App.</p>

          <h2 className="text-lg font-display font-bold">2. Description of Service</h2>
          <p>Hybrid Athletics is a training management platform for athletes and coaches. The App provides tools for planning training sessions, logging workouts, analyzing performance, and communicating with coaches.</p>

          <h2 className="text-lg font-display font-bold">3. User Accounts</h2>
          <p>You must create an account to use the App. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.</p>

          <h2 className="text-lg font-display font-bold">4. User Content</h2>
          <p>You retain ownership of content you submit (workout logs, notes, race results). By submitting content, you grant us a limited license to store, process, and display it as part of the service.</p>

          <h2 className="text-lg font-display font-bold">5. Acceptable Use</h2>
          <p>You agree not to misuse the App, attempt to gain unauthorized access, or use the App for any unlawful purpose.</p>

          <h2 className="text-lg font-display font-bold">6. Disclaimer</h2>
          <p>The App provides training tools and suggestions but is not a substitute for professional medical or coaching advice. Use training plans and AI recommendations at your own risk.</p>

          <h2 className="text-lg font-display font-bold">7. Limitation of Liability</h2>
          <p>To the fullest extent permitted by law, Hybrid Athletics shall not be liable for any indirect, incidental, or consequential damages arising from your use of the App.</p>

          <h2 className="text-lg font-display font-bold">8. Changes to Terms</h2>
          <p>We may update these terms from time to time. Continued use of the App after changes constitutes acceptance of the new terms.</p>

          <h2 className="text-lg font-display font-bold">9. Contact</h2>
          <p>For questions about these terms, contact us through the App's support channels.</p>
        </div>
      </motion.div>
    </div>
  );
}
