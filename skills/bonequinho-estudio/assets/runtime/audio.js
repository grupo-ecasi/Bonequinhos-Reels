/* Bonequinhos-Reels · audio.js
 * Efeitos sonoros sintetizados (determinísticos, sem arquivos), mixagem voz + efeitos com ducking,
 * loudness BS.1770 e limitador. Regras de house/ecasi: build_sfx.py (nivelamento -18 dBFS RMS nos 250 ms
 * iniciais, sidechain pela voz, passa-alta 90 Hz) e master.py (-14 LUFS, pico ≤ -1 dB).
 * Funciona no navegador e no Node (só Float32Array).
 */
(function (root) {
  "use strict";
  const BQ = (root.BQ = root.BQ || {});
  const SR = 48000;
  const A = (BQ.audio = { SR });
  const U = BQ.util;

  // ---------- DSP básico ----------
  const rngOf = (seed) => BQ.util.rng(seed);
  const N = (sec) => Math.max(1, Math.floor(sec * SR));
  function biquad(x, type, f, Q = 0.7071, gainDb = 0) {
    const w0 = (2 * Math.PI * f) / SR, cw = Math.cos(w0), sw = Math.sin(w0), al = sw / (2 * Q), Av = Math.pow(10, gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === "lp") { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else if (type === "hp") { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else if (type === "bp") { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else if (type === "peak") { b0 = 1 + al * Av; b1 = -2 * cw; b2 = 1 - al * Av; a0 = 1 + al / Av; a1 = -2 * cw; a2 = 1 - al / Av; }
    else throw new Error("biquad: tipo " + type);
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
    return y;
  }
  A.biquad = biquad;
  function normalize(x, peak = 0.89) { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m > 0) { const g = peak / m; for (let i = 0; i < x.length; i++) x[i] *= g; } return x; }
  function fade(x, inS = 0.002, outS = 0.02) { const a = N(inS), b = N(outS); for (let i = 0; i < a && i < x.length; i++) x[i] *= i / a; for (let i = 0; i < b && i < x.length; i++) x[x.length - 1 - i] *= i / b; return x; }
  function noise(n, seed) { const r = rngOf(seed), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = r() * 2 - 1; return x; }
  function tone(n, f0, f1 = f0, shape = "sine", curve = "exp") { const x = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const u = i / n; const f = curve === "exp" ? f0 * Math.pow(f1 / f0, u) : f0 + (f1 - f0) * u; ph += (2 * Math.PI * f) / SR; x[i] = shape === "sine" ? Math.sin(ph) : shape === "tri" ? (2 / Math.PI) * Math.asin(Math.sin(ph)) : Math.sign(Math.sin(ph)) * 0.6; } return x; }
  const env = (x, fn) => { for (let i = 0; i < x.length; i++) x[i] *= fn(i / SR, i / x.length); return x; };
  const mix = (...parts) => { const n = Math.max(...parts.map(([p, off = 0]) => p.length + N(off))); const out = new Float32Array(n); for (const [p, off = 0, g = 1] of parts) { const o = N(off); for (let i = 0; i < p.length; i++) out[o + i] += p[i] * g; } return out; };

  // ---------- catálogo de sons ----------
  const SOUNDS = {
    whoosh: () => { const n = N(0.6), r = rngOf(7), x = new Float32Array(n); let lp = 0, bp = 0; for (let i = 0; i < n; i++) { const u = i / n, e = Math.sin(Math.PI * Math.pow(u, 0.7)) ** 2, f = 300 + 2600 * Math.sin(Math.PI * u), k = 1 - Math.exp((-2 * Math.PI * f) / SR), w = r() * 2 - 1; lp += k * (w - lp); bp += k * (lp - bp); x[i] = (lp - bp) * e; } return x; },
    "whoosh-short": () => { const n = N(0.32), r = rngOf(11), x = new Float32Array(n); let lp = 0, bp = 0; for (let i = 0; i < n; i++) { const u = i / n, e = Math.sin(Math.PI * Math.pow(u, 0.6)) ** 2, f = 600 + 3800 * Math.sin(Math.PI * u), k = 1 - Math.exp((-2 * Math.PI * f) / SR), w = r() * 2 - 1; lp += k * (w - lp); bp += k * (lp - bp); x[i] = (lp - bp) * e; } return x; },
    pop: () => mix([env(tone(N(0.18), 900, 180), (t) => Math.exp(-t * 30))], [env(noise(N(0.006), 3), (t, u) => 1 - u), 0, 0.4]),
    click: () => mix([env(biquad(noise(N(0.004), 5), "hp", 2500), (t, u) => 1 - u), 0, 0.8], [env(tone(N(0.03), 2200), (t) => Math.exp(-t * 180)), 0, 0.6]),
    "click-soft": () => biquad(mix([env(tone(N(0.04), 1400), (t) => Math.exp(-t * 120))], [env(noise(N(0.004), 9), (t, u) => 1 - u), 0, 0.3]), "lp", 3500),
    tick: () => env(tone(N(0.02), 3200), (t) => Math.exp(-t * 300)),
    ding: () => env(mix([tone(N(1.3), 1320)], [tone(N(1.3), 2640), 0, 0.3], [tone(N(1.3), 3960), 0, 0.1]), (t) => Math.exp(-t * 3.2) * Math.min(1, t / 0.003)),
    chime: () => mix([env(mix([tone(N(1.0), 1318.5)], [tone(N(1.0), 2637), 0, 0.25]), (t) => Math.exp(-t * 4) * Math.min(1, t / 0.003))], [env(mix([tone(N(1.0), 1975.5)], [tone(N(1.0), 3951), 0, 0.2]), (t) => Math.exp(-t * 4) * Math.min(1, t / 0.003)), 0.09, 0.85]),
    success: () => mix(...[1046.5, 1318.5, 1568].map((f, i) => [env(mix([tone(N(0.6), f)], [tone(N(0.6), f * 2), 0, 0.2]), (t) => Math.exp(-t * 6) * Math.min(1, t / 0.004)), i * 0.085, 0.8])),
    error: () => biquad(mix([env(tone(N(0.16), 330, 330, "square"), (t, u) => Math.min(1, t / 0.005) * (1 - u * 0.3))], [env(tone(N(0.24), 247, 247, "square"), (t, u) => Math.min(1, t / 0.005) * (1 - u)), 0.15]), "lp", 2200),
    "impact-bass": () => { const body = env(tone(N(0.9), 110, 42), (t) => Math.exp(-t * 4.5) * Math.min(1, t / 0.002)); const thump = env(biquad(noise(N(0.12), 13), "lp", 400), (t) => Math.exp(-t * 35)); const y = mix([body], [thump, 0, 0.8]); for (let i = 0; i < y.length; i++) y[i] = Math.tanh(y[i] * 1.6); return y; },
    thud: () => mix([env(tone(N(0.35), 140, 70), (t) => Math.exp(-t * 14))], [env(biquad(noise(N(0.08), 17), "lp", 700), (t) => Math.exp(-t * 45)), 0, 0.6]),
    sparkle: () => { const r = rngOf(21); return mix(...Array.from({ length: 7 }, (_, i) => [env(tone(N(0.35), 2200 + r() * 3000), (t) => Math.exp(-t * 14) * Math.min(1, t / 0.002)), i * 0.06 + r() * 0.03, 0.5 + r() * 0.4])); },
    riser: () => { const n = N(1.4), nz = biquad(noise(n, 23), "bp", 1800, 0.8), tn = tone(n, 180, 1400, "tri"); return env(mix([nz, 0, 0.7], [tn, 0, 0.35]), (t, u) => Math.pow(u, 2.2) * (u > 0.97 ? (1 - u) / 0.03 : 1)); },
    drop: () => mix([env(tone(N(0.14), 1500, 520), (t) => Math.exp(-t * 28) * Math.min(1, t / 0.001))], [env(tone(N(0.1), 2600, 2000), (t) => Math.exp(-t * 60)), 0.012, 0.3]),
    page: () => env(biquad(noise(N(0.25), 29), "bp", 3000, 0.6), (t, u) => Math.sin(Math.PI * u) ** 2 * (0.6 + 0.4 * Math.sin(u * 40))),
    swoosh: () => SOUNDS.whoosh(),
    notification: () => mix([env(tone(N(0.5), 880), (t) => Math.exp(-t * 7) * Math.min(1, t / 0.003))], [env(tone(N(0.5), 1318.5), (t) => Math.exp(-t * 7) * Math.min(1, t / 0.003)), 0.11]),
    glitch: () => { const r = rngOf(31), n = N(0.3), x = new Float32Array(n); let v = 0; for (let i = 0; i < n; i++) { if (i % 240 === 0) v = r() * 2 - 1; x[i] = v * (r() > 0.4 ? 1 : 0); } return env(biquad(x, "bp", 1500, 0.5), (t, u) => 1 - u); },
    buzz: () => { const x = tone(N(0.5), 120, 120, "square"); return env(biquad(x, "lp", 1800), (t, u) => Math.min(1, t / 0.01) * (1 - u)); },
    spark: () => { const r = rngOf(37), n = N(0.4), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = r() < 0.02 ? (r() * 2 - 1) : 0; return env(biquad(x, "hp", 2000), (t) => Math.exp(-t * 6)); },
  };
  A.SOUND_NAMES = Object.keys(SOUNDS);
  const cache = new Map();
  /** Som pelo nome (Float32Array mono 48 kHz, pico 0,89). */
  A.sound = (name) => {
    if (cache.has(name)) return cache.get(name);
    const make = SOUNDS[name];
    if (!make) throw new Error(`som "${name}" não existe. Sons: ${A.SOUND_NAMES.join(", ")}`);
    const x = fade(normalize(make()), 0.0015, 0.02);
    cache.set(name, x);
    return x;
  };

  // ---------- medições ----------
  /** Loudness integrada BS.1770-4 (LUFS) de um sinal mono 48 kHz. */
  A.lufs = (x) => {
    // ponderação K (coeficientes oficiais para 48 kHz)
    const kw = new Float32Array(x.length);
    let a1 = -1.69065929318241, a2 = 0.73248077421585, b0 = 1.53512485958697, b1 = -2.69169618940638, b2 = 1.19839281085285;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; kw[i] = v; }
    a1 = -1.99004745483398; a2 = 0.99007225036621; b0 = 1; b1 = -2; b2 = 1; x1 = x2 = y1 = y2 = 0;
    for (let i = 0; i < kw.length; i++) { const v = b0 * kw[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = kw[i]; y2 = y1; y1 = v; kw[i] = v; }
    const blk = N(0.4), hop = N(0.1), zs = [];
    for (let s = 0; s + blk <= kw.length; s += hop) { let z = 0; for (let i = s; i < s + blk; i++) z += kw[i] * kw[i]; zs.push(z / blk); }
    const L = (z) => -0.691 + 10 * Math.log10(z + 1e-20);
    const abs = zs.filter((z) => L(z) > -70);
    if (!abs.length) return -70;
    const relT = L(abs.reduce((s, z) => s + z, 0) / abs.length) - 10;
    const g = abs.filter((z) => L(z) > relT);
    return L(g.reduce((s, z) => s + z, 0) / g.length);
  };
  /** Nível de referência de um som: RMS da janela de 50 ms mais forte (dBFS). */
  const levels = new Map();
  A.level = (name) => {
    if (levels.has(name)) return levels.get(name);
    const s = A.sound(name), w = N(0.05);
    let best = -120;
    for (let a = 0; a < s.length; a += Math.floor(w / 2)) best = Math.max(best, rmsDb(s, a, Math.min(s.length, a + w)));
    levels.set(name, best);
    return best;
  };
  A.peakDb = (x) => { let m = 0; for (let i = 0; i < x.length; i++) { const a = x[i] < 0 ? -x[i] : x[i]; if (a > m) m = a; } return 20 * Math.log10(m + 1e-12); };
  const rmsDb = (x, a, b) => { let s = 0; const n = Math.max(1, b - a); for (let i = a; i < b && i < x.length; i++) s += x[i] * x[i]; return 10 * Math.log10(s / n + 1e-12); };

  /** Limitador com antecipação (pico de amostra). */
  function limiter(x, ceilingDb = -1.5, lookS = 0.005, relS = 0.08) {
    const ceil = Math.pow(10, ceilingDb / 20), look = N(lookS), rel = Math.exp(-1 / N(relS));
    // ganho necessário só onde o sinal passa do teto, espalhado para trás (antecipação)
    const g = new Float32Array(x.length).fill(1);
    let any = false;
    for (let i = 0; i < x.length; i++) {
      const a = x[i] < 0 ? -x[i] : x[i];
      if (a <= ceil) continue;
      any = true;
      const n = ceil / a;
      for (let k = Math.max(0, i - look); k <= i; k++) if (g[k] > n) g[k] = n;
    }
    if (!any) return x;
    // liberação suave
    let cur = 1;
    for (let i = 0; i < x.length; i++) { const gi = g[i]; cur = gi < cur ? gi : gi + (cur - gi) * rel; if (cur > 1) cur = 1; x[i] *= cur; }
    return x;
  }

  /**
   * Mixa voz e efeitos.
   * @param {{voice:Float32Array|null, events:{t:number,name:string,db:number}[], duration:number, sfxVolumeDb?:number}} o
   * @returns {{data:Float32Array, report:any}}
   */
  A.mix = (o) => {
    const len = N(o.duration);
    const report = { events: [], voiceLufs: null, mixLufs: null, finalLufs: null, peakDb: null };
    // voz: passa-alta 70 Hz e -16 LUFS
    let voice = null;
    if (o.voice && o.voice.length) {
      voice = new Float32Array(len); voice.set(o.voice.subarray(0, len));
      voice = biquad(voice, "hp", 70);
      const vl = A.lufs(voice); report.voiceLufsIn = +vl.toFixed(1);
      const g = Math.pow(10, Math.min(20, -16 - vl) / 20); for (let i = 0; i < voice.length; i++) voice[i] *= g;
      report.voiceLufs = -16;
    }
    // ganho de duck da voz (sidechain: limiar 0,1, razão 2, ataque 5 ms, liberação 200 ms), calculado uma vez
    let duck = null;
    if (voice) {
      duck = new Float32Array(len).fill(1);
      const att = Math.exp(-1 / N(0.005)), rel = Math.exp(-1 / N(0.2));
      let envv = 0;
      for (let i = 0; i < len; i++) {
        const a = voice[i] < 0 ? -voice[i] : voice[i]; envv = a > envv ? a + (envv - a) * att : a + (envv - a) * rel;
        if (envv > 0.1) duck[i] = Math.pow(envv / 0.1, -0.5);
      }
    }
    const vol = o.sfxVolumeDb ?? 0;
    const evs = o.events.map((ev) => ({ t: +ev.t.toFixed(2), name: ev.name, db: ev.db || 0, auto: 0 }));
    const buildBus = () => {
      let bus = new Float32Array(len);
      for (const ev of evs) {
        const s = A.sound(ev.name);
        const gain = Math.pow(10, (U.clamp(-18 - A.level(ev.name), -24, 12) + ev.db + ev.auto + vol) / 20);
        const at = N(Math.max(0, ev.t));
        for (let i = 0; i < s.length && at + i < len; i++) bus[at + i] += s[i] * gain;
      }
      if (duck) for (let i = 0; i < len; i++) bus[i] *= duck[i];
      return biquad(bus, "hp", 90);
    };
    // medição por evento (regra do measure_mix.py: efeito de 3 a 8 dB abaixo da voz)
    const measure = (bus) => { if (voice) for (const ev of evs) {
      const a = N(ev.t), b = a + N(0.4);
      let sfxMax = -120; for (let w = a; w < b; w += N(0.05)) sfxMax = Math.max(sfxMax, rmsDb(bus, w, w + N(0.05)));
      const va = Math.max(0, a - N(0.6)), vb = Math.min(len, a + N(0.6));
      let vs = 0, vn = 0; for (let w = va; w < vb; w += N(0.05)) { const d = rmsDb(voice, w, w + N(0.05)); if (d > -40) { vs += Math.pow(10, d / 10); vn++; } }
      ev.sfxDb = +sfxMax.toFixed(1);
      ev.diffDb = vn ? +(sfxMax - 10 * Math.log10(vs / vn)).toFixed(1) : null;
    } };
    let bus = buildBus();
    measure(bus);
    // autoajuste: efeito alto demais (menos de 4 dB abaixo da voz) desce para ~6 dB abaixo;
    // efeito sumido (mais de 12 dB abaixo) sobe até +4 dB. O ganho manual (db) continua valendo.
    if (o.autoLevel !== false && voice) {
      let changed = false;
      for (const ev of evs) {
        if (ev.diffDb == null) continue;
        if (ev.diffDb > -4) { ev.auto = -6 - ev.diffDb; changed = true; }
        else if (ev.diffDb < -12) { ev.auto = Math.min(4, -9 - ev.diffDb); changed = true; }
      }
      if (changed) { bus = buildBus(); measure(bus); }
    }
    report.events = evs.map((e) => ({ ...e, auto: +e.auto.toFixed(1) }));
    // soma e master: -14 LUFS no ESTÉREO final. A mix é mono e vai duplicada em L e R, o que soma
    // +3,01 LU na medição BS.1770; por isso o alvo do mono é -17,01.
    const TARGET = -14 - 3.01;
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) out[i] = (voice ? voice[i] : 0) + bus[i];
    const ml = A.lufs(out); report.mixLufs = +ml.toFixed(1);
    // várias passadas: o limitador tira um pouco de loudness; a passada seguinte compensa.
    // Teto de -2,2 dBFS por amostra mantém o pico verdadeiro (entre amostras) abaixo de -1 dBTP.
    for (let pass = 0; pass < 6 && ml > -69; pass++) {
      const cur = A.lufs(out);
      if (Math.abs(cur - TARGET) < 0.1) break;
      const g = Math.pow(10, Math.min(24, TARGET - cur + (pass ? 0.25 : 0)) / 20); for (let i = 0; i < len; i++) out[i] *= g;
      limiter(out, -2.2);
    }
    report.finalLufs = +(A.lufs(out) + 3.01).toFixed(1);
    report.note = "finalLufs = loudness do estéreo exportado (mono duplicado)";
    report.peakDb = +A.peakDb(out).toFixed(1);
    return { data: out, report };
  };
})(typeof window !== "undefined" ? window : globalThis);
