#!/usr/bin/env node
// Work around Remotion's port probe hanging on some WSL setups.
//
// @remotion/renderer checks whether a port is free by connecting to it on 127.0.0.1 / ::1.
// On WSL the connect to a free port can neither succeed nor be refused; it times out, and
// Remotion treats a timeout as "unavailable", tries every port, and fails with
// "No available ports found" (or appears to hang). This patch makes a timeout count as
// "available" - a port nobody answers on is free. It edits only this skill's node_modules
// and is idempotent. Re-run after `npm install`.
//
//   node scripts/patch-remotion-port.mjs          # patch
//   node scripts/patch-remotion-port.mjs --check  # report only

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const file = path.join(path.dirname(require.resolve("@remotion/renderer/package.json")), "dist", "get-port.js");
const src = fs.readFileSync(file, "utf8");
const handler = /(socket\.on\('timeout', \(\) => \{\s*status = ')(unavailable|available)(')/;
const m = src.match(handler);
if (!m) {
  console.error(`unexpected get-port.js layout, not patched: ${file}`);
  process.exit(1);
}
if (m[2] === "available") {
  console.log(`already patched: ${file}`);
  process.exit(0);
}
if (process.argv.includes("--check")) {
  console.log(`not patched: ${file}`);
  process.exit(1);
}
fs.writeFileSync(file, src.replace(handler, "$1available$3"));
console.log(`patched (timeout = available): ${file}`);
