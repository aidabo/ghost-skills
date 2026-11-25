#!/usr/bin/env node
// Pull one frame from the middle of every scene and tile them into one contact sheet,
// so the whole video can be checked with a single image before handing it over.
//
//   node scripts/check-frames.mjs --video <file.mp4> --scenes <scenes.json> --out <sheet.png> [--at 0.5] [--width 270] [--cols 6]

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const arg = (name, def = undefined) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
if (!arg("video") || !arg("scenes") || !arg("out")) {
  console.log("usage: check-frames.mjs --video <file.mp4> --scenes <scenes.json> --out <sheet.png> [--at 0.5] [--width 270] [--cols 6]");
  process.exit(2);
}

const doc = JSON.parse(fs.readFileSync(arg("scenes"), "utf8"));
const fps = doc.fps ?? 30;
const at = Number(arg("at", "0.5"));
const width = Number(arg("width", "270"));
const cols = Number(arg("cols", "6"));
const video = path.resolve(arg("video"));
const videoLen = Number(
  execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video], { encoding: "utf8" }).trim(),
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "intro-frames-"));
let start = 0;
let n = 0;
for (const s of doc.scenes) {
  const t = (start + s.frames * at) / fps;
  start += s.frames;
  if (t >= videoLen) break; // partial render (--frames)
  n += 1;
  const png = path.join(tmp, `f${String(n).padStart(3, "0")}.png`);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-ss", t.toFixed(3), "-i", video, "-frames:v", "1", "-vf", `scale=${width}:-2`, png]);
  console.log(`scene ${n} @ ${t.toFixed(2)}s  ${s.title.replace(/\n/g, " ")}`);
}
const rows = Math.ceil(n / cols);
fs.mkdirSync(path.dirname(path.resolve(arg("out"))), { recursive: true });
execFileSync("ffmpeg", [
  "-loglevel", "error", "-y", "-start_number", "1", "-i", path.join(tmp, "f%03d.png"),
  "-vf", `tile=${Math.min(cols, n)}x${rows}:padding=8:color=white`, "-frames:v", "1", path.resolve(arg("out")),
]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${path.resolve(arg("out"))} (${n} scenes)`);
