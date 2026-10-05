# LPC Map Editor

A browser tile map editor for Liberated Pixel Cup (LPC) art. It uses the same
32×32 style as the [character generator](../character-generator). Maps
export to [Tiled](https://www.mapeditor.org/) `.tmj` format, which Phaser,
Godot (with a Tiled importer), Unity (SuperTiled2Unity) and most 2D engines
can load.

## Run it

Requires Node.js 18+. There are no dependencies to install.

```sh
cd map-editor
npm start            # http://localhost:8080
```

Any static web server works too (for example `python3 -m http.server`). It
must be served over http, not opened as a file.

## Features

- **Terrain painting with automatic edges**: grass, dirt, plowed soil, wheat,
  sand, water, ponds, swamp, lava and more. Edges and corners are picked for
  you. Asphalt is a plain fill for roads.
- **Tile stamps**: pick one tile or drag across a sheet to stamp a whole
  house, tree or market stall. Sheets cover farm items, crops, fences,
  houses, interiors, castles, and city streets: sidewalks, road markings,
  traffic lights, signs, Victorian buildings and cars.
- **Layers**: Terrain, Detail, Objects, Decor (windows, doors and props drawn
  on top of objects), Above characters (treetops, roofs) and Collision. Each can be shown or hidden.
- **Tools**: brush, rectangle, fill, eraser and picker. Right-click erases.
  Undo and redo are included.
- **Auto collision** marks water, holes and lava as blocked. Paint the rest on
  the Collision layer.
- **Import AI map** opens a map from [`../map-generator`](../map-generator).
  Select both `06-final.tmj` and `06-background.png`. The AI painting becomes
  the background, its walkable grid becomes the Collision layer, and its
  regions are kept. Paint LPC tiles on top as needed.
- **Save / Open** stores an editable project file (`.json`). Your current map
  is also autosaved in the browser.
- **Export Tiled** downloads a `.zip` with:
  - `map.tmj`
  - `ground.png`: the terrain, pre-rendered, because its 16px edge pieces
    have no whole-tile equivalent
  - the tile sheets used
  - a `collision` layer (1 = blocked)
  - `CREDITS.txt` for the art used
- **Export PNG** downloads the whole map as one image.

Keyboard: `B` brush, `R` rectangle, `G` fill, `E` eraser, `I` picker,
`1`–`6` layers, `Ctrl+Z` / `Ctrl+Y` undo and redo, `Ctrl+S` save, `+` / `-`
zoom, `0` fit, `Space`-drag to pan.

## Using an export in a game

The exported Tiled map has these layers, bottom to top:

| Layer | Type | Use |
|---|---|---|
| `background` | image | AI background (imported maps only) |
| `ground` | image | Terrain |
| `detail` | tiles | Small ground details |
| `objects` | tiles | Trees, buildings, crops (drawn under characters) |
| `decor` | tiles | Windows, doors, street props on top of objects |
| `above` | tiles | Treetops, roofs (draw **over** characters) |
| `collision` | tiles | Non-zero = blocked; hidden by default |
| `regions`, … | objects | Named areas from AI maps |

## Downtown maps

`maps/` holds four generated city districts. Open one with **Open** to edit it
or export it:

| Map | Feel |
|---|---|
| `flats.json` | Run-down tenements, bins, cones, cracked roads |
| `midtown.json` | Busy shopping streets, taxis, full traffic lights |
| `portside.json` | Warehouses, trucks, boxes |
| `goldcoast.json` | Upmarket blocks with trees and gardens |

Each map is a grid of two-lane streets with crosswalks, curbed sidewalks,
street lights, parked and moving cars, a collision layer and named regions
for every block and building. Regenerate them with:

```sh
npm run downtown                          # all four
node tools/downtown.mjs midtown           # one
node tools/downtown.mjs --style victorian # pick the building style
```

There are two building styles:

- **victorian** (the committed maps): buildings built from LPC Victorian
  walls, roofs, windows and doors, with full-size LPC cars. Openly licensed.
- **ranitaya**: whole-building sprites and props from
  [Ranitaya's City Essential Assets](https://ranitaya-studios.itch.io/ranitayas-city-essential),
  with half-size cars. This pack is royalty-free to use but is not openly
  licensed for redistribution, so it is **not** in this repository. Import
  your copy first; the generator then uses it by default:

  ```sh
  node tools/import-ranitaya.mjs path/to/Ranitaya_s_50_City_Essential_Assets_Pack.zip
  npm run downtown
  ```

  The import writes `assets/tilesets/ranitaya/`, which is git-ignored. The
  editor hides those sheets when they are missing.

`tools/make-small-cars.mjs` rebuilds `assets/tilesets/lpc-cars/cars_small.png`
(the half-size cars) from `cars.png`.

## Tests

```sh
npm test
```

## Art credits

The bundled tiles are LPC art under CC-BY-SA 3.0 / GPL 3.0 (some also
OGA-BY 3.0; LPC Modern Streets is CC0).
You must credit the artists. See [`assets/CREDITS.md`](assets/CREDITS.md);
every export includes a `CREDITS.txt` for the art it uses.
