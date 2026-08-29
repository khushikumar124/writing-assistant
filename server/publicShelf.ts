import type { Express, Request, Response } from "express";
import { ENV } from "./_core/env";
import { findUserByUsername, listPublishedIdeas } from "./db";

/**
 * The parts of a public shelf that a crawler sees.
 *
 * A single-page app returns the same empty HTML shell for every URL, so a link
 * to someone's shelf posted anywhere unfurls as "Nook — a calm
 * workspace for writers" with no name, no description and no indication whose
 * shelf it is. That makes the one growth surface in the app useless as a
 * shared link, which is the entire point of it.
 *
 * These routes run before the SPA and inject real metadata, plus an RSS feed
 * so a shelf can be followed rather than only visited.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** RSS is XML, and an unescaped ampersand in a title breaks the whole feed. */
function escapeXml(value: string): string {
  return escapeHtml(value);
}

export function mountPublicShelf(app: Express): void {
  /**
   * RSS. Lets someone subscribe to a writer's shipped work without either of
   * them needing an account anywhere else.
   */
  app.get("/@:username/feed.xml", async (req: Request, res: Response) => {
    const user = await findUserByUsername(req.params.username);

    // Same 404 for "no such handle" and "not public", so the feed cannot be
    // used to discover which handles exist.
    if (!user || !user.publicProfile || !user.username) {
      res.status(404).type("text/plain").send("No shelf here.");
      return;
    }

    const pieces = await listPublishedIdeas(user.id);
    const name = user.name ?? user.username;
    const shelfUrl = `${ENV.appUrl}/@${user.username}`;

    const items = pieces
      .map(piece => {
        // Prefer where it was actually published; fall back to the shelf.
        const link = piece.publishedUrl ?? shelfUrl;
        // The guid prefix is deliberately still the app's old name. A guid is
        // a permanent identity rather than a label: changing it would make
        // every item already sitting in someone's reader look brand new and
        // re-notify them about posts they read months ago. No human sees it.
        return `    <item>
      <title>${escapeXml(piece.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">writing-assistant-${piece.id}</guid>
      <pubDate>${(piece.publishedAt ?? piece.createdAt).toUTCString()}</pubDate>
      ${piece.description ? `<description>${escapeXml(piece.description)}</description>` : ""}
    </item>`;
      })
      .join("\n");

    res.type("application/rss+xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(name)}</title>
    <link>${escapeXml(shelfUrl)}</link>
    <description>${escapeXml(user.bio ?? `Writing published by ${name}.`)}</description>
    <atom:link href="${escapeXml(`${shelfUrl}/feed.xml`)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`);
  });

  /**
   * Metadata for a shelf URL.
   *
   * Returns the real `index.html` with the head tags rewritten, so the page
   * still boots as the normal SPA — this only changes what a crawler reads
   * before any JavaScript runs.
   */
  app.use(async (req: Request, res: Response, next) => {
    const match = /^\/@([A-Za-z0-9_-]+)\/?$/.exec(req.path);
    if (!match || req.method !== "GET") return next();

    const user = await findUserByUsername(match[1]);
    if (!user || !user.publicProfile || !user.username) return next();

    const pieces = await listPublishedIdeas(user.id);
    const name = user.name ?? user.username;
    const words = pieces.reduce((sum, piece) => sum + piece.wordCount, 0);

    const description =
      user.bio ??
      `${pieces.length} piece${pieces.length === 1 ? "" : "s"} published` +
        (words > 0 ? `, ${words.toLocaleString()} words.` : ".");

    // Handed to the SPA layer, which injects it into the served HTML.
    res.locals.shelfMeta = {
      title: `${name} — published writing`,
      description,
      url: `${ENV.appUrl}/@${user.username}`,
      feed: `${ENV.appUrl}/@${user.username}/feed.xml`,
    };
    next();
  });
}

export type ShelfMeta = {
  title: string;
  description: string;
  url: string;
  feed: string;
};

/** Rewrites the head of the SPA shell with a shelf's own metadata. */
export function injectShelfMeta(html: string, meta: ShelfMeta): string {
  const tags = `
    <title>${escapeHtml(meta.title)}</title>
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <link rel="alternate" type="application/rss+xml" title="${escapeHtml(meta.title)}" href="${escapeHtml(meta.feed)}" />
    <meta property="og:type" content="profile" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:url" content="${escapeHtml(meta.url)}" />
    <meta property="og:image" content="${escapeHtml(`${ENV.appUrl}/icon-512.png`)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
    <meta name="twitter:image" content="${escapeHtml(`${ENV.appUrl}/icon-512.png`)}" />`;

  return html
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<meta\s+name="description"[^>]*\/?>/, "")
    .replace("</head>", `${tags}\n  </head>`);
}
