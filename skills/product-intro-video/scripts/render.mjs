#!/usr/bin/env node
// Render the JSON-driven intro video with Remotion.
//
//   node scripts/render.mjs --scenes <scenes.json> --public <dir> --out <file.mp4>
//        [--browser <chrome>] [--port <n>] [--frames <from-to>] [--concurrency <n>] [--crf <n>]
//
// Every media path inside scenes.json is relative to --public.
// --browser defaults to $REMOTION_BROWSER, then the newest Playwright Chromium in ~/.cache/ms-playwright.
// If rendering hangs at "port" on WSL, run `node scripts/patch-remotion-port.mjs` once (see references/pitfalls.md).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (name, def = undefined) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
if (args.includes("--help") || !arg("scenes") || !arg("public") || !arg("out")) {
  console.log("usage: render.mjs --scenes <scenes.json> --public <dir> --out <file.mp4> [--browser <path>] [--port <n>] [--frames a-b] [--concurrency n] [--crf n]");
  process.exit(args.includes("--help") ? 0 : 2);
}

// Remotion is imported only after the usage check so --help works before `npm install`.
const { bundle } = await import("@remotion/bundler");
const { renderMedia, selectComposition } = await import("@remotion/renderer");

const scenesFile = path.resolve(arg("scenes"));
const publicDir = path.resolve(arg("public"));
const out = path.resolve(arg("out"));
const props = JSON.parse(fs.readFileSync(scenesFile, "utf8"));

const missing = [];
for (const s of props.scenes ?? []) {
  for (const key of ["img", "voice", "face"]) if (s[key] && !fs.existsSync(path.join(publicDir, s[key]))) missing.push(s[key]);
  if (!(s.frames > 0)) missing.push(`frames of "${s.title}" (run durations.mjs)`);
}
if (props.presenter?.still && !fs.existsSync(path.join(publicDir, props.presenter.still))) missing.push(props.presenter.still);
if (missing.length) {
  console.error(`missing: ${missing.join(", ")}`);
  process.exit(1);
}

function findBrowser() {
  if (arg("browser")) return arg("browser");
  if (process.env.REMOTION_BROWSER) return process.env.REMOTION_BROWSER;
  const root = path.join(os.homedir(), ".cache", "ms-playwright");
  if (!fs.existsSync(root)) return undefined;
  const found = fs
    .readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))
    .map((d) => path.join(root, d, "chrome-linux", "chrome"))
    .find((p) => fs.existsSync(p));
  return found;
}

const browserExecutable = findBrowser();
const port = arg("port") ? Number(arg("port")) : undefined;
const frameRange = arg("frames") ? arg("frames").split("-").map(Number) : undefined;
console.log(`browser: ${browserExecutable ?? "(Remotion default)"}`);

const serveUrl = await bundle({ entryPoint: path.join(here, "remotion", "index.ts"), publicDir });
const common = { serveUrl, id: "Intro", inputProps: props, browserExecutable, port };
const composition = await selectComposition(common);
console.log(`composition: ${composition.width}x${composition.height} ${composition.fps}fps ${composition.durationInFrames} frames (${(composition.durationInFrames / composition.fps).toFixed(1)}s)`);

fs.mkdirSync(path.dirname(out), { recursive: true });
let last = -1;
await renderMedia({
  ...common,
  composition,
  codec: "h264",
  outputLocation: out,
  frameRange: frameRange?.length === 2 ? frameRange : undefined,
  concurrency: arg("concurrency") ? Number(arg("concurrency")) : null,
  crf: arg("crf") ? Number(arg("crf")) : undefined,
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 10) * 10;
    if (pct !== last) {
      last = pct;
      console.log(`render ${pct}%`);
    }
  },
});
console.log(`wrote ${out}`);
