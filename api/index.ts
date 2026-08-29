import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import { createApp } from "../server/app";
import { injectShelfMeta, type ShelfMeta } from "../server/publicShelf";

/**
 * The Vercel entry point.
 *
 * Vercel serves the built client straight from `dist/public` as static files.
 * This function handles everything that needs the server: the API, the OAuth
 * redirects, the cron endpoints, and shelf URLs — which come here rather than
 * being served statically so their metadata can be rewritten for crawlers.
 *
 * Module scope runs once per cold start and is reused across invocations, so
 * the app (and its database client) is built here rather than per request.
 */
const app = createApp();

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

/**
 * Shelf pages fall through to here after `mountPublicShelf` has resolved the
 * metadata, so the HTML a crawler receives already names the writer.
 */
app.use((_req: Request, res: Response) => {
  const meta = res.locals.shelfMeta as ShelfMeta | undefined;
  const html = readShell();
  res
    .status(200)
    .type("html")
    .send(meta ? injectShelfMeta(html, meta) : html);
});

export default app;
