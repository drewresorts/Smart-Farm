#!/usr/bin/env node
/**
 * Builds assets/tilesets/lpc-cars/cars_small.png: the LPC cars at half size, each in its own
 * 32px-aligned slot, for maps drawn at a smaller scale than LPC characters.
 *
 * One row of slots per car colour (3 tiles tall):
 *   cols 0-2 facing left (3x2) | cols 3-5 facing right (3x2) | cols 6-7 facing down (2x3) | cols 8-9 facing up (2x3)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng, blank, blit, halve, crop } from "./png.mjs";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "tilesets", "lpc-cars");
const T = 32;

// Colour blocks in cars.png: [first column, first row] of each 6-tile-wide block.
export const SMALL_CAR_COLOURS = ["red", "police", "orange", "blue", "pickup", "navy", "yellow", "green", "mustard", "truck"];
const BLOCKS = [[0, 0], [6, 0], [12, 0], [18, 0], [24, 0], [0, 11], [6, 11], [12, 11], [18, 11], [24, 11]];

const src = decodePng(readFileSync(join(DIR, "cars.png")));
const out = blank(10 * T, BLOCKS.length * 3 * T);
BLOCKS.forEach(([cx, cy], i) => {
  const y0 = i * 3 * T;
  const left = halve(crop(src, cx * T, cy * T, 6 * T, 3 * T));
  const right = halve(crop(src, cx * T, (cy + 8) * T, 6 * T, 3 * T));
  const down = halve(crop(src, cx * T, (cy + 3) * T, 3 * T, 5 * T));
  const up = halve(crop(src, (cx + 3) * T, (cy + 3) * T, 3 * T, 5 * T));
  blit(out, left, 0, y0 + 8);
  blit(out, right, 3 * T, y0 + 8);
  blit(out, down, 6 * T + 8, y0 + 8);
  blit(out, up, 8 * T + 8, y0 + 8);
});
writeFileSync(join(DIR, "cars_small.png"), encodePng(out));
console.log(`cars_small.png: ${out.width}x${out.height}`);
