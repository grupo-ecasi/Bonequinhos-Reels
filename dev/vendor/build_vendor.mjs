// Gera vendor.min.js (IIFE) com Three.js + addons + Mediabunny para embutir no estúdio.
import { build } from "esbuild";
import { statSync } from "node:fs";
const out = process.argv[2] || "vendor.min.js";
await build({
  entryPoints: ["vendor-entry.js"],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["chrome114"],
  legalComments: "eof",
  outfile: out,
});
console.log(out, (statSync(out).size / 1024).toFixed(0) + " KB");
