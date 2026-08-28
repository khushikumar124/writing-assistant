/**
 * A shareable image of what someone shipped this year.
 *
 * Drawn on a canvas in the browser rather than rendered on the server, because
 * server-side image generation means a headless browser or a font-rasterising
 * dependency, and this needs neither — the numbers are already on the page, and
 * the only thing missing was a way to get them out of it.
 *
 * The output is a real PNG, so it can be posted anywhere that accepts an image.
 */

export type CardStats = {
  name: string;
  handle: string | null;
  pieces: number;
  words: number;
  year: number;
};

/** The petrol/cream palette, hard-coded: the card is not theme-dependent. */
const INK = "#f6ebd5";
const GROUND = "#263b3a";
const SURFACE = "#304745";
const ACCENT = "#e7b873";
const MUTED = "#b8b9a6";

/** 2x, so it stays sharp when a platform scales it down. */
const WIDTH = 1200;
const HEIGHT = 630;

export function drawShareCard(stats: CardStats): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const context = canvas.getContext("2d");
  if (!context) return canvas;

  context.fillStyle = GROUND;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // The faint grid from the app's own background, so the card is recognisably
  // from the same place.
  context.strokeStyle = "rgba(246, 235, 213, 0.05)";
  context.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 56) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, HEIGHT);
    context.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 56) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WIDTH, y);
    context.stroke();
  }

  // The card body, offset-shadowed like every other surface in the app.
  const pad = 64;
  context.fillStyle = "rgba(19, 31, 30, 0.5)";
  context.fillRect(pad + 8, pad + 8, WIDTH - pad * 2, HEIGHT - pad * 2);
  context.fillStyle = SURFACE;
  context.fillRect(pad, pad, WIDTH - pad * 2, HEIGHT - pad * 2);
  context.strokeStyle = "rgba(246, 235, 213, 0.16)";
  context.strokeRect(pad, pad, WIDTH - pad * 2, HEIGHT - pad * 2);

  const left = pad + 64;

  context.fillStyle = MUTED;
  context.font = "600 24px ui-monospace, 'Courier New', monospace";
  context.fillText(`${stats.year} IN WRITING`.toUpperCase(), left, pad + 96);

  context.fillStyle = INK;
  context.font = "700 76px Georgia, 'Times New Roman', serif";
  context.fillText(
    truncate(context, stats.name, WIDTH - pad * 2 - 128),
    left,
    pad + 190
  );

  if (stats.handle) {
    context.fillStyle = MUTED;
    context.font = "400 28px ui-monospace, 'Courier New', monospace";
    context.fillText(`@${stats.handle}`, left, pad + 236);
  }

  // The two numbers, which are the reason the card exists.
  const figureY = pad + 380;
  context.fillStyle = ACCENT;
  context.font = "700 128px Georgia, 'Times New Roman', serif";
  const piecesText = String(stats.pieces);
  context.fillText(piecesText, left, figureY);

  const piecesWidth = context.measureText(piecesText).width;
  context.fillStyle = MUTED;
  context.font = "600 26px ui-monospace, 'Courier New', monospace";
  context.fillText(
    stats.pieces === 1 ? "PIECE SHIPPED" : "PIECES SHIPPED",
    left,
    figureY + 44
  );

  const secondX = left + Math.max(piecesWidth + 120, 340);
  context.fillStyle = ACCENT;
  context.font = "700 128px Georgia, 'Times New Roman', serif";
  context.fillText(stats.words.toLocaleString(), secondX, figureY);

  context.fillStyle = MUTED;
  context.font = "600 26px ui-monospace, 'Courier New', monospace";
  context.fillText("WORDS PUBLISHED", secondX, figureY + 44);

  context.fillStyle = MUTED;
  context.font = "400 24px ui-monospace, 'Courier New', monospace";
  context.fillText(
    stats.handle
      ? `writing-assistant · /@${stats.handle}`
      : "writing-assistant",
    left,
    HEIGHT - pad - 44
  );

  return canvas;
}

/** Ellipsises a name too long for the card rather than letting it overflow. */
function truncate(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (context.measureText(text).width <= maxWidth) return text;

  let result = text;
  while (
    result.length > 1 &&
    context.measureText(`${result}…`).width > maxWidth
  ) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

/** Triggers a download of the card as a PNG. */
export function downloadShareCard(stats: CardStats): void {
  const canvas = drawShareCard(stats);
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${stats.handle ?? "writing"}-${stats.year}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
