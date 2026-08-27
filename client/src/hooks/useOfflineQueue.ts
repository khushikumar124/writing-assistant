import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * A durable outbox for captured thoughts.
 *
 * Capture is the one action that must never fail: the whole premise is that
 * catching a thought costs nothing, and "sorry, you were on the tube" breaks
 * that. Anything that can't reach the server is written to localStorage and
 * replayed when connectivity returns — or on the next visit, if the tab died
 * in the meantime.
 *
 * localStorage rather than IndexedDB is deliberate: the payloads are a few
 * hundred bytes, the API is synchronous (so a queued item is durable before
 * the handler returns), and it survives a hard reload.
 */

const STORAGE_KEY = "pending-captures";

export type PendingCapture = {
  /** Client-side id, so a replayed item can be removed without ambiguity. */
  id: string;
  content: string;
  tags: string[];
  capturedAt: number;
};

function read(): PendingCapture[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A corrupt queue shouldn't wedge capture forever.
    return [];
  }
}

function write(queue: PendingCapture[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function useOfflineQueue() {
  const [pending, setPending] = useState<PendingCapture[]>(() => read());
  const utils = trpc.useUtils();

  const createThought = trpc.thoughts.create.useMutation();

  const enqueue = useCallback(
    (capture: Omit<PendingCapture, "id" | "capturedAt">) => {
      const item: PendingCapture = {
        ...capture,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        capturedAt: Date.now(),
      };
      const next = [...read(), item];
      write(next);
      setPending(next);
      return item;
    },
    []
  );

  /** Replays the queue oldest-first, stopping at the first failure. */
  const flush = useCallback(async () => {
    const queue = read();
    if (queue.length === 0) return;

    const remaining = [...queue];
    let sent = 0;

    for (const item of queue) {
      try {
        await createThought.mutateAsync({
          content: item.content,
          tags: item.tags,
        });
        remaining.shift();
        sent += 1;
      } catch {
        // Still unreachable — keep this and everything after it for next time.
        break;
      }
    }

    write(remaining);
    setPending(remaining);

    if (sent > 0) {
      await Promise.all([
        utils.thoughts.list.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);
      toast.success(
        sent === 1
          ? "Synced a thought you caught offline."
          : `Synced ${sent} offline thoughts.`
      );
    }
  }, [createThought, utils]);

  // Flush on reconnect, and once on mount for anything left by a previous visit.
  useEffect(() => {
    void flush();

    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // `flush` is stable enough in practice; re-running on every mutation object
    // identity change would replay the queue on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { pending, enqueue, flush };
}
