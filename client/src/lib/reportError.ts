/**
 * Ships client-side crashes to the server log.
 *
 * Without this, a bug that breaks the page is invisible: the user closes the
 * tab and nobody learns anything. `keepalive` matters because the most useful
 * reports come from errors that also navigate or close the page.
 */
export function reportError(error: unknown, at?: string): void {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        stack,
        at: at ?? window.location.pathname + window.location.search,
      }),
      keepalive: true,
    }).catch(() => {
      // Reporting must never itself throw — the app is already broken.
    });
  } catch {
    /* ignore */
  }
}

/** Catches what React's error boundary cannot: async and event-handler throws. */
export function installGlobalErrorReporting(): void {
  window.addEventListener("error", event => {
    reportError(event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", event => {
    reportError(event.reason, "unhandledrejection");
  });
}
