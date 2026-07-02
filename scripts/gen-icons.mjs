// One-off icon generator for the PWA. Rasterizes the branded SVGs in
// public/icons/ into the PNG sizes a web app manifest + iOS need.
//
//   npm i -D sharp   (prebuilt binaries, no native build)
//   node scripts/gen-icons.mjs
//
// Safe to re-run any time the source SVGs change.
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const standard = readFileSync(join(iconsDir, "icon-source.svg"));
const maskable = readFileSync(join(iconsDir, "icon-maskable-source.svg"));

const jobs = [
  { src: standard, size: 192, out: "icon-192.png" },
  { src: standard, size: 512, out: "icon-512.png" },
  { src: maskable, size: 512, out: "icon-maskable-512.png" },
  // Apple touch icon: 180×180, flattened onto an opaque bg (iOS ignores alpha).
  { src: standard, size: 180, out: "apple-touch-icon.png", flatten: "#0672a0" },
];

for (const { src, size, out, flatten } of jobs) {
  let img = sharp(src).resize(size, size);
  if (flatten) img = img.flatten({ background: flatten });
  await img.png().toFile(join(iconsDir, out));
  console.log(`✓ ${out} (${size}×${size})`);
}

console.log("Done — icons written to public/icons/");
