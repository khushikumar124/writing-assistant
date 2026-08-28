import { REMINDER_FREQUENCIES } from "@shared/domain";
import { z } from "zod";
import { ENV } from "../_core/env";
import { pushEnabled, sendPush } from "../_core/push";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  countPushSubscriptions,
  deletePushSubscription,
  getPreferences,
  listPushSubscriptions,
  savePushSubscription,
  updatePreferences,
} from "../db";

/**
 * Reminder settings and the push subscriptions behind them.
 *
 * The browser owns permission — nothing here can grant it, and nothing here can
 * message someone who hasn't asked. All this does is remember the schedule and
 * which browsers agreed to listen.
 */
export const remindersRouter = router({
  /** Public: the sign-in page has no session but the client needs the key. */
  config: publicProcedure.query(() => ({
    enabled: pushEnabled(),
    publicKey: ENV.vapidPublicKey,
  })),

  settings: protectedProcedure.query(async ({ ctx }) => {
    const [preferences, subscriptions] = await Promise.all([
      getPreferences(ctx.user.id),
      countPushSubscriptions(ctx.user.id),
    ]);

    return {
      frequency: preferences.reminderFrequency,
      time: preferences.reminderTime,
      days: preferences.reminderDays
        ? (JSON.parse(preferences.reminderDays) as number[])
        : [],
      timeZone: preferences.timeZone,
      /** How many browsers are listening — 0 means nothing will arrive. */
      devices: subscriptions,
    };
  }),

  update: protectedProcedure
    .input(
      z.object({
        frequency: z.enum(REMINDER_FREQUENCIES),
        /** "HH:MM", 24-hour. */
        time: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:00."),
        days: z.array(z.number().int().min(0).max(31)).max(31),
        timeZone: z.string().min(1).max(64),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updatePreferences(ctx.user.id, {
        reminderFrequency: input.frequency,
        reminderTime: input.time,
        reminderDays: JSON.stringify(input.days),
        timeZone: input.timeZone,
      });
      return { success: true } as const;
    }),

  /** Registers this browser. Called after the user grants permission. */
  subscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url().max(1000),
        p256dh: z.string().min(1).max(200),
        auth: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await savePushSubscription({ userId: ctx.user.id, ...input });
      return { success: true } as const;
    }),

  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string().max(1000) }))
    .mutation(async ({ input }) => {
      await deletePushSubscription(input.endpoint);
      return { success: true } as const;
    }),

  /**
   * Sends one immediately, so someone can confirm notifications actually
   * arrive on this device before trusting the schedule with their habit.
   */
  test: protectedProcedure.mutation(async ({ ctx }) => {
    const subscriptions = await listPushSubscriptions(ctx.user.id);
    if (subscriptions.length === 0) {
      return { sent: 0, message: "No browser is subscribed yet." } as const;
    }

    let sent = 0;
    for (const subscription of subscriptions) {
      const result = await sendPush(subscription, {
        title: "This is what a reminder looks like",
        body: "Quiet, and easy to turn off in Settings.",
        url: `${ENV.appUrl}/`,
      });
      if (result === "gone")
        await deletePushSubscription(subscription.endpoint);
      if (result === "sent") sent += 1;
    }

    return { sent, message: sent > 0 ? "Sent." : "Couldn't deliver." } as const;
  }),
});
