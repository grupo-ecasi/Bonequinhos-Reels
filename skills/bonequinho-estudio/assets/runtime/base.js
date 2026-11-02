/* Bonequinhos-Reels · base.js
 * Namespace BQ, utilidades determinísticas e registro das partes do tema.
 * Roda no navegador (estúdio) e no Node (validadores, via vm). Não usa DOM.
 */
(function (root) {
  "use strict";
  const BQ = (root.BQ = root.BQ || {});
  BQ.API_VERSION = 1;
  BQ.W = 1080;
  BQ.H = 1920;
  BQ.FPS = 30;

  // ---------- utilidades determinísticas (portadas de R world.html 157-187) ----------
  const U = (BQ.util = {});
  U.hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  U.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  U.clamp01 = (x) => Math.min(1, Math.max(0, x));
  U.prog = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : U.clamp01((t - a) / (b - a)));
  U.lerp = (a, b, x) => a + (b - a) * x;
  U.lerp3 = (a, b, x) => [U.lerp(a[0], b[0], x), U.lerp(a[1], b[1], x), U.lerp(a[2], b[2], x)];
  U.easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  U.easeOut = (x) => 1 - Math.pow(1 - x, 3);
  U.easeIn = (x) => x * x * x;
  U.easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  U.easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
  U.spring = (x) => (x <= 0 ? 0 : 1 - Math.exp(-6 * x) * Math.cos(9 * x));
  U.smoothstep = (a, b, x) => { const t = U.clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  U.angLerp = (a, b, x) => { let d = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return a + d * x; };
  U.deg = (d) => (d * Math.PI) / 180;
  /** Janela de visibilidade com entrada e saída suaves: 0 fora, 1 no meio. */
  U.window = (t, from, until, fadeIn = 0.35, fadeOut = 0.25) => {
    if (t < from || t > until) return 0;
    return Math.min(U.prog(t, from, from + fadeIn), 1 - U.prog(t, until - fadeOut, until));
  };
  /** Interpola chaves [[t, valor], ...] com easeInOut. Valor pode ser número ou array. */
  U.track = (t, keys, ease = U.easeInOut) => {
    if (!keys.length) return 0;
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [ta, va] = keys[i], [tb, vb] = keys[i + 1];
      if (t <= tb) {
        const x = tb === ta ? 1 : ease((t - ta) / (tb - ta));
        return Array.isArray(va) ? va.map((v, j) => U.lerp(v, vb[j], x)) : U.lerp(va, vb, x);
      }
    }
    return keys[keys.length - 1][1];
  };
  /** Gerador pseudoaleatório com semente (mulberry32). Use em vez de Math.random. */
  U.rng = (seed) => {
    let s = (seed >>> 0) || 1;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let z = s; z = Math.imul(z ^ (z >>> 15), z | 1); z ^= z + Math.imul(z ^ (z >>> 7), z | 61); return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
  };

  // ---------- erros de carregamento dos arquivos do projeto (navegador) ----------
  BQ.loadErrors = [];
  if (typeof root.addEventListener === "function") {
    root.addEventListener("error", (e) => {
      const f = String(e.filename || "");
      BQ.loadErrors.push(`${f.split("/").slice(-2).join("/") || "script"}:${e.lineno || "?"}:${e.colno || "?"} ${e.message}`);
    });
  }

  // ---------- opções desconhecidas (avisa em vez de ignorar em silêncio) ----------
  BQ.optWarnings = [];
  /** Confere as chaves de um objeto de opções contra a lista permitida. */
  BQ.checkOpts = (where, o, allowed) => {
    if (!o || typeof o !== "object" || Array.isArray(o)) return o;
    for (const k of Object.keys(o)) if (!allowed.includes(k)) {
      const msg = `${where}: opção "${k}" não existe e foi ignorada. Opções: ${allowed.join(", ")}`;
      if (!BQ.optWarnings.includes(msg)) BQ.optWarnings.push(msg);
    }
    return o;
  };

  // ---------- registro das partes do tema ----------
  BQ.parts = { scene: null, hud: null, sfx: null, moments: null };
  BQ.defineScene = (fn) => { if (typeof fn !== "function") throw new Error("defineScene precisa de uma função"); BQ.parts.scene = fn; };
  BQ.defineHud = (fn) => { if (typeof fn !== "function") throw new Error("defineHud precisa de uma função"); BQ.parts.hud = fn; };
  BQ.defineSfx = (fn) => { if (typeof fn !== "function") throw new Error("defineSfx precisa de uma função"); BQ.parts.sfx = fn; };
  BQ.defineMoments = (fn) => { if (typeof fn !== "function") throw new Error("defineMoments precisa de uma função"); BQ.parts.moments = fn; };

  /** Objeto que dá erro claro ao ler uma chave inexistente (marcas C, momentos M, blocos B). */
  BQ.strict = (obj, label) => new Proxy(obj, {
    get(target, key) {
      if (typeof key === "symbol" || key === "toJSON" || key === "then" || key === "inspect" || key === "constructor") return target[key];
      if (!(key in target)) {
        const keys = Object.keys(target);
        const near = keys.filter((k) => k.toLowerCase().includes(String(key).toLowerCase().slice(0, 3))).slice(0, 5);
        throw new Error(`${label}.${String(key)} não existe.` + (near.length ? ` Parecidas: ${near.join(", ")}.` : "") + ` Existentes: ${keys.slice(0, 40).join(", ")}${keys.length > 40 ? "…" : ""}`);
      }
      return target[key];
    },
    set() { throw new Error(`${label} é somente leitura`); },
  });
})(typeof window !== "undefined" ? window : globalThis);
