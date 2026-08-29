import fs from "node:fs";
import path from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

/**
 * Captures the screenshots used in the README.
 *
 * A script rather than a one-off, because screenshots rot: the moment the
 * design changes the README starts lying about the app. Re-running this is
 * cheaper than remembering how the last set was taken.
 *
 * Uses the Chrome already installed on the machine (puppeteer-core downloads
 * nothing) and signs in through the sandbox button, so the captures show real
 * sample writing rather than empty states.
 *
 *   npm run dev                 # in one terminal
 *   npm run screenshots         # in another
 */

const BASE = process.env.SCREENSHOT_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "docs/screenshots");
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Retina, so the images stay sharp when GitHub scales them down. */
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 2 };

async function settle(page: Page, ms = 900) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * The sandbox banner is true, but only for sandbox accounts — leaving it in
 * the README would advertise a warning nobody with an account ever sees.
 */
async function hideSandboxBanner(page: Page) {
  await page.addStyleTag({
    content: "[data-sandbox-banner]{display:none !important}",
  });
}

async function shoot(page: Page, name: string) {
  await hideSandboxBanner(page);
  await settle(page);
  await page.screenshot({
    path: path.join(OUT, `${name}.png`) as `${string}.png`,
  });
  console.log(`  ✓ ${name}.png`);
}

async function run(browser: Browser) {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  // The sandbox mints an account with sample writing, which is what makes the
  // screenshots worth looking at.
  await page.goto(`${BASE}/signin`, { waitUntil: "networkidle2" });
  const demo = await page
    .waitForSelector("::-p-text(Try it without an account)", {
      timeout: 15_000,
    })
    .catch(() => null);
  if (!demo) throw new Error("No sandbox button — is DEMO_MODE off?");
  await demo.click();
  await page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {});
  await settle(page, 2500);

  for (const [route, name] of [
    ["/", "dashboard"],
    ["/ideas", "ideas"],
    ["/thoughts", "thoughts"],
    ["/shipped", "shipped"],
    ["/discover", "discover"],
    ["/search?q=indexes", "search"],
  ] as const) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2" });
    await shoot(page, name);
  }

  // The editor, both ways round.
  //
  // The preference is set from the page rather than through an
  // `evaluateOnNewDocument` hook: a hook re-runs on every navigation, so it
  // would put the first value back on reload and both captures would match.
  await page.goto(`${BASE}/ideas`, { waitUntil: "networkidle2" });
  await page.evaluate(() => localStorage.setItem("editor-paper", "paper"));
  // A named piece from the sandbox seed, chosen because it has prose in it.
  // The first card in the list is whichever was touched last, and an empty
  // draft makes a poor advertisement for an editor.
  const idea = await page.waitForSelector(
    "::-p-text(The case for boring technology)"
  );
  await idea!.click();
  await settle(page, 1800);
  await shoot(page, "editor-paper");

  await page.evaluate(() => localStorage.setItem("editor-paper", "night"));
  await page.reload({ waitUntil: "networkidle2" });
  await settle(page, 1200);
  await shoot(page, "editor-night");
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (!fs.existsSync(CHROME)) {
    throw new Error(`No Chrome at ${CHROME}. Set CHROME_PATH.`);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--hide-scrollbars", "--force-color-profile=srgb"],
  });
  try {
    console.log(`Capturing from ${BASE} …`);
    await run(browser);
    console.log(`\nWritten to docs/screenshots/`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
