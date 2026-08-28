import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { installGlobalErrorReporting } from "@/lib/reportError";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      // The session lives in an httpOnly cookie, so it has to ride along.
      fetch: (input, init) =>
        globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }),
    }),
  ],
});

installGlobalErrorReporting();

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

/**
 * Installability and the offline app shell. Registered after load so it never
 * competes with the first paint, and skipped in development where the dev
 * server's own module graph should win.
 */
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(error => {
      console.warn("Service worker registration failed:", error);
    });
  });
}
