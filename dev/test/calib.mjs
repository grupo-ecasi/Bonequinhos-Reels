import { readFileSync } from "node:fs";
import { loadRuntime } from "./load_runtime.mjs";
const { BQ } = loadRuntime(["base.js", "roteiro.js"]);
const sets = [
  ["C:/app.Modelar-Concorrentes-MKT/house/videos/reboco-novo/assets/transcript.json", { "1.": "um", "2.": "dois", "3.": "três", "28": "vinte e oito", "13,": "treze", "1": "um", "13245": "treze mil duzentos e quarenta e cinco", "NBR": "ene bê erre", "pH": "pê agá", "House": "ráus", "WhatsApp.": "uótsap" }],
  ["C:/app.Modelar-Concorrentes-MKT/ecasi/series/energia-eletrica/ep2-residencial-v2/assets/transcript.json", { "PVC": "pê vê cê", "70": "setenta", "1.": "um", "2.": "dois", "3.": "três", "2,5,": "dois e meio", "24": "vinte e quatro", "20.": "vinte", "DR.": "dê erre", "30": "trinta", "mA": "miliampères", "DPS": "dê pê ésse", "40": "quarenta", "NBR": "ene bê erre", "5410": "cinco mil quatrocentos e dez", "DR": "dê erre", "NR-10": "ene erre dez", "ECASI.": "ecási" }],
];
for (const [p, SP] of sets) {
  const ref = JSON.parse(readFileSync(p, "utf8"));
  const text = ref.map((w) => SP[w.text] ? `{${w.text.replace(/[.,]$/, "")}|${SP[w.text]}}${(w.text.match(/[.,]$/) || [""])[0]}` : w.text).join(" ");
  const parsed = BQ.roteiro.parse(text);
  // pausas reais por força de pontuação
  const by = {}; let speechUnits = 0, speechTime = 0;
  parsed.tokens.forEach((t, i) => { speechUnits += t.w; speechTime += ref[i].end - ref[i].start; if (i < ref.length - 1) { const g = ref[i + 1].start - ref[i].end; (by[t.brk] ||= []).push(g); } });
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  console.log(p.split("/").slice(-4, -2).join("/"), "real", ref[ref.length - 1].end, "rate(fala/unid)", (speechTime / speechUnits).toFixed(4), "pausas:", Object.fromEntries(Object.entries(by).map(([k, v]) => [k, `${mean(v).toFixed(3)} (${v.length})`])));
}
