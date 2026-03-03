import { useState } from 'react';
import { motion } from 'framer-motion';
import { Dumbbell, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Invalid email').max(255),
  category: z.enum(['support', 'feedback', 'bug', 'other']),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000),
});

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<string>('support');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse({ name, email, category, message });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      // Store the contact message in audit_logs as a lightweight approach
      const { error } = await supabase.from('audit_logs').insert({
        action: 'contact_form',
        entity_type: 'contact',
        details: { name: parsed.data.name, email: parsed.data.email, category: parsed.data.category, message: parsed.data.message },
      });
      if (error) throw error;
      setSent(true);
      toast.success('Message sent! We\'ll get back to you soon.');
    } catch {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl gradient-hyrox flex items-center justify-center mx-auto">
            <Send className="h-7 w-7 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-display font-bold">Message Sent!</h2>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">Thank you for reaching out. We'll respond within 24 hours.</p>
          <Button variant="outline" asChild>
            <Link to="/auth">← Back to Login</Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-hyrox flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold">Contact Us</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Get in Touch</CardTitle>
            <CardDescription>Send us a message for support, feedback, or bug reports.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required maxLength={100} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required maxLength={255} />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                    <SelectItem value="bug">Bug Report</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" value={message} onChange={e => setMessage(e.target.value)} placeholder="How can we help?" rows={5} required minLength={10} maxLength={2000} />
              </div>

              <Button type="submit" className="w-full gradient-hyrox" disabled={loading}>
                {loading ? 'Sending…' : 'Send Message'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link to="/auth">← Back to Login</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/faq">View FAQ</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
