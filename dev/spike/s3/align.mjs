// Alinhamento roteiro × áudio sem modelo (spike S3).
// Ideia: o texto é conhecido. Detectamos as pausas no áudio, casamos pausas com fronteiras de
// palavra por programação dinâmica (custo = ritmo de fala por sílaba) e distribuímos as palavras
// dentro de cada trecho pela contagem de sílabas, usando só o tempo em que há fala.

const VOWELS = /[aeiouáéíóúâêôãõàüy]+/gi;

/** Conta sílabas aproximadas de uma palavra pt-BR (grupos de vogais). */
export function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-záéíóúâêôãõàüçy]/g, "");
  if (!w) return 0;
  const m = w.match(VOWELS);
  let n = m ? m.length : 1;
  // hiatos comuns separam vogais fortes: "dia", "rua", "poeira", "saída"
  for (const g of m || []) {
    if (g.length >= 2 && /[aeoáéó][aeoáéó]|[íú]|[iu][aeoá]$/.test(g)) n += 0.5;
  }
  return Math.max(1, n);
}

/** Força da pausa esperada depois da palavra (pela pontuação). */
export function breakStrength(display) {
  if (/(\.\.\.|…)$/.test(display)) return 3;
  if (/[.?!]$/.test(display)) return 3;
  if (/[:;]$/.test(display)) return 2.5;
  if (/[,—–-]$/.test(display)) return 2;
  return 0;
}

/** Envelope de energia (dB) em quadros de 10 ms. */
export function envelope(samples, sr, hopSec = 0.01) {
  const hop = Math.round(sr * hopSec), n = Math.floor(samples.length / hop), db = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = i * hop, e = k + hop; k < e; k++) s += samples[k] * samples[k];
    db[i] = 10 * Math.log10(s / hop + 1e-12);
  }
  const sm = new Float32Array(n);
  for (let i = 0; i < n; i++) sm[i] = (db[Math.max(0, i - 1)] + db[i] + db[Math.min(n - 1, i + 1)]) / 3;
  return { db: sm, hop: hopSec };
}

function percentile(arr, p) {
  const a = Float32Array.from(arr).sort();
  return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))];
}

/** Máscara de fala e lista de pausas (silêncios ≥ minPause). */
export function detectSpeech(env, { minPause = 0.08, minBurst = 0.04, rel = 0.5 } = {}) {
  const { db, hop } = env;
  const floor = percentile(db, 0.1), loud = percentile(db, 0.95);
  const thr = floor + rel * (loud - floor);
  const speech = new Uint8Array(db.length);
  for (let i = 0; i < db.length; i++) speech[i] = db[i] > thr ? 1 : 0;
  // remove estalos curtos
  const minB = Math.round(minBurst / hop);
  for (let i = 0; i < speech.length; ) {
    if (!speech[i]) { i++; continue; }
    let j = i; while (j < speech.length && speech[j]) j++;
    if (j - i < minB) speech.fill(0, i, j);
    i = j;
  }
  let on = speech.indexOf(1), off = speech.lastIndexOf(1);
  if (on < 0) { on = 0; off = db.length - 1; }
  const pauses = [];
  const minP = Math.round(minPause / hop);
  for (let i = on; i <= off; ) {
    if (speech[i]) { i++; continue; }
    let j = i; while (j <= off && !speech[j]) j++;
    if (j - i >= minP) pauses.push({ start: i * hop, end: j * hop, len: (j - i) * hop });
    i = j;
  }
  return { speech, hop, onset: on * hop, offset: (off + 1) * hop, pauses, thr, floor, loud };
}

/**
 * Alinha palavras ao áudio.
 * @param {Float32Array} samples mono
 * @param {number} sr
 * @param {{display:string, spoken?:string}[]} words
 * @returns {{start:number,end:number}[]}
 */
export function align(samples, sr, words, opts = {}) {
  const env = envelope(samples, sr);
  const det = detectSpeech(env, opts);
  const K = words.length;
  const wgt = words.map((w) => (w.spoken || w.display).split(/\s+/).reduce((s, x) => s + syllables(x), 0) + 0.25);
  const brk = words.map((w) => breakStrength(w.display));
  const cum = [0]; for (const x of wgt) cum.push(cum[cum.length - 1] + x);
  // tempo de fala acumulado (sem silêncios) para medir ritmo dentro dos trechos
  const { speech, hop } = det;
  const sCum = new Float64Array(speech.length + 1);
  for (let i = 0; i < speech.length; i++) sCum[i + 1] = sCum[i] + (speech[i] ? hop : 0);
  const speechTime = (a, b) => sCum[Math.max(0, Math.min(speech.length, Math.round(b / hop)))] - sCum[Math.max(0, Math.min(speech.length, Math.round(a / hop)))];
  const rate = speechTime(det.onset, det.offset) / cum[K]; // segundos de fala por unidade de sílaba

  // âncoras: 0 = início (fronteira -1), pausas 1..J, J+1 = fim (fronteira K-1)
  const P = det.pauses, J = P.length;
  const anchors = [{ t0: det.onset, t1: det.onset, len: 0 }, ...P.map((p) => ({ t0: p.start, t1: p.end, len: p.len })), { t0: det.offset, t1: det.offset, len: 0 }];
  const segCost = (aIdx, kA, bIdx, kB) => {
    const D = speechTime(anchors[aIdx].t1, anchors[bIdx].t0);
    const units = cum[kB + 1] - cum[kA + 1];
    if (units <= 0) return Infinity;
    const exp = rate * units;
    const r = Math.log((D + 0.05) / (exp + 0.05));
    return 6 * r * r * Math.sqrt(units);
  };
  const assignCost = (j, k) => {
    // pausa j (1..J) na fronteira depois da palavra k
    const s = brk[k], len = anchors[j].len;
    if (s === 0) return 2.2 + 6 * Math.max(0, len - 0.12); // pausa sem pontuação: possível (respiro), mas cara se longa
    return -0.6 * s;
  };
  const skipPause = (j) => 1.5 + 8 * anchors[j].len; // pausa ignorada (dentro de palavra)
  const skipBreak = (k) => 0.25 * brk[k]; // pontuação sem pausa (vírgula rápida)

  // DP: f[j][k] — âncora j atribuída à fronteira k
  const NA = J + 2;
  const f = Array.from({ length: NA }, () => new Float64Array(K).fill(Infinity));
  const from = Array.from({ length: NA }, () => new Int32Array(K * 2).fill(-1));
  // início virtual: âncora 0 na fronteira -1 → tratamos com kA = -1
  const startCost = (j, k) => {
    let c = segCost(0, -1, j, k);
    for (let jj = 1; jj < j; jj++) c += skipPause(jj);
    for (let kk = 0; kk < k; kk++) c += skipBreak(kk);
    return c;
  };
  for (let j = 1; j <= J; j++) for (let k = 0; k < K - 1; k++) {
    const c = startCost(j, k) + assignCost(j, k);
    if (c < f[j][k]) { f[j][k] = c; from[j][k * 2] = 0; from[j][k * 2 + 1] = -1; }
  }
  // pré-cálculo de somas de pulo
  const skipBreakCum = [0]; for (let k = 0; k < K; k++) skipBreakCum.push(skipBreakCum[k] + skipBreak(k));
  const skipPauseCum = [0]; for (let j = 1; j <= J + 1; j++) skipPauseCum.push(skipPauseCum[j - 1] + (j <= J ? skipPause(j) : 0));
  for (let j = 1; j <= J; j++) for (let k = 0; k < K - 1; k++) {
    if (!isFinite(f[j][k])) continue;
    for (let j2 = j + 1; j2 <= J; j2++) {
      const sp = skipPauseCum[j2 - 1] - skipPauseCum[j];
      for (let k2 = k + 1; k2 < K - 1; k2++) {
        const c = f[j][k] + sp + (skipBreakCum[k2] - skipBreakCum[k + 1]) + segCost(j, k, j2, k2) + assignCost(j2, k2);
        if (c < f[j2][k2]) { f[j2][k2] = c; from[j2][k2 * 2] = j; from[j2][k2 * 2 + 1] = k; }
      }
    }
  }
  // fim
  let best = startCost(J + 1, K - 1), bj = 0, bk = -1;
  for (let j = 1; j <= J; j++) for (let k = 0; k < K - 1; k++) {
    if (!isFinite(f[j][k])) continue;
    const c = f[j][k] + (skipPauseCum[J] - skipPauseCum[j]) + (skipBreakCum[K - 1] - skipBreakCum[k + 1]) + segCost(j, k, J + 1, K - 1);
    if (c < best) { best = c; bj = j; bk = k; }
  }
  // reconstrói a cadeia de âncoras
  const chain = [{ j: J + 1, k: K - 1 }];
  let cj = bj, ck = bk;
  while (cj > 0) { chain.push({ j: cj, k: ck }); const pj = from[cj][ck * 2], pk = from[cj][ck * 2 + 1]; cj = pj; ck = pk; }
  chain.push({ j: 0, k: -1 });
  chain.reverse();

  // distribui palavras em cada trecho pelo tempo de fala
  const res = new Array(K);
  for (let c = 0; c < chain.length - 1; c++) {
    const A = chain[c], B = chain[c + 1];
    const tA = anchors[A.j].t1, tB = anchors[B.j].t0;
    const iA = Math.round(tA / hop), iB = Math.round(tB / hop);
    const total = cum[B.k + 1] - cum[A.k + 1];
    const sTot = sCum[iB] - sCum[iA];
    const timeAtSpeech = (target) => {
      // primeiro quadro em que o tempo de fala acumulado atinge target
      let lo = iA, hi = iB;
      const goal = sCum[iA] + target;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (sCum[mid + 1] < goal) lo = mid + 1; else hi = mid; }
      return lo * hop;
    };
    for (let k = A.k + 1; k <= B.k; k++) {
      const u0 = (cum[k] - cum[A.k + 1]) / total, u1 = (cum[k + 1] - cum[A.k + 1]) / total;
      res[k] = { start: timeAtSpeech(u0 * sTot), end: timeAtSpeech(u1 * sTot) + hop };
    }
  }
  return { words: res, det: { onset: det.onset, offset: det.offset, pauses: P.length, rate, anchors: chain.length - 2 } };
}
