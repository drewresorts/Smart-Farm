#!/usr/bin/env node
/**
 * Generate a pixel-art map from a text description.
 *
 *   npm run generate -- "small farm with a red barn, crop fields and a pond"
 *   npm run generate -- --plan "small farm with a red barn, crop fields and a pond"
 *
 * --plan  First asks the planner model to lay out named areas (barn, fields, ...)
 *         so the output map includes labelled regions. Costs one extra API call.
 *
 * Output goes to output/maps/<run-id>/ — open 06-final.tmj in the map editor or Tiled.
 */
import dotenv from "dotenv";
import { spawn } from "child_process";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(ROOT, ".env");
dotenv.config({ path: ENV_PATH });

const args = process.argv.slice(2);
const plan = args.includes("--plan");
const description = args.filter((a) => a !== "--plan").join(" ").trim();

if (!description) {
  console.error('Usage: npm run generate -- [--plan] "description of the map"');
  process.exit(1);
}

const required = ["IMAGE_GEN_API_KEY", "IMAGE_GEN_MODEL", "VISION_API_KEY", "VISION_MODEL"];
if (plan) required.push("ORCHESTRATOR_API_KEY", "ORCHESTRATOR_MODEL");
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    `Missing settings: ${missing.join(", ")}\n` +
      (existsSync(ENV_PATH)
        ? `Fill them in ${ENV_PATH}.`
        : `Copy .env.example to .env and fill in your API keys.`),
  );
  process.exit(1);
}

const env = { ...process.env };

if (plan) {
  const { designWorld } = await import("./orchestrator/src/world-designer.mjs");
  const design = await designWorld(description);
  const planDir = join(ROOT, "output", "plans");
  mkdirSync(planDir, { recursive: true });
  const planPath = join(planDir, `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`);
  writeFileSync(planPath, JSON.stringify(design, null, 2));
  console.log(`[Plan] ${design.regions?.length ?? 0} regions planned -> ${planPath}`);
  env.WORLD_DESIGN_PATH = planPath;
  env.ORIGINAL_USER_PROMPT = description;
}

const child = spawn(process.execPath, [join(ROOT, "generators/map/src/index.mjs"), description], {
  stdio: "inherit",
  env,
});
child.on("exit", (code) => process.exit(code ?? 1));
