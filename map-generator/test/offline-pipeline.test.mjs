/**
 * Offline check of the non-AI pipeline steps (2: compress, 5: walkable grid,
 * 6: Tiled output) using a synthetic map, so it runs without API keys.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import sharp from "sharp";

import { compressMap } from "../generators/map/src/steps/step2-compress.mjs";
import { computeGrid } from "../generators/map/src/steps/step5-compute-grid.mjs";
import { buildOutput } from "../generators/map/src/steps/step6-build-output.mjs";

process.env.MAP_IMAGE_SIZE_K = "1";
process.env.BLOCK_SIZE = "32";

const SIZE = 1024;
const TILE = 32;
// Walkable rectangle in tile coordinates (inclusive start, exclusive end).
const WALK = { x0: 8, y0: 6, x1: 24, y1: 20 };

// Background: grass-coloured noise so the image is not trivially flat.
const base = Buffer.alloc(SIZE * SIZE * 3);
for (let i = 0; i < SIZE * SIZE; i++) {
  const n = (i * 2654435761) % 23;
  base[i * 3] = 70 + n;
  base[i * 3 + 1] = 120 + n;
  base[i * 3 + 2] = 60 + n;
}
// Marked copy: cyan tint over the walkable rectangle, as the AI overlay step produces.
const marked = Buffer.from(base);
for (let y = WALK.y0 * TILE; y < WALK.y1 * TILE; y++) {
  for (let x = WALK.x0 * TILE; x < WALK.x1 * TILE; x++) {
    const i = (y * SIZE + x) * 3;
    marked[i + 1] = Math.min(255, marked[i + 1] + 60);
    marked[i + 2] = Math.min(255, marked[i + 2] + 60);
  }
}
const toPng = (raw) => sharp(raw, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toBuffer();
const originalPng = await toPng(base);
const markedPng = await toPng(marked);

const { compressedMap, width, height } = await compressMap(originalPng);
assert.equal(width, SIZE);
assert.equal(height, SIZE);

const { grid, gridWidth, gridHeight, tileSize } = await computeGrid(compressedMap, markedPng, SIZE);
assert.equal(tileSize, TILE, "BLOCK_SIZE=32 should give LPC-sized tiles");
assert.equal(gridWidth, SIZE / TILE);
assert.equal(gridHeight, SIZE / TILE);

let mismatches = 0;
for (let y = 0; y < gridHeight; y++) {
  for (let x = 0; x < gridWidth; x++) {
    const inside = x >= WALK.x0 && x < WALK.x1 && y >= WALK.y0 && y < WALK.y1;
    if (grid[y][x] !== (inside ? 0 : 1)) mismatches++;
  }
}
assert.equal(mismatches, 0, `walkable grid differs from the marked rectangle in ${mismatches} cells`);

const tmj = buildOutput({
  grid,
  gridWidth,
  gridHeight,
  tileSize,
  regions: [{ id: "barn", name: "Barn", topLeft: { x: 64, y: 64 }, bottomRight: { x: 192, y: 160 } }],
  elements: [],
  backgroundImage: "06-background.png",
});
assert.equal(tmj.orientation, "orthogonal");
assert.equal(tmj.tilewidth, TILE);
const layers = Object.fromEntries(tmj.layers.map((l) => [l.name, l]));
assert.equal(layers.background.type, "imagelayer");
assert.equal(layers.collision.data.length, gridWidth * gridHeight);
assert.equal(layers.regions.objects[0].name, "Barn");

console.log(`\nok - offline pipeline: ${gridWidth}x${gridHeight} grid at ${tileSize}px, TMJ valid`);
