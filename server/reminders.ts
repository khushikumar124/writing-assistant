import { isReminderDue, reminderMessage } from "@shared/reminders";
import type { ReminderFrequency } from "@shared/domain";
import { ENV } from "./_core/env";
import { report } from "./_core/observability";
import { pushEnabled, sendPush } from "./_core/push";
import {
  deletePushSubscription,
  listPushSubscriptions,
  listReminderCandidates,
  listUnlinkedThoughts,
  markReminded,
} from "./db";

/**
 * The reminder scheduler.
 *
 * An in-process interval rather than a cron service, for the same reason the
 * backups are: this is one machine, and adding an external scheduler would mean
 * another moving part to configure and another thing that can be silently
 * misconfigured. It ticks every five minutes and asks a pure function whether
 * anyone is due, so the awkward parts — timezones, month boundaries, restarts
 * mid-window — are unit tested rather than observed in production.
 */

const TICK_MS = 5 * 60 * 1000;

function parseDays(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(day => typeof day === "number")
      : [];
  } catch {
    return [];
  }
}

/** One pass. Exported so it can be triggered on demand and tested. */
export async function sendDueReminders(now = new Date()): Promise<number> {
  if (!pushEnabled()) return 0;

  const candidates = await listReminderCandidates();
  let sent = 0;

  for (const candidate of candidates) {
    const due = isReminderDue(
      {
        frequency: candidate.frequency as ReminderFrequency,
        time: candidate.time,
        days: parseDays(candidate.days),
        timeZone: candidate.timeZone,
        lastRemindedAt: candidate.lastRemindedAt,
      },
      now
    );
    if (!due) continue;

    const subscriptions = await listPushSubscriptions(candidate.userId);
    if (subscriptions.length === 0) continue;

    const pile = await listUnlinkedThoughts(candidate.userId);
    const message = reminderMessage(pile.length);

    let anyDelivered = false;
    for (const subscription of subscriptions) {
      const result = await sendPush(subscription, {
        ...message,
        url: `${ENV.appUrl}/`,
      });

      // A dead endpoint is normal — browsers rotate them when site data is
      // cleared — so prune rather than retrying it forever.
      if (result === "gone") {
        await deletePushSubscription(subscription.endpoint);
      } else if (result === "sent") {
        anyDelivered = true;
      }
    }

    // Only mark it sent if something actually arrived, so a transient outage
    // doesn't silently consume the day's reminder.
    if (anyDelivered) {
      await markReminded(candidate.userId);
      sent += 1;
    }
  }

  return sent;
}

export function scheduleReminders(): void {
  if (!pushEnabled()) {
    console.log("  Reminders off — no VAPID keys (npm run keys:vapid)");
    return;
  }

  const tick = async () => {
    try {
      const sent = await sendDueReminders();
      if (sent > 0) console.log(`[reminders] sent ${sent}`);
    } catch (error) {
      report({
        source: "server",
        message: `Reminder tick failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  };

  void tick();
  setInterval(tick, TICK_MS).unref?.();
  console.log("  Reminders on — checking every 5 minutes");
}
