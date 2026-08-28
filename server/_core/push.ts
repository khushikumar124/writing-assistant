import webpush from "web-push";
import { ENV } from "./env";
import { report } from "./observability";

/**
 * Web Push, for the reminders people opt into.
 *
 * Push rather than email is a deliberate choice: the app already ships a
 * service worker, push needs no mail provider, no deliverability reputation and
 * no unsubscribe plumbing, and it cannot be used to reach someone who has not
 * explicitly granted permission in their browser. The cost is reach — it works
 * on desktop browsers and Android, and on iOS only for an installed PWA — but a
 * reminder nobody can silence would be worse than one that reaches fewer
 * people.
 */

export function pushEnabled(): boolean {
  return Boolean(ENV.vapidPublicKey && ENV.vapidPrivateKey);
}

let configured = false;

function configure(): void {
  if (configured || !pushEnabled()) return;
  webpush.setVapidDetails(
    // The contact is required by the spec so a push service can reach the
    // operator about a misbehaving sender.
    ENV.vapidSubject,
    ENV.vapidPublicKey!,
    ENV.vapidPrivateKey!
  );
  configured = true;
}

export type PushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushMessage = {
  title: string;
  body: string;
  /** Where clicking it should land. */
  url: string;
};

/**
 * Delivers one notification.
 *
 * Returns `"gone"` when the push service says the subscription is dead (404 or
 * 410), which is the signal to delete the row — browsers rotate endpoints when
 * a user clears site data, and keeping dead rows means retrying forever.
 */
export async function sendPush(
  target: PushTarget,
  message: PushMessage
): Promise<"sent" | "gone" | "failed"> {
  if (!pushEnabled()) return "failed";
  configure();

  try {
    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      JSON.stringify(message),
      { TTL: 12 * 60 * 60 }
    );
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";

    report({
      source: "server",
      message: `Push failed (${status ?? "no status"}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
    return "failed";
  }
}
