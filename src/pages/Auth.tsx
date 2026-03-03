import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Dumbbell, Mail, ArrowLeft } from 'lucide-react';

type View = 'auth' | 'check-email' | 'forgot-password' | 'forgot-sent';

export default function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [view, setView] = useState<View>('auth');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      navigate('/dashboard');
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      setView('check-email');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Enter your email address'); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setView('forgot-sent');
    }
    setLoading(false);
  };

  const Logo = () => (
    <div className="flex flex-col items-center mb-8">
      <div className="h-16 w-16 rounded-2xl gradient-hyrox flex items-center justify-center mb-4 shadow-lg">
        <Dumbbell className="h-8 w-8 text-primary-foreground" />
      </div>
      <h1 className="text-2xl font-display font-bold tracking-tight">Hybrid Athletics</h1>
      <p className="text-sm text-muted-foreground mt-1">Train smarter. Race faster.</p>
    </div>
  );

  // Check email confirmation screen
  if (view === 'check-email') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Logo />
          <Card className="glass">
            <CardContent className="p-8 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-display font-bold">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                We sent a verification link to <strong className="text-foreground">{email}</strong>. Click the link to activate your account.
              </p>
              <p className="text-xs text-muted-foreground">
                Didn't receive it? Check your spam folder or try again.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setView('auth')}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sign In
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Forgot password sent screen
  if (view === 'forgot-sent') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Logo />
          <Card className="glass">
            <CardContent className="p-8 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-display font-bold">Reset link sent</h2>
              <p className="text-sm text-muted-foreground">
                We sent a password reset link to <strong className="text-foreground">{email}</strong>.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setView('auth')}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sign In
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Forgot password form
  if (view === 'forgot-password') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Logo />
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg font-display">Reset Password</CardTitle>
              <CardDescription>Enter your email and we'll send a reset link</CardDescription>
            </CardHeader>
            <form onSubmit={handleForgotPassword}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input id="reset-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="athlete@hyrox.com" required />
                </div>
                <Button type="submit" className="w-full gradient-hyrox" disabled={loading}>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </Button>
                <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={() => setView('auth')}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sign In
                </Button>
              </CardContent>
            </form>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Main auth form
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Logo />
        <Card className="glass">
          <Tabs defaultValue="signin">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input id="signin-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="athlete@hyrox.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input id="signin-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full gradient-hyrox" disabled={loading}>
                    {loading ? 'Signing in…' : 'Sign In'}
                  </Button>
                  <Button type="button" variant="link" className="w-full text-sm text-muted-foreground" onClick={() => setView('forgot-password')}>
                    Forgot password?
                  </Button>
                </CardContent>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input id="signup-name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="athlete@hyrox.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
                  </div>
                  <Button type="submit" className="w-full gradient-hyrox" disabled={loading}>
                    {loading ? 'Creating account…' : 'Create Account'}
                  </Button>
                </CardContent>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
        <p className="text-xs text-center text-muted-foreground mt-4">
          By continuing, you agree to our{' '}
          <Link to="/terms" className="underline hover:text-foreground">Terms of Service</Link>{' '}
          and{' '}
          <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
        </p>
        <p className="text-xs text-center text-muted-foreground mt-2 space-x-2">
          <Link to="/about" className="underline hover:text-foreground">About</Link>
          <span>·</span>
          <Link to="/faq" className="underline hover:text-foreground">FAQ</Link>
          <span>·</span>
          <Link to="/contact" className="underline hover:text-foreground">Contact</Link>
        </p>
      </motion.div>
    </div>
  );
}
