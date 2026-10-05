// Automatic edges for terrain sheets in the standard LPC layout (3x6 tiles of 32px):
//
//   row 0-1, col 0   : decorations (unused here)
//   rows 0-1, cols 1-2: inner corners (a 2x2 block showing a hole in the terrain)
//   rows 2-4          : 3x3 block — outer corners, edges, centre fill at (1,3)
//   row 5             : fill variations
//
// Each map cell is drawn as four 16px quadrants. A quadrant looks at its two
// orthogonal neighbours and the diagonal between them, then copies the matching
// quadrant from the sheet.

export const HALF = 16;

// Quadrant corners: dx/dy point from the cell towards that corner.
export const CORNERS = [
  { name: "tl", dx: -1, dy: -1, qx: 0, qy: 0 },
  { name: "tr", dx: 1, dy: -1, qx: 1, qy: 0 },
  { name: "bl", dx: -1, dy: 1, qx: 0, qy: 1 },
  { name: "br", dx: 1, dy: 1, qx: 1, qy: 1 },
];

// Inner-corner tile to use when only the diagonal in that direction is missing.
const INNER = { tl: [2, 1], tr: [1, 1], bl: [2, 0], br: [1, 0] };
const OUTER = { tl: [0, 2], tr: [2, 2], bl: [0, 4], br: [2, 4] };

/**
 * Which sheet tile (in 32px tile units) supplies one quadrant of a cell.
 * @param {{dx:number, dy:number, name:string}} corner
 * @param {boolean} h  same terrain in the horizontal neighbour (towards dx)
 * @param {boolean} v  same terrain in the vertical neighbour (towards dy)
 * @param {boolean} d  same terrain in the diagonal neighbour
 * @returns {[number, number] | null} sheet tile, or null for "use the fill tile"
 */
export function quadrantSource(corner, h, v, d) {
  if (h && v) return d ? null : INNER[corner.name];
  if (!h && !v) return OUTER[corner.name];
  if (h) return [1, corner.dy < 0 ? 2 : 4]; // top or bottom edge
  return [corner.dx < 0 ? 0 : 2, 3]; // left or right edge
}

/** Fill tile for a cell; `variants` picks a stable pseudo-random bottom-row variation. */
export function fillTile(x, y, variants) {
  if (!variants) return [1, 3];
  const n = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  const r = n % 8;
  return r < 3 ? [r, 5] : [1, 3];
}

/**
 * Draw commands for one terrain cell: [sheetX, sheetY, destX, destY, size] in pixels.
 * `same(x, y)` says whether a neighbouring cell has the same terrain
 * (cells outside the map count as the same, so map borders stay seamless).
 */
export function terrainCellParts(x, y, same, variants) {
  const parts = [];
  const fill = fillTile(x, y, variants);
  const allFull = CORNERS.every((c) => same(x + c.dx, y) && same(x, y + c.dy) && same(x + c.dx, y + c.dy));
  if (allFull) {
    parts.push([fill[0] * 32, fill[1] * 32, 0, 0, 32]);
    return parts;
  }
  for (const c of CORNERS) {
    const src = quadrantSource(c, same(x + c.dx, y), same(x, y + c.dy), same(x + c.dx, y + c.dy)) || [1, 3];
    parts.push([src[0] * 32 + c.qx * HALF, src[1] * 32 + c.qy * HALF, c.qx * HALF, c.qy * HALF, HALF]);
  }
  return parts;
}
