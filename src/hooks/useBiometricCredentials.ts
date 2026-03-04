/**
 * Hook to store & retrieve login credentials via the
 * Credential Management API.  On supported devices the
 * browser gates `.get()` behind Face ID / Touch ID /
 * device PIN, so the user gets a biometric prompt.
 */

declare global {
  interface Window {
    PasswordCredential: new (data: {
      id: string;
      password: string;
      name?: string;
    }) => PasswordCredential;
  }
  interface PasswordCredential extends Credential {
    password: string;
  }
}

const isSupported = () =>
  typeof window !== 'undefined' &&
  'credentials' in navigator &&
  typeof window.PasswordCredential !== 'undefined';

export async function storeCredential(email: string, password: string) {
  if (!isSupported()) return;
  try {
    const cred = new window.PasswordCredential({
      id: email,
      password,
      name: email,
    });
    await navigator.credentials.store(cred);
  } catch {
    // silently ignore – user may dismiss prompt
  }
}

export async function retrieveCredential(): Promise<{
  email: string;
  password: string;
} | null> {
  if (!isSupported()) return null;
  try {
    const cred = (await navigator.credentials.get({
      password: true,
      mediation: 'optional', // triggers biometric if available
    } as CredentialRequestOptions)) as PasswordCredential | null;
    if (cred?.id && cred.password) {
      return { email: cred.id, password: cred.password };
    }
  } catch {
    // user dismissed or API unavailable
  }
  return null;
}
