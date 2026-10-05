#!/usr/bin/env node
/**
 * Split the built sheets into one file per animation, as transparent PNG and SVG.
 *
 *   node export-sequences.mjs            # all characters
 *   node export-sequences.mjs --only stretch
 *
 * Output (sequences/<id>/):
 *   <animation>.png          strip, frames left to right, 48px each, transparent
 *   <animation>.svg          same strip as crisp pixel rectangles (scales without blurring)
 *   frames/<animation>_<n>.png  every frame on its own, transparent
 *
 * Run `npm run build` first. Side animations face right; mirror for left.
 */
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SHEETS = join(ROOT, "sheets");
const OUT = join(ROOT, "sequences");
const manifest = JSON.parse(readFileSync(join(SHEETS, "manifest.json"), "utf8"));
const F = manifest.frameWidth;

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;

/** Pixel strip -> SVG, merging horizontal runs of the same colour into one rect. */
function toSvg(data, width, height) {
  const rects = [];
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) { x++; continue; }
      const key = data.readUInt32BE(i);
      let run = 1;
      while (x + run < width && data[(y * width + x + run) * 4 + 3] !== 0 && data.readUInt32BE((y * width + x + run) * 4) === key) run++;
      const hex = data.subarray(i, i + 3).toString("hex");
      const alpha = data[i + 3] === 255 ? "" : ` fill-opacity="${(data[i + 3] / 255).toFixed(3)}"`;
      rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="#${hex}"${alpha}/>`);
      x += run;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">` +
    rects.join("") +
    "</svg>\n"
  );
}

rmSync(OUT, { recursive: true, force: true });
let files = 0;
for (const ch of manifest.characters.filter((c) => !only || only.includes(c.id))) {
  const dir = join(OUT, ch.id);
  mkdirSync(join(dir, "frames"), { recursive: true });
  const sheet = sharp(join(SHEETS, ch.file));
  for (const [name, a] of Object.entries(manifest.animations)) {
    const width = a.count * F;
    const { data } = await sheet
      .clone()
      .extract({ left: a.start * F, top: a.row * F, width, height: F })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const raw = { raw: { width, height: F, channels: 4 } };
    await sharp(data, raw).png({ compressionLevel: 9 }).toFile(join(dir, `${name}.png`));
    writeFileSync(join(dir, `${name}.svg`), toSvg(data, width, F));
    for (let k = 0; k < a.count; k++) {
      await sharp(data, raw)
        .extract({ left: k * F, top: 0, width: F, height: F })
        .png({ compressionLevel: 9 })
        .toFile(join(dir, "frames", `${name}_${k}.png`));
    }
    files += 2 + a.count;
  }
  process.stdout.write(`${ch.id} `);
}
console.log(`\n${files} files written to sequences/`);
