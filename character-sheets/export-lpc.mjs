#!/usr/bin/env node
/**
 * Export full LPC spritesheets (64x64 frames) for every character from the bundled
 * character generator, once plain and once holding a knife.
 *
 *   node export-lpc.mjs                 # all characters
 *   node export-lpc.mjs --only stretch,lt_rourke
 *   node export-lpc.mjs --url http://localhost:5173/   # use an already running generator
 *
 * Output: lpc/<id>.png, lpc/<id>_knife.png, lpc/<id>.credits.csv
 * Fails if the generator drops or changes any requested item.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CHARACTERS, hashFor } from "./characters.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const GENERATOR = join(ROOT, "..", "character-generator");
const OUT = join(ROOT, "lpc");

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = opt("--only")?.split(",");
let url = opt("--url");

async function startGenerator() {
  if (!existsSync(join(GENERATOR, "dist", "index.html"))) {
    throw new Error("Build the character generator first: cd ../character-generator && npm ci && npm run build");
  }
  const port = 4173;
  const proc = spawn("npx", ["vite", "preview", "--port", String(port), "--strictPort"], { cwd: GENERATOR, stdio: "ignore" });
  const target = `http://localhost:${port}/`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(target)).ok) return { proc, target };
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill();
  throw new Error("Character generator preview server did not start");
}

const parseHash = (h) =>
  Object.fromEntries(
    decodeURIComponent(h.replace(/^#/, ""))
      .split("&")
      .filter(Boolean)
      .map((kv) => kv.split("=")),
  );

let server;
if (!url) {
  server = await startGenerator();
  url = server.target;
}
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const problems = [];

async function download(buttonName, path) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 60000 }),
    page.getByRole("button", { name: buttonName, exact: true }).click(),
  ]);
  await dl.saveAs(path);
}

try {
  for (const ch of CHARACTERS.filter((c) => !only || only.includes(c.id))) {
    for (const knife of [false, true]) {
      const hash = hashFor(ch, { knife });
      await page.goto("about:blank");
      await page.goto(`${url}#${hash}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const wanted = parseHash(hash);
      const got = parseHash(await page.evaluate(() => location.hash));
      for (const [k, v] of Object.entries(wanted)) {
        if (got[k] !== v) problems.push(`${ch.id}${knife ? " (knife)" : ""}: ${k}=${v} -> ${got[k] ?? "dropped"}`);
      }
      const name = knife ? `${ch.id}_knife` : ch.id;
      await download("Spritesheet (PNG)", join(OUT, `${name}.png`));
      if (!knife) await download("Credits (CSV)", join(OUT, `${ch.id}.credits.csv`));
      process.stdout.write(`${name} `);
    }
  }
} finally {
  await browser.close();
  server?.proc.kill();
}

console.log();
writeFileSync(join(OUT, "export-problems.json"), JSON.stringify(problems, null, 2));
if (problems.length) {
  console.error(`\n${problems.length} selection problem(s):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("All selections resolved exactly.");
