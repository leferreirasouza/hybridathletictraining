import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { storeCredential, retrieveCredential } from '@/hooks/useBiometricCredentials';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Dumbbell, Mail, ArrowLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from 'react-i18next';

type View = 'auth' | 'check-email' | 'forgot-password' | 'forgot-sent';

export default function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [view, setView] = useState<View>('auth');

  // Attempt biometric credential retrieval on mount
  useEffect(() => {
    retrieveCredential().then(async (cred) => {
      if (!cred) return;
      setEmail(cred.email);
      setPassword(cred.password);
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: cred.email,
        password: cred.password,
      });
      if (!error) {
        navigate('/dashboard');
      } else {
        toast.error(error.message);
      }
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      await storeCredential(email, password);
      navigate('/dashboard');
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error(error.message);
    } else if (data.session) {
      navigate('/onboarding');
    } else {
      setView('check-email');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error(t('auth.email')); return; }
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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast.error('Google sign-in failed: ' + (error as Error).message);
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast.error('Apple sign-in failed: ' + (error as Error).message);
      setLoading(false);
    }
  };

  const OAuthButtons = ({ action }: { action: 'in' | 'up' }) => (
    <>
      <div className="flex items-center gap-3 my-1">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">{t('auth.or')}</span>
        <Separator className="flex-1" />
      </div>
      <div className="space-y-2">
        <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
          <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {action === 'in' ? t('auth.signIn') : t('auth.signUp')} with Google
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={handleAppleSignIn} disabled={loading}>
          <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          {action === 'in' ? t('auth.signIn') : t('auth.signUp')} with Apple
        </Button>
      </div>
    </>
  );

  const Logo = () => (
    <div className="flex flex-col items-center mb-8">
      <div className="h-16 w-16 rounded-2xl gradient-hyrox flex items-center justify-center mb-4 shadow-lg">
        <Dumbbell className="h-8 w-8 text-primary-foreground" />
      </div>
      <h1 className="text-2xl font-display font-bold tracking-tight">{t('app.name')}</h1>
      <p className="text-sm text-muted-foreground mt-1">{t('app.tagline')}</p>
    </div>
  );

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
              <h2 className="text-lg font-display font-bold">{t('auth.checkEmail')}</h2>
              <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('auth.checkEmailDesc', { email }) }} />
              <p className="text-xs text-muted-foreground">{t('auth.checkEmailHint')}</p>
              <Button variant="outline" className="w-full" onClick={() => setView('auth')}>
                <ArrowLeft className="h-4 w-4 mr-2" /> {t('auth.backToSignIn')}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

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
              <h2 className="text-lg font-display font-bold">{t('auth.resetLinkSent')}</h2>
              <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('auth.resetLinkSentDesc', { email }) }} />
              <Button variant="outline" className="w-full" onClick={() => setView('auth')}>
                <ArrowLeft className="h-4 w-4 mr-2" /> {t('auth.backToSignIn')}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (view === 'forgot-password') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Logo />
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg font-display">{t('auth.resetPassword')}</CardTitle>
              <CardDescription>{t('auth.resetDesc')}</CardDescription>
            </CardHeader>
            <form onSubmit={handleForgotPassword}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">{t('auth.email')}</Label>
                  <Input id="reset-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="athlete@hyrox.com" required />
                </div>
                <Button type="submit" className="w-full gradient-hyrox" disabled={loading}>
                  {loading ? t('auth.sending') : t('auth.sendResetLink')}
                </Button>
                <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={() => setView('auth')}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> {t('auth.backToSignIn')}
                </Button>
              </CardContent>
            </form>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
        <Logo />
        <Card className="glass">
          <Tabs defaultValue="signin">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">{t('auth.signIn')}</TabsTrigger>
                <TabsTrigger value="signup">{t('auth.signUp')}</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">{t('auth.email')}</Label>
                    <Input id="signin-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="athlete@hyrox.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">{t('auth.password')}</Label>
                    <Input id="signin-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full gradient-hyrox" disabled={loading}>
                    {loading ? t('auth.signingIn') : t('auth.signIn')}
                  </Button>
                  <OAuthButtons action="in" />
                  <Button type="button" variant="link" className="w-full text-sm text-muted-foreground" onClick={() => setView('forgot-password')}>
                    {t('auth.forgotPassword')}
                  </Button>
                </CardContent>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">{t('auth.fullName')}</Label>
                    <Input id="signup-name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">{t('auth.email')}</Label>
                    <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="athlete@hyrox.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t('auth.password')}</Label>
                    <Input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
                  </div>
                  <Button type="submit" className="w-full gradient-hyrox" disabled={loading}>
                    {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
                  </Button>
                  <OAuthButtons action="up" />
                </CardContent>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
        <p className="text-xs text-center text-muted-foreground mt-4">
          {t('auth.agreeTerms')}{' '}
          <Link to="/terms" className="underline hover:text-foreground">{t('auth.termsOfService')}</Link>{' '}
          {t('auth.and')}{' '}
          <Link to="/privacy" className="underline hover:text-foreground">{t('auth.privacyPolicy')}</Link>.
        </p>
        <p className="text-xs text-center text-muted-foreground mt-2 space-x-2">
          <Link to="/about" className="underline hover:text-foreground">{t('auth.about')}</Link>
          <span>·</span>
          <Link to="/faq" className="underline hover:text-foreground">{t('auth.faq')}</Link>
          <span>·</span>
          <Link to="/contact" className="underline hover:text-foreground">{t('auth.contact')}</Link>
        </p>
      </motion.div>
    </div>
  );
}
