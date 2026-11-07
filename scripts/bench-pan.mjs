// pnpm bench: is the board still smooth? Opens a full board (51 images) in
// headless WebKit, the engine the Mac app runs on, and times every frame while
// it pans, zooms and opens a stack. Fails (exit 1) if any run averages under
// 55 fps or drops more than 5% of its frames past 20ms.
//
// Options, for measuring a board of your own (say one with live cards):
//   --board <file>   a board.json to measure instead of scripts/bench/board.json
//   --zoom <z>       zoom in to about z before each run, and let it settle

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "@playwright/test";
import { MAX_SLOW_SHARE, MIN_FPS, SLOW_MS, recordFrames, summarise } from "./bench/frames.mjs";
import { boardImages, ensureImages } from "./bench/images.mjs";
import { devServer } from "./bench/server.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const benchDir = join(root, "scripts", "bench", "media");
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const boardText = readFileSync(arg("board") ?? join(root, "scripts", "bench", "board.json"), "utf8");
const ZOOM = Number(arg("zoom")) || null;
const board = JSON.parse(boardText);

const VIEWPORT = { width: 1440, height: 900 };
const PAN_MS = 4000;
/** The deal-out of a 7-image stack: 0.2s of stagger, then a 0.62s spring settling. */
const OPEN_MS = 1000;
/** One open is only 60 frames, so a stack is opened this many times and the frames pooled. */
const OPENS = 3;

/** Middle of the loose card nearest the middle of the window. */
async function overCard(page) {
  return page.evaluate(() => {
    const mid = [innerWidth / 2, innerHeight / 2];
    const points = [...document.querySelectorAll(".react-flow__node-card")].map((el) => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    });
    points.sort((a, b) => Math.hypot(a[0] - mid[0], a[1] - mid[1]) - Math.hypot(b[0] - mid[0], b[1] - mid[1]));
    return points[0];
  });
}

/** A spot with nothing on it but the board itself. */
async function overEmpty(page) {
  return page.evaluate(() => {
    for (let y = innerHeight - 60; y > 60; y -= 40) {
      for (let x = 60; x < innerWidth - 60; x += 40) {
        if (document.elementFromPoint(x, y)?.classList.contains("react-flow__pane")) return [x, y];
      }
    }
    return null;
  });
}

async function centreOf(page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  return box && [box.x + box.width / 2, box.y + box.height / 2];
}

const runs = [
  { name: "pan, pointer over a card", at: overCard, motion: "pan", ms: PAN_MS },
  { name: "pan, pointer over empty space", at: overEmpty, motion: "pan", ms: PAN_MS },
  { name: "zoom (pinch)", at: () => [VIEWPORT.width / 2, VIEWPORT.height / 2], motion: "zoom", ms: PAN_MS },
  {
    name: "open a stack (deal-out)",
    at: (page) => centreOf(page, '.react-flow__node-stack[data-id="stack-4"]'),
    ms: OPEN_MS,
    times: OPENS,
    click: true,
  },
];

/** A fresh window on the bench board, every image loaded and decoded. */
async function openBoard(browser, url) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.addInitScript((text) => localStorage.setItem("forma.board.v1", text), boardText);
  await page.goto(url);
  await page.waitForSelector(".react-flow__node-card");
  await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => {}))));
  await page.waitForTimeout(1000);
  if (ZOOM) await zoomTo(page, ZOOM);
  return { context, page };
}

const scaleOf = (page) =>
  page.evaluate(() => Number(document.querySelector(".react-flow__viewport").style.transform.match(/scale\(([\d.]+)/)?.[1] ?? 1));

/** Pinches in (or out) around the middle of the window until the board is at about `z`, then lets it settle. */
async function zoomTo(page, z) {
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await page.keyboard.down("Control");
  for (let i = 0; i < 400; i++) {
    const now = await scaleOf(page);
    if (Math.abs(now - z) / z < 0.03) break;
    await page.mouse.wheel(0, now < z ? -6 : 6);
  }
  await page.keyboard.up("Control");
  await page.waitForTimeout(1500);
}

/** The gaps between frames during one go of a run. */
async function framesOf(browser, url, run) {
  const { context, page } = await openBoard(browser, url);
  try {
    const at = await run.at(page);
    if (!at) throw new Error(`Couldn't find where to put the pointer for "${run.name}".`);
    await page.mouse.move(at[0], at[1]);
    await page.waitForTimeout(300);
    live.add(await page.evaluate(() => document.querySelectorAll(".card-media.live iframe").length));
    const frames = page.evaluate(recordFrames, { ms: run.ms, at, motion: run.motion });
    if (run.click) await page.mouse.click(at[0], at[1]);
    return await frames;
  } finally {
    await context.close();
  }
}

async function measure(browser, url, run) {
  const gaps = [];
  for (let k = 0; k < (run.times ?? 1); k++) gaps.push(...(await framesOf(browser, url, run)));
  return summarise(gaps);
}

/** How many live cards were running as runs started. */
const live = new Set();

const pad = (v, n) => String(v).padStart(n);
const line = (name, r) =>
  `${name.padEnd(32)}${pad(r.fps.toFixed(0), 4)} fps   95th pct ${pad(r.p95.toFixed(1), 5)} ms   over ${SLOW_MS}ms ${pad((r.slow * 100).toFixed(1), 5)}%   ${r.pass ? "ok" : "TOO SLOW"}`;

const browser = await webkit.launch({ headless: true });
let server;
let failed = false;
try {
  const made = await ensureImages(browser, board, benchDir);
  server = await devServer(root, benchDir);
  const images = boardImages(board).length;
  console.log(`WebKit ${browser.version()}, ${VIEWPORT.width}x${VIEWPORT.height} @2x, ${images} images${made ? ` (${made} drawn)` : ""}`);
  console.log(`board at ${server.url}${server.reused ? " (your dev server)" : ""}${ZOOM ? `, zoomed to ${ZOOM}` : ""}\n`);
  for (const run of runs) {
    const result = await measure(browser, server.url, run);
    failed ||= !result.pass;
    console.log(line(run.name, result));
  }
  const lives = [...live].filter((n) => n > 0);
  if (lives.length) console.log(`\nlive cards running as runs started: ${[...live].join(", ")}`);
} finally {
  await browser.close();
  await server?.stop();
}

if (failed) {
  console.error(`\nToo slow: every run needs ${MIN_FPS} fps or more and at most ${MAX_SLOW_SHARE * 100}% of frames over ${SLOW_MS}ms.`);
  process.exit(1);
}
console.log("\nSmooth.");
