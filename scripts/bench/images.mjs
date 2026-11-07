// Placeholder pictures for the bench board. Drawn by the browser itself (no
// image library needed) and written to scripts/bench/media, which git
// ignores, so no real images are ever committed. That folder is outside
// public/, so a build never ships them; the dev server serves them from the
// project root. Each is at least as heavy as a real photo: 1400px on the long
// side, soft shapes and grain so JPEG can't squash it to nothing.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Every image item in a board file, loose or stacked. */
export function boardImages(board) {
  const items = board.nodes.flatMap((n) => (n.items ? n.items : n.item ? [n.item] : []));
  return items.filter((i) => (i.kind ?? "image") === "image");
}

function draw({ w, h, seed }) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // Close seeds start out close; a few draws pull them apart.
  for (let k = 0; k < 4; k++) rnd();
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const hue = rnd() * 360;
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, `hsl(${hue} 45% 70%)`);
  bg.addColorStop(1, `hsl(${(hue + 60) % 360} 50% 35%)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `hsla(${(hue + rnd() * 120) % 360} 60% ${30 + rnd() * 50}% / 0.5)`;
    ctx.beginPath();
    ctx.arc(rnd() * w, rnd() * h, 20 + rnd() * w * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const px = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < px.data.length; i += 4) {
    const g = (rnd() - 0.5) * 10;
    px.data[i] += g;
    px.data[i + 1] += g;
    px.data[i + 2] += g;
  }
  ctx.putImageData(px, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
}

/** Writes any bench image that isn't on disk yet. Returns how many it made. */
export async function ensureImages(browser, board, dir) {
  mkdirSync(dir, { recursive: true });
  const missing = boardImages(board).filter((i) => !existsSync(join(dir, `${i.id}.jpg`)));
  if (!missing.length) return 0;
  const page = await browser.newPage();
  for (const item of missing) {
    const scale = 1400 / Math.max(item.w, item.h);
    const seed = [...item.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483646, 7) + 1;
    const size = { w: Math.round(item.w * scale), h: Math.round(item.h * scale), seed };
    const base64 = await page.evaluate(draw, size);
    writeFileSync(join(dir, `${item.id}.jpg`), Buffer.from(base64, "base64"));
  }
  await page.close();
  return missing.length;
}
