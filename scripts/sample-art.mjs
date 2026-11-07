// Draws the sample board's pictures into public/sample, so a fresh clone and
// a fresh install open on a full board. All of them are made here, so the repo
// holds nothing from anyone else's work. Run with `pnpm sample-art`, once
// after changing a drawing (once: pnpm exec playwright install webkit).

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "@playwright/test";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sample");
const BLUE = "#1f4fd8";
const INK = "#16181d";
const SANS = "'Helvetica Neue', Helvetica, sans-serif";
const shadow = `<filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity=".22"/></filter>`;
const range = (n) => Array.from({ length: n }, (_, i) => i);

const line = (x, y, w, o = 0.14, h = 6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#000" opacity="${o}"/>`;

const art = {
  // Blue and white
  "0bbf2964": [300, 300, "#f3f1ec", `<polygon points="38,250 262,250 150,56" fill="${BLUE}"/>`],
  "9bea50dd": [267, 300, "#163f9e", `
    ${range(17).map((i) => `<path d="M${i * 16.7} 0V300" stroke="#fff" opacity=".13"/>`).join("")}
    ${range(19).map((i) => `<path d="M0 ${i * 16.7}H267" stroke="#fff" opacity=".13"/>`).join("")}
    <g fill="none" stroke="#fff" stroke-width="1.4">
      <rect x="50" y="66" width="167" height="134"/><circle cx="134" cy="133" r="44"/>
      <path d="M50 133H217M134 66V200"/><path d="M50 222H217M50 217v10M217 217v10"/>
    </g>
    <text x="50" y="248" font-family="Menlo, monospace" font-size="9" fill="#fff" letter-spacing="1">PLAN A, 1:50</text>`],
  "3ee1bced": [240, 300, "#fff", (() => {
    let x = 0;
    return range(12).map((i) => {
      const w = 3 + i * 2.2;
      const bar = `<rect x="${x}" width="${w}" height="300" fill="${BLUE}"/>`;
      x += w + 16 - i;
      return bar;
    }).join("");
  })()],
  "7963b716": [400, 225, "url(#sky)", `
    <defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#2d68e3"/><stop offset="1" stop-color="#d8e5ff"/></linearGradient></defs>
    <circle cx="282" cy="86" r="42" fill="#fff"/>
    <path d="M0 176C70 150 140 150 210 174S340 196 400 164V225H0Z" fill="#fff" opacity=".6"/>
    <path d="M0 200C90 178 170 184 240 198S350 210 400 192V225H0Z" fill="#fff"/>`],
  "3d157743": [225, 300, "#fff", range(7).flatMap((r) => range(5).map((c) => {
    const turn = ((c * 3 + r * 5) % 4) * 90;
    return `<path transform="translate(${c * 45 + 22.5} ${r * 45 + 15}) rotate(${turn})" d="M-22.5 -22.5H22.5A45 45 0 0 1 -22.5 22.5Z" fill="${BLUE}"/>`;
  })).join("")],
  "9bd354f5": [400, 265, BLUE, range(15).map((r) => {
    const y = 12 + r * 17;
    const d = range(41).map((i) => `${i ? "L" : "M"}${i * 10} ${(y + Math.sin(i / 4 + r / 3) * 13).toFixed(1)}`).join("");
    return `<path d="${d}" fill="none" stroke="#fff" stroke-width="1.6"/>`;
  }).join("")],

  // Minimal interfaces
  "9dc3d214": [225, 300, "#e8eaf0", `<defs>${shadow}</defs>
    <rect x="35" y="44" width="155" height="108" rx="22" fill="#fff" opacity=".55" filter="url(#s)"/>
    <rect x="28" y="92" width="169" height="112" rx="24" fill="#fff" opacity=".8" filter="url(#s)"/>
    <rect x="20" y="144" width="185" height="118" rx="26" fill="#fff" filter="url(#s)"/>
    ${line(42, 176, 96, 0.5, 8)}${line(42, 196, 136)}${line(42, 212, 112)}`],
  "2e65e758": [300, 300, "#f1f1ee", `<defs>${shadow}</defs>
    <rect x="62" y="24" width="176" height="252" rx="24" fill="#fff" filter="url(#s)"/>
    ${range(4).map((i) => `<circle cx="90" cy="${64 + i * 40}" r="11" fill="#e6e8ee"/>${line(110, 57 + i * 40, 86, 0.42)}${line(110, 69 + i * 40, 60)}`).join("")}
    <rect x="80" y="226" width="140" height="32" rx="16" fill="${BLUE}"/>
    <rect x="124" y="239" width="52" height="6" rx="3" fill="#fff"/>`],
  a2af8454: [400, 298, "#fff", `
    <rect width="72" height="298" fill="#f4f5f7"/>
    ${range(5).map((i) => line(16, 44 + i * 22, i ? 30 : 40, i ? 0.13 : 0.45)).join("")}
    <text x="92" y="38" font-family="${SANS}" font-size="15" font-weight="600" fill="${INK}">Pipeline</text>
    ${["New", "Talking", "Won"].map((t, c) => `
      <text x="${92 + c * 100}" y="68" font-family="${SANS}" font-size="9.5" fill="#7c828c">${t}</text>
      ${range(3 - c).map((r) => `<rect x="${92 + c * 100}" y="${78 + r * 62}" width="90" height="54" rx="9" fill="#f7f8fa" stroke="#eceef2"/>${line(102 + c * 100, 92 + r * 62, 56, 0.4)}${line(102 + c * 100, 106 + r * 62, 40)}`).join("")}`).join("")}
    <path d="M292 214C312 208 322 188 338 192S366 170 382 164" fill="none" stroke="${BLUE}" stroke-width="2"/>`],
  ccc3a7b5: [400, 284, "#f7f7f4", `<defs>${shadow}</defs>
    <rect x="60" y="58" width="280" height="44" rx="22" fill="#fff" filter="url(#s)"/>
    <circle cx="84" cy="79" r="6" fill="none" stroke="#7c828c" stroke-width="1.6"/><path d="M89 84l5 5" stroke="#7c828c" stroke-width="1.6"/>
    <text x="104" y="84" font-family="${SANS}" font-size="14" fill="#7c828c">Find anything</text>
    ${range(3).map((i) => `${line(84, 132 + i * 34, 160 - i * 34, i ? 0.16 : 0.42, 7)}${line(84, 145 + i * 34, 96, 0.08)}`).join("")}`],
  "3f1951a8": [241, 300, "#ececea", `
    ${[0.72, 0.35, 0.56].map((v, i) => `<rect x="34" y="${58 + i * 44}" width="173" height="4" rx="2" fill="#c9c9c6"/><rect x="34" y="${58 + i * 44}" width="${173 * v}" height="4" rx="2" fill="${INK}"/><circle cx="${34 + 173 * v}" cy="${60 + i * 44}" r="9" fill="#fff" stroke="#d4d4d0"/>`).join("")}
    <rect x="34" y="202" width="52" height="30" rx="15" fill="${BLUE}"/><circle cx="71" cy="217" r="12" fill="#fff"/>
    <rect x="102" y="202" width="52" height="30" rx="15" fill="#d6d6d3"/><circle cx="117" cy="217" r="12" fill="#fff"/>`],

  // Typography
  "9d024b2b": [400, 225, "#0d0d0e", `<text x="200" y="196" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="226" fill="#fff">A</text>`],
  "67fce8d8": [300, 300, "#efe9dc", `<text x="150" y="196" text-anchor="middle" font-family="Didot, Georgia, serif" font-size="164" fill="${INK}">Aa</text>
    <text x="24" y="276" font-family="${SANS}" font-size="10" fill="${INK}">Display, 164 pt</text>`],
  e9fe5182: [300, 300, "#fff", [100, 300, 500, 700, 900].map((w, i) => `<text x="150" y="${70 + i * 52}" text-anchor="middle" font-family="${SANS}" font-weight="${w}" font-size="66" letter-spacing="-2" fill="${INK}">CALM</text>`).join("")],
  "8866bb5d": [400, 225, "#e8492a", `<text x="28" y="96" font-family="Georgia, serif" font-size="56" fill="#fbf1e4">Trust is</text>
    <text x="28" y="156" font-family="Georgia, serif" font-style="italic" font-size="56" fill="#fbf1e4">quiet.</text>
    <text x="28" y="200" font-family="${SANS}" font-size="10" fill="#fbf1e4">Specimen, No. 4</text>`],

  // Packaging
  "35515d79": [400, 300, "#dfe4ea", `<defs>${shadow}<linearGradient id="foil" x2="1" y2="1"><stop stop-color="#f2f3f5"/><stop offset=".5" stop-color="#b9bec6"/><stop offset="1" stop-color="#eceef1"/></linearGradient></defs>
    <g transform="rotate(-9 200 150)" filter="url(#s)">
      <rect x="50" y="94" width="300" height="112" fill="url(#foil)"/>
      <rect x="86" y="88" width="228" height="124" fill="${BLUE}"/>
      <text x="200" y="164" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="44" letter-spacing="3" fill="#fff">NORTH</text>
    </g>`],
  cd067aa2: [240, 300, "#ead9c6", `<defs>${shadow}</defs>
    <rect x="58" y="52" width="124" height="196" rx="4" fill="#fbfaf7" filter="url(#s)"/>
    <circle cx="120" cy="130" r="30" fill="${BLUE}"/>
    <text x="120" y="212" text-anchor="middle" font-family="${SANS}" font-size="11" letter-spacing="2" fill="${INK}">BALM, 50 ML</text>`],
  "0cadf925": [240, 300, "#cfd6cc", `<defs>${shadow}</defs>
    <rect x="40" y="176" width="160" height="72" rx="3" fill="#f7f4ec" filter="url(#s)"/>
    <rect x="56" y="112" width="128" height="64" rx="3" fill="#2c3a33" filter="url(#s)"/>
    <rect x="72" y="60" width="96" height="52" rx="3" fill="#f7f4ec" filter="url(#s)"/>
    <text x="120" y="218" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="13" letter-spacing="3" fill="${INK}">FIELD</text>
    <text x="120" y="150" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="11" letter-spacing="3" fill="#f7f4ec">FIELD</text>`],
  "074f85be": [225, 300, "#f1c6b4", `<defs>${shadow}<linearGradient id="can"><stop stop-color="#d9dde3"/><stop offset=".35" stop-color="#fff"/><stop offset="1" stop-color="#c3c8d0"/></linearGradient></defs>
    <g filter="url(#s)"><rect x="62" y="56" width="101" height="190" rx="10" fill="url(#can)"/><ellipse cx="112.5" cy="58" rx="50" ry="10" fill="#b5bac3"/></g>
    <rect x="62" y="108" width="101" height="86" fill="#e8492a"/>
    <text x="112.5" y="158" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="26" fill="#fff">Fizz</text>`],
  d3a28eb4: [142, 300, "#20262e", `<path d="M58 34h26v46c0 12 22 18 22 40v130a14 14 0 0 1-14 14H50a14 14 0 0 1-14-14V120c0-22 22-28 22-40Z" fill="#eef0f3"/>
    <rect x="58" y="24" width="26" height="16" rx="2" fill="${BLUE}"/>
    <rect x="36" y="150" width="70" height="66" fill="${BLUE}"/>
    <text x="71" y="188" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="11" letter-spacing="1" fill="#fff">OIL</text>`],

  // Loose finds
  "42cd816b": [300, 300, "#dfe7f5", `<defs>${shadow}</defs>
    <path d="M150 66V40" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="150" cy="36" r="7" fill="${BLUE}"/>
    <circle cx="150" cy="158" r="94" fill="#fff" filter="url(#s)"/>
    <rect x="86" y="118" width="128" height="62" rx="31" fill="${INK}"/>
    <circle cx="124" cy="149" r="10" fill="#8fb2ff"/><circle cx="176" cy="149" r="10" fill="#8fb2ff"/>`],
  f87f60b0: [300, 300, "#3a3f47", `
    <rect x="60" y="48" width="180" height="252" fill="#f4e7c9"/>
    <rect x="60" y="48" width="30" height="252" fill="#878d97"/><rect x="210" y="48" width="30" height="252" fill="#878d97"/>
    <rect x="115" y="26" width="70" height="12" rx="6" fill="#20242a"/><circle cx="150" cy="32" r="3" fill="#ffb03a"/>
    <rect x="112" y="130" width="76" height="62" rx="20" fill="#fff"/><rect x="124" y="148" width="52" height="24" rx="12" fill="${INK}"/>
    <circle cx="139" cy="160" r="5" fill="#8fb2ff"/><circle cx="161" cy="160" r="5" fill="#8fb2ff"/>
    <rect x="124" y="198" width="52" height="66" rx="14" fill="#fff"/><rect x="128" y="264" width="18" height="24" rx="6" fill="#d9dbe0"/><rect x="154" y="264" width="18" height="24" rx="6" fill="#d9dbe0"/>`],
  "87668d1c": [300, 300, "#f6d9dc", `<defs>${shadow}</defs>
    <g filter="url(#s)"><ellipse cx="116" cy="88" rx="24" ry="66" fill="#fff" transform="rotate(-8 116 88)"/><ellipse cx="184" cy="88" rx="24" ry="66" fill="#fff" transform="rotate(8 184 88)"/><circle cx="150" cy="182" r="76" fill="#fff"/></g>
    <ellipse cx="116" cy="92" rx="10" ry="44" fill="#f3b8c0" transform="rotate(-8 116 92)"/><ellipse cx="184" cy="92" rx="10" ry="44" fill="#f3b8c0" transform="rotate(8 184 92)"/>
    <circle cx="122" cy="176" r="7" fill="${INK}"/><circle cx="178" cy="176" r="7" fill="${INK}"/>
    <path d="M142 196h16l-8 9Z" fill="#e88a98"/>`],
};

mkdirSync(out, { recursive: true });
const browser = await webkit.launch();
const page = await (await browser.newContext({ deviceScaleFactor: 2 })).newPage();
for (const [id, [w, h, bg, body]] of Object.entries(art)) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>`);
  await page.screenshot({ path: join(out, `${id}.jpg`), type: "jpeg", quality: 84 });
}
await browser.close();
console.log(`Drew ${Object.keys(art).length} pictures into public/sample`);
