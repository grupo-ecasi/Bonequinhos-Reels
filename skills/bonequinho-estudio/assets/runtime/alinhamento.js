/* Bonequinhos-Reels · alinhamento.js
 * Alinha o roteiro (texto conhecido) ao áudio da narração sem modelo de IA.
 * 1) detecta trechos de fala e pausas pela energia; 2) casa pausas com fronteiras de palavra por
 * programação dinâmica (custo = ritmo de fala por sílaba); 3) distribui as palavras de cada trecho
 * pelo tempo de fala. Medido no spike S3: mediana 0,08 s em voz limpa; 0,11 s em áudio de celular.
 */
(function (root) {
  "use strict";
  const BQ = (root.BQ = root.BQ || {});
  const A = (BQ.align = {});

  A.envelope = (samples, sr, hopSec = 0.01) => {
    const hop = Math.max(1, Math.round(sr * hopSec)), n = Math.floor(samples.length / hop), db = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = i * hop, e = k + hop; k < e; k++) s += samples[k] * samples[k];
      db[i] = 10 * Math.log10(s / hop + 1e-12);
    }
    const sm = new Float32Array(n);
    for (let i = 0; i < n; i++) sm[i] = (db[Math.max(0, i - 1)] + db[i] + db[Math.min(n - 1, i + 1)]) / 3;
    return { db: sm, hop: hopSec };
  };
  const percentile = (arr, p) => { const a = Float32Array.from(arr).sort(); return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))]; };

  A.detect = (env, { minPause = 0.08, minBurst = 0.04, rel = 0.5 } = {}) => {
    const { db, hop } = env;
    const floor = percentile(db, 0.1), loud = percentile(db, 0.95);
    const thr = floor + rel * (loud - floor);
    const speech = new Uint8Array(db.length);
    for (let i = 0; i < db.length; i++) speech[i] = db[i] > thr ? 1 : 0;
    const minB = Math.round(minBurst / hop);
    for (let i = 0; i < speech.length;) {
      if (!speech[i]) { i++; continue; }
      let j = i; while (j < speech.length && speech[j]) j++;
      if (j - i < minB) speech.fill(0, i, j);
      i = j;
    }
    let on = speech.indexOf(1), off = speech.lastIndexOf(1);
    if (on < 0) { on = 0; off = Math.max(0, db.length - 1); }
    const pauses = [], minP = Math.round(minPause / hop);
    for (let i = on; i <= off;) {
      if (speech[i]) { i++; continue; }
      let j = i; while (j <= off && !speech[j]) j++;
      if (j - i >= minP) pauses.push({ start: i * hop, end: j * hop, len: (j - i) * hop });
      i = j;
    }
    return { speech, hop, onset: on * hop, offset: (off + 1) * hop, pauses };
  };

  /**
   * @param {Float32Array} samples áudio mono
   * @param {number} sr taxa de amostragem
   * @param {{w:number, brk:number}[]} toks tokens do roteiro (w = peso em sílabas, brk = força da pausa)
   * @returns {{words:{start:number,end:number}[], onset:number, offset:number, pauses:number, anchors:number}}
   */
  A.align = (samples, sr, toks, opts = {}) => {
    const env = A.envelope(samples, sr);
    const det = A.detect(env, opts);
    const K = toks.length;
    if (!K) return { words: [], onset: det.onset, offset: det.offset, pauses: 0, anchors: 0 };
    const wgt = toks.map((t) => t.w), brk = toks.map((t) => (t.brk >= 3 ? 3 : t.brk));
    const cum = [0]; for (const x of wgt) cum.push(cum[cum.length - 1] + x);
    const { speech, hop } = det;
    const sCum = new Float64Array(speech.length + 1);
    for (let i = 0; i < speech.length; i++) sCum[i + 1] = sCum[i] + (speech[i] ? hop : 0);
    const fi = (t) => Math.max(0, Math.min(speech.length, Math.round(t / hop)));
    const speechTime = (a, b) => sCum[fi(b)] - sCum[fi(a)];
    const rate = speechTime(det.onset, det.offset) / cum[K];
    const P = det.pauses, J = P.length;
    const anchors = [{ t0: det.onset, t1: det.onset, len: 0 }, ...P.map((p) => ({ t0: p.start, t1: p.end, len: p.len })), { t0: det.offset, t1: det.offset, len: 0 }];
    const segCost = (aIdx, kA, bIdx, kB) => {
      const D = speechTime(anchors[aIdx].t1, anchors[bIdx].t0), units = cum[kB + 1] - cum[kA + 1];
      if (units <= 0) return Infinity;
      const r = Math.log((D + 0.05) / (rate * units + 0.05));
      return 6 * r * r * Math.sqrt(units);
    };
    const assignCost = (j, k) => { const s = brk[k], len = anchors[j].len; return s === 0 ? 2.2 + 6 * Math.max(0, len - 0.12) : -0.6 * s; };
    const skipPause = (j) => 1.5 + 8 * anchors[j].len;
    const skipBreak = (k) => 0.25 * brk[k];
    const skipBreakCum = [0]; for (let k = 0; k < K; k++) skipBreakCum.push(skipBreakCum[k] + skipBreak(k));
    const skipPauseCum = [0]; for (let j = 1; j <= J + 1; j++) skipPauseCum.push(skipPauseCum[j - 1] + (j <= J ? skipPause(j) : 0));
    const NA = J + 2;
    const f = Array.from({ length: NA }, () => new Float64Array(Math.max(1, K)).fill(Infinity));
    const fromJ = Array.from({ length: NA }, () => new Int32Array(Math.max(1, K)).fill(-1));
    const fromK = Array.from({ length: NA }, () => new Int32Array(Math.max(1, K)).fill(-2));
    const startCost = (j, k) => segCost(0, -1, j, k) + skipPauseCum[j - 1] + skipBreakCum[k];
    for (let j = 1; j <= J; j++) for (let k = 0; k < K - 1; k++) {
      const c = startCost(j, k) + assignCost(j, k);
      if (c < f[j][k]) { f[j][k] = c; fromJ[j][k] = 0; fromK[j][k] = -1; }
    }
    for (let j = 1; j <= J; j++) for (let k = 0; k < K - 1; k++) {
      const base = f[j][k];
      if (!isFinite(base)) continue;
      for (let j2 = j + 1; j2 <= J; j2++) {
        const sp = skipPauseCum[j2 - 1] - skipPauseCum[j];
        for (let k2 = k + 1; k2 < K - 1; k2++) {
          const c = base + sp + (skipBreakCum[k2] - skipBreakCum[k + 1]) + segCost(j, k, j2, k2) + assignCost(j2, k2);
          if (c < f[j2][k2]) { f[j2][k2] = c; fromJ[j2][k2] = j; fromK[j2][k2] = k; }
        }
      }
    }
    let best = segCost(0, -1, J + 1, K - 1) + skipPauseCum[J] + skipBreakCum[K - 1], bj = 0, bk = -1;
    for (let j = 1; j <= J; j++) for (let k = 0; k < K - 1; k++) {
      if (!isFinite(f[j][k])) continue;
      const c = f[j][k] + (skipPauseCum[J] - skipPauseCum[j]) + (skipBreakCum[K - 1] - skipBreakCum[k + 1]) + segCost(j, k, J + 1, K - 1);
      if (c < best) { best = c; bj = j; bk = k; }
    }
    const chain = [{ j: J + 1, k: K - 1 }];
    let cj = bj, ck = bk;
    while (cj > 0) { chain.push({ j: cj, k: ck }); const pj = fromJ[cj][ck], pk = fromK[cj][ck]; cj = pj; ck = pk; }
    chain.push({ j: 0, k: -1 });
    chain.reverse();
    const res = new Array(K);
    for (let c = 0; c < chain.length - 1; c++) {
      const a = chain[c], b = chain[c + 1];
      const iA = fi(anchors[a.j].t1), iB = fi(anchors[b.j].t0);
      const total = cum[b.k + 1] - cum[a.k + 1], sTot = sCum[iB] - sCum[iA];
      const timeAt = (target) => { let lo = iA, hi = iB; const goal = sCum[iA] + target; while (lo < hi) { const mid = (lo + hi) >> 1; if (sCum[mid + 1] < goal) lo = mid + 1; else hi = mid; } return lo * hop; };
      for (let k = a.k + 1; k <= b.k; k++) {
        const u0 = (cum[k] - cum[a.k + 1]) / total, u1 = (cum[k + 1] - cum[a.k + 1]) / total;
        res[k] = { start: timeAt(u0 * sTot), end: timeAt(u1 * sTot) + hop };
      }
    }
    return { words: res, onset: det.onset, offset: det.offset, pauses: J, anchors: chain.length - 2 };
  };

  /** Início e fim da fala num trecho (para aparar silêncio de gravações por bloco). */
  A.speechBounds = (samples, sr) => {
    const det = A.detect(A.envelope(samples, sr));
    return { onset: det.onset, offset: det.offset };
  };
})(typeof window !== "undefined" ? window : globalThis);
