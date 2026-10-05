#!/usr/bin/env node
/**
 * Build 48x48 game character sheets from the exported LPC sheets (lpc/<id>.png).
 *
 *   node build-sheets.mjs            # all characters
 *   node build-sheets.mjs --only stretch
 *
 * Output:
 *   sheets/<id>.png         one sheet per character (layout below)
 *   sheets/manifest.json    manifest: animations (row/start/count/view), per-character info
 *   preview/                contact sheets for review
 *
 * Frame format: 48x48, transparent, soles on row 43, centred, side frames face right.
 * LPC frames are 64x64; they are scaled by 3/4 with an outline-preserving filter.
 */
import sharp from "sharp";
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CHARACTERS } from "./characters.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DEFS = join(ROOT, "..", "character-generator", "sheet_definitions");
const LPC = join(ROOT, "lpc");
const OUT = join(ROOT, "sheets");
const PREVIEW = join(ROOT, "preview");

const SRC = 64;
const F = 48;
const FEET_ROW = 43; // Soles of the standing frame in each view are moved to this row.

// ── LPC sheet layout (rows of 64px frames) ───────────────────────────────────
const DIR = { B: 0, L: 1, F: 2, S: 3 }; // LPC order: up, left, down, right
const LPC_ROWS = {
  spellcast: 0, thrust: 4, walk: 8, slash: 12, shoot: 16, hurt: 20, climb: 21, idle: 22,
  jump: 26, sit: 30, emote: 34, run: 38, combat: 42, backslash: 46, halfslash: 50,
};
// Animation names as used in item definitions, for checking support.
const DEF_NAME = { backslash: "1h_backslash", halfslash: "1h_halfslash" };
const BASE_ANIMS = ["spellcast", "thrust", "walk", "slash", "shoot", "hurt"];

/** A source frame: LPC animation, view, frame index. `knife` reads the knife sheet. */
const f = (anim, view, i, extra = {}) => ({ anim, view, i, ...extra });
const seq = (anim, view, frames, extra) => frames.map((i) => f(anim, view, i, extra));

/**
 * Output layout. Each animation lists its frames; `fallback` is used when any of the
 * character's items lacks the LPC animation (the layer would otherwise vanish).
 */
const LAYOUT = [
  // Row 0: the game's current 20-frame layout, unchanged.
  [
    { name: "idle_front_legacy", view: "F", frames: [f("walk", "F", 0)] },
    { name: "walk_front_legacy", view: "F", frames: seq("walk", "F", [1, 3, 5, 7]) },
    { name: "idle_back_legacy", view: "B", frames: [f("walk", "B", 0)] },
    { name: "walk_back_legacy", view: "B", frames: seq("walk", "B", [1, 3, 5, 7]) },
    { name: "idle_side_legacy", view: "S", frames: [f("walk", "S", 0)] },
    { name: "walk_side_legacy", view: "S", frames: seq("walk", "S", [1, 3, 5, 7]) },
    { name: "hands_up", view: "F", frames: [f("spellcast", "F", 5)] },
    { name: "cower", view: "F", frames: [f("hurt", "F", 3)] },
    { name: "punch_legacy", view: "S", frames: [f("halfslash", "S", 4)], fallback: [f("slash", "S", 4)] },
    { name: "hurt_legacy", view: "F", frames: [f("hurt", "F", 1)] },
    { name: "ko_legacy", view: "F", frames: [f("hurt", "F", 5)] },
  ],
  // Row 1: smooth 8-frame walks.
  [
    { name: "walk_front", view: "F", frames: seq("walk", "F", [1, 2, 3, 4, 5, 6, 7, 8]) },
    { name: "walk_back", view: "B", frames: seq("walk", "B", [1, 2, 3, 4, 5, 6, 7, 8]) },
    { name: "walk_side", view: "S", frames: seq("walk", "S", [1, 2, 3, 4, 5, 6, 7, 8]) },
  ],
  // Row 2: runs (sprint, flee, chase, jog).
  [
    { name: "run_front", view: "F", frames: seq("run", "F", [0, 1, 2, 3, 4, 5, 6, 7]), fallback: seq("walk", "F", [1, 2, 3, 4, 5, 6, 7, 8]) },
    { name: "run_back", view: "B", frames: seq("run", "B", [0, 1, 2, 3, 4, 5, 6, 7]), fallback: seq("walk", "B", [1, 2, 3, 4, 5, 6, 7, 8]) },
    { name: "run_side", view: "S", frames: seq("run", "S", [0, 1, 2, 3, 4, 5, 6, 7]), fallback: seq("walk", "S", [1, 2, 3, 4, 5, 6, 7, 8]) },
  ],
  // Row 3: side-on fist fighting.
  [
    { name: "fight_stance_side", view: "S", frames: seq("combat", "S", [0, 1]), fallback: seq("walk", "S", [0, 0]) },
    { name: "punch_jab", view: "S", frames: seq("halfslash", "S", [1, 4, 5]), fallback: seq("thrust", "S", [1, 4, 6]) },
    { name: "punch_cross", view: "S", frames: seq("slash", "S", [2, 4, 5]) },
    { name: "punch_finisher", view: "S", frames: seq("backslash", "S", [2, 6, 10, 12]), fallback: seq("slash", "S", [1, 2, 4, 5]) },
    { name: "lunge", view: "S", frames: seq("halfslash", "S", [1, 2]), fallback: seq("thrust", "S", [2, 3]) },
  ],
  // Row 4: side-on weapons. Knife frames come from the knife sheet; the pistol is drawn on.
  [
    { name: "knife_slash", view: "S", frames: seq("slash", "S", [1, 2, 4, 5], { knife: true }) },
    { name: "knife_stab", view: "S", frames: seq("thrust", "S", [1, 3, 4, 6], { knife: true }) },
    {
      name: "pistol_aim_fire", view: "S",
      frames: [f("shoot", "S", 2), f("shoot", "S", 4, { pistol: true }), f("shoot", "S", 6, { pistol: true, flash: true }), f("shoot", "S", 6, { pistol: true })],
    },
    { name: "point_freeze", view: "S", frames: seq("shoot", "S", [4, 5]) },
  ],
  // Row 5: reactions (LPC draws these facing the camera).
  [
    { name: "hurt_front", view: "F", frames: seq("hurt", "F", [0, 1]) },
    { name: "stagger_front", view: "F", frames: seq("hurt", "F", [1, 2, 1, 0]) },
    { name: "knockdown_front", view: "F", frames: seq("hurt", "F", [2, 3, 4, 5]) },
    { name: "get_up_front", view: "F", frames: seq("hurt", "F", [5, 4, 3, 2]) },
    { name: "ko_front", view: "F", frames: seq("hurt", "F", [5, 5]) },
    { name: "restrained", view: "F", frames: [f("hurt", "F", 5), f("hurt", "F", 5, { dx: 1 })] },
  ],
  // Row 6: extras.
  [
    { name: "idle_front", view: "F", frames: seq("idle", "F", [0, 1]), fallback: seq("walk", "F", [0, 0]) },
    { name: "idle_back", view: "B", frames: seq("idle", "B", [0, 1]), fallback: seq("walk", "B", [0, 0]) },
    { name: "idle_side", view: "S", frames: seq("idle", "S", [0, 1]), fallback: seq("walk", "S", [0, 0]) },
    { name: "fight_stance_front", view: "F", frames: seq("combat", "F", [0, 1]), fallback: seq("walk", "F", [0, 0]) },
    { name: "taunt", view: "F", frames: seq("emote", "F", [1, 2]), fallback: seq("spellcast", "F", [3, 4]) },
    { name: "kneel_search", view: "F", frames: seq("sit", "F", [0, 1]), fallback: seq("hurt", "F", [2, 2]) },
    { name: "sit_front", view: "F", frames: [f("sit", "F", 2)], fallback: [f("hurt", "F", 2)] },
    { name: "sit_side", view: "S", frames: [f("sit", "S", 2)], fallback: [f("walk", "S", 0)] },
    { name: "jump_dodge_side", view: "S", frames: seq("jump", "S", [0, 1, 2, 3, 4]), fallback: seq("walk", "S", [0, 2, 3, 4, 0]) },
    { name: "climb", view: "B", frames: seq("climb", "B", [0, 1, 2, 3, 4, 5]), fallback: seq("walk", "B", [1, 2, 3, 4, 5, 6]) },
  ],
];

// ── Which LPC animations each character fully supports ───────────────────────

function loadDefinitions() {
  const byType = {};
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".json") && !name.startsWith("meta_")) {
        const d = JSON.parse(readFileSync(p, "utf8"));
        if (d.type_name && d.name) (byType[d.type_name] ??= []).push(d);
      }
    }
  };
  walk(DEFS);
  return byType;
}

function supportedAnimations(lpc, defs) {
  const sets = [];
  for (const [type, value] of Object.entries(lpc)) {
    // Body, head and eye colour cover everything; an expression missing a pose only falls back to the default face.
    if (["sex", "body", "head", "eyes", "expression"].includes(type)) continue;
    const matches = (defs[type] || []).filter((d) => {
      const n = d.name.replace(/ /g, "_");
      return value === n || value.startsWith(`${n}_`);
    });
    const def = matches.sort((a, b) => b.name.length - a.name.length)[0];
    if (!def) throw new Error(`No definition for ${type}=${value}`);
    sets.push(new Set(def.animations || BASE_ANIMS));
  }
  return (anim) => sets.every((s) => s.has(DEF_NAME[anim] || anim));
}

// ── Pixel work ───────────────────────────────────────────────────────────────

async function loadSheet(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function sourceFrame(sheet, row, col) {
  const out = new Uint8ClampedArray(SRC * SRC * 4);
  for (let y = 0; y < SRC; y++) {
    const s = ((row * SRC + y) * sheet.width + col * SRC) * 4;
    out.set(sheet.data.subarray(s, s + SRC * 4), y * SRC * 4);
  }
  return out;
}

// Each 48px output pixel covers 4/3 source pixels; these are the overlap weights.
const SPAN = [
  [[0, 1], [1, 1 / 3]],
  [[1, 2 / 3], [2, 2 / 3]],
  [[2, 1 / 3], [3, 1]],
];

/**
 * 64 -> 48 downscale. Opaque if at least ~40% covered; colour is the most-covered colour,
 * with dark outline colours weighted up so outlines survive.
 */
function downscale(src) {
  const out = new Uint8ClampedArray(F * F * 4);
  for (let oy = 0; oy < F; oy++) {
    for (let ox = 0; ox < F; ox++) {
      const bx = Math.floor(ox / 3) * 4;
      const by = Math.floor(oy / 3) * 4;
      const weights = new Map();
      let cover = 0;
      for (const [sy, wy] of SPAN[oy % 3]) {
        for (const [sx, wx] of SPAN[ox % 3]) {
          const i = ((by + sy) * SRC + bx + sx) * 4;
          if (src[i + 3] < 128) continue;
          const w = wx * wy;
          cover += w;
          const key = (src[i] << 16) | (src[i + 1] << 8) | src[i + 2];
          const luma = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
          weights.set(key, (weights.get(key) || 0) + w * (luma < 70 ? 1.6 : 1));
        }
      }
      if (cover < 0.7) continue; // total weight per output pixel is 16/9 ≈ 1.78
      let best = 0;
      let bestW = -1;
      for (const [k, w] of weights) if (w > bestW) { best = k; bestW = w; }
      const o = (oy * F + ox) * 4;
      out[o] = best >> 16;
      out[o + 1] = (best >> 8) & 255;
      out[o + 2] = best & 255;
      out[o + 3] = 255;
    }
  }
  return out;
}

function lowestOpaqueRow(frame) {
  for (let y = F - 1; y >= 0; y--) {
    for (let x = 0; x < F; x++) if (frame[(y * F + x) * 4 + 3]) return y;
  }
  return FEET_ROW;
}

function shifted(frame, dx, dy) {
  const out = new Uint8ClampedArray(F * F * 4);
  for (let y = 0; y < F; y++) {
    for (let x = 0; x < F; x++) {
      const sx = x - dx;
      const sy = y - dy;
      if (sx < 0 || sy < 0 || sx >= F || sy >= F) continue;
      out.set(frame.subarray((sy * F + sx) * 4, (sy * F + sx) * 4 + 4), (y * F + x) * 4);
    }
  }
  return out;
}

const OUTLINE = [27, 24, 31];
const METAL = [92, 96, 104];
const METAL_HI = [140, 146, 156];
const FLASH = [255, 214, 74];
const FLASH_HI = [255, 250, 220];

function put(frame, x, y, rgb) {
  if (x < 0 || y < 0 || x >= F || y >= F) return;
  const o = (y * F + x) * 4;
  frame[o] = rgb[0];
  frame[o + 1] = rgb[1];
  frame[o + 2] = rgb[2];
  frame[o + 3] = 255;
}

/** Draws a small pistol in the extended (right) hand, optionally with a muzzle flash. */
function drawPistol(frame, flash) {
  // The hand is the right-most opaque pixel between shoulder and hip height.
  let hx = -1;
  let hy = -1;
  for (let y = 16; y <= 30; y++) {
    for (let x = F - 1; x > hx; x--) {
      if (frame[(y * F + x) * 4 + 3]) { hx = x; hy = y; break; }
    }
  }
  if (hx < 0) return;
  const gx = hx - 1;
  const gy = hy - 2;
  // Barrel (6 px) over the hand, grip below the rear of the barrel.
  const shape = [
    "KKKKKK",
    "KMHHHK",
    "KMKKKK",
    "KK....",
  ];
  shape.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch === "K") put(frame, gx + i, gy + j, OUTLINE);
      if (ch === "M") put(frame, gx + i, gy + j, METAL);
      if (ch === "H") put(frame, gx + i, gy + j, METAL_HI);
    }),
  );
  if (flash) {
    const fx = gx + 6;
    const fy = gy;
    for (const [x, y, c] of [
      [0, 0, FLASH], [0, 1, FLASH], [1, 0, FLASH_HI], [1, 1, FLASH_HI], [2, 0, FLASH], [2, 1, FLASH],
      [1, -1, FLASH], [1, 2, FLASH], [3, 0, FLASH], [3, 1, FLASH], [2, -1, FLASH], [2, 2, FLASH],
    ]) put(frame, fx + x, fy + y, c);
  }
}

// ── Build ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const onlyArg = args.indexOf("--only") >= 0 ? args[args.indexOf("--only") + 1].split(",") : null;
const defs = loadDefinitions();
mkdirSync(OUT, { recursive: true });
mkdirSync(PREVIEW, { recursive: true });

const cols = Math.max(...LAYOUT.map((row) => row.reduce((n, a) => n + a.frames.length, 0)));
const manifestAnims = {};
LAYOUT.forEach((row, r) => {
  let start = 0;
  for (const a of row) {
    manifestAnims[a.name] = { row: r, start, count: a.frames.length, view: a.view };
    start += a.frames.length;
  }
});

const manifest = {
  frameWidth: F,
  frameHeight: F,
  columns: cols,
  rows: LAYOUT.length,
  feetRow: 43,
  sideFacing: "right",
  notes: [
    "Row 0 is the original 20-frame layout. Other rows follow the brief's section 5 suggestion.",
    "Views: F = front (toward camera), B = back, S = side facing right (mirror for left).",
    "fallbacks: animations drawn with stand-in frames because an item the character wears has no art for that pose.",
    "partial: animations where one worn item has no art for that pose, so that item is missing in those frames.",
  ],
  animations: manifestAnims,
  characters: [],
};

const characters = CHARACTERS.filter((c) => !onlyArg || onlyArg.includes(c.id));
for (const ch of characters) {
  const base = await loadSheet(join(LPC, `${ch.id}.png`));
  const knife = await loadSheet(join(LPC, `${ch.id}_knife.png`));
  const supports = supportedAnimations(ch.lpc, defs);
  // Per-view vertical offset that puts the standing frame's soles on FEET_ROW.
  // The same offset applies to every frame of that view, so jumps and falls keep their motion.
  const offsetY = {};
  for (const view of ["F", "B", "S"]) {
    const frame = downscale(sourceFrame(base, LPC_ROWS.walk + DIR[view], 0));
    offsetY[view] = FEET_ROW - lowestOpaqueRow(frame);
  }
  const fallbacks = [];
  const partial = [];
  const sheet = Buffer.alloc(cols * F * LAYOUT.length * F * 4);

  LAYOUT.forEach((row, r) => {
    let col = 0;
    for (const a of row) {
      const usesUnsupported = a.frames.some((fr) => !supports(fr.anim));
      const frames = usesUnsupported && a.fallback ? a.fallback : a.frames;
      if (usesUnsupported) (a.fallback ? fallbacks : partial).push(a.name);
      for (const fr of frames) {
        const src = fr.knife ? knife : base;
        const lpcRow = LPC_ROWS[fr.anim] + (["hurt", "climb"].includes(fr.anim) ? 0 : DIR[fr.view]);
        let frame = shifted(downscale(sourceFrame(src, lpcRow, fr.i)), fr.dx || 0, offsetY[fr.view]);
        if (fr.pistol) drawPistol(frame, fr.flash);
        for (let y = 0; y < F; y++) {
          const d = ((r * F + y) * cols * F + col * F) * 4;
          sheet.set(frame.subarray(y * F * 4, (y + 1) * F * 4), d);
        }
        col++;
      }
    }
  });

  await sharp(sheet, { raw: { width: cols * F, height: LAYOUT.length * F, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, `${ch.id}.png`));
  manifest.characters.push({
    id: ch.id,
    file: `${ch.id}.png`,
    group: ch.group,
    role: ch.role,
    archetypes: ch.archetypes,
    description: ch.description,
    skin: ch.skin,
    lpc: ch.lpc,
    fallbacks,
    partial,
  });
  const notes = [fallbacks.length && `stand-ins: ${fallbacks.join(", ")}`, partial.length && `partial: ${partial.join(", ")}`].filter(Boolean);
  process.stdout.write(`${ch.id}${notes.length ? ` (${notes.join("; ")})` : ""}\n`);
}

if (!onlyArg) {
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeCredits();
  await writeContactSheet();
}

/** preview/contact.png: one row per character (in manifest.json order) showing key frames at 2x. */
async function writeContactSheet() {
  const picks = [
    ["idle_front_legacy", 0], ["walk_front", 2], ["idle_back_legacy", 0], ["walk_side", 2], ["run_side", 3],
    ["fight_stance_side", 0], ["punch_jab", 1], ["punch_finisher", 2], ["knife_slash", 2], ["pistol_aim_fire", 2],
    ["hands_up", 0], ["cower", 0], ["knockdown_front", 3], ["taunt", 1],
  ];
  const S = 2;
  const composites = [];
  for (const [r, ch] of characters.entries()) {
    for (const [i, [anim, k]] of picks.entries()) {
      const a = manifestAnims[anim];
      composites.push({
        input: await sharp(join(OUT, `${ch.id}.png`))
          .extract({ left: (a.start + k) * F, top: a.row * F, width: F, height: F })
          .resize(F * S, F * S, { kernel: "nearest" })
          .toBuffer(),
        left: i * F * S,
        top: r * F * S,
      });
    }
  }
  await sharp({ create: { width: picks.length * F * S, height: characters.length * F * S, channels: 4, background: { r: 214, g: 211, b: 202, alpha: 1 } } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(join(PREVIEW, "contact.png"));
  writeFileSync(
    join(PREVIEW, "contact.txt"),
    `Rows (top to bottom, same order as manifest.json): ${characters.map((c) => c.id).join(", ")}\nColumns: ${picks.map(([a, k]) => `${a}[${k}]`).join(", ")}\n`,
  );
}

// ── Credits ──────────────────────────────────────────────────────────────────

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n") { row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter((r) => r.length >= 5);
}

/** Merges the credits of every art file used (plus the knife) into sheets/CREDITS.csv and a readable summary. */
function writeCredits() {
  const byFile = new Map();
  for (const ch of CHARACTERS) {
    for (const r of parseCsv(readFileSync(join(LPC, `${ch.id}.credits.csv`), "utf8")).slice(1)) byFile.set(r[0], r);
  }
  const master = parseCsv(readFileSync(join(DEFS, "..", "CREDITS.csv"), "utf8"));
  for (const r of master) if (r[0].startsWith("weapon/sword/dagger/")) byFile.set(r[0], r);

  const q = (s) => `"${s.replace(/"/g, '""')}"`;
  const rows = [...byFile.values()].sort((a, b) => a[0].localeCompare(b[0]));
  writeFileSync(
    join(OUT, "CREDITS.csv"),
    ["filename,notes,authors,licenses,urls", ...rows.map((r) => r.slice(0, 5).map(q).join(","))].join("\n") + "\n",
  );

  const authors = new Set();
  const licenses = new Set();
  const urls = new Set();
  for (const r of rows) {
    r[2].split(",").map((s) => s.trim()).filter(Boolean).forEach((a) => authors.add(a));
    r[3].split(",").map((s) => s.trim()).filter(Boolean).forEach((l) => licenses.add(l));
    r[4].split(",").map((s) => s.trim()).filter(Boolean).forEach((u) => urls.add(u));
  }
  writeFileSync(
    join(OUT, "CREDITS.txt"),
    [
      "Character art: Universal LPC Spritesheet Character Generator assets (Liberated Pixel Cup).",
      "https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator",
      "",
      `Licenses (each file is available under at least one; see CREDITS.csv per file): ${[...licenses].sort().join(", ")}`,
      "",
      "Authors:",
      ...[...authors].sort((a, b) => a.localeCompare(b)).map((a) => `- ${a}`),
      "",
      "Sources:",
      ...[...urls].sort().map((u) => `- ${u}`),
      "",
      "The pistol and muzzle flash on the aim/fire frames were drawn by the build script for this project.",
      "",
    ].join("\n"),
  );
  console.log(`Credits: ${rows.length} art files, ${authors.size} authors.`);
}
console.log(`\nBuilt ${characters.length} sheets: ${cols}x${LAYOUT.length} frames of ${F}px.`);
