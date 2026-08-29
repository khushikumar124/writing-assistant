import type { Express, Request, Response } from "express";
import { ENV } from "./_core/env";
import { report } from "./_core/observability";
import { purgeExpiredDemoUsers, purgeExpiredTrash } from "./db";
import { sendDueReminders } from "./reminders";

/**
 * Scheduled work, as HTTP endpoints.
 *
 * On a long-running server these jobs are timers. Serverless has no process to
 * hold a timer, so the platform calls these paths on a schedule instead and the
 * timers only run when self-hosting. Same functions either way.
 *
 * Vercel sends an `Authorization: Bearer $CRON_SECRET` header on scheduled
 * invocations. Without a configured secret these endpoints refuse to run at
 * all rather than being left open — they are cheap, but they are still writes
 * anyone could trigger.
 */

function authorised(req: Request): boolean {
  const secret = ENV.cronSecret;
  if (!secret) return false;

  const header = req.headers.authorization;
  return header === `Bearer ${secret}`;
}

export function mountCron(app: Express): void {
  app.get("/api/cron/reminders", async (req: Request, res: Response) => {
    if (!authorised(req)) {
      res.status(401).json({ error: "Unauthorised" });
      return;
    }

    try {
      const sent = await sendDueReminders();
      res.json({ ok: true, sent });
    } catch (error) {
      report({
        source: "server",
        message: `Reminder cron failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ ok: false });
    }
  });

  /**
   * Housekeeping that used to run at boot: expired sandboxes and long-abandoned
   * trash. Serverless has no boot to hang it off, so it rides the same daily
   * schedule.
   */
  app.get("/api/cron/sweep", async (req: Request, res: Response) => {
    if (!authorised(req)) {
      res.status(401).json({ error: "Unauthorised" });
      return;
    }

    try {
      const [sandboxes, trashed] = await Promise.all([
        purgeExpiredDemoUsers(),
        purgeExpiredTrash(),
      ]);
      res.json({ ok: true, sandboxes, trashed });
    } catch (error) {
      report({
        source: "server",
        message: `Sweep cron failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      res.status(500).json({ ok: false });
    }
  });
}
