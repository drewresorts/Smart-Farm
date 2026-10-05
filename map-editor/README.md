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
  you.
- **Tile stamps**: pick one tile or drag across a sheet to stamp a whole
  house, tree or market stall. Sheets cover farm items, crops, fences,
  houses, interiors, castles and more.
- **Layers**: Terrain, Detail, Objects, Above characters (treetops, roofs)
  and Collision. Each can be shown or hidden.
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
`1`–`5` layers, `Ctrl+Z` / `Ctrl+Y` undo and redo, `Ctrl+S` save, `+` / `-`
zoom, `0` fit, `Space`-drag to pan.

## Using an export in a game

The exported Tiled map has these layers, bottom to top:

| Layer | Type | Use |
|---|---|---|
| `background` | image | AI background (imported maps only) |
| `ground` | image | Terrain |
| `detail` | tiles | Small ground details |
| `objects` | tiles | Trees, buildings, crops (drawn under characters) |
| `above` | tiles | Treetops, roofs (draw **over** characters) |
| `collision` | tiles | Non-zero = blocked; hidden by default |
| `regions`, … | objects | Named areas from AI maps |

## Tests

```sh
npm test
```

## Art credits

All tiles are LPC art under CC-BY-SA 3.0 / GPL 3.0 (some also OGA-BY 3.0).
You must credit the artists. See [`assets/CREDITS.md`](assets/CREDITS.md);
every export includes a `CREDITS.txt` for the art it uses.
