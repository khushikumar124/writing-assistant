import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useState } from "react";

/**
 * Subscribing this browser to reminders.
 *
 * Permission belongs to the browser and can only be requested from a user
 * gesture, so this is a hook the settings page drives rather than something
 * that runs on load — a site that asks for notification permission the moment
 * you arrive is the reason people block notifications by reflex.
 */

/**
 * The VAPID key travels as base64url and the browser wants bytes. Backed by an
 * explicit ArrayBuffer because `applicationServerKey` will not accept a view
 * over a possibly-shared buffer.
 */
function urlBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );
  const normalised = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);

  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index++) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

export type PushState =
  "unsupported" | "unconfigured" | "denied" | "off" | "on" | "working";

export function usePushSubscription() {
  const [state, setState] = useState<PushState>("working");
  const utils = trpc.useUtils();

  const { data: config } = trpc.reminders.config.useQuery();
  const subscribe = trpc.reminders.subscribe.useMutation();
  const unsubscribe = trpc.reminders.unsubscribe.useMutation();

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  /** Reads the browser's current truth rather than trusting stored state. */
  const refresh = useCallback(async () => {
    if (!supported) return setState("unsupported");
    if (config && !config.enabled) return setState("unconfigured");
    if (Notification.permission === "denied") return setState("denied");

    const registration = await navigator.serviceWorker.getRegistration();
    const existing = await registration?.pushManager.getSubscription();
    setState(existing ? "on" : "off");
  }, [supported, config]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!supported || !config?.publicKey) return;
    setState("working");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }

      // In development the service worker is not registered at startup, so
      // register on demand rather than failing with a confusing error.
      const registration =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        // Required by every browser: a push that cannot show a notification is
        // not allowed, which is the rule that stops silent background pings.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(config.publicKey),
      });

      const json = subscription.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      await subscribe.mutateAsync({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });

      await utils.reminders.settings.invalidate();
      setState("on");
    } catch {
      setState("off");
    }
  }, [supported, config, subscribe, utils]);

  const disable = useCallback(async () => {
    setState("working");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const existing = await registration?.pushManager.getSubscription();
      if (existing) {
        await unsubscribe.mutateAsync({ endpoint: existing.endpoint });
        await existing.unsubscribe();
      }
      await utils.reminders.settings.invalidate();
    } finally {
      setState("off");
    }
  }, [unsubscribe, utils]);

  return { state, enable, disable, refresh };
}
