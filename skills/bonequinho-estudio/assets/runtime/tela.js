/* Bonequinhos-Reels · tela.js
 * Textos na tela desenhados em Canvas 2D por cima do 3D: título, resposta, número gigante, barra 1-2-3,
 * cards, comparação, lista, callouts presos a âncoras 3D, legendas palavra a palavra e CTA.
 * Porte da gramática visual de house/reboco-novo hud.html e cta.html.
 * Zonas seguras do Reels (1080x1920): evitar y < 200 e y > 1560 (interface do Instagram) e x > 960 embaixo.
 */
(function (root) {
  "use strict";
  const BQ = (root.BQ = root.BQ || {});
  const U = BQ.util;
  const W = 1080, Hh = 1920;
  const SAFE = { top: 200, bottom: 1560, left: 60, right: 1020 };

  /** Cria os widgets de tela. `env` traz brand, C, B, screen(anchor) e as palavras (legendas). */
  BQ.createTela = function (env) {
    const { brand } = env;
    const CL = brand.colors;
    const FD = brand.fonts.display, FT = brand.fonts.text;
    const tone = (t) => ({ danger: CL.danger, success: CL.success, info: CL.info || "#0ea5e9", accent: CL.accent, warn: "#f59e0b", ink: CL.ink }[t || "accent"] || t);

    // ---------- utilidades de desenho ----------
    function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
    function font(ctx, size, weight = 800, fam = FD) { ctx.font = `${weight} ${Math.round(size)}px ${fam}`; }
    /** Divide "texto com *destaque*" em segmentos. */
    function segs(text) { const out = []; String(text).split(/(\*[^*]+\*)/).forEach((p) => { if (!p) return; if (p.startsWith("*") && p.endsWith("*")) out.push({ t: p.slice(1, -1), hi: true }); else out.push({ t: p, hi: false }); }); return out; }
    const plain = (text) => String(text).replace(/\*/g, "");
    /** Ajusta o tamanho da fonte para caber na largura. Retorna o tamanho usado. */
    function fit(ctx, text, maxW, size, weight, fam, min = size * 0.55) {
      let s = size;
      for (; s > min; s -= 2) { font(ctx, s, weight, fam); if (ctx.measureText(plain(text)).width <= maxW) break; }
      font(ctx, s, weight, fam);
      return s;
    }
    /** Quebra o texto em linhas que cabem em maxW. */
    function wrap(ctx, text, maxW) {
      const words = String(text).split(/\s+/), lines = [];
      let cur = "";
      for (const w of words) { const test = cur ? cur + " " + w : w; if (ctx.measureText(plain(test)).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test; }
      if (cur) lines.push(cur);
      return lines;
    }
    function drawRich(ctx, text, x, y, color, hiColor, align = "center") {
      const parts = segs(text);
      const total = parts.reduce((s, p) => s + ctx.measureText(p.t).width, 0);
      let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
      const prevAlign = ctx.textAlign; ctx.textAlign = "left";
      for (const p of parts) { ctx.fillStyle = p.hi ? hiColor : color; ctx.fillText(p.t, cx, y); cx += ctx.measureText(p.t).width; }
      ctx.textAlign = prevAlign;
      return total;
    }
    function shadow(ctx, on, blur = 24, alpha = 0.28) { if (on) { ctx.shadowColor = `rgba(0,0,0,${alpha})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = 8; } else { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; } }
    /** Fator de entrada/saída: 0..1 com mola na entrada. */
    function enter(t, from, until, { hold = false, inDur = 0.55, outDur = 0.25 } = {}) {
      if (t < from || t > until) return { a: 0, s: 0 };
      const i = hold && from <= 0 ? 1 : U.prog(t, from, from + inDur);
      const o = 1 - U.prog(t, until - outDur, until);
      return { a: Math.min(U.clamp01(i * 2), o), s: U.spring(i) * (0.85 + 0.15 * o), i, o };
    }
    const needTimes = (name, op) => { if (!Number.isFinite(op.from) || !Number.isFinite(op.until)) throw new Error(`H.${name}: from e until precisam ser números (use marcas, ex. from: C.gancho, until: C.ainda). Recebido from=${op.from}, until=${op.until}`); };

    // ---------- widgets ----------
    const H = {};
    /** Título do gancho: card escuro no topo. Linhas com *destaque* na cor da marca. */
    H.title = (op) => { needTimes("title", op); BQ.checkOpts("H.title", op, ["from", "until", "kicker", "lines", "text", "y", "size", "bg", "holdFromStart"]); return { kind: "title", ...op, draw(ctx, t) {
      const e = enter(t, op.from, op.until, { hold: op.holdFromStart ?? true }); if (e.a <= 0) return;
      const lines = op.lines || [op.text || ""]; const y0 = op.y ?? 260;
      ctx.save(); ctx.globalAlpha = e.a; ctx.translate(W / 2, y0 + (1 - e.s) * -40); ctx.scale(0.92 + 0.08 * e.s, 0.92 + 0.08 * e.s);
      const maxW = 860; let h = 60; const sizes = [];
      if (op.kicker) { font(ctx, 54, 800); h += 64; }
      for (const ln of lines) { const s = fit(ctx, ln, maxW, op.size || 104, 900); sizes.push(s); h += s * 1.02; }
      shadow(ctx, true); ctx.fillStyle = op.bg || CL.ink; rr(ctx, -470, 0, 940, h, 40); ctx.fill(); shadow(ctx, false);
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; let y = 40;
      if (op.kicker) { font(ctx, 52, 800); ctx.fillStyle = "rgba(255,255,255,0.82)"; ctx.fillText(op.kicker.toUpperCase(), 0, y + 26); y += 64; }
      lines.forEach((ln, i) => { font(ctx, sizes[i], 900); drawRich(ctx, ln.toUpperCase(), 0, y + sizes[i] * 0.52, "#ffffff", CL.accentLight || CL.accent); y += sizes[i] * 1.02; });
      ctx.restore();
    } }; };
    /** Resposta em carimbo no centro ("Ainda não.", "Pode!"). */
    H.answer = (op) => { needTimes("answer", op); BQ.checkOpts("H.answer", op, ["from", "until", "text", "tone", "y", "tilt", "size"]); return { kind: "answer", ...op, draw(ctx, t) {
      const e = enter(t, op.from, op.until, { inDur: 0.45 }); if (e.a <= 0) return;
      const lines = String(op.text).split("\n"); const y0 = op.y ?? 700;
      ctx.save(); ctx.globalAlpha = e.a; ctx.translate(W / 2, y0); ctx.rotate(U.deg(op.tilt ?? -4)); const sc = 1.25 - 0.25 * e.s; ctx.scale(sc, sc);
      const size = op.size || 150; font(ctx, size, 900); const tw = Math.max(...lines.map((l) => ctx.measureText(l.toUpperCase()).width));
      const bh = size * 1.05 * lines.length + 50;
      shadow(ctx, true); ctx.fillStyle = tone(op.tone || "danger"); rr(ctx, -tw / 2 - 50, -bh / 2, tw + 100, bh, 34); ctx.fill(); shadow(ctx, false);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      lines.forEach((l, i) => ctx.fillText(l.toUpperCase(), 0, (i - (lines.length - 1) / 2) * size * 1.05 + 6));
      ctx.restore();
    } }; };
    /** Número gigante num círculo (28 DIAS, 30 mA...). */
    H.bigNumber = (op) => { needTimes("bigNumber", op); BQ.checkOpts("H.bigNumber", op, ["from", "until", "value", "unit", "label", "side", "x", "y", "radius", "tone", "size"]); return { kind: "bigNumber", ...op, draw(ctx, t) {
      const e = enter(t, op.from, op.until); if (e.a <= 0) return;
      const x = op.x ?? (op.side === "left" ? 300 : op.side === "center" ? W / 2 : 780), y = op.y ?? 820, r = op.radius ?? 175;
      ctx.save(); ctx.globalAlpha = e.a; ctx.translate(x, y); ctx.scale(e.s, e.s);
      shadow(ctx, true, 30); ctx.fillStyle = tone(op.tone || "accent"); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); shadow(ctx, false);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const s = fit(ctx, String(op.value), r * 1.6, op.size || 190, 900);
      ctx.fillText(String(op.value), 0, op.unit ? -r * 0.12 : 6);
      if (op.unit) { fit(ctx, op.unit.toUpperCase(), r * 1.5, 50, 800); ctx.fillText(op.unit.toUpperCase(), 0, r * 0.5); }
      ctx.restore();
      if (op.label) { ctx.save(); ctx.globalAlpha = e.a; font(ctx, 46, 800); ctx.textAlign = "center"; ctx.textBaseline = "top"; const lw = ctx.measureText(op.label).width + 44; ctx.fillStyle = CL.ink; rr(ctx, x - lw / 2, y + r + 22, lw, 70, 20); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillText(op.label, x, y + r + 34); ctx.restore(); }
      void s;
    } }; };
    /** Barra 1-2-3 no topo. `at` = instantes em que cada passo fica ativo (os anteriores viram "feito"). */
    H.steps = (op) => { needTimes("steps", op); BQ.checkOpts("H.steps", op, ["from", "until", "labels", "at", "y"]); if (!Array.isArray(op.labels) || op.labels.length < 2) throw new Error("H.steps precisa de labels: [\"Passo 1\", \"Passo 2\", ...]"); return { kind: "steps", ...op, draw(ctx, t) {
      const e = enter(t, op.from, op.until, { inDur: 0.45 }); if (e.a <= 0) return;
      const n = op.labels.length, y = op.y ?? 230, gap = 14, w = (920 - gap * (n - 1)) / n, x0 = (W - 920) / 2;
      const at = op.at || [];
      ctx.save(); ctx.globalAlpha = e.a; ctx.textBaseline = "middle"; ctx.textAlign = "center";
      op.labels.forEach((lb, i) => {
        const active = at[i] != null && t >= at[i] && (at[i + 1] == null || t < at[i + 1]);
        const done = at[i + 1] != null && t >= at[i + 1];
        const pop = active ? U.spring(U.prog(t, at[i], at[i] + 0.5)) : 1;
        const x = x0 + i * (w + gap), hh = active ? 104 : 92, yy = y - (active ? 6 : 0) + (1 - e.s) * -30;
        shadow(ctx, active, 20, 0.25);
        ctx.fillStyle = done ? CL.success : active ? tone("accent") : "rgba(11,18,32,0.72)"; rr(ctx, x, yy, w, hh, 24); ctx.fill(); shadow(ctx, false);
        ctx.fillStyle = "#fff"; font(ctx, 34, 900); ctx.fillText(done ? "✓" : String(i + 1), x + 38, yy + hh / 2);
        fit(ctx, lb.toUpperCase(), w - 84, active ? 44 * (0.9 + 0.1 * pop) : 40, 800); ctx.textAlign = "left"; ctx.fillText(lb.toUpperCase(), x + 70, yy + hh / 2 + 2); ctx.textAlign = "center";
      });
      ctx.restore();
    } }; };
    /** Card com ícone, título e texto (meio/baixo da tela). */
    H.card = (op) => { needTimes("card", op); BQ.checkOpts("H.card", op, ["from", "until", "title", "text", "icon", "tone", "y", "w"]); return { kind: "card", ...op, draw(ctx, t) {
      const e = enter(t, op.from, op.until); if (e.a <= 0) return;
      const y = op.y ?? 1080, w = op.w ?? 900, x = (W - w) / 2, col = tone(op.tone || "accent");
      ctx.save(); ctx.globalAlpha = e.a; ctx.translate(0, (1 - e.s) * 50);
      font(ctx, 44, 600, FT); const lines = op.text ? wrap(ctx, op.text, w - (op.icon ? 190 : 80)) : [];
      const h = 70 + (op.title ? 70 : 0) + lines.length * 56;
      shadow(ctx, true); ctx.fillStyle = "#ffffff"; rr(ctx, x, y, w, h, 34); ctx.fill(); shadow(ctx, false);
      ctx.fillStyle = col; rr(ctx, x, y, 14, h, [34, 0, 0, 34]); ctx.fill();
      let tx = x + 50;
      if (op.icon) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 95, y + h / 2, 52, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff"; font(ctx, 56, 900); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(op.icon, x + 95, y + h / 2 + 3); tx = x + 175; }
      ctx.textAlign = "left"; ctx.textBaseline = "top"; let yy = y + 36;
      if (op.title) { fit(ctx, op.title.toUpperCase(), w - (tx - x) - 40, 58, 900); ctx.fillStyle = CL.ink; drawRich(ctx, op.title.toUpperCase(), tx, yy, CL.ink, col, "left"); yy += 70; }
      font(ctx, 44, 600, FT); ctx.fillStyle = "#334155"; lines.forEach((l) => { drawRich(ctx, l, tx, yy, "#334155", col, "left"); yy += 56; });
      ctx.restore();
    } }; };
    /** Comparação lado a lado (mito × verdade, errado × certo). */
    H.compare = (op) => { needTimes("compare", op); BQ.checkOpts("H.compare", op, ["from", "until", "left", "right", "y", "h"]); return { kind: "compare", ...op, draw(ctx, t) {
      const e = enter(t, op.from, op.until); if (e.a <= 0) return;
      const y = op.y ?? 980, cw = 440, ch = op.h ?? 360;
      const icon = (s, tn) => s.icon ?? (tn === "success" ? "✓" : tn === "danger" ? "✗" : tn === "warn" ? "!" : "•");
      const L = op.left || {}, R = op.right || {}, lt = L.tone || "danger", rt = R.tone || "success";
      const sides = [[L, (W / 2) - cw - 10, lt, icon(L, lt)], [R, W / 2 + 10, rt, icon(R, rt)]];
      ctx.save(); ctx.globalAlpha = e.a;
      sides.forEach(([s, x, tn, ic], i) => {
        const k = U.spring(U.prog(t, op.from + i * 0.18, op.from + i * 0.18 + 0.55));
        ctx.save(); ctx.translate(x + cw / 2, y + ch / 2); ctx.scale(k, k); ctx.translate(-cw / 2, -ch / 2);
        shadow(ctx, true); ctx.fillStyle = "#fff"; rr(ctx, 0, 0, cw, ch, 32); ctx.fill(); shadow(ctx, false);
        ctx.fillStyle = tone(tn); rr(ctx, 0, 0, cw, 96, [32, 32, 0, 0]); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; fit(ctx, `${ic}  ${(s.title || "").toUpperCase()}`, cw - 40, 48, 900); ctx.fillText(`${ic}  ${(s.title || "").toUpperCase()}`, cw / 2, 50);
        if (s.value) { fit(ctx, s.value, cw - 40, 120, 900); ctx.fillStyle = tone(tn); ctx.fillText(s.value, cw / 2, 175); }
        if (s.text) { font(ctx, 38, 600, FT); ctx.fillStyle = "#334155"; wrap(ctx, s.text, cw - 50).slice(0, 3).forEach((l, j) => ctx.fillText(l, cw / 2, (s.value ? 255 : 165) + j * 46)); }
        ctx.restore();
      });
      ctx.restore();
    } }; };
    /** Lista que aparece item a item (norma, checklist). items: [{text, at, ok:true|false}] */
    H.list = (op) => { needTimes("list", op); BQ.checkOpts("H.list", op, ["from", "until", "title", "items", "x", "y"]); return { kind: "list", ...op, draw(ctx, t) {
      const e = enter(t, op.from, op.until); if (e.a <= 0) return;
      const items = op.items || [], x = op.x ?? 110, w = W - 2 * x; let y = op.y ?? 900;
      ctx.save(); ctx.globalAlpha = e.a;
      font(ctx, 42, 600, FT);
      const rows = items.map((it) => wrap(ctx, it.text, w - 150));
      const h = 50 + (op.title ? 80 : 0) + rows.reduce((s, r) => s + r.length * 54 + 26, 0);
      shadow(ctx, true); ctx.fillStyle = "rgba(255,255,255,0.97)"; rr(ctx, x, y, w, h, 34); ctx.fill(); shadow(ctx, false);
      y += 40; ctx.textBaseline = "top"; ctx.textAlign = "left";
      if (op.title) { fit(ctx, op.title.toUpperCase(), w - 80, 54, 900); drawRich(ctx, op.title.toUpperCase(), x + 44, y, CL.ink, tone("accent"), "left"); y += 80; }
      items.forEach((it, i) => {
        const k = it.at == null ? 1 : U.spring(U.prog(t, it.at, it.at + 0.5));
        ctx.save(); ctx.globalAlpha = e.a * U.clamp01(k * 1.4); ctx.translate((1 - k) * 40, 0);
        const col = it.ok === false ? CL.danger : it.ok === true ? CL.success : tone("accent");
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 74, y + 26, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; font(ctx, 32, 900); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(it.ok === false ? "✗" : it.ok === true ? "✓" : String(i + 1), x + 74, y + 28);
        ctx.textAlign = "left"; ctx.textBaseline = "top"; font(ctx, 42, 600, FT);
        rows[i].forEach((l, j) => drawRich(ctx, l, x + 124, y + j * 54 + 2, "#1f2937", col, "left"));
        ctx.restore();
        y += rows[i].length * 54 + 26;
      });
      ctx.restore();
    } }; };
    /** Rótulo preso a uma âncora 3D, com linha. dx/dy: deslocamento do rótulo em px. */
    H.callout = (op) => { needTimes("callout", op); BQ.checkOpts("H.callout", op, ["from", "until", "anchor", "text", "tone", "dx", "dy", "top", "bottom", "size", "bg"]); if (!op.anchor) throw new Error("H.callout precisa de anchor (nome criado com lib.anchor)"); return { kind: "callout", ...op, draw(ctx, t) {
      const e = enter(t, op.from, op.until, { inDur: 0.3, outDur: 0.2 }); if (e.a <= 0) return;
      const p = env.screen(op.anchor); if (!p.visible) return;
      font(ctx, op.size || 52, 900); const label = String(op.text).toUpperCase(); const bw = ctx.measureText(label).width + 56, bh = (op.size || 52) + 44;
      const dx = op.dx ?? 140, dy = op.dy ?? -110;
      let bx = p.x + dx - (dx < 0 ? bw : 0), by = p.y + dy - bh / 2;
      bx = U.clamp(bx, SAFE.left, SAFE.right - bw); by = U.clamp(by, op.top ?? 330, (op.bottom ?? 1320) - bh);
      const lx = bx + (dx < 0 ? bw : 0), ly = by + bh / 2, grow = U.easeOut(e.i ?? 1);
      ctx.save(); ctx.globalAlpha = e.a;
      ctx.strokeStyle = CL.ink; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(U.lerp(p.x, lx, grow), U.lerp(p.y, ly, grow)); ctx.stroke();
      ctx.fillStyle = tone(op.tone || "accent"); ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.translate(0, 14 * (1 - U.easeOutExpo(e.i ?? 1)));
      shadow(ctx, true, 18, 0.22); ctx.fillStyle = op.bg || "#ffffff"; rr(ctx, bx, by, bw, bh, 22); ctx.fill(); shadow(ctx, false);
      ctx.fillStyle = tone(op.tone || "accent"); rr(ctx, bx, by + bh - 10, bw, 10, [0, 0, 22, 22]); ctx.fill();
      ctx.fillStyle = CL.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, bx + bw / 2, by + bh / 2 - 2);
      ctx.restore();
    } }; };
    /** Texto livre (use com moderação). */
    H.text = (op) => { needTimes("text", op); BQ.checkOpts("H.text", op, ["from", "until", "text", "x", "y", "size", "weight", "font", "color", "align", "stroke"]); return { kind: "text", ...op, draw(ctx, t) {
      const e = enter(t, op.from, op.until); if (e.a <= 0) return;
      ctx.save(); ctx.globalAlpha = e.a; font(ctx, op.size || 64, op.weight || 900, op.font === "text" ? FT : FD); ctx.textAlign = op.align || "center"; ctx.textBaseline = "middle";
      if (op.stroke !== false) { ctx.lineWidth = 10; ctx.strokeStyle = "rgba(11,18,32,0.85)"; ctx.lineJoin = "round"; ctx.strokeText(plain(op.text), op.x ?? W / 2, op.y ?? 600); }
      drawRich(ctx, op.text, op.x ?? W / 2, op.y ?? 600, op.color || "#fff", tone("accent"), op.align || "center");
      ctx.restore();
    } }; };
    /** Clarão de tela inteira (impacto). */
    H.flash = (op) => { if (!Number.isFinite(op.at)) throw new Error("H.flash precisa de at (marca)"); BQ.checkOpts("H.flash", op, ["at", "dur", "strength", "color"]); return { kind: "flash", from: op.at, until: op.at + (op.dur ?? 0.35), ...op, draw(ctx, t) {
      const k = 1 - U.prog(t, op.at, op.at + (op.dur ?? 0.35)); if (t < op.at || k <= 0) return;
      ctx.save(); ctx.globalAlpha = k * (op.strength ?? 0.6); ctx.fillStyle = op.color || "#ffffff"; ctx.fillRect(0, 0, W, Hh); ctx.restore();
    } }; };
    H.SAFE = SAFE;

    // ---------- legendas palavra a palavra ----------
    function captions(words, opts = {}) {
      const groups = BQ.roteiro.captionGroups(words);
      const y = opts.y ?? 1440;
      return {
        kind: "captions", groups,
        draw(ctx, t) {
          if (opts.enabled === false) return;
          const g = groups.find((x) => t >= x.start && t <= x.end); if (!g) return;
          const k = U.prog(t, g.start, g.start + 0.12);
          ctx.save(); ctx.textBaseline = "middle"; ctx.textAlign = "left";
          let size = 66; font(ctx, size, 900);
          const text = (w) => w.display.replace(/[.,;:]+$/, "");
          let widths = g.words.map((w) => ctx.measureText(text(w) + " ").width), total = widths.reduce((s, v) => s + v, 0);
          if (total > 900) { size = Math.floor(size * 900 / total); font(ctx, size, 900); widths = g.words.map((w) => ctx.measureText(text(w) + " ").width); total = widths.reduce((s, v) => s + v, 0); }
          let x = W / 2 - total / 2 + ctx.measureText(" ").width / 2;
          ctx.globalAlpha = k; ctx.fillStyle = CL.captionBg; rr(ctx, x - 34, y - size * 0.82, total + 40, size * 1.64, 24); ctx.fill();
          g.words.forEach((w, i) => {
            const on = t >= w.start - 0.02;
            ctx.globalAlpha = k * (on ? 1 : 0.45);
            ctx.fillStyle = /\d/.test(w.display) ? CL.captionNum : "#ffffff";
            ctx.fillText(text(w), x, y + 3); x += widths[i];
          });
          ctx.restore();
        },
      };
    }

    // ---------- CTA (só no modo empresa) ----------
    function cta(from, until) {
      return {
        kind: "cta", from, until,
        draw(ctx, t) {
          if (brand.mode !== "empresa") return;
          const e = enter(t, from, until, { inDur: 0.6, outDur: 0.35 }); if (e.a <= 0) return;
          const y = 1020, w = 920, x = (W - w) / 2, h = 330;
          ctx.save(); ctx.globalAlpha = e.a; ctx.translate(0, (1 - e.s) * 80);
          shadow(ctx, true, 34, 0.3); ctx.fillStyle = "#ffffff"; rr(ctx, x, y, w, h, 40); ctx.fill(); shadow(ctx, false);
          let tx = x + 60;
          if (env.logoImage) { ctx.save(); ctx.beginPath(); ctx.arc(x + 130, y + 120, 82, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(env.logoImage, x + 48, y + 38, 164, 164); ctx.restore(); tx = x + 240; }
          ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = CL.ink;
          fit(ctx, brand.name || "", x + w - 50 - tx, 66, 900); ctx.fillText(brand.name || "", tx, y + 92);
          if (brand.handle) { font(ctx, 42, 600, FT); ctx.fillStyle = "#475569"; ctx.fillText(brand.handle, tx, y + 152); }
          const label = brand.ctaText || (brand.whatsapp ? `Chama no WhatsApp ${brand.whatsapp}` : "Siga para mais dicas");
          const pulse = 1 + 0.03 * Math.sin((t - from) * 6);
          ctx.save(); ctx.translate(W / 2, y + 262); ctx.scale(pulse, pulse);
          font(ctx, 46, 900); const bw = Math.min(w - 80, ctx.measureText(label).width + 90);
          ctx.fillStyle = brand.whatsapp ? "#25d366" : CL.accent; rr(ctx, -bw / 2, -46, bw, 92, 46); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.textAlign = "center"; fit(ctx, label, bw - 60, 46, 900); ctx.fillText(label, 0, 3);
          ctx.restore();
          ctx.restore();
        },
      };
    }
    return { H, captions, cta, SAFE };
  };
})(typeof window !== "undefined" ? window : globalThis);
