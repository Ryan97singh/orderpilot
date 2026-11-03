// Generates the PWA / favicon icon set from an inline SVG "OP" monogram.
// Run with: npm run icons   (outputs are committed, so this is only needed when the design changes)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BRAND = "#1f4fd1";
const BRAND_DARK = "#173a9c";

/**
 * @param {object} opts
 * @param {boolean} opts.maskable  full-bleed background, glyph kept inside the 80% safe zone
 * @param {boolean} opts.rounded   rounded-square tile (favicon / standard icon)
 */
function monogram({ maskable = false, rounded = true } = {}) {
  const radius = maskable ? 0 : rounded ? 112 : 0;
  // Maskable icons get cropped to a circle by some launchers, so the glyph shrinks.
  const scale = maskable ? 0.72 : 1;
  const offset = (512 - 512 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND}"/>
      <stop offset="1" stop-color="${BRAND_DARK}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <!-- paper-plane accent -->
    <path d="M356 132 L404 120 L392 168 Z" fill="#ffffff" opacity="0.55"/>
    <text x="256" y="318" text-anchor="middle"
      font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
      font-size="200" font-weight="700" letter-spacing="-8" fill="#ffffff">OP</text>
    <rect x="148" y="352" width="216" height="14" rx="7" fill="#ffffff" opacity="0.35"/>
  </g>
</svg>`;
}

async function png(svg, size, out) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(root, out));
  console.log(`wrote ${out} (${size}x${size})`);
}

await mkdir(path.join(root, "public/icons"), { recursive: true });

const standard = monogram();
const maskable = monogram({ maskable: true });

await writeFile(path.join(root, "app/icon.svg"), standard);
console.log("wrote app/icon.svg");
await png(standard, 192, "public/icons/icon-192.png");
await png(standard, 512, "public/icons/icon-512.png");
await png(maskable, 512, "public/icons/icon-maskable-512.png");
// iOS applies its own rounding, so the apple icon is a full-bleed square.
await png(monogram({ rounded: false }), 180, "app/apple-icon.png");
