// Map data model, editing helpers, project save/load, Tiled (.tmj) import/export.
// No DOM access here so it can be unit tested in Node.

import { TILE, terrainById, tilesetById, PACKS } from "./catalog.js";

export const TILE_LAYERS = ["detail", "objects", "above"];
export const LAYERS = ["terrain", ...TILE_LAYERS, "collision"];

export function createMap(width, height, base = "grass") {
  const n = width * height;
  return {
    width,
    height,
    tile: TILE,
    base,
    terrain: new Array(n).fill(null),
    layers: Object.fromEntries(TILE_LAYERS.map((l) => [l, new Array(n).fill(null)])),
    collision: new Array(n).fill(0),
    background: null,
    objectGroups: [],
  };
}

export const tileRef = (tilesetId, col, row) => `${tilesetId}#${col},${row}`;

export function parseTileRef(ref) {
  const i = ref.lastIndexOf("#");
  const [col, row] = ref.slice(i + 1).split(",").map(Number);
  return { tilesetId: ref.slice(0, i), col, row };
}

export function getCell(map, layer, x, y) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  const i = y * map.width + x;
  if (layer === "terrain") return map.terrain[i];
  if (layer === "collision") return map.collision[i];
  return map.layers[layer][i];
}

/** Sets a cell and records the previous value in `changes` (Map of "layer:i" -> before). */
export function setCell(map, layer, x, y, value, changes) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const i = y * map.width + x;
  const arr = layer === "terrain" ? map.terrain : layer === "collision" ? map.collision : map.layers[layer];
  if (arr[i] === value) return false;
  const key = `${layer}:${i}`;
  if (changes && !changes.has(key)) changes.set(key, arr[i]);
  arr[i] = value;
  return true;
}

/** Applies a recorded change set in reverse and returns the inverse change set. */
export function revert(map, changes) {
  const inverse = new Map();
  for (const [key, before] of changes) {
    const [layer, idx] = key.split(":");
    const i = Number(idx);
    setCell(map, layer, i % map.width, Math.floor(i / map.width), before, inverse);
  }
  return inverse;
}

/** Flood fill from (x, y) over cells equal to the starting value. `valueAt(x, y)` gives the new value. */
export function floodFill(map, layer, x, y, valueAt, changes) {
  const start = getCell(map, layer, x, y);
  if (start === undefined) return [];
  const touched = [];
  const seen = new Uint8Array(map.width * map.height);
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) continue;
    const i = cy * map.width + cx;
    if (seen[i] || getCell(map, layer, cx, cy) !== start) continue;
    seen[i] = 1;
    touched.push([cx, cy]);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  for (const [cx, cy] of touched) setCell(map, layer, cx, cy, valueAt(cx, cy), changes);
  return touched;
}

/** Marks cells whose terrain is water, holes, lava etc. as blocked. Returns how many changed. */
export function autoCollision(map, changes) {
  let n = 0;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = map.terrain[y * map.width + x] ?? map.base;
      if (t && terrainById[t]?.blocked && setCell(map, "collision", x, y, 1, changes)) n++;
    }
  }
  return n;
}

// ── Project files ────────────────────────────────────────────────────────────

export function toProject(map) {
  return { format: "smart-farm-map", version: 1, ...map };
}

export function fromProject(json) {
  if (json?.format !== "smart-farm-map") throw new Error("Not a Smart-Farm map project file.");
  const map = createMap(json.width, json.height, json.base ?? null);
  const n = json.width * json.height;
  const take = (arr, fill) => (Array.isArray(arr) && arr.length === n ? arr.slice() : new Array(n).fill(fill));
  map.terrain = take(json.terrain, null);
  for (const l of TILE_LAYERS) map.layers[l] = take(json.layers?.[l], null);
  map.collision = take(json.collision, 0);
  map.background = json.background ?? null;
  map.objectGroups = Array.isArray(json.objectGroups) ? json.objectGroups : [];
  return map;
}

// ── Import maps from the AI generator (or any Tiled map with a collision layer) ──

/**
 * Converts an AI-generated .tmj into an editor map on the 32px LPC grid.
 * The background image (if given) is stretched over the whole map.
 */
export function importAiTmj(tmj, backgroundDataUrl = null) {
  const srcTile = tmj.tilewidth || TILE;
  const scale = srcTile / TILE;
  const width = Math.max(1, Math.round(tmj.width * scale));
  const height = Math.max(1, Math.round(tmj.height * scale));
  const map = createMap(width, height, null);

  const collisionLayer = (tmj.layers || []).find((l) => l.type === "tilelayer" && /collision/i.test(l.name));
  if (collisionLayer) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const sx = Math.min(tmj.width - 1, Math.floor(((x + 0.5) * TILE) / srcTile));
        const sy = Math.min(tmj.height - 1, Math.floor(((y + 0.5) * TILE) / srcTile));
        map.collision[y * width + x] = collisionLayer.data[sy * tmj.width + sx] ? 1 : 0;
      }
    }
  }

  const pxScale = (width * TILE) / (tmj.width * srcTile);
  map.objectGroups = (tmj.layers || [])
    .filter((l) => l.type === "objectgroup")
    .map((g) => ({
      name: g.name,
      objects: (g.objects || []).map((o) => ({
        ...o,
        x: Math.round(o.x * pxScale),
        y: Math.round(o.y * pxScale),
        width: Math.round((o.width || 0) * pxScale),
        height: Math.round((o.height || 0) * pxScale),
      })),
    }));

  if (backgroundDataUrl) map.background = { src: backgroundDataUrl };
  return map;
}

// ── Tiled export ─────────────────────────────────────────────────────────────

/** Tilesets used by the map's tile layers, in a stable order. */
export function usedTilesets(map) {
  const ids = new Set();
  for (const l of TILE_LAYERS) for (const ref of map.layers[l]) if (ref) ids.add(parseTileRef(ref).tilesetId);
  return [...ids].sort();
}

export function usedPacks(map) {
  const packs = new Set(usedTilesets(map).map((id) => tilesetById[id]?.pack));
  const terrains = new Set(map.terrain.filter(Boolean));
  if (map.base) terrains.add(map.base);
  for (const t of terrains) packs.add(tilesetById[terrainById[t]?.sheet]?.pack);
  packs.delete(undefined);
  return [...packs].sort();
}

export function creditsText(map) {
  const packs = usedPacks(map);
  const lines = [];
  if (packs.length) {
    lines.push("Tile art used in this map (credit required):", "", ...packs.map((p) => `- ${PACKS[p].credit}`), "");
  }
  if (map.background) lines.push("Background image: AI-generated (see the generator's model provider terms).");
  if (!lines.length) lines.push("This map uses no third-party tile art.");
  return lines.join("\n").trim() + "\n";
}

/**
 * Builds a Tiled map. Terrain (with its automatic edges) is baked into an image
 * layer "ground.png" because its 16px edge pieces have no whole-tile equivalent.
 * @param {object} map
 * @param {Record<string, {width:number,height:number}>} sheetSizes  pixel size per tileset id
 * @param {{hasGround:boolean}} opts
 */
export function buildTmj(map, sheetSizes, { hasGround = true } = {}) {
  const tilesets = [
    {
      firstgid: 1,
      name: "collision",
      image: "tilesets/collision.png",
      imagewidth: TILE,
      imageheight: TILE,
      tilewidth: TILE,
      tileheight: TILE,
      columns: 1,
      tilecount: 1,
      margin: 0,
      spacing: 0,
    },
  ];
  const gidBase = {};
  let next = 2;
  for (const id of usedTilesets(map)) {
    const size = sheetSizes[id];
    const columns = Math.floor(size.width / TILE);
    const tilecount = columns * Math.floor(size.height / TILE);
    gidBase[id] = { firstgid: next, columns };
    tilesets.push({
      firstgid: next,
      name: id,
      image: tilesetById[id].file.replace(/^assets\//, ""),
      imagewidth: size.width,
      imageheight: size.height,
      tilewidth: TILE,
      tileheight: TILE,
      columns,
      tilecount,
      margin: 0,
      spacing: 0,
    });
    next += tilecount;
  }

  const gid = (ref) => {
    if (!ref) return 0;
    const { tilesetId, col, row } = parseTileRef(ref);
    const b = gidBase[tilesetId];
    return b ? b.firstgid + row * b.columns + col : 0;
  };

  let id = 1;
  const base = { opacity: 1, visible: true, x: 0, y: 0 };
  const pxW = map.width * TILE;
  const pxH = map.height * TILE;
  const layers = [];
  if (map.background) {
    layers.push({ id: id++, name: "background", type: "imagelayer", image: "background.png", imagewidth: pxW, imageheight: pxH, ...base });
  }
  if (hasGround) {
    layers.push({ id: id++, name: "ground", type: "imagelayer", image: "ground.png", imagewidth: pxW, imageheight: pxH, ...base });
  }
  for (const l of TILE_LAYERS) {
    layers.push({
      id: id++,
      name: l,
      type: "tilelayer",
      width: map.width,
      height: map.height,
      data: map.layers[l].map(gid),
      ...base,
      ...(l === "above" ? { properties: [{ name: "drawAboveCharacters", type: "bool", value: true }] } : {}),
    });
  }
  layers.push({
    id: id++,
    name: "collision",
    type: "tilelayer",
    width: map.width,
    height: map.height,
    data: map.collision.map((c) => (c ? 1 : 0)),
    ...base,
    opacity: 0.4,
    visible: false,
  });
  let objId = 1;
  for (const g of map.objectGroups) {
    layers.push({
      id: id++,
      name: g.name,
      type: "objectgroup",
      draworder: "topdown",
      objects: g.objects.map((o) => ({ ...o, id: objId++ })),
      ...base,
    });
  }

  return {
    type: "map",
    version: "1.10",
    tiledversion: "1.10.2",
    orientation: "orthogonal",
    renderorder: "right-down",
    infinite: false,
    width: map.width,
    height: map.height,
    tilewidth: TILE,
    tileheight: TILE,
    compressionlevel: -1,
    nextlayerid: id,
    nextobjectid: objId,
    tilesets,
    layers,
  };
}

