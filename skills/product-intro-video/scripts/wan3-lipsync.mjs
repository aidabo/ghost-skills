#!/usr/bin/env node
// Make one talking-head video per narration line with Wan3 (image + audio -> video). PAID API.
//
//   node scripts/wan3-lipsync.mjs --image <face.jpg> --voice-dir <dir of sN.wav> --out-dir <dir>
//        [--only s1,s3] [--prompt "<text>"] [--apply]
//
// Without --apply it only lists what would be sent (no network, no cost).
// Lines whose <out-dir>/sN.mp4 already exists are skipped, so re-runs only pay for new lines.
// Each line is limited to 15 s of audio (Wan3 limit); longer lines are refused - split the narration.
//
// Environment (values are never printed):
//   WAN3_PROVIDER_MODULE  path to wan3-provider.mjs (e.g. <ghost-front>/tools/news-worker/lib/wan3-provider.mjs)
//                         or GHOST_FRONT_DIR, from which that path is derived
//   WAN3_API_BASE_URL     HTTPS base URL of the Model Studio API
//   DASHSCOPE_API_KEY     API key (QWEN_API_KEY is accepted as a fallback)
//   WAN3_MODEL            default wan3.0-video

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const arg = (name, def = undefined) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const apply = args.includes("--apply");
if (!arg("image") || !arg("voice-dir") || !arg("out-dir")) {
  console.log("usage: wan3-lipsync.mjs --image <face.jpg> --voice-dir <dir> --out-dir <dir> [--only s1,s2] [--prompt text] [--apply]");
  process.exit(2);
}

const image = path.resolve(arg("image"));
const voiceDir = path.resolve(arg("voice-dir"));
const outDir = path.resolve(arg("out-dir"));
const only = arg("only") ? new Set(arg("only").split(",")) : null;
const prompt =
  arg("prompt") ??
  "The person speaks warmly and calmly to the camera, natural lip movement matching the speech, gentle smile, slight natural head movement, static camera.";
const natural = (s) => s.split(/(\d+)/).map((t) => (/^\d+$/.test(t) ? t.padStart(6, "0") : t)).join("");
const names = fs
  .readdirSync(voiceDir)
  .filter((f) => f.endsWith(".wav"))
  .map((f) => f.slice(0, -4))
  .filter((n) => !only || only.has(n))
  .sort((a, b) => natural(a).localeCompare(natural(b)));

const seconds = (p) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], { encoding: "utf8" }).trim());

const plan = names.map((name) => {
  const out = path.join(outDir, `${name}.mp4`);
  const d = seconds(path.join(voiceDir, `${name}.wav`));
  const state = fs.existsSync(out) && fs.statSync(out).size > 0 ? "exists" : d > 15 ? "too-long" : "make";
  return { name, out, d, state, duration: Math.min(15, Math.max(2, Math.ceil(d))) };
});
for (const p of plan) console.log(`${p.name.padEnd(6)} ${p.d.toFixed(2)}s -> ${p.state}${p.state === "make" ? ` (duration ${p.duration})` : ""}`);
const todo = plan.filter((p) => p.state === "make");
if (plan.some((p) => p.state === "too-long")) console.log("Lines over 15 s must be split before they can be sent.");
if (!apply) {
  console.log(`preview: ${todo.length} line(s) would be sent to Wan3. Add --apply to run (paid).`);
  process.exit(0);
}
if (!todo.length) process.exit(0);

const modulePath =
  process.env.WAN3_PROVIDER_MODULE ||
  (process.env.GHOST_FRONT_DIR && path.join(process.env.GHOST_FRONT_DIR, "tools/news-worker/lib/wan3-provider.mjs"));
const baseUrl = process.env.WAN3_API_BASE_URL;
const apiKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
const missing = [!modulePath && "WAN3_PROVIDER_MODULE or GHOST_FRONT_DIR", !baseUrl && "WAN3_API_BASE_URL", !apiKey && "DASHSCOPE_API_KEY"].filter(Boolean);
if (missing.length) {
  console.error(`set ${missing.join(", ")} in the environment`);
  process.exit(2);
}
if (!/^https:\/\//.test(baseUrl)) {
  console.error("WAN3_API_BASE_URL must be https:// (the API key is sent with every request)");
  process.exit(2);
}
const { createWan3Provider, createWan3HttpTransport } = await import(pathToFileURL(path.resolve(modulePath)).href);
const providerModel = process.env.WAN3_MODEL || "wan3.0-video";
const transport = createWan3HttpTransport({ baseUrl, apiKey, providerModel });
const provider = createWan3Provider({ mode: "image-audio", providerModel, transport });
const mime = /\.png$/i.test(image) ? "image/png" : "image/jpeg";
const image_url = `data:${mime};base64,${fs.readFileSync(image).toString("base64")}`;
fs.mkdirSync(outDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wan3-"));

let failed = 0;
for (const p of todo) {
  const wav16 = path.join(tmp, `${p.name}-16k.wav`);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", path.join(voiceDir, `${p.name}.wav`), "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav16]);
  try {
    const prepared = await provider.prepare({ image_url, audio_bytes: fs.readFileSync(wav16), duration: p.duration, prompt });
    let r = await provider.submit(prepared);
    const t0 = Date.now();
    process.stdout.write(`${p.name} submitted `);
    while (!/succeeded|failed|canceled/i.test(r.status) && Date.now() - t0 < 25 * 60 * 1000) {
      await new Promise((s) => setTimeout(s, 15000));
      r = await provider.resume(r.run_id);
      process.stdout.write(".");
    }
    console.log(` ${r.status}`);
    if (!r.video_url) throw new Error(`no video (${r.code || r.status})`);
    const res = await fetch(r.video_url);
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
    // Write to a temp name first so a broken download is never mistaken for a finished line on re-runs.
    const part = `${p.out}.part`;
    fs.writeFileSync(part, Buffer.from(await res.arrayBuffer()));
    fs.renameSync(part, p.out);
    console.log(`saved ${p.out}`);
  } catch (e) {
    failed += 1;
    console.error(`${p.name} failed: ${String(e.message || e).slice(0, 160)}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
