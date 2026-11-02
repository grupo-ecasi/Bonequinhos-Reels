import { readFileSync, writeFileSync } from "node:fs";
import { loadRuntime } from "./load_runtime.mjs";
const { BQ } = loadRuntime(["base.js", "roteiro.js"]);
const [src, dst] = process.argv.slice(2);
const p = BQ.roteiro.parse(readFileSync(src, "utf8"));
writeFileSync(dst, BQ.roteiro.scriptTexts(p).map((x) => x.spoken).join("\n"), "utf8");
console.log(readFileSync(dst, "utf8"));
