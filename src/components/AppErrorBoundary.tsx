import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '@/i18n';
import { hardReload, isChunkLoadError } from '@/lib/appRecovery';

interface Props {
  children: ReactNode;
  /** Compact card inside the app layout instead of a full-screen panel. */
  inline?: boolean;
}

interface State {
  error: Error | null;
}

// i18n itself may be what failed, so every string has an English fallback.
const tr = (key: string, fallback: string) => {
  try {
    return i18n.t(key, { defaultValue: fallback }) as string;
  } catch {
    return fallback;
  }
};

/**
 * Without this, any exception while rendering unmounts the whole React tree
 * and leaves only the dark page background. This shows what went wrong and
 * offers a reload that also clears a stale offline copy of the app.
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error boundary caught:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const stale = isChunkLoadError(error);
    return (
      <div
        className={
          this.props.inline
            ? 'p-4 flex justify-center'
            : 'min-h-screen bg-background text-foreground flex items-center justify-center p-4'
        }
      >
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 space-y-3 shadow-sm">
          <p className="text-base font-semibold">
            {stale
              ? tr('appError.staleTitle', 'A new version of the app is available')
              : tr('appError.title', 'Something went wrong')}
          </p>
          <p className="text-sm text-muted-foreground">
            {stale
              ? tr('appError.staleBody', 'Reload to get the latest version.')
              : tr('appError.body', 'This page hit an error. Reloading usually fixes it. If it keeps happening, send us a screenshot of this message.')}
          </p>
          {!stale && (
            <pre className="text-[11px] whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-muted-foreground max-h-40 overflow-auto">
              {error.message || String(error)}
            </pre>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
              onClick={() => void hardReload()}
            >
              {tr('appError.reload', 'Reload app')}
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-sm"
              onClick={() => window.location.assign('/')}
            >
              {tr('appError.home', 'Go to dashboard')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
