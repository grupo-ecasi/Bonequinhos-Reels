// Spike S3: mede o alinhamento sem modelo contra o transcript (Whisper) do reboco-novo.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { align } from "./align.mjs";

const REF = "C:/app.Modelar-Concorrentes-MKT/house/videos/reboco-novo";
const audioPath = process.argv[2] || `${REF}/assets/narracao-norm.mp3`;
const SR = 16000;
const raw = execFileSync("ffmpeg", ["-v", "error", "-i", audioPath, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);

const ref = JSON.parse(readFileSync(`${REF}/assets/transcript.json`, "utf8"));
// forma falada dos números e siglas (no produto vem da marcação {exibe|fala} do roteiro)
const SPOKEN = { "1.": "um", "2.": "dois", "3.": "três", "28": "vinte e oito", "13,": "treze", "1": "um", "13245": "treze mil duzentos e quarenta e cinco", "NBR": "ene bê erre", "pH": "pê agá", "House": "ráus", "WhatsApp.": "uótsap" };
const words = ref.map((w) => ({ display: w.text, spoken: SPOKEN[w.text] || w.text }));

const t0 = performance.now();
const { words: out, det } = align(samples, SR, words);
const ms = performance.now() - t0;

const err = out.map((w, i) => Math.abs(w.start - ref[i].start));
const sorted = [...err].sort((a, b) => a - b);
const q = (p) => sorted[Math.floor(p * (sorted.length - 1))];
// palavras-âncora do vídeo (cues_spec.json)
const spec = JSON.parse(readFileSync(`${REF}/tools/cues_spec.json`, "utf8"));
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const cueErr = [];
let cursor = 0;
for (const [name, c] of Object.entries(spec)) {
  let hits = 0, idx = -1;
  for (let i = 0; i < ref.length; i++) if (norm(ref[i].text) === norm(c.word)) { hits++; if (hits === (c.n || 1) && i >= 0) { idx = i; break; } }
  if (idx < 0) continue;
  cueErr.push({ name, word: ref[idx].text, ref: ref[idx].start, est: +out[idx].start.toFixed(2), err: +Math.abs(out[idx].start - ref[idx].start).toFixed(2) });
  cursor = idx;
}
const ce = cueErr.map((c) => c.err).sort((a, b) => a - b);
console.log(JSON.stringify({
  audio: audioPath.split("/").pop(), ms: Math.round(ms), det,
  words: { n: err.length, median: +q(0.5).toFixed(3), p90: +q(0.9).toFixed(3), max: +q(1).toFixed(3) },
  cues: { n: ce.length, median: +ce[Math.floor((ce.length - 1) / 2)].toFixed(3), p90: +ce[Math.floor(0.9 * (ce.length - 1))].toFixed(3), max: +ce[ce.length - 1].toFixed(3) },
  worstCues: cueErr.sort((a, b) => b.err - a.err).slice(0, 8),
}, null, 1));
