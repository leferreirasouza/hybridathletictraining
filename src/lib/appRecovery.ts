// Recovery from a stale installed version of the app.
//
// The app is a PWA: a service worker precaches index.html and every JS chunk.
// After a republish the old chunk files no longer exist on the server, and a
// plain reload can be answered by the same stale service-worker cache, so the
// page keeps requesting files that 404 — which used to end in a dark screen.
// hardReload() drops the service worker and its caches before reloading, so
// the next load comes straight from the network.

const HARD_RELOAD_FLAG = "app-hard-reload";

export async function hardReload(): Promise<void> {
  try {
    sessionStorage.setItem(HARD_RELOAD_FLAG, "1");
  } catch {
    // Private mode / blocked storage: still try to recover.
  }
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } finally {
    window.location.reload();
  }
}

/** True once a hard reload already happened in this tab, to avoid reload loops. */
export function hardReloadAlreadyTried(): boolean {
  try {
    return sessionStorage.getItem(HARD_RELOAD_FLAG) === "1";
  } catch {
    return true;
  }
}

export function clearRecoveryFlags(): void {
  try {
    sessionStorage.removeItem(HARD_RELOAD_FLAG);
    sessionStorage.removeItem("chunk-reload");
  } catch {
    // ignore
  }
}

/** Errors thrown when a lazy-loaded page file can't be fetched. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk \d+ failed/i.test(
    message,
  );
}
