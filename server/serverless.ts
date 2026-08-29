import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import type { ServerResponse } from "node:http";
import type { Express, Request, Response } from "express";
import type { ShelfMeta } from "./publicShelf";

/**
 * The Vercel entry point.
 *
 * Vercel serves the built client straight from `dist/public` as static files.
 * This function handles everything that needs the server: the API, the OAuth
 * redirects, the cron endpoints, and shelf URLs — which come here rather than
 * being served statically so their metadata can be rewritten for crawlers.
 */

/** The built SPA shell, read once and reused for the lifetime of the instance. */
let shell: string | null = null;

function readShell(): string {
  if (shell !== null) return shell;

  const candidates = [
    path.join(process.cwd(), "dist/public/index.html"),
    path.join(process.cwd(), "public/index.html"),
  ];
  const found = candidates.find(candidate => fs.existsSync(candidate));

  shell = found
    ? fs.readFileSync(found, "utf-8")
    : "<!doctype html><html></html>";
  return shell;
}

let app: Express | null = null;
let initError: Error | null = null;
let started = false;

/**
 * Builds the app on the first request rather than at module scope.
 *
 * The server modules validate their configuration as they load, so a bad
 * environment throws during import — which a try/catch around `createApp()`
 * cannot catch, because the import has already failed by the time the call
 * runs. Importing dynamically here puts that failure inside the guard, so a
 * misconfigured deploy answers with its reason instead of a bare crash.
 *
 * Built once per cold start and reused across invocations.
 */
async function ensureApp(): Promise<void> {
  if (started) return;
  started = true;

  try {
    const [{ createApp }, { injectShelfMeta }] = await Promise.all([
      import("./app"),
      import("./publicShelf"),
    ]);

    const built = createApp();

    // Shelf pages fall through to here after `mountPublicShelf` has resolved
    // the metadata, so the HTML a crawler receives already names the writer.
    built.use((_req: Request, res: Response) => {
      const meta = res.locals.shelfMeta as ShelfMeta | undefined;
      const html = readShell();
      res
        .status(200)
        .type("html")
        .send(meta ? injectShelfMeta(html, meta) : html);
    });

    app = built;
  } catch (error) {
    initError = error instanceof Error ? error : new Error(String(error));
    console.error("[boot] failed to build the app:", initError);
  }
}

/**
 * TEMPORARY DIAGNOSTIC — remove once the boot failure is identified.
 *
 * Reports the reason the app could not be built. Names of environment
 * variables only, never their values.
 */
function bootFailure(res: ServerResponse): void {
  const names = [
    "DATABASE_URL",
    "SESSION_SECRET",
    "APP_URL",
    "CRON_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
    "NODE_ENV",
    "PORT",
  ];

  const body = [
    "BOOT FAILURE",
    `name:    ${initError?.name}`,
    `message: ${initError?.message}`,
    "",
    initError?.stack ?? "(no stack)",
    "",
    "environment (names only, never values):",
    ...names.map(key => `  ${key}: ${process.env[key] ? "set" : "MISSING"}`),
    "",
    `cwd: ${process.cwd()}`,
    `node: ${process.version}`,
  ].join("\n");

  // Raw Node response API, not Express's: this path exists precisely because
  // the Express app could not be built, so nothing may depend on its helpers.
  res.statusCode = 500;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.end(body);
}

export default async function handler(
  req: Request,
  res: Response
): Promise<void> {
  await ensureApp();

  if (!app) {
    bootFailure(res as unknown as ServerResponse);
    return;
  }

  (app as unknown as (a: Request, b: Response) => void)(req, res);
}
