import { TILE, TILESETS, TERRAINS, terrainById, tilesetById } from "./catalog.js";
import {
  createMap, getCell, setCell, revert, floodFill, autoCollision, tileRef, parseTileRef,
  toProject, fromProject, importAiTmj, buildTmj, usedTilesets, creditsText, TILE_LAYERS,
} from "./map.js";
import { renderCells, drawTile } from "./render.js";
import { makeZip } from "./zip.js";

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "lpc-map-editor/autosave";
const LAYER_INFO = [
  { id: "terrain", name: "Terrain" },
  { id: "detail", name: "Detail" },
  { id: "objects", name: "Objects" },
  { id: "decor", name: "Decor (on objects)" },
  { id: "above", name: "Above characters" },
  { id: "collision", name: "Collision" },
];

const state = {
  map: null,
  sheets: {},
  sheetSizes: {},
  world: document.createElement("canvas"),
  background: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  tool: "brush",
  layer: "terrain",
  terrain: "dirt",
  stamp: null, // { tilesetId, col, row, w, h }
  visible: Object.fromEntries([...LAYER_INFO.map((l) => [l.id, true]), ["background", true]]),
  undo: [],
  redo: [],
  hover: null,
  drag: null,
  spaceDown: false,
};

const view = $("view");
const vctx = view.getContext("2d");
const wctx = state.world.getContext("2d");

// ── Startup ──────────────────────────────────────────────────────────────────

async function loadSheets() {
  await Promise.all(
    TILESETS.map(
      (t) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            state.sheets[t.id] = img;
            state.sheetSizes[t.id] = { width: img.width, height: img.height };
            resolve();
          };
          img.onerror = () => {
            console.warn(`Could not load ${t.file}`);
            resolve();
          };
          img.src = t.file;
        }),
    ),
  );
}

async function init() {
  buildUi();
  await loadSheets();
  buildPalettes();
  let restored = false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      await setMap(fromProject(JSON.parse(saved)));
      restored = true;
    }
  } catch (err) {
    console.warn("Autosave not restored:", err);
  }
  if (!restored) await setMap(createMap(40, 30, "grass"));
  selectTool("brush");
  selectLayer("terrain");
  selectTerrain("dirt");
  showTab("terrain");
  fitView();
  status(restored ? "Restored your last map." : "New 40×30 map. Pick a terrain or tiles and start painting.");
}

async function setMap(map) {
  state.map = map;
  state.undo = [];
  state.redo = [];
  state.background = map.background ? await loadImage(map.background.src) : null;
  state.world.width = map.width * TILE;
  state.world.height = map.height * TILE;
  $("base-select").value = map.base ?? "";
  renderLayerList();
  renderAll();
  updateUndoButtons();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

// ── UI construction ──────────────────────────────────────────────────────────

function buildUi() {
  for (const b of document.querySelectorAll("#tools button")) b.onclick = () => selectTool(b.dataset.tool);
  for (const b of document.querySelectorAll(".tab")) b.onclick = () => showTab(b.dataset.tab);

  const terrainOptions = TERRAINS.map((t) => `<option value="${t.id}">${t.name}</option>`).join("");
  $("base-select").innerHTML = `<option value="">None</option>${terrainOptions}`;
  $("new-base").innerHTML = `<option value="">None</option>${terrainOptions}`;
  $("new-base").value = "grass";
  $("base-select").onchange = (e) => {
    state.map.base = e.target.value || null;
    renderAll();
    scheduleSave();
  };

  $("tileset-select").onchange = () => drawSheet();

  $("show-grid").onchange = draw;
  $("show-regions").onchange = draw;
  $("btn-autocollision").onclick = () => {
    const changes = new Map();
    const n = autoCollision(state.map, changes);
    commit(changes);
    renderAll();
    status(n ? `Marked ${n} water/hole/lava tiles as blocked.` : "No new tiles to block.");
  };

  $("btn-new").onclick = () => $("dlg-new").showModal();
  $("dlg-new").addEventListener("close", async () => {
    if ($("dlg-new").returnValue !== "ok") return;
    const w = clampInt($("new-w").value, 4, 512);
    const h = clampInt($("new-h").value, 4, 512);
    await setMap(createMap(w, h, $("new-base").value || null));
    fitView();
    scheduleSave();
    status(`New ${w}×${h} map.`);
  });
  $("btn-open").onclick = () => $("file-open").click();
  $("file-open").onchange = openProject;
  $("btn-save").onclick = saveProject;
  $("btn-import").onclick = () => $("file-import").click();
  $("file-import").onchange = importAiMap;
  $("btn-export").onclick = exportTiled;
  $("btn-png").onclick = exportPng;
  $("btn-undo").onclick = undo;
  $("btn-redo").onclick = redo;
  $("btn-zoom-in").onclick = () => zoomAt(state.zoom * 1.25);
  $("btn-zoom-out").onclick = () => zoomAt(state.zoom / 1.25);
  $("btn-fit").onclick = fitView;

  new ResizeObserver(() => draw()).observe($("stage"));
  view.addEventListener("pointerdown", onPointerDown);
  view.addEventListener("pointermove", onPointerMove);
  view.addEventListener("pointerup", onPointerUp);
  view.addEventListener("pointerleave", () => { state.hover = null; draw(); });
  view.addEventListener("contextmenu", (e) => e.preventDefault());
  view.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", (e) => { if (e.code === "Space") state.spaceDown = false; });
}

function renderLayerList() {
  const items = [...LAYER_INFO];
  if (state.background) items.unshift({ id: "background", name: "AI background", noEdit: true });
  $("layers").innerHTML = items
    .map(
      (l) => `<li data-layer="${l.id}" class="${l.id === state.layer ? "active" : ""}">
        <input type="checkbox" ${state.visible[l.id] ? "checked" : ""} title="Show or hide" data-vis="${l.id}">
        <span>${l.name}</span></li>`,
    )
    .join("");
  for (const li of $("layers").querySelectorAll("li")) {
    li.onclick = (e) => {
      if (e.target.dataset.vis) return;
      if (li.dataset.layer !== "background") selectLayer(li.dataset.layer);
    };
  }
  for (const cb of $("layers").querySelectorAll("input")) {
    cb.onchange = () => {
      state.visible[cb.dataset.vis] = cb.checked;
      renderAll();
    };
  }
}

function buildPalettes() {
  // Sheets that failed to load (e.g. an optional pack that hasn't been imported) are left out.
  $("tileset-select").innerHTML = TILESETS.filter((t) => state.sheets[t.id]).map((t) => `<option value="${t.id}">${t.name}</option>`).join("");
  $("terrain-grid").innerHTML = "";
  for (const t of TERRAINS) {
    const b = document.createElement("button");
    b.dataset.terrain = t.id;
    b.title = t.blocked ? `${t.name} (blocked by Auto collision)` : t.name;
    const c = document.createElement("canvas");
    c.width = c.height = TILE;
    const img = state.sheets[t.sheet];
    const [pc, pr] = t.fill ?? [1, 3];
    if (img) c.getContext("2d").drawImage(img, pc * TILE, pr * TILE, TILE, TILE, 0, 0, TILE, TILE);
    b.append(c, document.createTextNode(t.name));
    b.onclick = () => selectTerrain(t.id);
    $("terrain-grid").append(b);
  }
  const sheet = $("sheet-canvas");
  let sel = null;
  const cellAt = (e) => {
    const r = sheet.getBoundingClientRect();
    const img = state.sheets[$("tileset-select").value];
    const cols = Math.floor(img.width / TILE);
    const rows = Math.floor(img.height / TILE);
    return {
      x: clampInt(Math.floor(((e.clientX - r.left) / r.width) * sheet.width / TILE), 0, cols - 1),
      y: clampInt(Math.floor(((e.clientY - r.top) / r.height) * sheet.height / TILE), 0, rows - 1),
    };
  };
  sheet.addEventListener("pointerdown", (e) => {
    sheet.setPointerCapture(e.pointerId);
    sel = { a: cellAt(e) };
    setStampFrom(sel.a, sel.a);
  });
  sheet.addEventListener("pointermove", (e) => {
    if (sel) setStampFrom(sel.a, cellAt(e));
  });
  sheet.addEventListener("pointerup", () => { sel = null; });
  drawSheet();
}

function setStampFrom(a, b) {
  const tilesetId = $("tileset-select").value;
  state.stamp = {
    tilesetId,
    col: Math.min(a.x, b.x),
    row: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x) + 1,
    h: Math.abs(a.y - b.y) + 1,
  };
  if (state.layer === "terrain" || state.layer === "collision") selectLayer("objects");
  if (state.tool === "erase" || state.tool === "pick") selectTool("brush");
  drawSheet();
  status(`Stamp: ${state.stamp.w}×${state.stamp.h} tiles from ${tilesetById[tilesetId].name}.`);
}

function drawSheet() {
  const id = $("tileset-select").value;
  const img = state.sheets[id];
  const c = $("sheet-canvas");
  if (!img) return;
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  for (let x = 0; x <= img.width; x += TILE) line(ctx, x + 0.5, 0, x + 0.5, img.height);
  for (let y = 0; y <= img.height; y += TILE) line(ctx, 0, y + 0.5, img.width, y + 0.5);
  const s = state.stamp;
  if (s && s.tilesetId === id) {
    ctx.strokeStyle = "#ff3b30";
    ctx.lineWidth = 2;
    ctx.strokeRect(s.col * TILE + 1, s.row * TILE + 1, s.w * TILE - 2, s.h * TILE - 2);
    ctx.lineWidth = 1;
  }
}

function selectTool(tool) {
  state.tool = tool;
  for (const b of document.querySelectorAll("#tools button")) b.classList.toggle("active", b.dataset.tool === tool);
}

function selectLayer(layer) {
  state.layer = layer;
  for (const li of $("layers").querySelectorAll("li")) li.classList.toggle("active", li.dataset.layer === layer);
  if (layer === "terrain") showTab("terrain");
  else if (TILE_LAYERS.includes(layer)) showTab("tiles");
  draw();
}

function selectTerrain(id) {
  state.terrain = id;
  for (const b of $("terrain-grid").querySelectorAll("button")) b.classList.toggle("active", b.dataset.terrain === id);
  if (state.layer !== "terrain") selectLayer("terrain");
  if (state.tool === "erase" || state.tool === "pick") selectTool("brush");
}

function showTab(tab) {
  for (const b of document.querySelectorAll(".tab")) b.classList.toggle("active", b.dataset.tab === tab);
  $("tab-terrain").hidden = tab !== "terrain";
  $("tab-tiles").hidden = tab !== "tiles";
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderOpts() {
  return { background: state.background, layers: state.visible };
}

function renderAll() {
  const m = state.map;
  renderCells(wctx, m, state.sheets, { x0: 0, y0: 0, x1: m.width - 1, y1: m.height - 1 }, renderOpts());
  draw();
}

function renderDirty(cells) {
  if (!cells.length) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of cells) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  // Terrain edges depend on neighbours, so redraw one extra cell around the change.
  renderCells(wctx, state.map, state.sheets, { x0: x0 - 1, y0: y0 - 1, x1: x1 + 1, y1: y1 + 1 }, renderOpts());
  draw();
}

function draw() {
  const dpr = window.devicePixelRatio || 1;
  const w = view.clientWidth;
  const h = view.clientHeight;
  if (view.width !== Math.round(w * dpr) || view.height !== Math.round(h * dpr)) {
    view.width = Math.round(w * dpr);
    view.height = Math.round(h * dpr);
  }
  const m = state.map;
  if (!m) return;
  vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  vctx.clearRect(0, 0, w, h);
  vctx.imageSmoothingEnabled = false;
  const z = state.zoom;
  vctx.save();
  vctx.translate(state.panX, state.panY);
  vctx.scale(z, z);
  vctx.fillStyle = "rgba(0,0,0,0.25)";
  vctx.fillRect(4 / z, 4 / z, m.width * TILE, m.height * TILE);
  vctx.drawImage(state.world, 0, 0);

  if (state.visible.collision && (state.layer === "collision" || state.tool === "pick" || m.collision.some(Boolean))) {
    vctx.fillStyle = state.layer === "collision" ? "rgba(255,40,40,0.45)" : "rgba(255,40,40,0.18)";
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) if (m.collision[y * m.width + x]) vctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  if ($("show-grid").checked && z >= 0.4) {
    vctx.strokeStyle = "rgba(0,0,0,0.12)";
    vctx.lineWidth = 1 / z;
    for (let x = 0; x <= m.width; x++) line(vctx, x * TILE, 0, x * TILE, m.height * TILE);
    for (let y = 0; y <= m.height; y++) line(vctx, 0, y * TILE, m.width * TILE, y * TILE);
  }

  if ($("show-regions").checked) {
    vctx.font = `${Math.max(10, 12 / z)}px system-ui, sans-serif`;
    vctx.lineWidth = 2 / z;
    for (const g of m.objectGroups) {
      vctx.strokeStyle = /interactive/i.test(g.name) ? "#ffd60a" : "#0a84ff";
      vctx.fillStyle = vctx.strokeStyle;
      for (const o of g.objects) {
        vctx.strokeRect(o.x, o.y, o.width, o.height);
        vctx.fillText(o.name || "", o.x + 3 / z, o.y + 13 / z);
      }
    }
  }

  drawHover();
  vctx.strokeStyle = "rgba(0,0,0,0.5)";
  vctx.lineWidth = 1 / z;
  vctx.strokeRect(0, 0, m.width * TILE, m.height * TILE);
  vctx.restore();
  $("zoom-label").textContent = `${Math.round(z * 100)}%`;
}

function drawHover() {
  const hv = state.hover;
  if (!hv) return;
  const z = state.zoom;
  const d = state.drag;
  if (d && d.tool === "rect" && d.start) {
    const r = rectFrom(d.start, hv);
    vctx.fillStyle = d.erase ? "rgba(255,59,48,0.25)" : "rgba(63,125,58,0.3)";
    vctx.fillRect(r.x0 * TILE, r.y0 * TILE, (r.x1 - r.x0 + 1) * TILE, (r.y1 - r.y0 + 1) * TILE);
    return;
  }
  let w = 1, h = 1;
  const stampMode = TILE_LAYERS.includes(state.layer) && state.stamp && ["brush", "rect", "fill"].includes(state.tool);
  if (stampMode && state.tool === "brush") {
    w = state.stamp.w;
    h = state.stamp.h;
    vctx.globalAlpha = 0.6;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        drawTile(vctx, state.sheets, tileRef(state.stamp.tilesetId, state.stamp.col + dx, state.stamp.row + dy), (hv.x + dx) * TILE, (hv.y + dy) * TILE);
      }
    }
    vctx.globalAlpha = 1;
  }
  vctx.strokeStyle = state.tool === "erase" ? "#ff3b30" : "#ffffff";
  vctx.lineWidth = 2 / z;
  vctx.strokeRect(hv.x * TILE, hv.y * TILE, w * TILE, h * TILE);
}

function line(ctx, x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

// ── View (zoom / pan) ────────────────────────────────────────────────────────

function fitView() {
  const m = state.map;
  const w = view.clientWidth || 800;
  const h = view.clientHeight || 600;
  const z = Math.min((w - 40) / (m.width * TILE), (h - 40) / (m.height * TILE));
  state.zoom = Math.max(0.1, Math.min(4, z));
  state.panX = (w - m.width * TILE * state.zoom) / 2;
  state.panY = (h - m.height * TILE * state.zoom) / 2;
  draw();
}

function zoomAt(z, cx = view.clientWidth / 2, cy = view.clientHeight / 2) {
  z = Math.max(0.1, Math.min(8, z));
  state.panX = cx - ((cx - state.panX) * z) / state.zoom;
  state.panY = cy - ((cy - state.panY) * z) / state.zoom;
  state.zoom = z;
  draw();
}

function onWheel(e) {
  e.preventDefault();
  const r = view.getBoundingClientRect();
  zoomAt(state.zoom * Math.pow(1.0015, -e.deltaY), e.clientX - r.left, e.clientY - r.top);
}

function cellFromEvent(e) {
  const r = view.getBoundingClientRect();
  return {
    x: Math.floor((e.clientX - r.left - state.panX) / state.zoom / TILE),
    y: Math.floor((e.clientY - r.top - state.panY) / state.zoom / TILE),
  };
}

// ── Painting ─────────────────────────────────────────────────────────────────

function onPointerDown(e) {
  view.setPointerCapture(e.pointerId);
  if (e.button === 1 || (e.button === 0 && state.spaceDown)) {
    state.drag = { pan: true, x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
    return;
  }
  if (e.button !== 0 && e.button !== 2) return;
  const cell = cellFromEvent(e);
  const erase = e.button === 2 || state.tool === "erase";
  state.drag = { tool: state.tool, erase, start: cell, changes: new Map(), last: null };

  if (state.tool === "pick") return pick(cell);
  if (state.tool === "fill") {
    doFill(cell, erase);
    finishStroke();
    state.drag = null;
    return;
  }
  if (state.tool === "brush" || state.tool === "erase") paintAt(cell);
  draw();
}

function onPointerMove(e) {
  const d = state.drag;
  if (d?.pan) {
    state.panX = d.panX + e.clientX - d.x;
    state.panY = d.panY + e.clientY - d.y;
    draw();
    return;
  }
  const cell = cellFromEvent(e);
  const inside = cell.x >= 0 && cell.y >= 0 && cell.x < state.map.width && cell.y < state.map.height;
  state.hover = inside ? cell : null;
  if (inside) status(`Tile ${cell.x}, ${cell.y} · map ${state.map.width}×${state.map.height}`);
  if (d && (d.tool === "brush" || d.tool === "erase")) {
    // Fill in gaps when the pointer moves fast.
    const from = d.last || cell;
    const steps = Math.max(Math.abs(cell.x - from.x), Math.abs(cell.y - from.y));
    for (let i = 1; i <= steps; i++) {
      paintAt({ x: Math.round(from.x + ((cell.x - from.x) * i) / steps), y: Math.round(from.y + ((cell.y - from.y) * i) / steps) });
    }
  }
  draw();
}

function onPointerUp() {
  const d = state.drag;
  if (!d) return;
  if (d.tool === "rect" && !d.pan && state.hover) {
    const r = rectFrom(d.start, state.hover);
    const cells = [];
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) cells.push([x, y]);
    const valueAt = valueFn(d.erase, r.x0, r.y0);
    for (const [x, y] of cells) setCell(state.map, state.layer, x, y, valueAt(x, y), d.changes);
    renderDirty(cells);
  }
  if (!d.pan) finishStroke();
  state.drag = null;
  draw();
}

/** Value to write at (x, y) for the current layer and selection. Tile stamps repeat from (ox, oy). */
function valueFn(erase, ox = 0, oy = 0) {
  const layer = state.layer;
  if (layer === "collision") return () => (erase ? 0 : 1);
  if (layer === "terrain") {
    const t = erase || state.terrain === state.map.base ? null : state.terrain;
    return () => t;
  }
  if (erase || !state.stamp) return () => null;
  const s = state.stamp;
  return (x, y) => tileRef(s.tilesetId, s.col + mod(x - ox, s.w), s.row + mod(y - oy, s.h));
}

function paintAt(cell) {
  const d = state.drag;
  d.last = cell;
  const layer = state.layer;
  const changed = [];
  if (TILE_LAYERS.includes(layer) && !d.erase && state.stamp) {
    // Multi-tile stamps snap to a grid anchored at the stroke start, so dragging lays copies side by side.
    const s = state.stamp;
    const ax = d.start.x + Math.floor((cell.x - d.start.x) / s.w) * s.w;
    const ay = d.start.y + Math.floor((cell.y - d.start.y) / s.h) * s.h;
    const key = `${ax},${ay}`;
    d.stamped ??= new Set();
    if (d.stamped.has(key)) return;
    d.stamped.add(key);
    for (let dy = 0; dy < s.h; dy++) {
      for (let dx = 0; dx < s.w; dx++) {
        if (setCell(state.map, layer, ax + dx, ay + dy, tileRef(s.tilesetId, s.col + dx, s.row + dy), d.changes)) changed.push([ax + dx, ay + dy]);
      }
    }
  } else {
    if (TILE_LAYERS.includes(layer) && !d.erase && !state.stamp) return status("Pick tiles from the Tiles tab first.");
    if (setCell(state.map, layer, cell.x, cell.y, valueFn(d.erase)(cell.x, cell.y), d.changes)) changed.push([cell.x, cell.y]);
  }
  renderDirty(changed);
}

function doFill(cell, erase) {
  if (TILE_LAYERS.includes(state.layer) && !erase && !state.stamp) return status("Pick tiles from the Tiles tab first.");
  const touched = floodFill(state.map, state.layer, cell.x, cell.y, valueFn(erase, cell.x, cell.y), state.drag.changes);
  renderDirty(touched);
}

function pick(cell) {
  const v = getCell(state.map, state.layer, cell.x, cell.y);
  if (state.layer === "terrain") {
    selectTerrain(v || state.map.base || "grass");
  } else if (TILE_LAYERS.includes(state.layer) && v) {
    const { tilesetId, col, row } = parseTileRef(v);
    $("tileset-select").value = tilesetId;
    state.stamp = { tilesetId, col, row, w: 1, h: 1 };
    drawSheet();
    showTab("tiles");
  }
  selectTool("brush");
  state.drag = null;
}

function finishStroke() {
  const d = state.drag;
  if (d) commit(d.changes);
}

function commit(changes) {
  if (!changes || !changes.size) return;
  state.undo.push(changes);
  if (state.undo.length > 200) state.undo.shift();
  state.redo = [];
  updateUndoButtons();
  scheduleSave();
}

function undo() {
  const c = state.undo.pop();
  if (!c) return;
  state.redo.push(revert(state.map, c));
  renderAll();
  updateUndoButtons();
  scheduleSave();
}

function redo() {
  const c = state.redo.pop();
  if (!c) return;
  state.undo.push(revert(state.map, c));
  renderAll();
  updateUndoButtons();
  scheduleSave();
}

function updateUndoButtons() {
  $("btn-undo").disabled = !state.undo.length;
  $("btn-redo").disabled = !state.redo.length;
}

function onKeyDown(e) {
  if (e.target.closest("input, select, textarea, dialog")) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === "z") { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
  if (ctrl && e.key.toLowerCase() === "y") { e.preventDefault(); return redo(); }
  if (ctrl && e.key.toLowerCase() === "s") { e.preventDefault(); return saveProject(); }
  if (ctrl) return;
  if (e.code === "Space") { state.spaceDown = true; e.preventDefault(); return; }
  const tools = { b: "brush", r: "rect", g: "fill", e: "erase", i: "pick" };
  if (tools[e.key]) return selectTool(tools[e.key]);
  if (/^[1-6]$/.test(e.key)) return selectLayer(LAYER_INFO[Number(e.key) - 1].id);
  if (e.key === "+" || e.key === "=") return zoomAt(state.zoom * 1.25);
  if (e.key === "-") return zoomAt(state.zoom / 1.25);
  if (e.key === "0") return fitView();
}

// ── Files ────────────────────────────────────────────────────────────────────

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toProject(state.map)));
    } catch (err) {
      console.warn("Autosave skipped:", err);
    }
  }, 500);
}

function saveProject() {
  download(new Blob([JSON.stringify(toProject(state.map))], { type: "application/json" }), "map-project.json");
  status("Saved project file. Open it again later with Open.");
}

async function openProject(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    await setMap(fromProject(JSON.parse(await file.text())));
    fitView();
    scheduleSave();
    status(`Opened ${file.name}.`);
  } catch (err) {
    alert(`Could not open ${file.name}: ${err.message}`);
  }
}

async function importAiMap(e) {
  const files = [...e.target.files];
  e.target.value = "";
  const tmjFile = files.find((f) => /\.(tmj|json)$/i.test(f.name));
  if (!tmjFile) return alert("Choose the map's .tmj file (and its background .png) from the generator's output folder.");
  try {
    const tmj = JSON.parse(await tmjFile.text());
    const bgName = (tmj.layers || []).find((l) => l.type === "imagelayer")?.image;
    const pngs = files.filter((f) => /\.png$/i.test(f.name));
    const bgFile = pngs.find((f) => f.name === bgName) || pngs[0];
    const bgUrl = bgFile ? await fileToDataUrl(bgFile) : null;
    await setMap(importAiTmj(tmj, bgUrl));
    fitView();
    scheduleSave();
    status(
      `Imported ${tmjFile.name}: ${state.map.width}×${state.map.height} tiles` +
        (bgUrl ? "" : " (no background image chosen — select the .png together with the .tmj)") +
        ". Paint on top, fix collision on the Collision layer, then Export.",
    );
  } catch (err) {
    alert(`Could not import ${tmjFile.name}: ${err.message}`);
  }
}

async function exportTiled() {
  const m = state.map;
  const hasGround = Boolean(m.base) || m.terrain.some(Boolean);
  const files = [];

  if (hasGround) {
    const ground = canvasFor(m);
    renderCells(ground.getContext("2d"), m, state.sheets, fullRect(m), { groundOnly: true });
    files.push({ name: "ground.png", data: await canvasBytes(ground) });
  }
  if (state.background) {
    const bg = canvasFor(m);
    bg.getContext("2d").drawImage(state.background, 0, 0, bg.width, bg.height);
    files.push({ name: "background.png", data: await canvasBytes(bg) });
  }
  const col = document.createElement("canvas");
  col.width = col.height = TILE;
  const cctx = col.getContext("2d");
  cctx.fillStyle = "rgba(255,0,0,0.6)";
  cctx.fillRect(0, 0, TILE, TILE);
  files.push({ name: "tilesets/collision.png", data: await canvasBytes(col) });

  for (const id of usedTilesets(m)) {
    const t = tilesetById[id];
    const res = await fetch(t.file);
    files.push({ name: t.file.replace(/^assets\//, ""), data: new Uint8Array(await res.arrayBuffer()) });
  }
  files.unshift({ name: "map.tmj", data: JSON.stringify(buildTmj(m, state.sheetSizes, { hasGround }), null, 2) });
  files.push({ name: "CREDITS.txt", data: creditsText(m) });

  download(makeZip(files), "map-tiled.zip");
  status("Exported map-tiled.zip — unzip it and open map.tmj in Tiled or load it in your game.");
}

async function exportPng() {
  const m = state.map;
  const c = canvasFor(m);
  renderCells(c.getContext("2d"), m, state.sheets, fullRect(m), { background: state.background });
  download(new Blob([await canvasBytes(c)], { type: "image/png" }), "map.png");
  status("Exported map.png. Remember to credit the tile artists (see Tile credits).");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fullRect = (m) => ({ x0: 0, y0: 0, x1: m.width - 1, y1: m.height - 1 });
const mod = (a, n) => ((a % n) + n) % n;
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v)) || lo));

function rectFrom(a, b) {
  return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
}

function canvasFor(m) {
  const c = document.createElement("canvas");
  c.width = m.width * TILE;
  c.height = m.height * TILE;
  return c;
}

function canvasBytes(c) {
  return new Promise((resolve) => c.toBlob(async (b) => resolve(new Uint8Array(await b.arrayBuffer())), "image/png"));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function status(text) {
  $("status").textContent = text;
}

init();
