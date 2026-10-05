#!/usr/bin/env node
/**
 * Imports "Ranitaya's 50+ City Essential Assets" into tile-aligned sheets for the editor.
 *
 *   node tools/import-ranitaya.mjs path/to/Ranitaya_s_50_City_Essential_Assets_Pack.zip
 *   node tools/import-ranitaya.mjs path/to/unzipped-folder
 *
 * Writes assets/tilesets/ranitaya/{buildings.png, props.png, index.json}. That folder is
 * git-ignored: the pack is royalty-free to use in your projects, but it is not openly
 * licensed for redistribution, so keep it out of public repositories.
 */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng, blank, blit } from "./png.mjs";

const T = 32;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "tilesets", "ranitaya");

let source = process.argv[2];
if (!source) {
  console.error("Usage: node tools/import-ranitaya.mjs <pack .zip or folder>");
  process.exit(1);
}
if (statSync(source).isFile()) {
  const dir = mkdtempSync(join(tmpdir(), "ranitaya-"));
  execFileSync("unzip", ["-q", "-o", source, "-d", dir]);
  source = dir;
}

function findPngs(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) found.push(...findPngs(p));
    else if (extname(name).toLowerCase() === ".png") found.push(p);
  }
  return found;
}
const pngs = findPngs(source);
const buildings = pngs.filter((p) => /buildings/i.test(p) && /building\d+\.png$/i.test(p)).sort();
const props = pngs.filter((p) => /[\\/]assets[\\/]/i.test(p)).sort();
if (!buildings.length) throw new Error(`No Building*.png files found under ${source}`);

/** Shelf-packs images into a sheet, each in its own tile-aligned slot, bottom-aligned and centred. */
function pack(files, sheetTiles) {
  const items = files.map((f) => {
    const img = decodePng(readFileSync(f));
    return { name: basename(f, ".png"), img, w: Math.ceil(img.width / T), h: Math.ceil(img.height / T) };
  });
  let col = 0, row = 0, shelf = 0;
  for (const it of items) {
    if (col + it.w > sheetTiles) { col = 0; row += shelf; shelf = 0; }
    it.col = col;
    it.row = row;
    col += it.w;
    shelf = Math.max(shelf, it.h);
  }
  const sheet = blank(sheetTiles * T, (row + shelf) * T);
  for (const it of items) {
    const dx = it.col * T + Math.floor((it.w * T - it.img.width) / 2);
    const dy = it.row * T + (it.h * T - it.img.height);
    blit(sheet, it.img, dx, dy);
  }
  return { sheet, items: items.map(({ name, col: c, row: r, w, h, img }) => ({ name, col: c, row: r, w, h, pxWidth: img.width, pxHeight: img.height })) };
}

mkdirSync(OUT, { recursive: true });
const b = pack(buildings, 24);
const p = pack(props, 16);
writeFileSync(join(OUT, "buildings.png"), encodePng(b.sheet));
writeFileSync(join(OUT, "props.png"), encodePng(p.sheet));
writeFileSync(join(OUT, "index.json"), JSON.stringify({ buildings: b.items, props: p.items }, null, 2));
writeFileSync(
  join(OUT, "CREDITS.txt"),
  "Ranitaya's 50+ City Essential Assets by Ranitaya Studios.\n" +
    "Royalty-free for personal and commercial projects (per the itch.io page).\n" +
    "https://ranitaya-studios.itch.io/ranitayas-city-essential\n" +
    "Not openly licensed for redistribution: do not commit these files to a public repository.\n",
);
console.log(`Imported ${b.items.length} buildings and ${p.items.length} props into ${OUT}`);
if (!existsSync(join(OUT, "..", "..", "..", ".gitignore"))) console.log("Remember: keep assets/tilesets/ranitaya/ out of git.");
