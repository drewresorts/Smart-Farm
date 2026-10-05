import { test } from "node:test";
import assert from "node:assert/strict";

import { quadrantSource, terrainCellParts, CORNERS } from "../src/autotile.js";
import {
  createMap, setCell, getCell, revert, floodFill, autoCollision, tileRef,
  toProject, fromProject, importAiTmj, buildTmj, creditsText,
} from "../src/map.js";
import { crc32, makeZip } from "../src/zip.js";

const corner = (name) => CORNERS.find((c) => c.name === name);

test("autotile picks fill, edges, outer and inner corners", () => {
  assert.equal(quadrantSource(corner("tl"), true, true, true), null);
  assert.deepEqual(quadrantSource(corner("tl"), false, false, false), [0, 2]);
  assert.deepEqual(quadrantSource(corner("br"), false, false, true), [2, 4]);
  assert.deepEqual(quadrantSource(corner("tl"), true, false, false), [1, 2]); // top edge
  assert.deepEqual(quadrantSource(corner("bl"), true, false, false), [1, 4]); // bottom edge
  assert.deepEqual(quadrantSource(corner("tl"), false, true, false), [0, 3]); // left edge
  assert.deepEqual(quadrantSource(corner("tr"), false, true, false), [2, 3]); // right edge
  assert.deepEqual(quadrantSource(corner("br"), true, true, false), [1, 0]); // inner corner
  assert.deepEqual(quadrantSource(corner("tl"), true, true, false), [2, 1]);
});

test("isolated terrain cell is built from the four outer corners", () => {
  const parts = terrainCellParts(5, 5, (x, y) => x === 5 && y === 5, false);
  assert.equal(parts.length, 4);
  assert.deepEqual(parts.map((p) => p.slice(0, 2)), [[0, 64], [80, 64], [0, 144], [80, 144]]);
});

test("fully surrounded cell draws one whole fill tile", () => {
  const parts = terrainCellParts(1, 1, () => true, false);
  assert.deepEqual(parts, [[32, 96, 0, 0, 32]]);
});

test("setCell records changes and revert undoes and redoes them", () => {
  const m = createMap(4, 4);
  const changes = new Map();
  setCell(m, "terrain", 1, 1, "dirt", changes);
  setCell(m, "objects", 2, 2, tileRef("lpc-base/barrel", 0, 0), changes);
  setCell(m, "collision", 3, 3, 1, changes);
  const redo = revert(m, changes);
  assert.equal(getCell(m, "terrain", 1, 1), null);
  assert.equal(getCell(m, "objects", 2, 2), null);
  assert.equal(getCell(m, "collision", 3, 3), 0);
  revert(m, redo);
  assert.equal(getCell(m, "terrain", 1, 1), "dirt");
  assert.equal(getCell(m, "collision", 3, 3), 1);
});

test("flood fill stays inside the matching region", () => {
  const m = createMap(5, 5);
  for (let y = 0; y < 5; y++) setCell(m, "terrain", 2, y, "water");
  const touched = floodFill(m, "terrain", 0, 0, () => "dirt", new Map());
  assert.equal(touched.length, 10);
  assert.equal(getCell(m, "terrain", 4, 4), null);
  assert.equal(getCell(m, "terrain", 2, 2), "water");
});

test("auto collision blocks water but not dirt", () => {
  const m = createMap(3, 1, null);
  setCell(m, "terrain", 0, 0, "water");
  setCell(m, "terrain", 1, 0, "dirt");
  assert.equal(autoCollision(m, new Map()), 1);
  assert.deepEqual(m.collision, [1, 0, 0]);
});

test("project files round-trip", () => {
  const m = createMap(3, 2);
  setCell(m, "detail", 1, 1, tileRef("lpc-farming/plants", 2, 3));
  const back = fromProject(JSON.parse(JSON.stringify(toProject(m))));
  assert.deepEqual(back, m);
  assert.throws(() => fromProject({ width: 1 }), /Not a Smart-Farm/);
});

test("AI maps on a 16px grid are resampled to 32px tiles", () => {
  const data = new Array(8 * 4).fill(1);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) data[y * 8 + x] = 0; // left half walkable
  const tmj = {
    width: 8, height: 4, tilewidth: 16, tileheight: 16,
    layers: [
      { type: "imagelayer", name: "background", image: "06-background.png" },
      { type: "tilelayer", name: "collision", data },
      { type: "objectgroup", name: "regions", objects: [{ name: "Barn", x: 32, y: 16, width: 64, height: 32 }] },
    ],
  };
  const m = importAiTmj(tmj, "data:image/png;base64,AAAA");
  assert.equal(m.width, 4);
  assert.equal(m.height, 2);
  assert.deepEqual(m.collision, [0, 0, 1, 1, 0, 0, 1, 1]);
  assert.equal(m.base, null);
  assert.deepEqual(m.objectGroups[0].objects[0], { name: "Barn", x: 32, y: 16, width: 64, height: 32 });
});

test("Tiled export assigns gids per tileset and keeps collision values", () => {
  const m = createMap(2, 2);
  setCell(m, "objects", 0, 0, tileRef("lpc-base/barrel", 1, 1));
  setCell(m, "above", 1, 0, tileRef("lpc-base/treetop", 0, 0));
  setCell(m, "collision", 1, 1, 1);
  const sizes = { "lpc-base/barrel": { width: 128, height: 64 }, "lpc-base/treetop": { width: 192, height: 224 } };
  const tmj = buildTmj(m, sizes, { hasGround: true });
  const byName = Object.fromEntries(tmj.tilesets.map((t) => [t.name, t]));
  assert.equal(byName.collision.firstgid, 1);
  assert.equal(byName["lpc-base/barrel"].firstgid, 2);
  assert.equal(byName["lpc-base/barrel"].tilecount, 8);
  assert.equal(byName["lpc-base/treetop"].firstgid, 10);
  assert.equal(byName["lpc-base/barrel"].image, "tilesets/lpc-base/barrel.png");
  const layers = Object.fromEntries(tmj.layers.map((l) => [l.name, l]));
  assert.equal(layers.ground.image, "ground.png");
  assert.deepEqual(layers.objects.data, [2 + 1 * 4 + 1, 0, 0, 0]);
  assert.deepEqual(layers.above.data, [0, 10, 0, 0]);
  assert.deepEqual(layers.collision.data, [0, 0, 0, 1]);
  assert.match(creditsText(m), /Lanea Zimmerman/);
});

test("zip output has valid CRCs and an end-of-central-directory record", async () => {
  assert.equal(crc32(new TextEncoder().encode("hello")), 0x3610a686);
  const bytes = new Uint8Array(await makeZip([{ name: "a.txt", data: "hello" }]).arrayBuffer());
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(view.getUint32(14, true), 0x3610a686);
});
