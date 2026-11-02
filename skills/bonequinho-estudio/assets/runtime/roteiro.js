/* Bonequinhos-Reels · roteiro.js
 * Lê o roteiro com marcação, estima tempos por sílabas e monta as marcas C, os blocos B e as legendas.
 *
 * Marcação do roteiro.txt:
 *   # nome-do-bloco          começa um bloco (gancho, promessa, problema, camada1, ..., cta, loop)
 *   [[marca]]palavra         a marca "marca" fica no início da palavra seguinte
 *   {exibe|fala}             a legenda mostra "exibe"; a voz fala "fala" (números, siglas, nomes)
 *   ...                      pausa longa
 *   // comentário            linha ignorada
 */
(function (root) {
  "use strict";
  const BQ = (root.BQ = root.BQ || {});
  const R = (BQ.roteiro = {});

  // Calibrado nas narrações do reboco-novo e do EP2 (Whisper): 0,172 s por unidade (sílaba + 0,25 por palavra),
  // já incluindo as micropausas. As pausas abaixo são o extra médio medido depois da pontuação.
  R.RATE = 0.172;
  R.PAUSE = { 0: 0, 2: 0.04, 2.5: 0.06, 3: 0.08, 4: 0.3 };
  R.LEAD_IN = 0.25; // silêncio antes da primeira palavra
  R.TAIL = 0.9; // C.end = fim da última palavra + TAIL (regra do sync_cues.py)
  R.BLOCK_GAP = 0.15; // pausa extra entre blocos

  const VOWELS = /[aeiouáéíóúâêôãõàüy]+/gi;
  R.syllables = (word) => {
    const w = String(word).toLowerCase().replace(/[^a-záéíóúâêôãõàüçy]/g, "");
    if (!w) return /\d/.test(word) ? 2 * String(word).replace(/\D/g, "").length : 0;
    const m = w.match(VOWELS);
    let n = m ? m.length : 1;
    for (const g of m || []) if (g.length >= 2 && /[aeoáéó][aeoáéó]|[íú]|[iu][aeoá]$/.test(g)) n += 0.5;
    return Math.max(1, n);
  };
  /** Força da pausa esperada depois do token (pela pontuação). 4 = reticências. */
  R.breakStrength = (s) => {
    s = String(s).trim();
    if (/(\.\.\.|…)$/.test(s)) return 4;
    if (/[.?!]["”')]*$/.test(s)) return 3;
    if (/[:;]$/.test(s)) return 2.5;
    if (/[,—–]$/.test(s)) return 2;
    return 0;
  };
  R.weight = (spoken) => String(spoken).split(/\s+/).filter(Boolean).reduce((s, x) => s + R.syllables(x) + 0.25, 0);

  /**
   * Converte o texto marcado em blocos e tokens.
   * @returns {{blocks:{name:string, tokens:number[]}[], tokens:{display:string, spoken:string, block:string, cues:string[], brk:number, w:number}[], cues:string[], errors:string[], warnings:string[]}}
   */
  R.parse = (text) => {
    const out = { blocks: [], tokens: [], cues: [], errors: [], warnings: [] };
    let block = null;
    const ensureBlock = (name, line) => {
      if (out.blocks.some((b) => b.name === name)) out.errors.push(`linha ${line}: bloco "${name}" repetido`);
      block = { name, tokens: [], line };
      out.blocks.push(block);
    };
    const lines = String(text).replace(/\r/g, "").split("\n");
    lines.forEach((raw, li) => {
      const line = raw.trim();
      const ln = li + 1;
      if (!line || line.startsWith("//")) return;
      const h = line.match(/^#+\s*([\p{L}\p{N}_-]+)\s*$/u);
      if (h) { ensureBlock(h[1].toLowerCase(), ln); return; }
      if (!block) ensureBlock("gancho", ln);
      // tokeniza: {exibe|fala}, [[marca]], palavras
      const re = /\[\[([^\]]*)\]\]|\{([^{}|]*)\|([^{}]*)\}|(\S+)/g;
      let m, pendingCues = [];
      while ((m = re.exec(line))) {
        if (m[1] !== undefined) {
          const name = m[1].trim();
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) { out.errors.push(`linha ${ln}: marca [[${name}]] inválida (use letras sem acento, números e _; comece com letra)`); continue; }
          if (out.cues.includes(name) || pendingCues.includes(name)) { out.errors.push(`linha ${ln}: marca [[${name}]] repetida`); continue; }
          pendingCues.push(name);
          continue;
        }
        let display, spoken;
        if (m[2] !== undefined) {
          display = m[2].trim(); spoken = m[3].trim();
          // pontuação colada depois da chave: {28|vinte e oito}.
          const tail = line.slice(re.lastIndex).match(/^[.,!?:;…]+/);
          if (tail) { display += tail[0]; spoken += tail[0]; re.lastIndex += tail[0].length; }
        } else {
          display = spoken = m[4];
          // marca colada no meio de uma palavra: "[[x]]palavra" já é tratada; aqui só a palavra
          if (/\[\[|\]\]|\{|\}/.test(display)) { out.errors.push(`linha ${ln}: marcação mal formada em "${display}"`); continue; }
        }
        if (/^[.,!?:;…]+$/.test(display) && out.tokens.length) {
          // pontuação solta: cola no token anterior
          const prev = out.tokens[out.tokens.length - 1];
          prev.display += display; prev.spoken += display; prev.brk = Math.max(prev.brk, R.breakStrength(prev.display));
          continue;
        }
        const tok = { display, spoken, block: block.name, cues: pendingCues, brk: R.breakStrength(display), w: R.weight(spoken.replace(/[^\p{L}\p{N}\s]/gu, " ")) };
        if (/\d/.test(display) && display === spoken) out.warnings.push(`linha ${ln}: "${display}" tem número; escreva {${display}|por extenso} para a voz e a sincronia`);
        if (/\b[A-Z]{2,}\b/.test(display) && display === spoken && !/^(OK|TV)$/.test(display.replace(/\W/g, ""))) out.warnings.push(`linha ${ln}: sigla "${display}"; se a voz deve soletrar, use {${display}|como se fala}`);
        out.cues.push(...pendingCues);
        pendingCues = [];
        block.tokens.push(out.tokens.length);
        out.tokens.push(tok);
      }
      if (pendingCues.length) out.errors.push(`linha ${ln}: marca(s) ${pendingCues.map((c) => `[[${c}]]`).join(" ")} no fim da linha, sem palavra depois`);
    });
    for (const b of out.blocks) if (!b.tokens.length) out.errors.push(`bloco "${b.name}" está vazio`);
    const reserved = ["hook", "end"];
    for (const c of out.cues) if (reserved.includes(c)) out.errors.push(`a marca [[${c}]] é reservada (C.hook = 0 e C.end = fim são automáticas)`);
    return out;
  };

  /** Tempos estimados (sem voz): sílabas × ritmo + pausas por pontuação. */
  R.estimate = (parsed, { rate = R.RATE } = {}) => {
    let t = R.LEAD_IN;
    const words = [];
    parsed.tokens.forEach((tok, i) => {
      const dur = tok.w * rate;
      words.push({ start: t, end: t + dur });
      t += dur;
      const next = parsed.tokens[i + 1];
      t += R.PAUSE[tok.brk] || 0;
      if (next && next.block !== tok.block) t += R.BLOCK_GAP;
    });
    return { words, voiceDuration: 0, source: "estimado" };
  };

  /**
   * Monta C (marcas), B (blocos) e a lista de palavras a partir dos tempos por token.
   * @param parsed resultado de R.parse
   * @param timing {words:[{start,end}], voiceDuration:number, source:string}
   */
  R.build = (parsed, timing) => {
    const words = parsed.tokens.map((tok, i) => ({ ...tok, i, start: timing.words[i].start, end: timing.words[i].end }));
    const C = { hook: 0 };
    for (const w of words) for (const c of w.cues) C[c] = +w.start.toFixed(3);
    const last = words[words.length - 1];
    C.end = +Math.max(last ? last.end + R.TAIL : 1, (timing.voiceDuration || 0) + 0.2).toFixed(3);
    const B = {};
    for (const b of parsed.blocks) {
      const ws = b.tokens.map((i) => words[i]);
      B[b.name] = { start: +ws[0].start.toFixed(3), end: +ws[ws.length - 1].end.toFixed(3) };
    }
    return { C, B, words, source: timing.source, voiceDuration: timing.voiceDuration || 0 };
  };

  /** Agrupa palavras em legendas (porte de build_captions.py:22-52). */
  R.captionGroups = (words, { maxWords = 5, maxChars = 24, gap = 0.15 } = {}) => {
    const groups = [];
    let cur = [];
    const flush = () => { if (cur.length) groups.push(cur); cur = []; };
    words.forEach((w, i) => {
      const prev = words[i - 1];
      const chars = cur.reduce((s, x) => s + x.display.length + 1, 0) + w.display.length;
      if (cur.length && (cur.length >= maxWords || chars > maxChars || (prev && w.start - prev.end > gap) || (prev && prev.brk >= 3) || (prev && prev.block !== w.block))) flush();
      cur.push(w);
    });
    flush();
    return groups.map((g, k) => {
      const next = groups[k + 1];
      const start = Math.max(0.12, g[0].start - 0.05);
      const end = Math.min(g[g.length - 1].end + 0.5, next ? next[0].start - 0.05 : Infinity);
      return { start, end, words: g };
    });
  };

  /** Texto para gravar (exibição) e texto para IA de voz (forma falada), por bloco. */
  R.scriptTexts = (parsed) => parsed.blocks.map((b) => ({
    block: b.name,
    display: b.tokens.map((i) => parsed.tokens[i].display).join(" "),
    spoken: b.tokens.map((i) => parsed.tokens[i].spoken).join(" "),
  }));
})(typeof window !== "undefined" ? window : globalThis);
