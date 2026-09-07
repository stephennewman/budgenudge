/**
 * Renders the Red Fern mark on its own, at several sizes and with optional
 * variants side by side, so the frond can be checked against the sign without
 * loading the whole site.
 *
 *   node scripts/preview-fern.js [out.png]
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const cache = path.join(os.tmpdir(), "red-fern-fern-preview");
execFileSync(
  "npx",
  [
    "tsc",
    "app/red-fern/fern-geometry.ts",
    "--outDir",
    cache,
    "--module",
    "commonjs",
    "--target",
    "es2022",
    "--skipLibCheck",
  ],
  { stdio: "inherit" }
);

const { BRAND, FROND, buildFrond, RACHIS_WIDTH, VIEW_BOX } = require(
  path.join(cache, "fern-geometry.js")
);

function fern(frond, color, height) {
  const width = (height * VIEW_BOX.width) / VIEW_BOX.height;
  const leaves = frond.pinnae
    .map((p) => `<path d="${p.d}" transform="${p.transform}" />`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}">
    <g fill="${color}">${leaves}</g>
    <path d="${frond.rachis}" fill="none" stroke="${color}" stroke-width="${RACHIS_WIDTH}" stroke-linecap="round" />
  </svg>`;
}

const variants = [
  ["default", FROND],
  ["airier", { ...FROND, pairs: 11, maxWidth: 4.1, liftBase: 38, liftTip: 58 }],
  ["denser", { ...FROND, pairs: 14, maxWidth: 4.9, curve: 0.2 }],
];

const columns = variants
  .map(
    ([label, options]) => `<figure>
      ${fern(buildFrond(options), BRAND.brick, 150)}
      <figcaption>${label}</figcaption>
    </figure>`
  )
  .join("");

const small = `<figure>
    ${fern(buildFrond(), BRAND.brick, 64)}
    ${fern(buildFrond(), BRAND.brick, 36)}
    <figcaption>small</figcaption>
  </figure>`;

const onDark = `<figure class="dark">
    ${fern(buildFrond(), BRAND.brickLight, 96)}
    <figcaption style="color:${BRAND.cream}">on charcoal</figcaption>
  </figure>`;

const html = `<!doctype html><meta charset="utf-8">
<style>
  body { margin:0; background:${BRAND.cream}; font-family: Georgia, serif;
         display:flex; align-items:flex-end; gap:40px; padding:32px; }
  .dark { background:${BRAND.charcoal}; padding:20px; border-radius:12px; }
  figure { margin:0; display:flex; align-items:flex-end; gap:12px; }
  figcaption { font-size:12px; color:#7e8385; }
  svg { display:block; }
</style>
${columns}${small}${onDark}`;

const htmlFile = path.join(cache, "preview.html");
fs.writeFileSync(htmlFile, html);

const out = process.argv[2] || path.join(cache, "fern.png");
execFileSync("google-chrome", [
  "--headless=old",
  "--virtual-time-budget=1200",
  "--disable-gpu",
  "--no-sandbox",
  // Its own profile, so this never fights a browser someone has open.
  `--user-data-dir=${path.join(cache, "chrome-profile")}`,
  "--hide-scrollbars",
  "--window-size=1100,260",
  `--screenshot=${out}`,
  `file://${htmlFile}`,
]);
console.log(out);
