// S3b: robustez do alinhamento (outra voz, áudio degradado tipo celular, palavra pulada, um arquivo por bloco).
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { align } from "./align.mjs";

const SR = 16000;
const decode = (path, af) => {
  const args = ["-v", "error", "-i", path];
  if (af) args.push("-af", af);
  args.push("-ac", "1", "-ar", String(SR), "-f", "f32le", "-");
  const raw = execFileSync("ffmpeg", args, { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
};

const R = "C:/app.Modelar-Concorrentes-MKT/house/videos/reboco-novo/assets";
const E = "C:/app.Modelar-Concorrentes-MKT/ecasi/series/energia-eletrica/ep2-residencial-v2/assets";
const SPOKEN_R = { "1.": "um", "2.": "dois", "3.": "três", "28": "vinte e oito", "13,": "treze", "1": "um", "13245": "treze mil duzentos e quarenta e cinco", "NBR": "ene bê erre", "pH": "pê agá", "House": "ráus", "WhatsApp.": "uótsap" };
const SPOKEN_E = { "PVC": "pê vê cê", "70": "setenta", "1.": "um", "2.": "dois", "3.": "três", "2,5,": "dois e meio", "24": "vinte e quatro", "20.": "vinte", "DR.": "dê erre", "30": "trinta", "mA": "miliampères", "DPS": "dê pê ésse", "40": "quarenta", "NBR": "ene bê erre", "5410": "cinco mil quatrocentos e dez", "DR": "dê erre", "NR-10": "ene erre dez", "ECASI.": "ecási" };

function stats(out, ref, idxMap) {
  const e = [];
  out.forEach((w, i) => { const j = idxMap ? idxMap[i] : i; if (j >= 0 && w) e.push(Math.abs(w.start - ref[j].start)); });
  e.sort((a, b) => a - b);
  const q = (p) => e[Math.floor(p * (e.length - 1))];
  return { n: e.length, median: +q(0.5).toFixed(3), p90: +q(0.9).toFixed(3), max: +q(1).toFixed(3), within250ms: +(e.filter((x) => x <= 0.25).length / e.length).toFixed(3) };
}

function run(name, samples, ref, spoken, { drop = -1 } = {}) {
  const idx = ref.map((_, i) => i).filter((i) => i !== drop);
  const words = idx.map((i) => ({ display: ref[i].text, spoken: spoken[ref[i].text] || ref[i].text }));
  const { words: out } = align(samples, SR, words);
  console.log(name.padEnd(42), JSON.stringify(stats(out, ref, idx)));
}

// Um arquivo por bloco: corta o áudio nos limites de frase (fim de frase . ? !) e alinha cada bloco isolado.
function runPerBlock(name, samples, ref, spoken) {
  const blocks = []; let cur = [];
  ref.forEach((w, i) => { cur.push(i); if (/[.?!]$/.test(w.text) && cur.length >= 6) { blocks.push(cur); cur = []; } });
  if (cur.length) blocks.push(cur);
  const errs = [];
  for (const b of blocks) {
    const a = Math.max(0, (b[0] > 0 ? (ref[b[0] - 1].end + ref[b[0]].start) / 2 : 0));
    const z = b[b.length - 1] + 1 < ref.length ? (ref[b[b.length - 1]].end + ref[b[b.length - 1] + 1].start) / 2 : samples.length / SR;
    const seg = samples.subarray(Math.floor(a * SR), Math.floor(z * SR));
    const { words: out } = align(seg, SR, b.map((i) => ({ display: ref[i].text, spoken: spoken[ref[i].text] || ref[i].text })));
    out.forEach((w, k) => errs.push(Math.abs(w.start + a - ref[b[k]].start)));
  }
  errs.sort((x, y) => x - y);
  const q = (p) => errs[Math.floor(p * (errs.length - 1))];
  console.log(name.padEnd(42), JSON.stringify({ blocks: blocks.length, n: errs.length, median: +q(0.5).toFixed(3), p90: +q(0.9).toFixed(3), max: +q(1).toFixed(3), within250ms: +(errs.filter((x) => x <= 0.25).length / errs.length).toFixed(3) }));
}

const refR = JSON.parse(readFileSync(`${R}/transcript.json`, "utf8"));
const refE = JSON.parse(readFileSync(`${E}/transcript.json`, "utf8"));
// "celular": banda de telefone + ruído rosa (~22 dB SNR) + eco leve de sala
const PHONE = "highpass=f=300,lowpass=f=3400,aecho=0.8:0.5:40:0.25";
const noisy = (path) => {
  const out = `${process.cwd()}/tmp-noisy-${path.includes("ecasi") ? "E" : "R"}.wav`;
  if (!existsSync(out)) execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path, "-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.02:seed=7",
    "-filter_complex", `[0:a]${PHONE}[v];[1:a]volume=1[n];[v][n]amix=inputs=2:duration=first:normalize=0`, "-ar", "16000", "-ac", "1", out]);
  return out;
};

const sR = decode(`${R}/narracao-norm.mp3`);
const sE = decode(`${E}/narracao-norm.mp3`);
run("R limpo (referência)", sR, refR, SPOKEN_R);
run("E limpo (outra voz)", sE, refE, SPOKEN_E);
const nR = decode(noisy(`${R}/narracao-norm.mp3`));
const nE = decode(noisy(`${E}/narracao-norm.mp3`));
run("R celular (banda+ruído+eco)", nR, refR, SPOKEN_R);
run("E celular (banda+ruído+eco)", nE, refE, SPOKEN_E);
run("R palavra pulada no roteiro (#60)", sR, refR, SPOKEN_R, { drop: 60 });
run("E palavra pulada no roteiro (#100)", sE, refE, SPOKEN_E, { drop: 100 });
runPerBlock("R um arquivo por bloco", sR, refR, SPOKEN_R);
runPerBlock("E um arquivo por bloco", sE, refE, SPOKEN_E);
runPerBlock("E celular, um arquivo por bloco", nE, refE, SPOKEN_E);
