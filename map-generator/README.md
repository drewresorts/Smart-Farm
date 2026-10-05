# AI Map Generator

Turns a text description into a top-down pixel-art game map, saved as a
[Tiled](https://www.mapeditor.org/) `.tmj` file with:

- a painted background image,
- a collision layer (which tiles are walkable),
- named regions (with `--plan`) and interactive objects.

This is the map pipeline from
[OpenPixel-RPG](https://github.com/tensor2023/OpenPixel-RPG)'s `GeoPixel`
engine (commit `12e6fed`), cut down to map creation only. The NPC
simulation, game client and real-world location modes are not included.

## Setup

Requires Node.js 18+ and API keys for an image model and a vision model
(for example through [OpenRouter](https://openrouter.ai) or
[Google AI Studio](https://aistudio.google.com/apikey)).

```sh
cd map-generator
npm install
cp .env.example .env    # then fill in the *_API_KEY values
```

## Usage

```sh
npm run generate -- "small farm with a red barn, crop fields, a pond and a fenced pasture"

# Plan named areas first (one extra API call, gives labelled regions)
npm run generate -- --plan "small farm with a red barn, crop fields, a pond and a fenced pasture"

# Turn your own pixel-art image into a map with collision data
npm run from-image -- path/to/map.png "farm"
```

Each run writes to `output/maps/<run-id>/`. The final map is `06-final.tmj`
next to its background `06-background.png`. Open it in
[`../map-editor`](../map-editor) with **Import AI map** to paint LPC tiles
on top or fix the collision, or open it directly in Tiled.

Each map takes several model calls (generate, review, locate areas,
walkable overlay, plus retries), so expect a few minutes and some API cost
per map.

## Settings (`.env`)

| Setting | Default | Meaning |
|---|---|---|
| `MAP_IMAGE_SIZE_K` | `1` | Image size: 1 = 1024px, 2 = 2048px, 4 = 4096px |
| `BLOCK_SIZE` | `32` | Pixels per grid tile. 32 matches LPC, so a 1K map is 32×32 tiles |
| `ART_STYLE_PROMPT` | LPC-style pixel art | Style applied to every map |

## Tests

```sh
npm test
```

Runs the steps that don't call AI models (compress, walkable grid, Tiled
output) on a synthetic map, so it needs no API keys.

## License

MIT (see [`LICENSE`](LICENSE)). The AI-generated images are produced by
the model provider you configure; check their terms for commercial use.
