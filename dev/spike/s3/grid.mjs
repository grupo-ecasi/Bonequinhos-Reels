import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { align } from "./align.mjs";
const REF = "C:/app.Modelar-Concorrentes-MKT/house/videos/reboco-novo";
const raw = execFileSync("ffmpeg", ["-v","error","-i",`${REF}/assets/narracao-norm.mp3`,"-ac","1","-ar","16000","-f","f32le","-"], { maxBuffer: 1 << 28 });
const s = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
const ref = JSON.parse(readFileSync(`${REF}/assets/transcript.json`, "utf8"));
const SPOKEN = { "1.": "um", "2.": "dois", "3.": "três", "28": "vinte e oito", "13,": "treze", "1": "um", "13245": "treze mil duzentos e quarenta e cinco", "NBR": "ene bê erre", "pH": "pê agá", "House": "ráus", "WhatsApp.": "uótsap" };
const words = ref.map((w) => ({ display: w.text, spoken: SPOKEN[w.text] || w.text }));
for (const rel of [0.3, 0.4, 0.5, 0.6]) for (const minPause of [0.06, 0.08, 0.1]) {
  const { words: out } = align(s, 16000, words, { rel, minPause });
  const e = out.map((w, i) => Math.abs(w.start - ref[i].start)).sort((a, b) => a - b);
  console.log(`rel ${rel} minPause ${minPause}: mediana ${e[84].toFixed(3)} p90 ${e[151].toFixed(3)} p95 ${e[160].toFixed(3)} max ${e[168].toFixed(3)}`);
}
