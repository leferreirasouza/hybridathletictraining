import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, Shield } from "lucide-react";

// Narrow local typing for the Supabase auth.oauth beta namespace.
type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function safeNext(path: string | null): string {
  // Only allow same-origin, relative paths like `/.lovable/oauth/consent?...`
  if (!path) return "/";
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const oauth = (supabase.auth as unknown as { oauth: OAuthNs }).oauth;
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message ?? String(error));
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const oauth = (supabase.auth as unknown as { oauth: OAuthNs }).oauth;
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message ?? String(error));
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl gradient-hyrox flex items-center justify-center mb-4 shadow-lg">
            <Dumbbell className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Hybrid Athletics</h1>
        </div>
        <Card className="glass">{children}</Card>
      </div>
    </div>
  );

  if (error) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle className="text-lg">Authorization error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Shell>
    );
  }

  if (!details) {
    return (
      <Shell>
        <CardContent className="p-8 text-center">Loading…</CardContent>
      </Shell>
    );
  }

  const clientName = details.client?.name ?? details.client?.client_name ?? "An external app";

  return (
    <Shell>
      <CardHeader>
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-lg font-display">Connect {clientName}?</CardTitle>
        <CardDescription>
          {clientName} is requesting access to your Hybrid Athletics account. It will be able to read your
          training data (planned sessions, completions, training load, goal race) as you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button className="w-full gradient-hyrox" disabled={busy} onClick={() => decide(true)}>
          Approve
        </Button>
        <Button className="w-full" variant="outline" disabled={busy} onClick={() => decide(false)}>
          Deny
        </Button>
      </CardContent>
    </Shell>
  );
}

// Exported so Auth.tsx can safely normalize the ?next= param.
export { safeNext };
