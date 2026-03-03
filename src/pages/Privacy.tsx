import { motion } from 'framer-motion';
import { Dumbbell } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background px-4 py-10 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-hyrox flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold">Privacy Policy</h1>
        </div>

        <p className="text-sm text-muted-foreground">Last updated: March 2026</p>

        <div className="prose prose-sm dark:prose-invert space-y-4 text-sm text-foreground">
          <h2 className="text-lg font-display font-bold">1. Information We Collect</h2>
          <p>We collect information you provide directly: name, email address, training data (workout logs, race results, session notes), and preferences. We also collect usage data such as app interactions and device information.</p>

          <h2 className="text-lg font-display font-bold">2. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide, maintain, and improve the training platform</li>
            <li>Generate personalized training insights and AI coaching</li>
            <li>Enable coach-athlete collaboration within your organization</li>
            <li>Send training reminders and notifications (with your consent)</li>
          </ul>

          <h2 className="text-lg font-display font-bold">3. Data Sharing</h2>
          <p>Your training data is shared only with coaches within your organization. We do not sell personal information to third parties. We may share anonymized, aggregated data for research purposes.</p>

          <h2 className="text-lg font-display font-bold">4. Data Storage & Security</h2>
          <p>Your data is stored securely using industry-standard encryption. We use row-level security to ensure you can only access your own data (or data you've been granted access to as a coach).</p>

          <h2 className="text-lg font-display font-bold">5. Your Rights</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access and export your personal data</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Withdraw consent for notifications at any time</li>
          </ul>

          <h2 className="text-lg font-display font-bold">6. Cookies & Local Storage</h2>
          <p>We use local storage to save your preferences (theme, units, notification settings). We use essential cookies for authentication. We do not use advertising or tracking cookies.</p>

          <h2 className="text-lg font-display font-bold">7. Third-Party Services</h2>
          <p>The App integrates with Google Calendar (optional, user-initiated). When you export sessions, data is shared with Google per their privacy policy.</p>

          <h2 className="text-lg font-display font-bold">8. Children's Privacy</h2>
          <p>The App is not intended for users under 16. We do not knowingly collect data from children.</p>

          <h2 className="text-lg font-display font-bold">9. Changes to This Policy</h2>
          <p>We may update this policy periodically. We will notify you of significant changes via the App.</p>

          <h2 className="text-lg font-display font-bold">10. Contact</h2>
          <p>For privacy-related inquiries, contact us through the App's support channels.</p>
        </div>
      </motion.div>
    </div>
  );
}
