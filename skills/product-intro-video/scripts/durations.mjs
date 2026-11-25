#!/usr/bin/env node
// Set each scene's `frames` from the length of its face video (preferred) or voice file.
//
//   node scripts/durations.mjs --scenes <scenes.json> --public <dir> [--tail 1.0] [--min 3] [--out <file>]
//
// frames = presenter lead-in + media length + tail (seconds), never shorter than --min seconds.
// The face video wins over the voice because its audio is what plays (Wan3 can stretch the voice).
// Scenes without media keep their frames (or get --min). Writes back to --scenes unless --out is given.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const arg = (name, def = undefined) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
if (!arg("scenes") || !arg("public")) {
  console.log("usage: durations.mjs --scenes <scenes.json> --public <dir> [--tail 1.0] [--min 3] [--out <file>]");
  process.exit(2);
}

const file = path.resolve(arg("scenes"));
const publicDir = path.resolve(arg("public"));
const tail = Number(arg("tail", "1.0"));
const min = Number(arg("min", "3"));
const doc = JSON.parse(fs.readFileSync(file, "utf8"));
const fps = doc.fps ?? 30;
const lead = doc.presenter?.leadFrames ?? 10;

const seconds = (p) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], { encoding: "utf8" }).trim());

let total = 0;
doc.scenes.forEach((s, i) => {
  const media = s.face ?? s.voice;
  let frames = s.frames || Math.ceil(min * fps);
  let note = "no media";
  if (media) {
    const d = seconds(path.join(publicDir, media));
    frames = Math.max(Math.ceil(min * fps), lead + Math.ceil((d + tail) * fps));
    note = `${media} ${d.toFixed(2)}s`;
  }
  s.frames = frames;
  total += frames;
  console.log(`${String(i + 1).padStart(2)} ${String(frames).padStart(5)}f  ${note}`);
});
console.log(`total ${total} frames = ${(total / fps).toFixed(1)}s`);
fs.writeFileSync(path.resolve(arg("out", file)), JSON.stringify(doc, null, 2) + "\n");
