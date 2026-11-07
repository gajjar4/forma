// The dev server the bench measures: the one already running for this
// checkout on port 1420 (`pnpm dev`), or a Vite of its own from 1430 up, so it
// never takes the port `pnpm dev` and `pnpm tauri dev` insist on.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const DEV = "http://localhost:1420/";

/**
 * A server on 1420 counts as ours only if it serves the marker file this run
 * just wrote, so a dev server from another checkout is never measured by mistake.
 */
async function servesThisCheckout(marker) {
  try {
    const res = await fetch(new URL("scripts/bench/media/checkout.txt", DEV), { signal: AbortSignal.timeout(1500) });
    return res.ok && (await res.text()) === marker;
  } catch {
    return false;
  }
}

/** Returns the board's URL and a function that stops anything this started. */
export async function devServer(root, benchDir) {
  const marker = `${root}\n${Date.now()}`;
  writeFileSync(join(benchDir, "checkout.txt"), marker);
  if (await servesThisCheckout(marker)) {
    return { url: DEV, reused: true, stop: async () => {} };
  }
  const { createServer } = await import("vite");
  const server = await createServer({
    root,
    logLevel: "error",
    clearScreen: false,
    server: { port: 1430, strictPort: false },
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error("Vite started but reported no local URL.");
  return { url, reused: false, stop: () => server.close() };
}
