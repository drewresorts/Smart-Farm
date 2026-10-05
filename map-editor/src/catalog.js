// Tile sheets bundled with the editor. All sheets use 32x32 tiles.

export const TILE = 32;

export const PACKS = {
  "lpc-base": {
    name: "LPC Base Assets",
    credit:
      "LPC Base Assets by Lanea Zimmerman (Sharm) and Daniel Armstrong (HughSpectrum). " +
      "CC-BY-SA 3.0 / GPL 3.0 (Sharm's tiles also OGA-BY 3.0). " +
      "https://opengameart.org/content/liberated-pixel-cup-lpc-base-assets-sprites-map-tiles",
  },
  "lpc-farming": {
    name: "LPC Farming",
    credit:
      "[LPC] Farming tilesets, magic animations and UI elements by Daniel Eddeland. " +
      "CC-BY-SA 3.0 / GPL 3.0. " +
      "https://opengameart.org/content/lpc-farming-tilesets-magic-animations-and-ui-elements",
  },
  "lpc-crops": {
    name: "LPC Crops",
    credit:
      "[LPC] Crops by bluecarrot16, Daniel Eddeland (daneeklu), Joshua Taylor, " +
      "Richard Kettering (Jetrel). Commissioned by castelonia. CC-BY-SA 3.0+ / GPL 3.0+. " +
      "https://opengameart.org/content/lpc-crops",
  },
};

const sheets = {
  "lpc-farming": [
    "farming_fishing", "plants", "fence", "fence_alt", "plowed_soil", "wheat", "youngwheat",
    "tallgrass", "reed", "sand", "sandwater",
  ],
  "lpc-crops": ["crops"],
  "lpc-base": [
    "grass", "grassalt", "dirt", "dirt2", "water", "watergrass", "waterfall", "brackish",
    "treetop", "trunk", "house", "country", "rock", "mountains", "bridges", "signs", "barrel",
    "buckets", "chests", "cup", "cabinets", "kitchen", "inside", "stairs", "cement", "cementstair",
    "hole", "holek", "holemid", "lava", "lavarock", "dungeon", "castle_outside", "castlewalls",
    "castlefloors", "castlefloors_outside", "castle_lightsources",
  ],
};

/** @type {{id: string, pack: string, file: string, name: string}[]} */
export const TILESETS = Object.entries(sheets).flatMap(([pack, names]) =>
  names.map((n) => ({
    id: `${pack}/${n}`,
    pack,
    file: `assets/tilesets/${pack}/${n}.png`,
    name: `${n.replace(/_/g, " ")} (${PACKS[pack].name})`,
  })),
);

/**
 * Terrains are 96x192 sheets in the standard LPC terrain layout, painted with
 * automatic edges. `blocked` terrains are marked unwalkable by Auto collision.
 * `variants` uses the bottom row as random fill variations.
 */
export const TERRAINS = [
  { id: "grass", name: "Grass", sheet: "lpc-base/grass", variants: true },
  { id: "grassalt", name: "Dark grass", sheet: "lpc-base/grassalt" },
  { id: "tallgrass", name: "Tall grass", sheet: "lpc-farming/tallgrass" },
  { id: "dirt", name: "Dirt", sheet: "lpc-base/dirt", variants: true },
  { id: "dirt2", name: "Dark dirt", sheet: "lpc-base/dirt2", variants: true },
  { id: "plowed_soil", name: "Plowed soil", sheet: "lpc-farming/plowed_soil" },
  { id: "youngwheat", name: "Young wheat", sheet: "lpc-farming/youngwheat" },
  { id: "wheat", name: "Wheat", sheet: "lpc-farming/wheat" },
  { id: "sand", name: "Sand", sheet: "lpc-farming/sand", variants: true },
  { id: "water", name: "Water", sheet: "lpc-base/water", blocked: true },
  { id: "watergrass", name: "Pond (grass rim)", sheet: "lpc-base/watergrass", blocked: true },
  { id: "sandwater", name: "Sand (water edge)", sheet: "lpc-farming/sandwater" },
  { id: "brackish", name: "Swamp water", sheet: "lpc-base/brackish", blocked: true },
  { id: "hole", name: "Hole", sheet: "lpc-base/hole", blocked: true },
  { id: "lava", name: "Lava", sheet: "lpc-base/lava", blocked: true, variants: true },
];

export const terrainById = Object.fromEntries(TERRAINS.map((t, i) => [t.id, { ...t, order: i }]));
export const tilesetById = Object.fromEntries(TILESETS.map((t) => [t.id, t]));
