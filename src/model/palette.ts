// An image's main colours, from its pixels. Pure, so it can be tested without
// a browser: the app shrinks the picture onto a small canvas and hands the
// pixels in (see src/store/readPalette.ts).

/** How many colours a palette has at most. */
export const PALETTE_SIZE = 5;

/** Colours closer than this (straight-line RGB distance) count as one. */
const SAME = 28;
/** A colour has to cover at least this share of the picture to make the palette. */
const MIN_SHARE = 0.02;
const ROUNDS = 10;

type Rgb = [number, number, number];

const dist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function toHex([r, g, b]: Rgb) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Opaque pixels out of RGBA bytes. Anything mostly see-through isn't part of the picture. */
function opaque(data: ArrayLike<number>): Rgb[] {
  const out: Rgb[] = [];
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] >= 128) out.push([data[i], data[i + 1], data[i + 2]]);
  }
  return out;
}

/**
 * Starting colours: the most common colour first (in coarse bins of 16 levels
 * a channel), then the next most common that is clearly different from those
 * already picked. Deterministic, and one stray pixel never becomes a colour.
 */
function seeds(pixels: Rgb[], count: number): Rgb[] {
  const bins = new Map<number, { n: number; sum: Rgb }>();
  for (const p of pixels) {
    const key = ((p[0] >> 4) << 8) | ((p[1] >> 4) << 4) | (p[2] >> 4);
    const bin = bins.get(key) ?? { n: 0, sum: [0, 0, 0] };
    bin.n++;
    bin.sum[0] += p[0];
    bin.sum[1] += p[1];
    bin.sum[2] += p[2];
    bins.set(key, bin);
  }
  const ranked = [...bins.values()]
    .sort((a, b) => b.n - a.n)
    .map((b): Rgb => [b.sum[0] / b.n, b.sum[1] / b.n, b.sum[2] / b.n]);
  const picked: Rgb[] = [];
  for (const c of ranked) {
    if (picked.length === count) break;
    if (picked.every((p) => dist(p, c) > SAME * 1.5)) picked.push(c);
  }
  return picked;
}

/**
 * The picture's main colours as hex, the one covering most of it first. At
 * most `count`; fewer when the picture has fewer clearly different colours.
 * `data` is RGBA bytes, as a canvas's getImageData gives them.
 */
export function paletteOf(data: ArrayLike<number>, count = PALETTE_SIZE): string[] {
  const pixels = opaque(data);
  if (!pixels.length) return [];
  let centres = seeds(pixels, count);
  let sizes: number[] = [];

  // A few rounds of k-means: each pixel joins its nearest colour, and each
  // colour moves to the middle of its pixels.
  for (let round = 0; round < ROUNDS; round++) {
    const sums = centres.map((): Rgb => [0, 0, 0]);
    sizes = centres.map(() => 0);
    for (const p of pixels) {
      let best = 0;
      let bestD = Infinity;
      centres.forEach((c, k) => {
        const d = dist(p, c);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      });
      sizes[best]++;
      sums[best][0] += p[0];
      sums[best][1] += p[1];
      sums[best][2] += p[2];
    }
    centres = centres.map((c, k) => (sizes[k] ? [sums[k][0] / sizes[k], sums[k][1] / sizes[k], sums[k][2] / sizes[k]] : c));
  }

  const ranked = centres
    .map((c, k) => ({ c, n: sizes[k] }))
    .filter((x) => x.n / pixels.length >= MIN_SHARE)
    .sort((a, b) => b.n - a.n);
  const out: Rgb[] = [];
  for (const { c } of ranked) if (out.every((o) => dist(o, c) > SAME)) out.push(c);
  return out.map(toHex);
}

/** A palette as stored: six-digit hex colours. */
export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
