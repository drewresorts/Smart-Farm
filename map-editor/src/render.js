// Draws map cells onto a canvas at 1 map pixel = 1 canvas pixel.

import { TILE, terrainById } from "./catalog.js";
import { TILE_LAYERS, parseTileRef } from "./map.js";
import { terrainCellParts } from "./autotile.js";

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} map
 * @param {Record<string, HTMLImageElement>} sheets  images by tileset id
 * @param {{x0:number,y0:number,x1:number,y1:number}} rect  inclusive cell range
 * @param {{background?: HTMLImageElement|null, layers?: Record<string, boolean>, groundOnly?: boolean}} opts
 */
export function renderCells(ctx, map, sheets, rect, opts = {}) {
  const show = opts.layers || {};
  const visible = (l) => show[l] !== false;
  const x0 = Math.max(0, rect.x0);
  const y0 = Math.max(0, rect.y0);
  const x1 = Math.min(map.width - 1, rect.x1);
  const y1 = Math.min(map.height - 1, rect.y1);
  if (x1 < x0 || y1 < y0) return;

  ctx.clearRect(x0 * TILE, y0 * TILE, (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE);

  const bg = opts.background;
  if (bg && !opts.groundOnly && visible("background")) {
    const sx = bg.width / (map.width * TILE);
    const sy = bg.height / (map.height * TILE);
    ctx.drawImage(
      bg,
      x0 * TILE * sx, y0 * TILE * sy, (x1 - x0 + 1) * TILE * sx, (y1 - y0 + 1) * TILE * sy,
      x0 * TILE, y0 * TILE, (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE,
    );
  }

  const terrainAt = (x, y) => map.terrain[y * map.width + x];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (visible("terrain")) {
        if (map.base) drawTerrain(ctx, sheets, map.base, x, y, () => true);
        const t = terrainAt(x, y);
        if (t && t !== map.base) {
          const same = (nx, ny) =>
            nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || terrainAt(nx, ny) === t;
          drawTerrain(ctx, sheets, t, x, y, same);
        }
      }
      if (opts.groundOnly) continue;
      for (const l of TILE_LAYERS) {
        if (!visible(l)) continue;
        const ref = map.layers[l][y * map.width + x];
        if (ref) drawTile(ctx, sheets, ref, x * TILE, y * TILE);
      }
    }
  }
}

function drawTerrain(ctx, sheets, terrainId, x, y, same) {
  const t = terrainById[terrainId];
  const img = t && sheets[t.sheet];
  if (!img) return;
  if (t.fill) {
    ctx.drawImage(img, t.fill[0] * TILE, t.fill[1] * TILE, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
    return;
  }
  for (const [sx, sy, dx, dy, size] of terrainCellParts(x, y, same, t.variants)) {
    ctx.drawImage(img, sx, sy, size, size, x * TILE + dx, y * TILE + dy, size, size);
  }
}

export function drawTile(ctx, sheets, ref, dx, dy, size = TILE) {
  const { tilesetId, col, row } = parseTileRef(ref);
  const img = sheets[tilesetId];
  if (!img) return;
  ctx.drawImage(img, col * TILE, row * TILE, TILE, TILE, dx, dy, size, size);
}
