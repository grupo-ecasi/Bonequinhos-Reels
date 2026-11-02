#!/usr/bin/env node
// Validador do projeto (roda no sandbox do claude.ai ou em qualquer Node ≥ 18, sem navegador e sem rede).
// Uso: node check_project.mjs <pasta-do-projeto> [--json]
// 1) roteiro: marcação, marcas, blocos, números sem forma falada
// 2) sintaxe e proibições (Math.random, Date, DOM, fetch, import...) em cena.js / tela.js / sons.js / momentos.js
// 3) marcas C.x e blocos B.x usados existem; nomes de H.*, lib.*, sons e ações existem
// 4) teste de contrato: monta a cena com o THREE real, roda update(t) em toda a duração, confere NaN,
//    determinismo (em ordem × pulando direto), câmera, âncoras e desenha a tela num canvas falso.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import * as acorn from "./lib/acorn.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNTIME = join(HERE, "..", "assets", "runtime");
const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const asJson = args.includes("--json");
if (!dir) { console.error("uso: node check_project.mjs <pasta-do-projeto>"); process.exit(2); }

const errors = [], warnings = [];
const err = (file, msg, loc) => errors.push(`${file}${loc ? `:${loc.line}:${loc.column + 1}` : ""} — ${msg}`);
const warn = (file, msg, loc) => warnings.push(`${file}${loc ? `:${loc.line}:${loc.column + 1}` : ""} — ${msg}`);
const read = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : null);

// ---------- contexto com o runtime (sem DOM) ----------
function makeCtx2d() {
  let fontPx = 40;
  const store = {};
  const fn = () => undefined;
  const ctx = new Proxy(store, {
    get(t, k) {
      if (k === "measureText") return (s) => ({ width: String(s).length * fontPx * 0.5 });
      if (k === "createRadialGradient" || k === "createLinearGradient" || k === "createPattern") return () => ({ addColorStop: fn });
      if (k === "getImageData") return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (k in t) return t[k];
      return fn;
    },
    set(t, k, v) { t[k] = v; if (k === "font") { const m = String(v).match(/(\d+(?:\.\d+)?)px/); if (m) fontPx = +m[1]; } return true; },
  });
  return ctx;
}
const makeCanvas = (w, h) => ({ width: w, height: h, style: {}, getContext: () => makeCtx2d(), addEventListener() {}, toDataURL: () => "" });
const sandbox = { console: { log() {}, warn() {}, error() {}, info() {} }, Math, JSON, Date, Float32Array, Float64Array, Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array, ArrayBuffer, DataView, Array, Object, Proxy, Reflect, Error, TypeError, RangeError, Map, Set, WeakMap, WeakSet, Promise, Symbol, Number, String, Boolean, parseFloat, parseInt, isFinite, isNaN, setTimeout, clearTimeout, queueMicrotask, structuredClone, TextEncoder, TextDecoder };
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
sandbox.navigator = { userAgent: "node", hardwareConcurrency: 1 };
const ctx = vm.createContext(sandbox);
const load = (f) => vm.runInContext(readFileSync(join(RUNTIME, f), "utf8"), ctx, { filename: `runtime/${f}` });
try { load("vendor.min.js"); } catch (e) { console.error("falha ao carregar vendor.min.js:", e.message); process.exit(2); }
for (const f of ["base.js", "roteiro.js", "audio.js", "lib3d.js", "tela.js"]) load(f);
const BQ = sandbox.BQ, THREE = sandbox.BQV.THREE, addons = sandbox.BQV.addons;

// ---------- 1) roteiro ----------
const roteiro = read("roteiro.txt");
if (!roteiro) err("roteiro.txt", "arquivo não existe");
const parsed = BQ.roteiro.parse(roteiro || "");
parsed.errors.forEach((e) => err("roteiro.txt", e));
parsed.warnings.forEach((w) => warn("roteiro.txt", w));
const est = parsed.tokens.length ? BQ.roteiro.estimate(parsed) : null;
const built = est ? BQ.roteiro.build(parsed, est) : null;
const cueNames = new Set(built ? Object.keys(built.C) : ["hook", "end"]);
const blockNames = new Set(parsed.blocks.map((b) => b.name));
if (built) {
  const dur = built.C.end;
  if (dur < 15) warn("roteiro.txt", `duração estimada curta (${dur.toFixed(1)} s); Reels de bonequinho costumam ter 45–90 s`);
  if (dur > 95) warn("roteiro.txt", `duração estimada longa (${dur.toFixed(1)} s); acima de 90 s a retenção cai`);
  if (!blockNames.has("gancho")) warn("roteiro.txt", 'não há bloco "# gancho"');
}

// ---------- 2) e 3) análise estática ----------
const FORBID_ID = new Set(["Date", "performance", "requestAnimationFrame", "setTimeout", "setInterval", "fetch", "XMLHttpRequest", "eval", "Function", "document", "window", "navigator", "localStorage", "sessionStorage", "indexedDB", "Worker", "importScripts", "WebSocket"]);
const world0 = BQ.createLib3D({ THREE, addons, brand: { colors: { accent: "#2457d6", success: "#16a34a", danger: "#dc2626", ink: "#0b1220" }, fonts: { display: "x", text: "x" } }, makeCanvas });
const LIB = world0.lib;
const libPaths = new Set();
(function walkApi(o, p, depth) { for (const k of Object.keys(o)) { const q = p ? `${p}.${k}` : k; libPaths.add(q); const v = o[k]; if (depth < 1 && v && typeof v === "object" && !v.isObject3D && !Array.isArray(v) && k !== "THREE" && k !== "scene" && k !== "u" && k !== "util") walkApi(v, q, depth + 1); } })(LIB, "", 0);
world0.dispose();
const telaApi = BQ.createTela({ brand: { colors: {}, fonts: { display: "x", text: "x" } }, screen: () => ({ x: 0, y: 0, visible: true }) });
const H_NAMES = new Set(Object.keys(telaApi.H));
const near = (name, list) => [...list].map((x) => [x, lev(name, x)]).filter(([, d]) => d <= Math.max(2, name.length / 3)).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([x]) => x);
function lev(a, b) { const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }

/** A função update(t) devolvida pela cena não pode guardar estado: atribuir a variável de fora dela
 *  (contador += ..., ultimo = t) faz o quadro depender do caminho (prévia ≠ export). */
function checkUpdateState(ast, f) {
  const isFn = (n) => n && (n.type === "ArrowFunctionExpression" || n.type === "FunctionExpression");
  const declared = (fnNode) => {
    const names = new Set();
    const addPat = (p) => { if (!p) return; if (p.type === "Identifier") names.add(p.name); else if (p.type === "ObjectPattern") p.properties.forEach((q) => addPat(q.value || q.argument)); else if (p.type === "ArrayPattern") p.elements.forEach(addPat); else if (p.type === "AssignmentPattern") addPat(p.left); else if (p.type === "RestElement") addPat(p.argument); };
    fnNode.params.forEach(addPat);
    walk(fnNode.body, (n) => { if (n.type === "VariableDeclarator") addPat(n.id); if (n.type === "FunctionDeclaration" && n.id) names.add(n.id.name); });
    return names;
  };
  walk(ast, (call) => {
    if (call.type !== "CallExpression" || !call.callee.property || call.callee.property.name !== "defineScene" || !isFn(call.arguments[0])) return;
    const scene = call.arguments[0];
    const returned = [];
    if (scene.body.type !== "BlockStatement") { if (isFn(scene.body)) returned.push(scene.body); }
    else for (const st of scene.body.body) if (st.type === "ReturnStatement" && st.argument) {
      if (isFn(st.argument)) returned.push(st.argument);
      else if (st.argument.type === "ObjectExpression") st.argument.properties.forEach((p) => isFn(p.value) && returned.push(p.value));
    }
    for (const upd of returned) {
      const own = declared(upd);
      walk(upd.body, (n) => {
        const target = n.type === "UpdateExpression" ? n.argument : n.type === "AssignmentExpression" ? n.left : null;
        if (target && target.type === "Identifier" && !own.has(target.name)) err(f, `update(t) altera a variável de fora "${target.name}" — isso guarda estado entre quadros e a prévia fica diferente do vídeo exportado. Calcule tudo a partir de t (ex.: u.track(t, ...), u.prog(t, a, b)).`, n.loc.start);
      });
    }
  });
}

function walk(node, fn, parent) { if (!node || typeof node.type !== "string") return; fn(node, parent); for (const k of Object.keys(node)) { if (k === "loc") continue; const v = node[k]; if (Array.isArray(v)) v.forEach((c) => walk(c, fn, node)); else if (v && typeof v.type === "string") walk(v, fn, node); } }
const memberPath = (n) => { const parts = []; while (n && n.type === "MemberExpression" && !n.computed) { parts.unshift(n.property.name); n = n.object; } if (n && n.type === "Identifier") { parts.unshift(n.name); return parts; } return null; };
const files = { "momentos.js": read("momentos.js"), "cena.js": read("cena.js"), "tela.js": read("tela.js"), "sons.js": read("sons.js") };
if (!files["cena.js"]) err("cena.js", "arquivo não existe");
if (!files["tela.js"]) err("tela.js", "arquivo não existe");
const REQUIRED_CALL = { "cena.js": "defineScene", "tela.js": "defineHud", "sons.js": "defineSfx", "momentos.js": "defineMoments" };
for (const [f, src] of Object.entries(files)) {
  if (src == null) continue;
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "script", locations: true }); }
  catch (e) { err(f, `erro de sintaxe: ${e.message.replace(/ \(\d+:\d+\)$/, "")}`, e.loc); continue; }
  if (!src.includes(`BQ.${REQUIRED_CALL[f]}`)) err(f, `precisa chamar BQ.${REQUIRED_CALL[f]}(...)`);
  if (f === "cena.js") checkUpdateState(ast, f);
  walk(ast, (n, parent) => {
    if (n.type === "Identifier" && FORBID_ID.has(n.name) && !(parent && parent.type === "MemberExpression" && parent.property === n && !parent.computed) && !(parent && (parent.type === "Property") && parent.key === n)) err(f, `"${n.name}" é proibido no projeto (quebra o determinismo ou depende do navegador)`, n.loc.start);
    if (n.type === "MemberExpression" && !n.computed) {
      const p = memberPath(n);
      if (!p) return;
      if (p[0] === "Math" && p[1] === "random") err(f, "Math.random é proibido: use u.rng(semente) ou u.hash(n)", n.loc.start);
      if (parent && parent.type === "MemberExpression" && parent.object === n) return; // só o caminho completo
      if (p[0] === "C" && p.length >= 2 && !cueNames.has(p[1])) err(f, `marca C.${p[1]} não existe no roteiro.` + (near(p[1], cueNames).length ? ` Parecidas: ${near(p[1], cueNames).join(", ")}` : ` Crie [[${p[1]}]] no roteiro.`), n.loc.start);
      if (p[0] === "B" && p.length >= 2 && !blockNames.has(p[1])) err(f, `bloco B.${p[1]} não existe (blocos: ${[...blockNames].join(", ")})`, n.loc.start);
      if (p[0] === "H" && p.length >= 2 && f === "tela.js" && !H_NAMES.has(p[1])) err(f, `H.${p[1]} não existe. Widgets: ${[...H_NAMES].filter((x) => x !== "SAFE").join(", ")}` + (near(p[1], H_NAMES).length ? `. Você quis dizer ${near(p[1], H_NAMES).join(" ou ")}?` : ""), n.loc.start);
      if (p[0] === "lib" && p.length >= 2 && f === "cena.js") {
        const q = p.slice(1, 3).join(".");
        const ok = libPaths.has(q) || libPaths.has(p[1]) && (p.length === 2 || !libPaths.has(`${p[1]}.${p[2]}`) && ["THREE", "scene", "u", "util"].includes(p[1]));
        if (!libPaths.has(p[1])) err(f, `lib.${p[1]} não existe.` + (near(p[1], [...libPaths].filter((x) => !x.includes("."))).length ? ` Você quis dizer lib.${near(p[1], [...libPaths].filter((x) => !x.includes(".")))[0]}?` : ""), n.loc.start);
        else if (p.length >= 3 && !ok && typeof LIB[p[1]] === "object" && !["THREE", "scene", "u", "util"].includes(p[1])) err(f, `lib.${q} não existe. Em lib.${p[1]}: ${Object.keys(LIB[p[1]]).join(", ")}`, n.loc.start);
      }
    }
    if (n.type === "WhileStatement" && n.test.type === "Literal" && n.test.value === true) err(f, "while(true) é proibido", n.loc.start);
    if (n.type === "CallExpression" && n.callee.type === "MemberExpression") {
      const p = memberPath(n.callee);
      if (p && p.join(".") === "lib.obj" && n.arguments[0] && n.arguments[0].type === "Literal" && !LIB.OBJECTS.includes(n.arguments[0].value)) err(f, `lib.obj("${n.arguments[0].value}") não existe. Objetos: ${LIB.OBJECTS.join(", ")}`, n.loc.start);
      if (p && p.join(".") === "Object.assign" && n.arguments.some((a) => a.type === "ObjectExpression" && a.properties.some((pp) => pp.key && ["position", "rotation", "scale", "quaternion"].includes(pp.key.name)))) err(f, "Object.assign não consegue trocar position/rotation/scale de objetos 3D: use lib.put(obj, [x,y,z], [rx,ry,rz])", n.loc.start);
    }
    if (n.type === "ArrayExpression" && f === "cena.js" && parent && parent.type === "ArrayExpression" && n.elements[0] && n.elements[0].type === "Literal" && typeof n.elements[0].value === "string" && LIB.ACTIONS && /^[a-z][A-Za-z]+$/.test(n.elements[0].value) && n.elements.length >= 3 && !LIB.ACTIONS.includes(n.elements[0].value) && near(n.elements[0].value, LIB.ACTIONS).length) warn(f, `ação "${n.elements[0].value}" não existe; você quis dizer "${near(n.elements[0].value, LIB.ACTIONS)[0]}"?`, n.loc.start);
    if (n.type === "Literal" && typeof n.value === "string" && f === "sons.js" && parent && parent.type === "ArrayExpression" && parent.elements[2] === n && !BQ.audio.SOUND_NAMES.includes(n.value)) err(f, `som "${n.value}" não existe.` + (near(n.value, BQ.audio.SOUND_NAMES).length ? ` Você quis dizer "${near(n.value, BQ.audio.SOUND_NAMES)[0]}"?` : "") + ` Sons: ${BQ.audio.SOUND_NAMES.join(", ")}`, n.loc.start);
  });
}

// ---------- 4) teste de contrato (só se não houver erro estático) ----------
const report = { duration: built ? +built.C.end.toFixed(2) : null, cues: built ? Object.keys(built.C).length - 2 : 0, blocks: [...blockNames], widgets: 0, sfx: 0, actors: 0 };
if (!errors.length && built) {
  for (const [f, src] of Object.entries(files)) if (src != null) { try { vm.runInContext(src, ctx, { filename: `projeto/${f}` }); } catch (e) { err(f, `erro ao carregar: ${e.message}`); } }
  const brandJson = read("marca.json") ? JSON.parse(read("marca.json")) : { mode: "sem-marca" };
  const brand = { mode: brandJson.mode, name: brandJson.name || "", handle: brandJson.handle || "", whatsapp: brandJson.whatsapp || "", colors: { ink: "#0b1220", accent: "#2457d6", accentLight: "#7fb0ff", success: "#16a34a", danger: "#dc2626", info: "#0ea5e9", captionBg: "#000", captionNum: "#ff0", ...(brandJson.colors || {}) }, fonts: { display: "x", text: "x" }, logo: null };
  brand.color = (r) => brand.colors[r] || r;
  const logoTex = brand.mode === "empresa" ? new THREE.Texture() : null;
  const C = BQ.strict({ ...built.C }, "C"), B = BQ.strict({ ...built.B }, "B");
  let M = BQ.strict({}, "M");
  try { if (BQ.parts.moments) M = BQ.strict({ ...BQ.parts.moments(C, B) }, "M"); } catch (e) { err("momentos.js", e.message); }
  const mkWorld = () => {
    const w = BQ.createLib3D({ THREE, addons, brand, logoTex, makeCanvas });
    const upd = BQ.parts.scene({ THREE, lib: w.lib, C, B, M, brand, u: BQ.util });
    w.setUserUpdate(upd);
    return w;
  };
  let w1 = null, w2 = null;
  try { w1 = mkWorld(); w2 = mkWorld(); } catch (e) { err("cena.js", `ao montar a cena: ${e.message}` + stackLine(e)); }
  if (w1 && w2) {
    const T = built.C.end;
    const times = []; for (let t = 0; t <= T + 1e-6; t += 0.1) times.push(+t.toFixed(2));
    let firstBad = null;
    const seqHash = new Map();
    try {
      for (const t of times) {
        w1.update(t);
        const cp = w1.camera.position;
        if (![cp.x, cp.y, cp.z].every(Number.isFinite) && !firstBad) { firstBad = t; err("cena.js", `câmera com posição inválida (NaN) em t=${t}s — confira lib.camera.keys`); }
        seqHash.set(t, w1.stateHash());
      }
    } catch (e) { err("cena.js", `update falhou em t≈${e.t ?? "?"}: ${e.message}` + stackLine(e)); }
    // pulando direto, em ordem inversa
    try {
      let bad = 0;
      for (const t of times.slice().reverse().filter((_, i) => i % 7 === 0)) { w2.update(t); if (w2.stateHash() !== seqHash.get(t)) { bad++; if (bad === 1) err("cena.js", `não determinística: o quadro em t=${t}s muda conforme o caminho (em ordem × pulando). Algo guarda estado entre quadros (variável fora do update, +=, acumulador). Tudo deve ser função de t.`); } }
    } catch (e) { err("cena.js", `update falhou: ${e.message}` + stackLine(e)); }
    // loop: começo × fim
    try {
      w2.update(0); const a = w2.camera.position.clone(); w2.update(T); const b = w2.camera.position.clone();
      if (a.distanceTo(b) > 0.3) warn("cena.js", `loop: a câmera no fim (t=${T.toFixed(1)}) está ${a.distanceTo(b).toFixed(2)} m longe do começo; para o Reels emendar, a última chave deve repetir a primeira`);
    } catch {}
    report.actors = w1.scene.children.filter((o) => o.userData && o.userData.isPerson).length;
    try { visionCheck(w1, T); } catch (e) { warn("cena.js", `não consegui conferir o enquadramento: ${e.message}`); }
    try { timingCheck(w1); } catch {}
    // tela
    const tela = BQ.createTela({ brand, C, B, M, screen: (a) => { try { return w1.screen(a); } catch (e) { throw new Error(`âncora "${a}" não existe na cena (crie com lib.anchor)`); } }, logoImage: null });
    let widgets = [];
    try { widgets = (BQ.parts.hud({ H: tela.H, C, B, M, brand, u: BQ.util }) || []).flat().filter(Boolean); } catch (e) { err("tela.js", e.message + stackLine(e)); }
    report.widgets = widgets.length;
    for (const wd of widgets) if (wd.kind !== "flash" && Number.isFinite(wd.from) && Number.isFinite(wd.until) && wd.until - wd.from < 1.0 && wd.until > wd.from) warn("tela.js", `${wd.kind} fica só ${(wd.until - wd.from).toFixed(2)} s na tela (${wd.from.toFixed(2)}–${wd.until.toFixed(2)}); menos de 1 s não dá para ler`);
    if (built.B.cta && brand.mode === "empresa") {
      const a = built.B.cta.start, b = built.B.loop ? built.B.loop.start + 0.39 : built.C.end - 0.2;
      for (const wd of widgets) if (["card", "compare", "list", "bigNumber", "answer", "text"].includes(wd.kind) && wd.from < b && wd.until > a) warn("tela.js", `${wd.kind} (${wd.from.toFixed(1)}–${wd.until.toFixed(1)} s) aparece junto com o CTA automático (${a.toFixed(1)}–${b.toFixed(1)} s, card em y≈1020–1350): feche antes de C.cta`);
    }
    if (built.B.cta && brand.mode !== "empresa") warn("roteiro.txt", "há bloco # cta, mas o projeto está sem marca: o card de CTA não aparece (a fala continua)");
    const c2d = makeCtx2d();
    const reported = new Set();
    for (const t of times.filter((_, i) => i % 3 === 0)) {
      try { w1.update(t); } catch {}
      for (const wd of widgets) { try { wd.draw(c2d, t); } catch (e) { if (!reported.has(wd)) { reported.add(wd); err("tela.js", `${wd.kind || "widget"} falhou em t=${t}s: ${e.message}`); } } }
    }
    // janelas de tempo dos widgets
    for (const wd of widgets) if (Number.isFinite(wd.from) && Number.isFinite(wd.until) && wd.until <= wd.from) err("tela.js", `${wd.kind}: until (${wd.until.toFixed(2)}) não é depois de from (${wd.from.toFixed(2)})`);
    const tops = widgets.filter((x) => ["title", "steps"].includes(x.kind));
    for (let i = 0; i < tops.length; i++) for (let j = i + 1; j < tops.length; j++) { const a = tops[i], b = tops[j]; if (a.from < b.until && b.from < a.until && (a.y ?? 0) === (b.y ?? 0)) warn("tela.js", `${a.kind} e ${b.kind} ficam no topo ao mesmo tempo (${Math.max(a.from, b.from).toFixed(1)}–${Math.min(a.until, b.until).toFixed(1)} s); um vai cobrir o outro`); }
    // sons
    try {
      const list = BQ.parts.sfx ? BQ.parts.sfx({ C, B, M, u: BQ.util }) || [] : [];
      report.sfx = list.length;
      const ts = [];
      for (const ev of list) {
        if (!Array.isArray(ev)) { err("sons.js", `evento inválido ${JSON.stringify(ev)}: use [marca, deslocamento, "som", dB]`); continue; }
        const [at, off = 0, name] = ev;
        const base = typeof at === "number" ? at : at in built.C ? built.C[at] : (() => { try { return M[at]; } catch { return NaN; } })();
        if (!Number.isFinite(base)) err("sons.js", `marca "${at}" não existe`);
        else ts.push(base + off);
        if (!BQ.audio.SOUND_NAMES.includes(name)) err("sons.js", `som "${name}" não existe`);
      }
      ts.sort((a, b) => a - b);
      for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] < 0.06) { warn("sons.js", `dois sons quase juntos em ${ts[i].toFixed(2)} s (embolam)`); break; }
      if (ts.some((t) => t < 0 || t > built.C.end)) warn("sons.js", "há som fora da duração do vídeo");
    } catch (e) { err("sons.js", e.message + stackLine(e)); }
    w1.dispose(); w2.dispose();
  }
}
/** "Visão cega": o que dá para saber do enquadramento sem renderizar. */
function visionCheck(w, T) {
  const box = new THREE.Box3(), size = new THREE.Vector3(), v = new THREE.Vector3();
  const tops = w.scene.children.filter((o) => (o.isMesh || o.isGroup || o.isSprite) && !["ceu", "ambiente", "comodo"].includes(o.name));
  const label = (o) => { box.setFromObject(o); box.getSize(size); const c = box.getCenter(v); return `${o.userData && o.userData.isPerson ? "bonequinho" : o.name ? `"${o.name}"` : "objeto"} de ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)} m em (${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)})`; };
  const inside = new Map(), cover = new Map();
  const mark = (map, o, t) => { if (!map.has(o)) map.set(o, []); map.get(o).push(t); };
  for (let t = 0; t <= T; t += 0.25) {
    w.update(t);
    const cam = w.camera.position;
    for (const o of tops) {
      if (!o.visible) continue;
      box.setFromObject(o);
      if (box.isEmpty()) continue;
      box.getSize(size);
      if (Math.max(size.x, size.y, size.z) > 12 || Math.max(size.x, size.y, size.z) < 0.03) continue;
      if (box.clone().expandByScalar(0.05).containsPoint(cam)) { mark(inside, o, t); continue; }
      if (o.userData && o.userData.isPerson) continue;
      if (box.clone().expandByScalar(0.25).containsPoint(w.cameraLook())) continue; // é o assunto do close
      // área da tela coberta pela caixa do objeto (só se estiver toda na frente da câmera)
      let x0 = 1, x1 = -1, y0 = 1, y1 = -1, front = true;
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
        const local = v.clone().applyMatrix4(w.camera.matrixWorldInverse);
        if (local.z > -0.05) { front = false; break; }
        v.project(w.camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
      if (!front) continue;
      const area = Math.max(0, Math.min(1, x1) - Math.max(-1, x0)) * Math.max(0, Math.min(1, y1) - Math.max(-1, y0)) / 4;
      if (area > 0.8) mark(cover, o, t);
    }
  }
  const ranges = (ts) => { const out = []; let a = ts[0], b = ts[0]; for (const t of ts.slice(1)) { if (t - b > 0.3) { out.push([a, b]); a = t; } b = t; } out.push([a, b]); return out.map(([x, y]) => (x === y ? `${x.toFixed(1)}s` : `${x.toFixed(1)}–${(y + 0.25).toFixed(1)}s`)).join(", "); };
  for (const [o, ts] of inside) warn("cena.js", `a câmera fica DENTRO de ${label(o)} em ${ranges(ts)} → quadro escuro/estranho. Aumente "dist" ou mude o "look"/"yaw" nessas chaves.`);
  for (const [o, ts] of cover) if (ts.length >= 3) warn("cena.js", `${label(o)} cobre mais de 80% da tela em ${ranges(ts)} → o assunto some. Afaste a câmera (dist maior) ou mude o ângulo.`);
  // bonequinhos: de costas para a câmera ou com a cabeça cortada enquanto aparecem
  const people = w.scene.children.filter((o) => o.userData && o.userData.isPerson);
  const back = new Map(), headCut = new Map();
  const fwd = new THREE.Vector3(), toCam = new THREE.Vector3(), hp = new THREE.Vector3(), bp = new THREE.Vector3();
  for (let t = 0; t <= T; t += 0.25) {
    w.update(t);
    for (const p of people) {
      p.userData.torso.getWorldPosition(bp); const b = bp.clone().project(w.camera);
      if (!(b.z < 1 && Math.abs(b.x) < 0.9 && Math.abs(b.y) < 0.95)) continue;
      p.userData.head.getWorldPosition(hp);
      const h = hp.clone().project(w.camera);
      if (h.y > 0.98 || Math.abs(h.x) > 1) mark(headCut, p, t);
      fwd.set(0, 0, 1).applyQuaternion(p.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
      toCam.copy(w.camera.position).sub(hp).setY(0).normalize();
      if (fwd.dot(toCam) < -0.5) mark(back, p, t);
    }
  }
  const who = (p) => `bonequinho ${people.indexOf(p) + 1} (camisa #${p.userData.torso.material.color.getHexString()})`;
  for (const [p, ts] of back) if (ts.length >= 8) warn("cena.js", `${who(p)} fica DE COSTAS para a câmera em ${ranges(ts)}. Vire-o com ["face", início, fim, {camera: true}] ou {toward: alvo}, ou mude o yaw da câmera.`);
  for (const [p, ts] of headCut) if (ts.length >= 3) warn("cena.js", `${who(p)} aparece com a CABEÇA FORA DO QUADRO em ${ranges(ts)}. Suba o "look" (≈ 1,3 para corpo inteiro) ou aumente "dist".`);
  // materiais: objeto grande muito escuro e brilho que estoura no bloom
  const seenDark = new Set(), seenGlow = new Set();
  w.scene.traverse((m) => {
    if (!m.isMesh || !m.material || m.name === "ceu") return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    box.setFromObject(m); box.getSize(size);
    const big = size.x * size.y + size.y * size.z + size.x * size.z > 1.2;
    for (const mt of mats) {
      if (mt.color && !mt.map && big && !seenDark.has(mt)) { const c = mt.color, lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; if (lum < 0.02) { seenDark.add(mt); warn("cena.js", `objeto grande quase preto (cor #${c.getHexString()}) de ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)} m: em close vira quadro preto. Use um tom médio (ex.: #3b4252 em vez de #111).`); } }
      if (mt.emissive && (mt.emissiveIntensity ?? 1) * Math.max(mt.emissive.r, mt.emissive.g, mt.emissive.b) > 0.6 && Math.max(size.x, size.y, size.z) > 0.04 && !seenGlow.has(mt)) { seenGlow.add(mt); warn("cena.js", `material emissivo forte (#${mt.emissive.getHexString()} × ${(mt.emissiveIntensity ?? 1)}) em peça de ${Math.max(size.x, size.y, size.z).toFixed(2)} m: com o bloom vira mancha branca estourada. Use emissive só em luzes/LEDs pequenos ou fx.glow; espuma, água e vidro não brilham.`); }
    }
  });
}
/** Durações curtas demais (ações, câmera, widgets) e sobreposição com o CTA. */
function timingCheck(w) {
  const MIN = { walk: 0.6, reach: 0.6, point: 0.6, press: 0.5, scrub: 0.8, paint: 0.8, wave: 0.8, thumbsUp: 0.6, hold: 0.5, headShake: 0.6, nod: 0.5, look: 0.4, celebrate: 0.8, shrug: 0.6, scare: 0.4, talk: 0.5, jump: 0.4, crouch: 0.6, face: 0.2, turn: 0.2 };
  w.scene.traverse((o) => { const A = o.userData && o.userData.actor; if (!A) return; for (const [type, a, b] of A.list) if (b - a < (MIN[type] ?? 0.3)) warn("cena.js", `ação "${type}" dura só ${(b - a).toFixed(2)} s (${a.toFixed(2)}–${b.toFixed(2)}); mínimo recomendado ${MIN[type]} s ou ela mal aparece`); });
  const keys = (w.cameraKeys() || []).slice().sort((a, b) => a.t - b.t);
  for (let i = 1; i < keys.length; i++) if (keys[i].t - keys[i - 1].t < 0.7 && !keys[i].cut) warn("cena.js", `chaves de câmera muito próximas (${keys[i - 1].t.toFixed(2)} s e ${keys[i].t.toFixed(2)} s): movimento brusco. Deixe ≥ 0,8 s ou use cut: true`);
  return true;
}
function stackLine(e) { const m = String(e.stack || "").match(/projeto\/(\w+\.js):(\d+):(\d+)/); return m ? ` (${m[1]}:${m[2]}:${m[3]})` : ""; }

for (const w of BQ.optWarnings || []) warnings.push(w);
if (built) {
  report.blocosTempo = Object.fromEntries(Object.entries(built.B).map(([n, b]) => [n, `${b.start.toFixed(1)}–${b.end.toFixed(1)} s`]));
  report.marcasTempo = Object.fromEntries(Object.entries(built.C).sort((a, b) => a[1] - b[1]).map(([c, t]) => [c, +t.toFixed(2)]));
}
if (asJson) console.log(JSON.stringify({ ok: !errors.length, errors, warnings, report }, null, 1));
else {
  console.log(`Projeto: ${dir}`);
  console.log(`  duração estimada ${report.duration ?? "?"} s · ${report.cues} marcas · ${report.widgets} widgets · ${report.sfx} sons · ${report.actors} bonequinho(s)`);
  if (report.blocosTempo) {
    console.log(`  blocos (tempo estimado sem narração): ${Object.entries(report.blocosTempo).map(([n, r]) => `${n} ${r}`).join(" · ")}`);
    console.log(`  marcas: ${Object.entries(report.marcasTempo).map(([c, t]) => `${c}=${t}`).join("  ")}`);
  }
  for (const w of warnings) console.log(`  aviso: ${w}`);
  for (const e of errors) console.log(`  ERRO: ${e}`);
  console.log(errors.length ? `✗ ${errors.length} erro(s)` : "✓ validação ok");
}
process.exit(errors.length ? 1 : 0);
