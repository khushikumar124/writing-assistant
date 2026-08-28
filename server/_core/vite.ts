import express, { type Express } from "express";
import fs from "node:fs";
import type { Server } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { injectShelfMeta, type ShelfMeta } from "../publicShelf";

/**
 * Dev: Vite in middleware mode, so the API and the client share one origin.
 *
 * Vite and the vite config are imported dynamically, inside the function, on
 * purpose. They are devDependencies, and the production image prunes those —
 * a top-level `import ... from "vite"` is resolved eagerly by ESM even though
 * this function never runs in production, which crashes the container at boot
 * with ERR_MODULE_NOT_FOUND. Deferring the import to the one code path that
 * actually needs it keeps the production bundle free of dev-only packages.
 */
export async function setupVite(app: Express, server: Server) {
  const { createServer: createViteServer } = await import("vite");

  // The specifier is built at runtime rather than written as a literal: given a
  // literal, esbuild inlines vite.config.ts into the bundle and hoists its
  // imports (vite, @vitejs/plugin-react, @tailwindcss/vite) to the top level —
  // reintroducing exactly the eager dev-dependency load this is avoiding.
  const configUrl = pathToFileURL(
    path.resolve(import.meta.dirname, "../../vite.config.ts")
  ).href;
  const { default: viteConfig } = (await import(configUrl)) as {
    default: Record<string, unknown>;
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: { middlewareMode: true, hmr: { server } },
    appType: "custom",
  });

  /**
   * Public shelves live at `/@handle`, but Vite's dev server claims every path
   * starting with `/@` for its own internal module ids (`/@fs`, `/@id`,
   * `/@vite/...`). Without this, loading a shelf URL directly in development
   * 404s inside Vite before the SPA ever boots. Vite's own prefixes are left
   * alone; anything else that looks like a handle falls through to the SPA.
   */
  const VITE_INTERNAL = /^\/@(fs|id|vite|react-refresh)\b/;
  app.use((req, _res, next) => {
    if (req.url.startsWith("/@") && !VITE_INTERNAL.test(req.url)) {
      req.url = "/";
    }
    next();
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    try {
      const templatePath = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      // Re-read from disk each time so edits to index.html show up without a
      // server restart.
      const template = await fs.promises.readFile(templatePath, "utf-8");
      let page = await vite.transformIndexHtml(req.originalUrl, template);

      const meta = res.locals.shelfMeta as ShelfMeta | undefined;
      if (meta) page = injectShelfMeta(page, meta);

      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });
}

/** Production: serve the built client, falling back to index.html for SPA routes. */
export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Client build not found at ${distPath}. Run \`npm run build\` before \`npm start\`.`
    );
  }

  app.use(express.static(distPath));

  // Read once: the built shell never changes while the process is alive.
  const shell = fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8");

  app.use("*", (_req, res) => {
    const meta = res.locals.shelfMeta as ShelfMeta | undefined;
    res
      .status(200)
      .type("html")
      .send(meta ? injectShelfMeta(shell, meta) : shell);
  });
}
