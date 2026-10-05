#!/usr/bin/env node
/**
 * Downtown map generator: writes editor project files (maps/<id>.json) for city districts.
 *
 *   node tools/downtown.mjs                      # all districts
 *   node tools/downtown.mjs flats                # one district
 *   node tools/downtown.mjs --style victorian    # force a building style
 *
 * Two building styles:
 *   ranitaya  - whole-building sprites and street props from Ranitaya's City Essentials pack,
 *               at their native (smaller) scale, with half-size LPC cars and 2-tile lanes.
 *               Used automatically once the pack is imported (tools/import-ranitaya.mjs).
 *   victorian - buildings assembled from LPC Victorian wall, roof, window and door tiles,
 *               full-size LPC cars and 3-tile lanes. Openly licensed, always available.
 *
 * Open the results in the editor (Open), tweak them, then Export Tiled / Export PNG.
 * Each district is a grid of two-lane streets around city blocks. A block has a curbed
 * sidewalk ring and a row of buildings whose fronts face the street below them.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createMap, setCell, tileRef, toProject } from "../src/map.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RANITAYA_INDEX = join(ROOT, "assets", "tilesets", "ranitaya", "index.json");

/** The Ranitaya pack index, or null when the pack hasn't been imported. */
export function ranitayaIndex() {
  return existsSync(RANITAYA_INDEX) ? JSON.parse(readFileSync(RANITAYA_INDEX, "utf8")) : null;
}

// ── Tile references ──────────────────────────────────────────────────────────
const SIDEWALK = "lpc-modern-streets/sidewalk_terrain";
const CRACKS = "lpc-modern-streets/cracks_transparent";
const MARK_WHITE = "lpc-modern-streets/traffic_markings";
const MANHOLE = "lpc-modern-streets/manhole_and_cover";
const LIGHTS = "lpc-modern-streets/traffic_lights";
const BINS = "lpc-modern-streets/trash_bins";
const TIRES = "lpc-modern-streets/wheels_and_tires";
const YELLOW = "lpc-streets/road_markings_yellow";
const MISC = "lpc-streets/street_misc";
const TENEMENT = "lpc-victorian/tenement";
const WINDOWS = "lpc-victorian/windows-doors";
const ACC = "lpc-victorian/accessories";
const CARS = "lpc-cars/cars";
const SMALL_CARS = "lpc-cars/cars_small";
const R_BUILDINGS = "ranitaya/buildings";
const R_PROPS = "ranitaya/props";
// Row of each colour in cars_small.png (3 tiles per colour; see tools/make-small-cars.mjs).
const SMALL_CAR_ROW = { red: 0, police: 3, orange: 6, blue: 9, pickup: 12, navy: 15, yellow: 18, green: 21, mustard: 24, truck: 27 };
const TREETOP = "lpc-base/treetop";
const TRUNK = "lpc-base/trunk";
const GRASS = "lpc-base/grass";

// 3x3 tileable wall textures (tenement rows 61-63), by starting column.
const WALLS = { slate: 0, stone: 3, brown: 6, darkBrown: 9, red: 12, lightRed: 15, darkGray: 18, cream: 21 };
// 3x4 tileable roof textures (accessories rows 50-53), by starting column.
const ROOFS = { slate: 0, gray: 3, brown: 6, red: 9 };
// Windows: lintel, glass and sill stacked 1 wide x 3 tall.
const WINDOW_STYLES = [[6, 85], [8, 85], [6, 89], [8, 89]];
// Doors: 1 wide x 2 tall.
const DOOR_STYLES = [[0, 21], [4, 21], [8, 21]];
// Chimneys: 1 wide x 3 tall (tenement rows 68-70).
const CHIMNEYS = [6, 9, 12, 15];
// Cars by colour block: [column of the 6-wide block, first row of the block].
const CAR_BLOCKS = {
  red: [0, 0], police: [6, 0], orange: [12, 0], blue: [18, 0], pickup: [24, 0],
  navy: [0, 11], yellow: [6, 11], green: [12, 11], mustard: [18, 11], truck: [24, 11],
};

// ── District themes ──────────────────────────────────────────────────────────
const DISTRICTS = {
  flats: {
    name: "The Flats",
    walls: ["darkBrown", "darkGray", "slate", "red", "brown"],
    roofs: ["slate", "gray"],
    cars: ["red", "blue", "navy", "pickup", "mustard", "truck"],
    police: 1, carDensity: 0.35, cracks: 0.18, bins: 0.5, cones: 0.25, lights: 0.4,
    vacantLot: true, trees: 0, gaps: 0.35,
    rBuildings: ["Building1", "Building2", "Building7", "Building5", "Building1", "Building7"],
    rProps: ["Trashbag", "Trashbag", "Opened Trashbin", "Closed Trashbin", "Opened Cardboard box", "Horizental cardboard box", "Fire Hidrant"],
    lamps: 0.5,
  },
  midtown: {
    name: "Midtown",
    walls: ["red", "lightRed", "brown", "cream", "stone"],
    roofs: ["brown", "red", "slate"],
    cars: ["yellow", "yellow", "red", "blue", "green", "orange", "navy"],
    police: 1, carDensity: 0.7, cracks: 0.04, bins: 0.25, cones: 0.05, lights: 1,
    vacantLot: false, trees: 0, gaps: 0.15,
    rBuildings: ["Building3", "Building4", "Building1", "Building2", "Building6", "Building3", "Building4"],
    rProps: ["Red Vending machine", "Yellow Vending Machine", "Closed Trashbin", "Fire Hidrant", "Plant2", "Green Vending Machine"],
    lamps: 1,
  },
  portside: {
    name: "Portside",
    walls: ["darkGray", "slate", "darkBrown"],
    roofs: ["gray", "slate"],
    cars: ["truck", "pickup", "truck", "navy", "mustard"],
    police: 0, carDensity: 0.4, cracks: 0.12, bins: 0.35, cones: 0.4, lights: 0.3,
    vacantLot: true, trees: 0, gaps: 0.25, wide: true,
    rBuildings: ["Building5", "Building5", "Building2", "Building5", "Building7"],
    rProps: ["Horizental cardboard box", "vertical cardboardbox", "Opened Cardboard box", "Trashbag", "Closed Trashbin", "Fire Hidrant"],
    lamps: 0.4,
  },
  goldcoast: {
    name: "Gold Coast",
    walls: ["cream", "stone", "lightRed"],
    roofs: ["slate", "red", "brown"],
    cars: ["navy", "green", "red", "blue"],
    police: 2, carDensity: 0.45, cracks: 0, bins: 0.1, cones: 0, lights: 1,
    vacantLot: false, trees: 0.45, gaps: 0.1,
    rBuildings: ["Building6", "Building7", "Building4", "Building7", "Building3"],
    rProps: ["Tree1", "Tree2", "Tree3", "Bush1", "Bush2", "Plant1", "Plant3", "Fire Hidrant"],
    lamps: 1,
  },
};

// ── Layout ───────────────────────────────────────────────────────────────────
// Columns and rows alternate block / road.
const LAYOUTS = {
  // Roads are 6 tiles: two 3-tile lanes for full-size LPC cars.
  victorian: {
    road: 6, crosswalk: 2,
    xs: [["block", 14], ["road", 6], ["block", 16], ["road", 6], ["block", 14]],
    ys: [["block", 11], ["road", 6], ["block", 11], ["road", 6], ["block", 11]],
  },
  // Roads are 4 tiles: two 2-tile lanes for half-size cars. Blocks hold buildings up to 7 tiles tall.
  ranitaya: {
    road: 4, crosswalk: 1,
    xs: [["block", 18], ["road", 4], ["block", 22], ["road", 4], ["block", 18]],
    ys: [["block", 11], ["road", 4], ["block", 11], ["road", 4], ["block", 11]],
  },
};

function spans(list) {
  let at = 0;
  return list.map(([kind, size]) => {
    const s = { kind, start: at, end: at + size - 1 };
    at += size;
    return s;
  });
}

function rng(seedText) {
  let h = 2166136261;
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDistrict(id, { style } = {}) {
  const theme = DISTRICTS[id];
  const index = ranitayaIndex();
  style ??= index ? "ranitaya" : "victorian";
  if (style === "ranitaya" && !index) throw new Error("Import the Ranitaya pack first: node tools/import-ranitaya.mjs <zip>");
  const L = LAYOUTS[style];
  const r = rng(`downtown-${id}-${style}`);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const chance = (p) => r() < p;

  const cols = spans(L.xs);
  const rows = spans(L.ys);
  const width = cols.at(-1).end + 1;
  const height = rows.at(-1).end + 1;
  const map = createMap(width, height, "asphalt");
  const regions = [];

  const set = (layer, x, y, ref) => setCell(map, layer, x, y, ref);
  const block = (x, y) => setCell(map, "collision", x, y, 1);
  const stamp = (layer, sheet, c0, r0, w, h, x, y, solid = true) => {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        set(layer, x + dx, y + dy, tileRef(sheet, c0 + dx, r0 + dy));
        if (solid) block(x + dx, y + dy);
      }
    }
  };
  const isRoad = (x, y) => cols.some((c) => c.kind === "road" && x >= c.start && x <= c.end) ||
    rows.some((rw) => rw.kind === "road" && y >= rw.start && y <= rw.end);

  // Roads: cracks, manholes, centre lines and crosswalks.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isRoad(x, y)) continue;
      if (chance(theme.cracks)) set("detail", x, y, tileRef(CRACKS, Math.floor(r() * 6), Math.floor(r() * 3)));
      else if (chance(0.01)) set("detail", x, y, tileRef(MANHOLE, 1, 0));
    }
  }
  const vRoads = cols.filter((c) => c.kind === "road");
  const hRoads = rows.filter((c) => c.kind === "road");
  const inV = (x) => vRoads.some((c) => x >= c.start && x <= c.end);
  const inH = (y) => hRoads.some((c) => y >= c.start && y <= c.end);
  for (const c of vRoads) {
    for (let y = 0; y < height; y++) {
      if (inH(y)) continue;
      // Dashed yellow centre line hugging the left edge of the right-hand lane.
      set("detail", c.start + L.road / 2, y, tileRef(YELLOW, 6, 11));
    }
  }
  for (const rw of hRoads) {
    for (let x = 0; x < width; x++) {
      if (inV(x)) continue;
      set("detail", x, rw.start + L.road / 2, tileRef(YELLOW, 11, 6));
    }
  }
  // Crosswalks on every side of each intersection.
  for (const c of vRoads) {
    for (const rw of hRoads) {
      for (let x = c.start; x <= c.end; x++) {
        set("detail", x, rw.start - L.crosswalk, tileRef(MARK_WHITE, 5, 1));
        set("detail", x, rw.end + L.crosswalk, tileRef(MARK_WHITE, 5, 1));
      }
      for (let y = rw.start; y <= rw.end; y++) {
        set("detail", c.start - L.crosswalk, y, tileRef(MARK_WHITE, 7, 0));
        set("detail", c.end + L.crosswalk, y, tileRef(MARK_WHITE, 7, 0));
      }
    }
  }

  // Blocks.
  const blocks = [];
  for (const c of cols.filter((s) => s.kind === "block")) {
    for (const rw of rows.filter((s) => s.kind === "block")) blocks.push({ x0: c.start, x1: c.end, y0: rw.start, y1: rw.end });
  }
  const vacant = theme.vacantLot ? Math.floor(r() * blocks.length) : -1;

  const rBuild = index ? Object.fromEntries(index.buildings.map((bd) => [bd.name, bd])) : {};
  const rProp = index ? Object.fromEntries(index.props.map((pr) => [pr.name, pr])) : {};
  blocks.forEach((b, bi) => {
    // Curbed sidewalk ring: corner-based tiles, so the curb runs through the outer tiles.
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const col = x === b.x0 ? 0 : x === b.x1 ? 2 : 1;
        const row = y === b.y0 ? 0 : y === b.y1 ? 2 : 1;
        set("detail", x, y, tileRef(SIDEWALK, col, row));
      }
    }
    // Building zone: inside the 2-tile sidewalk ring.
    const bx0 = b.x0 + 2;
    const bx1 = b.x1 - 2;
    const by0 = b.y0 + 2;
    const by1 = b.y1 - 2;

    if (bi === vacant) {
      vacantLot(bx0, by0, bx1, by1);
    } else if (style === "ranitaya") {
      spriteRow(bx0, by0, bx1, by1);
    } else {
      buildRow(bx0, by0, bx1, by1);
    }

    // Traffic lights at the block corners that face an intersection.
    const lightLayer = style === "ranitaya" ? "decor" : "objects";
    const taken = new Set();
    for (const [cx, cy] of [[b.x0 + 1, b.y1 - 2], [b.x1 - 1, b.y1 - 2], [b.x0 + 1, b.y0 + 1], [b.x1 - 1, b.y0 + 1]]) {
      const nearRoad = isRoad(cx < (b.x0 + b.x1) / 2 ? b.x0 - 1 : b.x1 + 1, cy) && isRoad(cx, cy < (b.y0 + b.y1) / 2 ? b.y0 - 1 : b.y1 + 1);
      if (nearRoad && chance(theme.lights)) {
        stamp(lightLayer, LIGHTS, pick([1, 2, 4]), 0, 1, 2, cx, cy);
        taken.add(`${cx},${cy + 1}`);
      }
    }

    if (style === "ranitaya") {
      sidewalkProps(b, taken);
    } else {
      // Street furniture on the side sidewalks (1 tile in from the curb).
      for (const x of [b.x0 + 1, b.x1 - 1]) {
        for (let y = b.y0 + 2; y <= b.y1 - 3; y += 3) {
          if (chance(theme.bins)) stamp("objects", BINS, pick([1, 3, 5]), 0, 1, 2, x, y);
          else if (chance(theme.cones)) stamp("objects", MISC, 0, 6, 1, 1, x, y + 1);
        }
      }
    }
  });

  // ── Ranitaya style ─────────────────────────────────────────────────────────

  /** Places a 1x2 prop so its base sits on row `y` (drawn over buildings, in the decor layer). */
  function prop(name, x, y, solid = true) {
    const pr = rProp[name];
    if (!pr) return;
    stamp("decor", R_PROPS, pr.col, pr.row, pr.w, pr.h, x, y - pr.h + 1, false);
    if (solid) block(x, y);
  }

  /** Fills a building zone with whole-building sprites standing on its bottom row. */
  function spriteRow(x0, y0, x1, y1) {
    const zoneH = y1 - y0 + 1;
    let x = x0;
    while (x <= x1) {
      const fits = theme.rBuildings.map((n) => rBuild[n]).filter((bd) => bd && bd.w <= x1 - x + 1 && bd.h <= zoneH);
      if (!fits.length) break;
      const bd = pick(fits);
      const top = y1 - bd.h + 1;
      stamp("objects", R_BUILDINGS, bd.col, bd.row, bd.w, bd.h, x, top, false);
      // Collision covers the drawn sprite (it is centred in its slot and stands on the bottom row).
      const left = x * 32 + Math.floor((bd.w * 32 - bd.pxWidth) / 2);
      for (let cy = Math.floor((y1 + 1) * 32 - bd.pxHeight) / 32 | 0; cy <= y1; cy++) {
        for (let cx = Math.floor(left / 32); cx <= Math.floor((left + bd.pxWidth - 1) / 32); cx++) block(cx, cy);
      }
      regions.push({ name: `${theme.name} ${bd.name}`, x, y: top, w: bd.w, h: bd.h });
      x += bd.w;
      if (x <= x1 - 2 && chance(theme.gaps)) {
        // A narrow gap between buildings with something in it.
        prop(pick(theme.rProps), x, y1);
        x += 1;
      }
    }
    // Leftover strip at the end of the row: greenery or clutter.
    for (; x <= x1; x++) if (chance(0.6)) prop(pick(theme.rProps), x, y1);
  }

  /** Street lamps along the front sidewalk, district clutter on the sidewalks. */
  function sidewalkProps(b, taken) {
    const frontY = b.y1 - 1; // sidewalk row in front of the buildings
    for (let x = b.x0 + 2; x <= b.x1 - 2; x++) {
      if (taken.has(`${x},${frontY}`)) continue;
      if ((x - b.x0) % 6 === 3 && chance(theme.lamps)) {
        prop("Light Pole", x, frontY);
      } else if (chance(0.12)) {
        prop(pick(theme.rProps), x, frontY);
      } else continue;
      taken.add(`${x},${frontY}`);
    }
    for (const x of [b.x0 + 1, b.x1 - 1]) {
      for (let y = b.y0 + 3; y <= b.y1 - 3; y += 2) {
        if (taken.has(`${x},${y}`)) continue;
        if (chance(theme.trees ? 0.6 : 0.25)) prop(pick(theme.rProps), x, y);
      }
    }
  }

  function buildRow(x0, y0, x1, y1) {
    let x = x0;
    while (x <= x1) {
      const remaining = x1 - x + 1;
      let w = theme.wide ? 8 + Math.floor(r() * 5) : 4 + Math.floor(r() * 4);
      if (remaining - w < 3) w = remaining; // don't leave a sliver
      building(x, y0, x + w - 1, y1);
      x += w;
      if (x <= x1 - 5 && chance(theme.trees)) {
        garden(x, y0, y1);
        x += 3;
      } else if (x <= x1 - 3 && chance(theme.gaps)) {
        alley(x, y0, y1);
        x += 1;
      }
    }
  }

  function building(x0, y0, x1, y1) {
    const wall = WALLS[pick(theme.walls)];
    const roof = ROOFS[pick(theme.roofs)];
    const facade = 4;
    const fy0 = y1 - facade + 1;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const ref = y < fy0
          ? tileRef(ACC, roof + ((x - x0) % 3), 50 + ((y - y0) % 4))
          : tileRef(TENEMENT, wall + ((x - x0) % 3), y === y1 ? 63 : y === fy0 ? 61 : 62);
        set("objects", x, y, ref);
        block(x, y);
      }
    }
    const win = pick(WINDOW_STYLES);
    const door = theme.wide ? null : pick(DOOR_STYLES);
    const doorX = x0 + Math.floor((x1 - x0) / 2);
    for (let x = x0 + 1; x <= x1 - 1; x += 2) {
      if (door && x === doorX) continue;
      stamp("decor", WINDOWS, win[0], win[1], 1, 3, x, fy0 - 1, false);
    }
    if (door) stamp("decor", WINDOWS, door[0], door[1], 1, 2, doorX, y1 - 1, false);
    else stamp("decor", WINDOWS, 0, 21, 1, 2, x0 + 1, y1 - 1, false); // warehouse side door
    if (y1 - y0 >= facade + 3 && chance(0.6)) {
      stamp("decor", TENEMENT, pick(CHIMNEYS), 68, 1, 3, x0 + 1 + Math.floor(r() * Math.max(1, x1 - x0 - 1)), y0, false);
    }
    regions.push({ name: `${theme.name} building`, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }

  function alley(x, y0, y1) {
    for (let y = y0; y <= y1; y++) set("detail", x, y, tileRef(SIDEWALK, 6 + (y % 2), 5));
    if (chance(0.7)) stamp("objects", BINS, pick([1, 3, 5]), 0, 1, 2, x, y1 - 2);
  }

  function vacantLot(x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        set("detail", x, y, chance(0.5) ? tileRef(CRACKS, Math.floor(r() * 6), Math.floor(r() * 3)) : null);
      }
    }
    // Tyre piles and cones scattered in the lot.
    for (let i = 0; i < 4; i++) {
      const x = x0 + 1 + Math.floor(r() * Math.max(1, x1 - x0 - 2));
      const y = y0 + 1 + Math.floor(r() * Math.max(1, y1 - y0 - 2));
      if (i % 2) stamp("objects", TIRES, 0, 3, 2, 2, x, y);
      else stamp("objects", MISC, 0, 6, 1, 1, x, y);
    }
    regions.push({ name: `${theme.name} vacant lot`, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }

  /** A 3-wide lawn between buildings with a tree in it. */
  function garden(x, y0, y1) {
    for (let y = y0; y <= y1; y++) for (let dx = 0; dx < 3; dx++) set("detail", x + dx, y, tileRef(GRASS, 1, 3));
    const ty = y0 + Math.floor(r() * Math.max(1, y1 - y0 - 4));
    stamp("above", TREETOP, 0, 0, 3, 3, x, ty, false);
    stamp("objects", TRUNK, 0, 0, 3, 3, x, ty + 2, false);
    block(x + 1, ty + 4);
    regions.push({ name: `${theme.name} garden`, x, y: y0, w: 3, h: y1 - y0 + 1 });
  }

  // Cars: parked against the kerb and driving in lanes.
  let police = theme.police;
  const car = () => (police > 0 && chance(0.3) ? (police--, "police") : pick(theme.cars));
  // Traffic keeps to the right: the upper lane of a street drives west (cars face left),
  // the lower lane east; on avenues the left lane drives south, the right lane north.
  const small = style === "ranitaya";
  const len = small ? 3 : 6; // horizontal car length in tiles
  const tall = small ? 3 : 5; // vertical car length in tiles
  const lane = L.road / 2;
  // Keep cars out of junctions and off the crosswalks either side of them.
  const clear = (inRoad, a, n) => {
    for (let i = a - L.crosswalk; i < a + n + L.crosswalk; i++) if (inRoad(i)) return false;
    return true;
  };
  for (const rw of hRoads) {
    for (let x = 0; x + len <= width; x += len + 1) {
      if (!clear(inV, x, len) || !chance(theme.carDensity)) continue;
      const upper = chance(0.5);
      const y = upper ? rw.start : rw.start + lane;
      if (small) stamp("objects", SMALL_CARS, upper ? 0 : 3, SMALL_CAR_ROW[car()], 3, 2, x, y);
      else {
        const [cx, cy] = CAR_BLOCKS[car()];
        stamp("objects", CARS, cx, cy + (upper ? 0 : 8), 6, 3, x, y);
      }
    }
  }
  for (const c of vRoads) {
    for (let y = 0; y + tall <= height; y += tall + 1) {
      if (!clear(inH, y, tall) || !chance(theme.carDensity)) continue;
      const left = chance(0.5);
      const x = left ? c.start : c.start + lane;
      if (small) stamp("objects", SMALL_CARS, left ? 6 : 8, SMALL_CAR_ROW[car()], 2, 3, x, y);
      else {
        const [cx, cy] = CAR_BLOCKS[car()];
        stamp("objects", CARS, cx + (left ? 0 : 3), cy + 3, 3, 5, x, y);
      }
    }
  }

  map.objectGroups = [
    {
      name: "regions",
      objects: regions.map((g) => ({ name: g.name, type: "", x: g.x * 32, y: g.y * 32, width: g.w * 32, height: g.h * 32, rotation: 0, visible: true })),
    },
  ];
  return map;
}

export const DISTRICT_IDS = Object.keys(DISTRICTS);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const styleAt = args.indexOf("--style");
  const style = styleAt >= 0 ? args.splice(styleAt, 2)[1] : undefined;
  const only = args[0];
  const outDir = join(ROOT, "maps");
  mkdirSync(outDir, { recursive: true });
  for (const id of DISTRICT_IDS.filter((d) => !only || d === only)) {
    const map = generateDistrict(id, { style });
    writeFileSync(join(outDir, `${id}.json`), JSON.stringify(toProject(map)));
    console.log(`${id}: ${map.width}x${map.height} -> maps/${id}.json`);
  }
}
