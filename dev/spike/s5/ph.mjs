import { phonemize, list_voices } from "phonemizer";
const v = await list_voices();
console.log("vozes espeak com pt:", v.filter((x) => /pt/i.test(x.identifier || x.name || JSON.stringify(x))).map((x) => x.identifier || x.name));
for (const lang of ["pt-br", "pt"]) {
  try { console.log(lang, await phonemize("Rebocou ontem? Já pode pintar? Ainda não. Vinte e oito dias de cura.", lang)); } catch (e) { console.log(lang, "ERRO", e.message); }
}
