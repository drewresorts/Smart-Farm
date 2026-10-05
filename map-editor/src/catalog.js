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
  "lpc-modern-streets": {
    name: "LPC Modern Streets",
    credit: "LPC Modern Streets by Faufilage. CC0. https://opengameart.org/content/lpc-modern-streets",
  },
  "lpc-streets": {
    name: "LPC Streets",
    credit:
      "[LPC] Streets by Baŝto, based on [LPC] Skorpio's SciFi Sprite Pack by Skorpio. " +
      "CC-BY-SA 3.0 / GPL 3.0. https://opengameart.org/content/lpc-streets",
  },
  "lpc-victorian": {
    name: "LPC Victorian Buildings",
    credit:
      "[LPC] Victorian Buildings by bluecarrot16, Lanea Zimmerman (Sharm), Casper Nilsson, " +
      "Lyndsay Takacs (cyanowl) and Redshrike. CC-BY-SA 3.0 / GPL 3.0. " +
      "https://opengameart.org/content/lpc-victorian-buildings",
  },
  ranitaya: {
    name: "Ranitaya City Essentials",
    credit:
      "Ranitaya's 50+ City Essential Assets by Ranitaya Studios. Royalty-free for personal and " +
      "commercial projects. https://ranitaya-studios.itch.io/ranitayas-city-essential " +
      "(import with tools/import-ranitaya.mjs; not redistributed in this repository)",
  },
  "lpc-cars": {
    name: "LPC Modern Cars",
    credit:
      "LPC Modern Car Additions by blue-moon-bear, edited from [LPC] Skorpio's SciFi Sprite Pack " +
      "by Skorpio; police car based on Baŝto's. CC-BY-SA 3.0 / GPL 3.0. " +
      "https://opengameart.org/content/lpc-modern-car-additions",
  },
};

const sheets = {
  "lpc-modern-streets": [
    "sidewalk_terrain", "base_road_tile", "cracked_road", "cracks_transparent", "traffic_markings",
    "manhole_and_cover", "rain_gutter_terrain", "rain_gutter_drain", "traffic_lights", "trash_bins",
    "traffic_cones", "sign_poles", "traffic_sign_base", "traffic_signs_pictograms", "traffic_sign_arrow",
    "chain_link_fence_frame", "chain_link_fence_wire_32x32", "wheels_and_tires",
  ],
  "lpc-streets": ["road_markings_yellow", "road_markings_white", "street_misc"],
  "lpc-victorian": ["tenement", "windows-doors", "accessories", "mansion"],
  "lpc-cars": ["cars", "cars_small"],
  ranitaya: ["buildings", "props"],
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
 * `fill: [col, row]` marks a plain texture: every cell draws that one tile, with no edges.
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
  { id: "asphalt", name: "Asphalt", sheet: "lpc-modern-streets/base_road_tile", fill: [0, 0] },
];

export const terrainById = Object.fromEntries(TERRAINS.map((t, i) => [t.id, { ...t, order: i }]));
export const tilesetById = Object.fromEntries(TILESETS.map((t) => [t.id, t]));
