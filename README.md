# Smart-Farm

## Tools

- [`character-generator/`](character-generator/) — a self-hosted copy of the
  [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator).
  It is a standalone web app for building layered 64×64 pixel-art character
  spritesheets, usable for any project.
- [`map-editor/`](map-editor/) — a browser tile map editor using LPC
  tilesets (farm, terrain, buildings). It exports Tiled `.tmj` maps.
  Run it with `cd map-editor && npm start`. See its
  [README](map-editor/README.md).
- [`map-generator/`](map-generator/) — an AI map generator that turns a text
  description into a pixel-art map with collision data. It is the map pipeline
  from [OpenPixel-RPG](https://github.com/tensor2023/OpenPixel-RPG) and needs
  your own AI API keys. Its maps open in the map editor via **Import AI map**.
  See its [README](map-generator/README.md).

### Running the character generator

Requires Node.js 22.19+ or 24+.

```sh
cd character-generator
npm ci
npm run dev        # development server at http://localhost:5173
```

To produce a static site that can be hosted anywhere:

```sh
npm run build      # output in character-generator/dist/
npm run preview    # serve the built site locally
```

### Source and licensing

The copy was taken from upstream commit
[`58ce1aa`](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/commit/58ce1aa479e4df32845a73a5d0afc221c3a893c2)
without modification.

- The generator's code is licensed under GPL-3.0
  (see [`character-generator/LICENSE`](character-generator/LICENSE)).
- The sprite art in `character-generator/spritesheets/` is under CC0, CC-BY,
  CC-BY-SA, OGA-BY and/or GPL, depending on the asset. Any sprite you use must
  credit its authors (except CC0). Use the generator's **Credits (TXT/CSV)**
  download for your selection, or
  [`character-generator/CREDITS.csv`](character-generator/CREDITS.csv) for the
  full list.
- For releases on DRM-protected stores (Steam, App Store), upstream recommends
  limiting yourself to CC0 and OGA-BY assets. The generator's **License
  Filters** panel can restrict choices to those licenses.

### Updating from upstream

```sh
git clone --depth 1 https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator.git /tmp/lpc
rsync -a --delete --exclude .git --exclude node_modules --exclude dist /tmp/lpc/ character-generator/
```

Then review the diff, commit, and update the commit hash above.
