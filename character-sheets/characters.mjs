// Cast definitions: every character the game draws, as Universal LPC generator selections.
//
// Fixed choices come from the brief (names, roles, outfit descriptions). Anything the brief
// leaves open (skin tone, hair, small colour accents) is picked by a random generator seeded
// with the character id, so the cast is varied but every rebuild gives the same result.
//
// `lpc` is the generator's URL hash in key/value form (see character-generator).
// Colours: plain names come from the ULPC palette (e.g. "navy"); "all.lpcr.<name>" uses the
// extended LPCR palette (e.g. "all.lpcr.denim").

const SKIN = ["light", "amber", "olive", "taupe", "bronze", "brown", "black"];
const EYE_COLOURS = ["brown", "brown", "brown", "brown", "brown", "gray", "blue", "green"];
const HAIR_COLOURS = ["black", "raven", "dark_brown", "dark_brown", "chestnut", "light_brown", "blonde", "sandy", "ginger", "dark_gray"];
const MALE_HAIR = [
  "Buzzcut", "Plain", "Parted", "Swoop", "Messy1", "Cowlick", "Afro", "Cornrows", "Dreadlocks_short",
  "Flat_top_fade", "Twists_fade", "Curly_short", "Bedhead", "Natural", "High_and_tight", "Side_Swoop",
];
const FEMALE_HAIR = [
  "Bob", "Ponytail", "Long_straight", "Pixie", "Curly_long", "Bangs_bun", "Long_messy", "Afro",
  "Twists_straight", "Braid", "High_ponytail", "Loose", "Wavy", "Lob", "Shoulderl",
];

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

/**
 * Build the generator selections for a person.
 * @param {string} id
 * @param {object} o
 *   sex: male | female | teen   (body type; teen is the young adult body. The muscular body
 *        is avoided: most shirts have no art for it)
 *   head: Human_Male | Human_Female | Human_Male_Gaunt | Human_Male_Plump | Human_Male_Elderly | Human_Female_Elderly
 *   skin, hair, hairColour, eyes: fixed values, otherwise seeded random
 *   noHair: true for bald
 *   wear: { type_name: "Item_Name_colour", ... } clothing and accessories
 */
function person(id, o) {
  const r = rng(id);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const sex = o.sex ?? "male";
  const female = sex === "female" || o.head?.startsWith("Human_Female");
  const skin = o.skin ?? pick(SKIN);
  const head = o.head ?? (female ? "Human_Female" : "Human_Male");
  const lpc = { sex, body: `Body_Color_${skin}`, head: `${head}_${skin}` };
  if (!o.noHair) {
    const hair = o.hair ?? pick(female ? FEMALE_HAIR : MALE_HAIR);
    lpc.hair = `${hair}_${o.hairColour ?? pick(HAIR_COLOURS)}`;
  }
  lpc.eyes = `Eye_Color_${o.eyes ?? pick(EYE_COLOURS)}`;
  if (o.expression) lpc.expression = `${o.expression}_${skin}`;
  Object.assign(lpc, o.wear);
  return { skin, lpc };
}

const c = (id, group, role, archetypes, description, opts) => ({
  id,
  group,
  role,
  archetypes,
  description,
  ...person(id, opts),
});

// ── The player: Stretch ──────────────────────────────────────────────────────
// Light skin, spiky black hair, smug half-lidded look. Same face and build in every outfit.
const STRETCH = { sex: "male", skin: "light", hair: "Spiked2", hairColour: "black", eyes: "brown", expression: "Closing_Eyes" };
const stretch = (id, description, wear) => c(id, "player", "player", ["player"], description, { ...STRETCH, wear });

// ── Shared outfit pieces ─────────────────────────────────────────────────────
const jeans = "Long_Pants_all.lpcr.denim";
const sneakers = "Revised_Shoes_white";

export const CHARACTERS = [
  // Player outfits
  stretch("stretch", "Hoodie: orange zip jacket, dark jeans, white sneakers", {
    clothes: "Longsleeve_2_Buttoned_orange", legs: jeans, shoes: sneakers,
  }),
  stretch("stretch_track", "Tracksuit: matching red tracksuit with white stripes", {
    clothes: "Longsleeve_2_VNeck_red", sleeves: "Longsleeves_2_Overlay_white", legs: "Pants_red", shoes: sneakers,
  }),
  stretch("stretch_courier", "Courier: yellow courier jacket and black cap", {
    clothes: "Longsleeve_2_Buttoned_yellow", hat: "Bonnie_black", legs: "Pants_charcoal", shoes: "Revised_Shoes_black",
  }),
  stretch("stretch_worker", "Night-shift worker: hi-vis vest over a dark long-sleeve, work boots", {
    clothes: "Sleeveless_2_VNeck_all.lpcr.lemon", sleeves: "Longsleeves_2_Overlay_charcoal", legs: "Pants_charcoal", shoes: "Basic_Boots_brown",
  }),
  stretch("stretch_suit", "Suit: slick black suit and red tie", {
    clothes: "Longsleeve_2_Buttoned_black", neck: "Necktie_red", legs: "Pants_black", shoes: "Revised_Shoes_black",
  }),
  stretch("stretch_scpf", "SCPF disguise: navy police uniform, cap and gold epaulets", {
    clothes: "Longsleeve_Polo_navy", hat: "Bonnie_navy", shoulders: "Epaulets_metal.gold", legs: "Pants_navy", shoes: "Revised_Shoes_black",
  }),

  // Syndicate lieutenants
  c("lt_rourke", "boss", "gang", ["lieutenant"], '"Knuckles" Rourke: big bruiser, red cap, brass knuckles', {
    head: "Human_Male_Plump", skin: "light", hair: "Buzzcut", hairColour: "ginger", expression: "Angry",
    wear: { hat: "Bonnie_red", clothes: "Sleeveless_2_VNeck_black", gloves: "Gloves_brass", beard: "Trimmed_Beard_ginger", legs: "Pants_charcoal", shoes: "Basic_Boots_black" },
  }),
  // LPC gowns and long coats have no run or fight art, so the boss wears an all-black pantsuit.
  c("lt_marchetti", "boss", "gang", ["lieutenant"], "Vee Marchetti: elegant and dangerous, sleek all-black pantsuit, shades", {
    sex: "female", skin: "olive", hair: "Long_straight", hairColour: "raven", eyes: "brown",
    wear: { clothes: "Longsleeve_2_Scoop_black", legs: "Pants_black", facial_eyes: "Shades_black", shoes: "Revised_Shoes_black" },
  }),
  c("lt_hallorann", "boss", "gang", ["lieutenant"], '"Doc" Hallorann: gaunt warehouse chemist in a pale lab coat and glasses', {
    head: "Human_Male_Gaunt", skin: "light", hair: "Balding", hairColour: "gray",
    wear: { clothes: "Longsleeve_2_Buttoned_white", legs: "Pants_gray", facial_eyes: "Round_Glasses_silver", shoes: "Revised_Shoes_brown" },
  }),
  c("lt_crane", "boss", "gang", ["lieutenant"], "Silas Crane: the final boss. Tuxedo, silver hair, silver beard", {
    head: "Human_Male_Elderly", skin: "light", hair: "Parted", hairColour: "platinum", expression: "Angry",
    wear: { clothes: "Longsleeve_2_Buttoned_black", neck: "Bowtie_black", beard: "Trimmed_Beard_platinum", legs: "Pants_black", shoes: "Revised_Shoes_black" },
  }),

  // Locals
  c("turtleneck", "npc", "civilian", ["local", "corner_dealer"], "Charcoal turtleneck, dark trousers", {
    wear: { clothes: "Longsleeve_charcoal", legs: "Pants_black", shoes: "Revised_Shoes_black" },
  }),
  c("blackfit", "npc", "civilian", ["local", "crane_thug"], "All-black streetwear", {
    wear: { clothes: "TShirt_black", legs: "Pants_black", shoes: "Revised_Shoes_black" },
  }),
  c("dark_layers", "npc", "civilian", ["local", "crane_thug", "corner_dealer"], "Dark layered cardigan with the hood up", {
    wear: { clothes: "Cardigan_charcoal", hat: "Hood_gray", legs: "Pants_black", shoes: "Basic_Boots_black" },
  }),
  c("mono_fit", "npc", "civilian", ["local", "socialite"], "Monochrome cream outfit", {
    sex: "female",
    wear: { clothes: "Longsleeve_2_Scoop_white", legs: "Pants_white", shoes: "Revised_Shoes_white" },
  }),
  c("local_teal", "npc", "civilian", ["local"], "Teal T-shirt, jeans", {
    wear: { clothes: "TShirt_teal", legs: jeans, shoes: "Basic_Shoes_brown" },
  }),
  c("local_maroon", "npc", "civilian", ["local"], "Maroon long-sleeve, khakis", {
    sex: "female",
    wear: { clothes: "Longsleeve_maroon", legs: "Pants_tan", shoes: "Basic_Shoes_brown" },
  }),

  // Students
  c("street_blue", "npc", "civilian", ["student", "jogger"], "Blue streetwear, sneakers", {
    sex: "teen",
    wear: { clothes: "Longsleeve_2_blue", legs: jeans, shoes: sneakers },
  }),
  c("tracksuit_lime", "npc", "civilian", ["student", "jogger"], "Lime tracksuit", {
    sex: "teen",
    wear: { clothes: "Longsleeve_2_VNeck_all.lpcr.apple", legs: "Pants_all.lpcr.apple", shoes: sneakers },
  }),
  c("jacket_yellow", "npc", "civilian", ["student", "tourist"], "Yellow jacket, jeans", {
    wear: { clothes: "Longsleeve_2_Buttoned_yellow", legs: jeans, shoes: sneakers },
  }),
  c("student_purple", "npc", "civilian", ["student"], "Purple sweater, glasses", {
    sex: "female", hair: "Ponytail",
    wear: { clothes: "Longsleeve_purple", legs: jeans, facial_eyes: "Nerd_Glasses_black", shoes: sneakers },
  }),

  // Tourists and joggers
  c("tourist_pink", "npc", "civilian", ["tourist", "jogger"], "Pink polo, white shorts, sunglasses", {
    sex: "female",
    wear: { clothes: "Shortsleeve_Polo_pink", legs: "Shorts_white", facial_eyes: "Sunglasses_black", shoes: "Sandals_tan" },
  }),
  c("tourist_teal", "npc", "civilian", ["tourist"], "Teal polo, khaki shorts, sunglasses", {
    head: "Human_Male_Plump",
    wear: { clothes: "Shortsleeve_Polo_teal", legs: "Shorts_tan", facial_eyes: "Sunglasses_black", shoes: "Sandals_brown" },
  }),

  // Night-shift workers
  c("worker_hivis", "npc", "civilian", ["worker"], "Yellow hi-vis vest, work boots", {
    sex: "male",
    wear: { clothes: "Sleeveless_2_VNeck_all.lpcr.lemon", sleeves: "Longsleeves_2_Overlay_gray", legs: "Pants_charcoal", shoes: "Basic_Boots_brown" },
  }),
  c("worker_orange", "npc", "civilian", ["worker"], "Orange hi-vis vest, dark bandana", {
    wear: { clothes: "Sleeveless_2_VNeck_orange", sleeves: "Longsleeves_2_Overlay_navy", bandana: "Bandana_charcoal", legs: "Pants_navy", shoes: "Basic_Boots_black" },
  }),
  c("worker_overalls", "npc", "civilian", ["worker"], "Work overalls, beard", {
    wear: { clothes: "Longsleeve_gray", overalls: "Overalls_navy", beard: "Basic_Beard_dark_brown", shoes: "Basic_Boots_brown" },
  }),

  // Office suits
  c("suit_slick", "npc", "civilian", ["office_suit"], "Slick black suit, swept-back hair", {
    hair: "Swoop",
    wear: { clothes: "Longsleeve_2_Buttoned_black", neck: "Necktie_charcoal", legs: "Pants_black", shoes: "Revised_Shoes_black" },
  }),
  c("suit_pale", "npc", "civilian", ["office_suit"], "Pale cream suit", {
    wear: { clothes: "Longsleeve_2_Buttoned_white", neck: "Necktie_tan", legs: "Pants_white", shoes: "Revised_Shoes_brown" },
  }),
  c("suit_classic", "npc", "civilian", ["office_suit"], "Classic navy suit, red tie", {
    wear: { clothes: "Longsleeve_2_Buttoned_navy", neck: "Necktie_red", legs: "Pants_navy", shoes: "Revised_Shoes_black" },
  }),
  c("suit_tux", "npc", "civilian", ["office_suit"], "Black tuxedo, bow tie", {
    wear: { clothes: "Longsleeve_2_Buttoned_black", neck: "Bowtie_black", legs: "Pants_black", shoes: "Revised_Shoes_black" },
  }),
  c("tux_dark", "npc", "civilian", ["office_suit"], "Charcoal tuxedo, bow tie, female", {
    sex: "female", hair: "Bangs_bun",
    wear: { clothes: "Longsleeve_2_Buttoned_charcoal", neck: "Bowtie_2_black", legs: "Pants_charcoal", shoes: "Revised_Shoes_black" },
  }),
  c("suit_sharp", "npc", "civilian", ["office_suit", "socialite"], "Sharp black suit, shades", {
    sex: "female", hair: "Bob",
    wear: { clothes: "Longsleeve_2_Buttoned_black", legs: "Pants_black", facial_eyes: "Shades_black", shoes: "Revised_Shoes_black" },
  }),
  c("suit_navy", "npc", "civilian", ["office_suit"], "Navy suit, blue tie", {
    sex: "female",
    wear: { clothes: "Longsleeve_2_Buttoned_navy", neck: "Necktie_sky", legs: "Pants_navy", shoes: "Revised_Shoes_black" },
  }),
  c("suit_grey", "npc", "civilian", ["office_suit"], "Grey suit, glasses", {
    head: "Human_Male_Elderly", hairColour: "gray",
    wear: { clothes: "Longsleeve_2_Buttoned_gray", neck: "Necktie_navy", legs: "Pants_gray", facial_eyes: "Glasses_black", shoes: "Revised_Shoes_black" },
  }),
  c("suit_black", "npc", "civilian", ["office_suit"], "Black suit, white shirt look", {
    wear: { clothes: "Longsleeve_2_Buttoned_black", neck: "Necktie_white", legs: "Pants_black", shoes: "Revised_Shoes_black" },
  }),
  c("suit_brown", "npc", "civilian", ["office_suit"], "Brown suit, mustache", {
    head: "Human_Male_Plump",
    wear: { clothes: "Longsleeve_2_Buttoned_brown", neck: "Necktie_tan", legs: "Pants_brown", mustache: "Mustache_dark_brown", shoes: "Revised_Shoes_brown" },
  }),
  c("suit_bald", "npc", "civilian", ["office_suit"], "Charcoal suit, bald", {
    noHair: true,
    wear: { clothes: "Longsleeve_2_Buttoned_charcoal", neck: "Necktie_maroon", legs: "Pants_charcoal", shoes: "Revised_Shoes_black" },
  }),

  // Socialites
  c("gown_black", "npc", "civilian", ["socialite"], "Black evening gown", {
    sex: "female", hair: "Long_straight",
    wear: { dress: "Sash_dress_black", shoes: "Revised_Shoes_black" },
  }),
  c("suit_scarf", "npc", "civilian", ["socialite"], "Camel suit with a silk scarf", {
    sex: "female", hair: "Wavy",
    wear: { clothes: "Longsleeve_2_Buttoned_tan", neck: "Scarf_rose", legs: "Pants_tan", shoes: "Revised_Shoes_brown" },
  }),

  // Gang
  c("jacket_red_cap", "npc", "gang", ["crane_thug"], "Red jacket, red cap", {
    sex: "male",
    wear: { clothes: "Longsleeve_2_Buttoned_red", hat: "Bonnie_red", legs: jeans, shoes: "Basic_Boots_black" },
  }),
  c("techwear", "npc", "gang", ["crane_thug", "corner_dealer"], "Black techwear, shades, bandana", {
    wear: { clothes: "Longsleeve_2_charcoal", bandana: "Bandana_black", facial_eyes: "Sunglasses_black", legs: "Pants_black", shoes: "Basic_Boots_black" },
  }),

  // SCPF officers (three distinct cops)
  c("cop_a", "npc", "cop", ["scpf_officer"], "Officer: navy uniform, cap, epaulets", {
    wear: { clothes: "Longsleeve_Polo_navy", hat: "Bonnie_navy", shoulders: "Epaulets_metal.gold", legs: "Pants_navy", shoes: "Revised_Shoes_black" },
  }),
  c("cop_b", "npc", "cop", ["scpf_officer"], "Officer: short-sleeve uniform, ponytail", {
    sex: "female", hair: "Ponytail",
    wear: { clothes: "Shortsleeve_Polo_navy", shoulders: "Epaulets_metal.silver", legs: "Pants_navy", shoes: "Revised_Shoes_black" },
  }),
  c("cop_c", "npc", "cop", ["scpf_officer"], "Sergeant: heavier build, mustache, cap", {
    head: "Human_Male_Plump",
    wear: { clothes: "Longsleeve_Polo_bluegray", hat: "Bonnie_navy", shoulders: "Epaulets_metal.gold", mustache: "Mustache_dark_gray", legs: "Pants_navy", shoes: "Basic_Boots_black" },
  }),
];

/** Selections for a character, optionally with a weapon added. */
export function hashFor(character, { knife = false } = {}) {
  const lpc = { ...character.lpc };
  if (knife) lpc.weapon = "Dagger_dagger";
  return Object.entries(lpc).map(([k, v]) => `${k}=${v}`).join("&");
}
