/* Bonequinhos-Reels · estudio.js
 * O estúdio: lê o projeto embutido, monta a cena, desenha a prévia, cuida da narração (gravar por bloco
 * ou subir áudio), sincroniza as marcas e exporta o MP4 (WebCodecs + Mediabunny), a capa e a folha de contato.
 * Só roda no navegador.
 */
(function () {
  "use strict";
  const BQ = window.BQ;
  const U = BQ.util;
  const { THREE, addons, Mediabunny: MB } = window.BQV;
  const W = BQ.W, H = BQ.H, FPS = BQ.FPS, SR = BQ.audio.SR;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

  const S = (BQ.state = {
    project: null, parsed: null, timing: null, built: null, world: null, hud: null, sfx: [],
    t: 0, playing: false, voice: null, voiceMode: null, mixCache: null, problems: [], offsets: {},
  });

  // ---------- problemas (vão para o relatório e para a faixa de aviso) ----------
  function problem(kind, msg, detail) {
    S.problems.push({ kind, msg, detail: detail ? String(detail).slice(0, 800) : undefined });
    console.warn(`[estúdio] ${kind}: ${msg}`, detail || "");
    renderProblems();
  }
  function clearProblems(kind) { S.problems = S.problems.filter((p) => p.kind !== kind); renderProblems(); }
  function renderProblems() {
    const box = $("#problems"); if (!box) return;
    const list = S.problems.filter((p) => p.kind === "erro");
    box.hidden = !list.length;
    box.innerHTML = list.length ? `<b>⚠️ ${list.length} problema(s) no projeto.</b> ${esc(list[0].msg)} <button class="link" data-tab="relatorio">ver relatório</button>` : "";
  }

  // ---------- armazenamento local (IndexedDB para áudio; localStorage para ajustes) ----------
  // A memória (MEM) sempre funciona; o IndexedDB guarda entre aberturas quando o navegador deixa
  // (dentro de prévias/iframes, como a do claude.ai, ele costuma ser bloqueado).
  const MEM = new Map();
  const DB = {
    _db: null, ok: null,
    async open() { if (this._db) return this._db; return (this._db = await new Promise((res, rej) => { const r = indexedDB.open("bq-estudio", 1); r.onupgradeneeded = () => r.result.createObjectStore("audio"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
    async put(key, val) { MEM.set(key, val); try { const db = await this.open(); await new Promise((res, rej) => { const tx = db.transaction("audio", "readwrite"); tx.objectStore("audio").put(val, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); this.ok = true; } catch (e) { this.ok = false; console.warn("IndexedDB indisponível; a narração fica só nesta aba", e); } },
    async get(key) { if (MEM.has(key)) return MEM.get(key); try { const db = await this.open(); return await new Promise((res, rej) => { const r = db.transaction("audio").objectStore("audio").get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); } catch { return undefined; } },
    async del(key) { MEM.delete(key); try { const db = await this.open(); await new Promise((res) => { const tx = db.transaction("audio", "readwrite"); tx.objectStore("audio").delete(key); tx.oncomplete = res; }); } catch {} },
  };
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const key = (k) => `${S.project.slug}:${k}`;

  // ---------- palco (renderer + bloom + canvas de saída) ----------
  let renderer, composer, renderPass, bloomPass, out, ctx, glCanvas;
  function createStage() {
    out = $("#out"); ctx = out.getContext("2d");
    glCanvas = document.createElement("canvas"); glCanvas.width = W; glCanvas.height = H;
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    composer = new addons.EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(W, H);
    glCanvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); problem("erro", "A placa de vídeo perdeu o contexto 3D. Recarregue a página (F5)."); });
  }
  function attachScene(world) {
    composer.passes.slice().forEach((p) => composer.removePass(p));
    renderPass = new addons.RenderPass(world.scene, world.camera); composer.addPass(renderPass);
    const bl = S.project.bloom ?? { strength: 0.45, radius: 0.28, threshold: 0.85 };
    if (bl !== false) { bloomPass = new addons.UnrealBloomPass(new THREE.Vector2(W, H), bl.strength, bl.radius, bl.threshold); composer.addPass(bloomPass); }
    composer.addPass(new addons.OutputPass());
  }

  // ---------- marca ----------
  async function loadBrand() {
    const b = S.project.brand || {};
    const brand = {
      mode: b.mode === "empresa" ? "empresa" : "sem-marca", name: b.name || "", handle: b.handle || "", whatsapp: b.whatsapp || "", ctaText: b.ctaText || "",
      colors: { ink: "#0b1220", accent: "#2457d6", accentLight: "#7fb0ff", success: "#16a34a", danger: "#dc2626", info: "#0ea5e9", captionBg: "rgba(11,18,32,0.82)", captionNum: "#ffd166", ...(b.colors || {}) },
      fonts: { display: '"Barlow Condensed", "Arial Narrow", sans-serif', text: '"Bricolage Grotesque", system-ui, sans-serif', ...(b.fonts || {}) },
      logo: null,
    };
    brand.color = (role) => brand.colors[role] || role;
    let logoImage = null, logoTex = null;
    if (brand.mode === "empresa" && b.logo) {
      logoImage = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => { problem("aviso", "Não consegui carregar o logo da marca."); res(null); }; im.src = b.logo; });
      if (logoImage) { logoTex = new THREE.Texture(logoImage); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.needsUpdate = true; brand.logo = logoTex; }
    }
    await Promise.all(["900", "800", "600"].map((w) => document.fonts.load(`${w} 40px ${brand.fonts.display}`).catch(() => {})));
    await document.fonts.load(`600 40px ${brand.fonts.text}`).catch(() => {});
    await document.fonts.ready;
    S.brand = brand; S.logoImage = logoImage; S.logoTex = logoTex;
  }

  // ---------- tempos e reconstrução ----------
  function computeBuilt() {
    const built = BQ.roteiro.build(S.parsed, S.timing);
    // ajustes manuais das marcas (só valem se a marca ainda está na mesma palavra)
    S.droppedOffsets = [];
    for (const [c, v] of Object.entries(S.offsets)) {
      if (!(c in built.C) || c === "hook" || c === "end") continue;
      const d = typeof v === "number" ? v : v.d;
      const w = built.words.find((x) => x.cues.includes(c));
      if (v && v.w && w && v.w !== w.display) { S.droppedOffsets.push(c); continue; }
      built.C[c] = +(built.C[c] + d).toFixed(3);
    }
    return built;
  }
  function rebuild() {
    clearProblems("erro"); clearProblems("aviso-cena");
    S.built = computeBuilt();
    const C = BQ.strict({ ...S.built.C }, "C"), B = BQ.strict({ ...S.built.B }, "B");
    let M = BQ.strict({}, "M");
    if (BQ.parts.moments) { try { M = BQ.strict({ ...BQ.parts.moments(C, B) }, "M"); } catch (e) { problem("erro", `momentos.js: ${e.message}`, e.stack); } }
    if (S.world) { S.world.dispose(); S.world = null; }
    const world = BQ.createLib3D({ THREE, addons, brand: S.brand, logoTex: S.logoTex, makeCanvas: (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; } });
    S.world = world;
    try {
      if (!BQ.parts.scene) throw new Error("o projeto não tem cena.js (BQ.defineScene)");
      const upd = BQ.parts.scene({ THREE, lib: world.lib, C, B, M, brand: S.brand, u: U });
      world.setUserUpdate(upd);
    } catch (e) { problem("erro", `cena.js: ${e.message}`, e.stack); }
    attachScene(world);
    // tela
    const env = { brand: S.brand, C, B, M, screen: (a) => { try { return world.screen(a); } catch (e) { return { x: 0, y: 0, visible: false }; } }, logoImage: S.logoImage };
    const tela = BQ.createTela(env);
    let widgets = [];
    try { if (BQ.parts.hud) widgets = BQ.parts.hud({ H: tela.H, C, B, M, brand: S.brand, u: U }) || []; } catch (e) { problem("erro", `tela.js: ${e.message}`, e.stack); }
    widgets = widgets.flat().filter(Boolean);
    for (const w of widgets) if (typeof w.draw !== "function") problem("erro", `tela.js: item sem draw() — use as funções H.title, H.card etc. (${JSON.stringify(w).slice(0, 80)})`);
    const ctaFrom = S.built.B.cta ? S.built.B.cta.start : null;
    const ctaUntil = S.built.B.loop ? S.built.B.loop.start + 0.39 : S.built.C.end - 0.2;
    S.hud = { widgets: widgets.filter((w) => typeof w.draw === "function"), captions: tela.captions(S.built.words, S.project.captions || {}), cta: ctaFrom != null ? tela.cta(ctaFrom, ctaUntil) : null };
    // sons
    S.sfx = [];
    try {
      const list = BQ.parts.sfx ? BQ.parts.sfx({ C, B, M, u: U }) || [] : [];
      for (const ev of list) {
        if (!Array.isArray(ev)) { problem("erro", `sons.js: cada evento é [marca ou segundos, deslocamento, "som", dB] — recebi ${JSON.stringify(ev)}`); continue; }
        const [at, off = 0, name, db = 0] = ev;
        const base = typeof at === "number" ? at : typeof at === "string" ? (at in S.built.C ? S.built.C[at] : M[at]) : NaN;
        if (!Number.isFinite(base)) { problem("erro", `sons.js: marca "${at}" não existe`); continue; }
        if (!BQ.audio.SOUND_NAMES.includes(name)) { problem("erro", `sons.js: som "${name}" não existe (${BQ.audio.SOUND_NAMES.join(", ")})`); continue; }
        S.sfx.push({ t: base + off, name, db });
      }
    } catch (e) { problem("erro", `sons.js: ${e.message}`, e.stack); }
    for (const w of BQ.optWarnings || []) if (!S.problems.some((p) => p.msg === w)) problem("aviso", w);
    S.mixCache = null;
    S.duration = S.built.C.end;
    renderTimeline(); renderCues(); renderNarration();
    seek(Math.min(S.t, S.duration));
  }

  // ---------- desenho de um quadro ----------
  function frame(t, { captions = true, overlay = true } = {}) {
    try { S.world.update(t); } catch (e) { if (!S._updErr) { S._updErr = true; problem("erro", `cena.js (update em t=${t.toFixed(2)}): ${e.message}`, e.stack); } }
    composer.render();
    ctx.drawImage(glCanvas, 0, 0, W, H);
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (!overlay) return;
    for (const w of S.hud.widgets) { try { w.draw(ctx, t); } catch (e) { if (!w._err) { w._err = true; problem("erro", `tela.js (${w.kind}): ${e.message}`, e.stack); } } }
    if (S.hud.cta) S.hud.cta.draw(ctx, t);
    if (captions) S.hud.captions.draw(ctx, t);
  }
  BQ.frame = frame;
  function seek(t) {
    S.t = U.clamp(t, 0, S.duration || 0);
    frame(S.t);
    updateTransport();
  }

  // ---------- áudio: voz + efeitos ----------
  async function decodeToMono(blob) {
    const buf = await blob.arrayBuffer();
    const ac = new (window.OfflineAudioContext)(1, SR, SR);
    const dec = await ac.decodeAudioData(buf.slice(0));
    const off = new OfflineAudioContext(1, Math.ceil(dec.duration * SR), SR);
    const src = off.createBufferSource(); src.buffer = dec; src.connect(off.destination); src.start();
    const r = await off.startRendering();
    return r.getChannelData(0).slice();
  }
  async function mixed() {
    if (S.mixCache) return S.mixCache;
    status("Preparando o áudio…");
    await new Promise((r) => setTimeout(r, 20));
    const m = BQ.audio.mix({ voice: S.voice, events: S.sfx, duration: S.duration, sfxVolumeDb: S.project.sfxVolumeDb ?? 0 });
    S.mixCache = m; S.mixReport = m.report;
    status("");
    renderSoundReport();
    return m;
  }
  function toAudioBuffer(data) {
    const ab = new AudioBuffer({ length: data.length, numberOfChannels: 2, sampleRate: SR });
    ab.copyToChannel(data, 0); ab.copyToChannel(data, 1);
    return ab;
  }

  // ---------- narração: montar a voz a partir dos blocos ou do arquivo único ----------
  // impressão digital do texto falado: se o roteiro mudar, a gravação antiga não serve mais
  const textHash = (s) => { let h = 2166136261; for (const ch of String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const blockSpoken = (name) => { const b = S.parsed.blocks.find((x) => x.name === name); return b ? b.tokens.map((i) => S.parsed.tokens[i].spoken).join(" ") : ""; };
  const allSpoken = () => S.parsed.tokens.map((t) => t.spoken).join(" ");
  async function saveAudio(k, blob, spoken) { await DB.put(key(k), { blob, hash: textHash(spoken), at: new Date().toISOString() }); }
  async function getAudio(k, spoken) {
    const rec = await DB.get(key(k));
    if (!rec) return { blob: null, stale: false };
    if (rec instanceof Blob) return { blob: rec, stale: false };
    return { blob: rec.blob, stale: rec.hash !== textHash(spoken) };
  }
  async function loadVoice() {
    const blocks = S.parsed.blocks;
    const recs = await Promise.all(blocks.map((b) => getAudio(`bloco:${b.name}`, blockSpoken(b.name))));
    const fullRec = await getAudio("voz:unica", allSpoken());
    S.staleBlocks = blocks.filter((b, i) => recs[i].stale).map((b) => b.name);
    S.fullStale = fullRec.stale;
    for (const n of S.staleBlocks) problem("aviso", `O texto do bloco "${n}" mudou depois da gravação: grave esse bloco de novo (a gravação antiga foi deixada de lado).`);
    if (S.fullStale) problem("aviso", "O roteiro mudou depois que a narração única foi enviada: envie o áudio novo (o antigo foi deixado de lado).");
    const blobs = recs.map((r) => (r.stale ? null : r.blob));
    const full = fullRec.stale ? null : fullRec.blob;
    S.blockBlobs = Object.fromEntries(blocks.map((b, i) => [b.name, blobs[i] || null]));
    S.fullBlob = full || null;
    const nBlocks = blobs.filter(Boolean).length;
    const embedded = embeddedVoice();
    S.embeddedVoice = !!embedded;
    if (nBlocks === blocks.length) await assembleBlocks(blobs);
    else if (full) await assembleFull(full);
    else if (embedded) { await assembleFull(embedded); S.voiceMode = "embutida no arquivo"; S.timing.source = "voz embutida (enviada no chat)"; }
    else if (nBlocks > 0) await assembleBlocks(blobs);
    else { S.voice = null; S.voiceMode = null; S.timing = BQ.roteiro.estimate(S.parsed); }
  }
  /** Narração que o Claude embutiu no HTML (a pessoa mandou o áudio no chat). */
  function embeddedVoice() {
    const v = S.project.voice;
    if (!v || !v.data) return null;
    const bin = atob(v.data.split(",")[1] || ""), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: v.mime || "audio/mpeg" });
  }
  async function assembleFull(blob) {
    status("Sincronizando a narração com o roteiro…");
    const mono = await decodeToMono(blob);
    const r = BQ.align.align(mono, SR, S.parsed.tokens);
    S.voice = mono; S.voiceMode = "única";
    S.timing = { words: r.words, voiceDuration: mono.length / SR, source: "voz (arquivo único)" };
    status("");
  }
  async function assembleBlocks(blobs) {
    status("Montando a narração bloco a bloco…");
    const lead = BQ.roteiro.LEAD_IN, gap = 0.3, margin = 0.06;
    const parts = []; const words = new Array(S.parsed.tokens.length);
    let t = lead;
    for (const [bi, b] of S.parsed.blocks.entries()) {
      const toks = b.tokens.map((i) => S.parsed.tokens[i]);
      if (blobs[bi]) {
        const mono = await decodeToMono(blobs[bi]);
        const bounds = BQ.align.speechBounds(mono, SR);
        const a = Math.max(0, Math.floor((bounds.onset - margin) * SR)), z = Math.min(mono.length, Math.ceil((bounds.offset + margin) * SR));
        const seg = mono.subarray(a, z);
        const r = BQ.align.align(seg, SR, toks);
        b.tokens.forEach((ti, k) => (words[ti] = { start: t + r.words[k].start, end: t + r.words[k].end }));
        parts.push([t, seg]);
        t += seg.length / SR + gap;
      } else {
        // bloco sem gravação: tempo estimado e silêncio
        const est = BQ.roteiro.estimate({ tokens: toks, blocks: [b] });
        b.tokens.forEach((ti, k) => (words[ti] = { start: t + est.words[k].start - BQ.roteiro.LEAD_IN, end: t + est.words[k].end - BQ.roteiro.LEAD_IN }));
        t += est.words[est.words.length - 1].end - BQ.roteiro.LEAD_IN + gap;
      }
    }
    const total = Math.ceil((t + 0.2) * SR), mono = new Float32Array(total);
    for (const [at, seg] of parts) mono.set(seg, Math.floor(at * SR));
    S.voice = mono; S.voiceMode = "por bloco";
    S.timing = { words, voiceDuration: t - gap, source: `voz (${blobs.filter(Boolean).length}/${blobs.length} blocos gravados)` };
    status("");
  }
  async function voiceChanged() {
    await loadVoice();
    rebuild();
    toast(S.voice ? "Narração sincronizada. Confira as marcas na aba Marcas." : "Sem narração: usando tempos estimados.");
  }

  // ---------- gravação por bloco com teleprompter ----------
  let micStream = null;
  async function mic() {
    if (micStream && micStream.active) return micStream;
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: false } });
    return micStream;
  }
  async function recordBlock(name) {
    const b = S.parsed.blocks.find((x) => x.name === name);
    const text = b.tokens.map((i) => S.parsed.tokens[i].display).join(" ");
    let stream;
    try { stream = await mic(); } catch (e) { toast("Não consegui usar o microfone: " + e.message, true); return; }
    const ov = $("#prompter"); ov.hidden = false;
    $("#prompter-text").textContent = text; $("#prompter-block").textContent = `Bloco: ${name}`;
    const st = $("#prompter-status");
    for (let s = 3; s > 0; s--) { st.textContent = `Comece em ${s}…`; await new Promise((r) => setTimeout(r, 700)); }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined), chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((r) => (rec.onstop = r));
    rec.start(); st.innerHTML = "<span class='rec'>● Gravando</span> — leia o texto. Clique em <b>Parar</b> ou aperte <b>Espaço</b> ao terminar.";
    const t0 = performance.now();
    const stop = () => { if (rec.state === "recording") rec.stop(); };
    const onKey = (e) => { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); stop(); } if (e.code === "Escape") { rec.onstop = null; rec.stop(); ov.hidden = true; } };
    window.addEventListener("keydown", onKey);
    $("#prompter-stop").onclick = stop;
    await done; window.removeEventListener("keydown", onKey);
    ov.hidden = true;
    if (!chunks.length) return;
    const blob = new Blob(chunks, { type: rec.mimeType });
    if (performance.now() - t0 < 600) { toast("Gravação muito curta, tente de novo.", true); return; }
    await saveAudio(`bloco:${name}`, blob, blockSpoken(name));
    await voiceChanged();
  }

  // ---------- interface ----------
  function status(msg) { const el = $("#status"); if (el) { el.textContent = msg; el.hidden = !msg; } }
  let toastTimer;
  function toast(msg, bad = false) { const el = $("#toast"); el.textContent = msg; el.className = bad ? "bad" : ""; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 4200); }
  BQ.toast = toast;

  function renderTimeline() {
    const tl = $("#timeline"); if (!tl || !S.built) return;
    const d = S.duration;
    const blocks = Object.entries(S.built.B).map(([n, b], i) => `<div class="blk c${i % 6}" style="left:${(b.start / d) * 100}%;width:${Math.max(0.5, ((b.end - b.start) / d) * 100)}%" title="${esc(n)}"><span>${esc(n)}</span></div>`).join("");
    const cues = Object.entries(S.built.C).filter(([c]) => c !== "hook" && c !== "end").map(([c, t]) => `<i style="left:${(t / d) * 100}%" title="${esc(c)} · ${t.toFixed(2)} s"></i>`).join("");
    tl.innerHTML = `<div class="blocks">${blocks}</div><div class="cues">${cues}</div><div class="head" id="playhead"></div>`;
  }
  function updateTransport() {
    const ph = $("#playhead"); if (ph && S.duration) ph.style.left = `${(S.t / S.duration) * 100}%`;
    const tm = $("#time"); if (tm) tm.textContent = `${fmt(S.t)} / ${fmt(S.duration || 0)}`;
  }
  function renderNarration() {
    const box = $("#narr-blocks"); if (!box || !S.parsed) return;
    const texts = BQ.roteiro.scriptTexts(S.parsed);
    box.innerHTML = texts.map((x) => {
      const has = S.blockBlobs && S.blockBlobs[x.block];
      const stale = (S.staleBlocks || []).includes(x.block);
      return `<div class="nb"><div class="nb-h"><b>${esc(x.block)}</b>${has ? '<span class="ok">✓ gravado</span>' : stale ? '<span class="warn">texto mudou: grave de novo</span>' : '<span class="mut">sem gravação</span>'}
        <span class="sp"></span><button data-rec="${esc(x.block)}">🎙️ ${has ? "Regravar" : "Gravar"}</button>
        ${has ? `<button class="ghost" data-play="${esc(x.block)}">▶</button><button class="ghost" data-del="${esc(x.block)}">✕</button>` : ""}
        <label class="ghost file">⬆<input type="file" accept="audio/*" data-up="${esc(x.block)}" hidden></label></div>
        <p>${esc(x.display)}</p></div>`;
    }).join("");
    const staleMsg = (S.fullStale ? "<br><span class='warn'>⚠ O roteiro mudou depois do envio da narração única: envie o áudio novo.</span>" : "") + ((S.staleBlocks || []).length ? `<br><span class='warn'>⚠ Texto mudou nos blocos: ${S.staleBlocks.map(esc).join(", ")}. Grave esses blocos de novo.</span>` : "");
    $("#voice-state").innerHTML = (S.voice ? `Narração em uso: <b>${esc(S.voiceMode)}</b> · ${(S.voice.length / SR).toFixed(1)} s · tempos: ${esc(S.timing.source)}` : `Sem narração ainda: a prévia usa <b>tempos estimados</b> (${S.duration.toFixed(1)} s).`) + staleMsg;
    $("#full-state").innerHTML = S.fullBlob ? `Arquivo único carregado (${(S.fullBlob.size / 1024 / 1024).toFixed(1)} MB). <button class="link" id="del-full">remover</button>` : "";
    const df = $("#del-full"); if (df) df.onclick = async () => { await DB.del(key("voz:unica")); await voiceChanged(); };
  }
  const offOf = (c) => { const v = S.offsets[c]; return v == null ? 0 : typeof v === "number" ? v : v.d; };
  const setOff = (c, d) => { const w = S.built && S.built.words.find((x) => x.cues.includes(c)); S.offsets[c] = { d: +d.toFixed(3), w: w ? w.display : "" }; };
  function renderCues() {
    const box = $("#cue-list"); if (!box || !S.built) return;
    const rows = Object.entries(S.built.C).filter(([c]) => c !== "hook" && c !== "end").sort((a, b) => a[1] - b[1]);
    const word = (c) => S.built.words.find((w) => w.cues.includes(c));
    box.innerHTML = rows.map(([c, t]) => { const off = offOf(c); const w = word(c); return `<div class="cue"><button class="ghost" data-go="${t}">▶</button><b>${esc(c)}</b><span class="mut">“${esc(w ? w.display : "")}”</span><span class="sp"></span><span class="tt">${t.toFixed(2)} s${off ? ` <i>(${off > 0 ? "+" : ""}${off.toFixed(2)})</i>` : ""}</span><button class="ghost" data-nudge="${esc(c)}" data-d="-0.05">−</button><button class="ghost" data-nudge="${esc(c)}" data-d="0.05">+</button></div>`; }).join("") || "<p class='mut'>O roteiro não tem marcas [[...]].</p>";
  }
  function renderSoundReport() {
    const box = $("#sfx-report"); if (!box) return;
    const r = S.mixReport;
    if (!r) { box.innerHTML = `<p class="mut">${S.sfx.length} efeitos no projeto. O relatório aparece depois de tocar ou exportar.</p>`; return; }
    const bad = r.events.filter((e) => e.diffDb != null && (e.diffDb > -3 || e.diffDb < -12));
    box.innerHTML = `<p>Loudness final <b>${r.finalLufs} LUFS</b> (meta -14) · pico ${r.peakDb} dBFS · ${r.events.length} efeitos.</p>` +
      (bad.length ? `<p class="warn">Efeitos fora da faixa (3–12 dB abaixo da voz): ${bad.map((e) => `${esc(e.name)} em ${e.t}s (${e.diffDb} dB)`).join(", ")}</p>` : "<p class='ok'>Todos os efeitos estão abaixo da voz.</p>");
  }
  function renderPublish() {
    const box = $("#publish"); if (!box) return;
    const md = S.project.publish || "";
    const sections = md.split(/\n(?=##\s)/).map((s) => { const m = s.match(/^##\s*(.+)\n([\s\S]*)$/); return m ? { title: m[1].trim(), body: m[2].trim() } : { title: "Texto", body: s.trim() }; }).filter((s) => s.body);
    box.innerHTML = sections.length ? sections.map((s, i) => `<div class="pub"><div class="nb-h"><b>${esc(s.title)}</b><span class="sp"></span><button class="ghost" data-copy="${i}">Copiar</button></div><pre>${esc(s.body)}</pre></div>`).join("") : "<p class='mut'>O projeto não tem texto de publicação.</p>";
    $$("[data-copy]", box).forEach((b) => (b.onclick = () => copy(sections[+b.dataset.copy].body)));
  }
  async function copy(text) { try { await navigator.clipboard.writeText(text); toast("Copiado."); } catch { toast("Não consegui copiar; selecione e copie à mão.", true); } }
  function reportText() {
    const r = {
      projeto: S.project.slug, titulo: S.project.title, versaoApi: BQ.API_VERSION, duracao: S.duration, tempos: S.built.source, narracao: S.voiceMode || "nenhuma",
      marcas: S.built.C, blocos: S.built.B, ajustesManuais: S.offsets, ajustesDescartados: S.droppedOffsets || [], blocosDesatualizados: S.staleBlocks || [], problemas: S.problems, mixagem: S.mixReport ? { finalLufs: S.mixReport.finalLufs, pico: S.mixReport.peakDb, efeitos: S.mixReport.events } : "ainda não calculada",
      exportacoes: S.exports || [], navegador: navigator.userAgent,
    };
    return "Relatório do estúdio (cole no chat do Claude):\n```json\n" + JSON.stringify(r, null, 1) + "\n```";
  }

  // ---------- reprodução ----------
  let actx = null, src = null, t0 = 0, raf = 0;
  async function play() {
    if (S.playing) return pause();
    const m = await mixed();
    actx = actx || new AudioContext({ sampleRate: SR });
    if (actx.state === "suspended") await actx.resume();
    src = actx.createBufferSource(); src.buffer = toAudioBuffer(m.data); src.connect(actx.destination);
    const from = S.t >= S.duration - 0.05 ? 0 : S.t;
    t0 = actx.currentTime + 0.05 - from; src.start(actx.currentTime + 0.05, from);
    S.playing = true; $("#play").textContent = "⏸";
    const loop = () => { if (!S.playing) return; const t = actx.currentTime - t0; if (t >= S.duration) { pause(); seek(S.duration); return; } S.t = Math.max(0, t); frame(S.t); updateTransport(); raf = requestAnimationFrame(loop); };
    loop();
  }
  function pause() { S.playing = false; cancelAnimationFrame(raf); try { src && src.stop(); } catch {} $("#play").textContent = "▶"; }

  // ---------- exportação ----------
  function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 120000); }
  async function pickVideo() {
    const cands = [["avc1.64002A", "prefer-hardware"], ["avc1.64002A", "prefer-software"], ["avc1.4D402A", "no-preference"], ["avc1.42E02A", "no-preference"]];
    for (const [codec, hw] of cands) { const s = await VideoEncoder.isConfigSupported({ codec, width: W, height: H, bitrate: 10e6, framerate: FPS, hardwareAcceleration: hw, avc: { format: "avc" } }).catch(() => ({ supported: false })); if (s.supported) return { codec, hw }; }
    return null;
  }
  async function pickAudio() {
    for (const [codec, br] of [["aac", 256e3], ["aac", 192e3], ["aac", 160e3], ["aac", 128e3], ["opus", 192e3]]) if (await MB.canEncodeAudio(codec, { numberOfChannels: 2, sampleRate: SR, bitrate: br })) return { codec, br };
    return null;
  }
  let cancelExport = false;
  async function exportMp4({ seconds, auto = true } = {}) {
    if (S.exporting) return;
    pause(); S.exporting = true; cancelExport = false;
    const info = { at: new Date().toISOString().slice(0, 19), seconds: seconds ?? S.duration };
    const prog = $("#exp-prog"), lbl = $("#exp-label");
    $("#exp-btn").disabled = true; $("#exp-cancel").hidden = false;
    let lock = null;
    try {
      try { lock = await navigator.wakeLock?.request("screen"); } catch {}
      const v = await pickVideo(); if (!v) throw new Error("Este navegador não exporta H.264. Use o Google Chrome ou o Microsoft Edge atualizados no computador.");
      const a = await pickAudio();
      info.video = v.codec; info.audio = a ? `${a.codec} ${a.br / 1000}k` : "sem áudio";
      lbl.textContent = "Preparando o áudio…";
      const m = await mixed();
      const dur = Math.min(info.seconds, S.duration);
      const output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: "in-memory" }), target: new MB.BufferTarget() });
      const vcfg = { codec: "avc", fullCodecString: v.codec, bitrate: 10e6, keyFrameInterval: 2, hardwareAcceleration: v.hw, latencyMode: "quality" };
      // marca a cor como bt709 (padrão de vídeo); se não der, usa a fonte de canvas padrão
      let vsrc, useSample = true;
      try { vsrc = new MB.VideoSampleSource(vcfg); } catch { useSample = false; vsrc = new MB.CanvasSource(out, vcfg); }
      output.addVideoTrack(vsrc, { frameRate: FPS });
      let asrc = null;
      if (a) { asrc = new MB.AudioBufferSource({ codec: a.codec, bitrate: a.br }); output.addAudioTrack(asrc); }
      await output.start();
      if (asrc) { const n = Math.ceil(dur * SR); await asrc.add(toAudioBuffer(m.data.subarray(0, n))); }
      const n = Math.round(dur * FPS), t0m = performance.now();
      for (let i = 0; i < n; i++) {
        if (cancelExport) throw new Error("cancelado");
        const t = i / FPS;
        frame(t);
        if (useSample) {
          const sample = new MB.VideoSample(out, { timestamp: t, duration: 1 / FPS, colorSpace: { primaries: "bt709", transfer: "bt709", matrix: "bt709", fullRange: false } });
          await vsrc.add(sample); sample.close();
        } else await vsrc.add(t, 1 / FPS);
        if (i % 10 === 0) {
          const el = (performance.now() - t0m) / 1000, eta = (el / (i + 1)) * (n - i - 1);
          prog.value = i / n; lbl.textContent = `Exportando ${Math.round((i / n) * 100)}% · faltam ~${Math.ceil(eta)} s (não minimize esta aba)`;
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      await output.finalize();
      const buf = output.target.buffer;
      info.ms = Math.round(performance.now() - t0m); info.mb = +(buf.byteLength / 1048576).toFixed(1); info.realtime = +((info.ms / 1000) / dur).toFixed(2);
      prog.value = 1; lbl.textContent = `Pronto: ${info.mb} MB em ${Math.round(info.ms / 1000)} s.`;
      if (auto) download(new Blob([buf], { type: "video/mp4" }), `${S.project.slug}.mp4`);
      S.lastExport = buf;
      (S.exports ||= []).push(info);
      toast("MP4 exportado. Confira na pasta Downloads.");
    } catch (e) {
      info.error = String(e && e.message || e); (S.exports ||= []).push(info);
      lbl.textContent = e.message === "cancelado" ? "Exportação cancelada." : `Erro: ${e.message}`;
      if (e.message !== "cancelado") problem("erro", `Exportação: ${e.message}`, e.stack);
    } finally {
      try { lock && lock.release(); } catch {}
      S.exporting = false; $("#exp-btn").disabled = false; $("#exp-cancel").hidden = true;
      seek(S.t);
    }
    return info;
  }
  function coverTime() { const c = S.project.cover || {}; const base = c.cue && c.cue in S.built.C ? S.built.C[c.cue] : 0; return U.clamp(base + (c.dt ?? 0.6), 0, S.duration); }
  function exportCover() { frame(coverTime(), { captions: false }); out.toBlob((b) => download(b, `${S.project.slug}-capa.jpg`), "image/jpeg", 0.92); seek(S.t); }
  /** Folha de contato: 16 quadros nos momentos-chave, com tempo e marca. */
  function contactTimes() {
    const cues = Object.entries(S.built.C).filter(([c]) => c !== "end").sort((a, b) => a[1] - b[1]);
    const blocks = Object.entries(S.built.B).map(([n, b]) => [`#${n}`, b.start + 0.4]);
    let pts = [...blocks, ...cues.map(([c, t]) => [c, t + 0.35])].sort((a, b) => a[1] - b[1]);
    const out16 = [];
    for (let i = 0; i < 16; i++) { const target = (i / 15) * (S.duration - 0.1); let best = pts[0]; for (const p of pts) if (Math.abs(p[1] - target) < Math.abs(best[1] - target)) best = p; out16.push(best); pts = pts.filter((p) => Math.abs(p[1] - best[1]) > 0.4); if (!pts.length) pts = [["", target]]; }
    return out16.sort((a, b) => a[1] - b[1]);
  }
  async function exportContactSheet({ auto = true } = {}) {
    const sheet = document.createElement("canvas"); sheet.width = 1080; sheet.height = 1920;
    const g = sheet.getContext("2d"); g.fillStyle = "#0b1220"; g.fillRect(0, 0, 1080, 1920);
    const times = contactTimes();
    times.forEach(([label, t], i) => {
      frame(t);
      const x = (i % 4) * 270, y = Math.floor(i / 4) * 480;
      g.drawImage(out, x + 2, y + 2, 266, 476);
      g.fillStyle = "rgba(0,0,0,0.7)"; g.fillRect(x + 2, y + 2, 266, 40);
      g.fillStyle = "#fff"; g.font = "700 22px system-ui"; g.textBaseline = "middle"; g.fillText(`${t.toFixed(1)}s ${label}`.slice(0, 22), x + 10, y + 23);
    });
    seek(S.t);
    const blob = await new Promise((r) => sheet.toBlob(r, "image/png"));
    if (auto) download(blob, `${S.project.slug}-folha-de-contato.png`);
    return blob;
  }

  // ---------- testes (usados pela automação local) ----------
  function pixelHash() { const d = ctx.getImageData(0, 0, W, H).data; let h = 2166136261; for (let i = 0; i < d.length; i += 4 * 97) { h ^= d[i] + (d[i + 1] << 8) + (d[i + 2] << 16); h = Math.imul(h, 16777619); } return h >>> 0; }
  BQ.test = {
    state: () => ({ duration: S.duration, cues: S.built && S.built.C, problems: S.problems, voice: S.voiceMode, timing: S.built && S.built.source }),
    export: (seconds) => exportMp4({ seconds, auto: true }),
    contactSheet: () => exportContactSheet({ auto: true }),
    /** Compara quadros obtidos em sequência com quadros obtidos pulando direto (prévia/folha × export). */
    determinism(times = [0.5, 1.5, 3, S.duration / 2, S.duration - 0.5]) {
      const seekHash = times.map((t) => { frame(t); return [pixelHash(), S.world.stateHash()]; });
      const seqHash = []; const targets = new Set(times.map((t) => Math.round(t * FPS)));
      const maxF = Math.max(...targets);
      for (let i = 0; i <= maxF; i += 1) { if (!targets.has(i) && i % 3) continue; frame(i / FPS); if (targets.has(i)) seqHash.push([i, pixelHash(), S.world.stateHash()]); }
      const byFrame = Object.fromEntries(seqHash.map(([i, p, s]) => [i, [p, s]]));
      const res = times.map((t, k) => { const f = Math.round(t * FPS); frame(f / FPS); const again = [pixelHash(), S.world.stateHash()]; return { t, seek: seekHash[k], seq: byFrame[f], again, ok: byFrame[f] && byFrame[f][1] === again[1] && byFrame[f][0] === again[0] }; });
      seek(S.t);
      return { ok: res.every((r) => r.ok), res };
    },
    setVoiceBlob: async (blob) => { await saveAudio("voz:unica", blob, allSpoken()); await voiceChanged(); },
  };

  // ---------- montagem da interface ----------
  function bindUI() {
    $("#play").onclick = play;
    $("#rew").onclick = () => { pause(); seek(0); };
    const tl = $("#timeline");
    const scrub = (e) => { const r = tl.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * S.duration); };
    tl.addEventListener("pointerdown", (e) => { pause(); tl.setPointerCapture(e.pointerId); scrub(e); tl.onpointermove = scrub; });
    tl.addEventListener("pointerup", () => (tl.onpointermove = null));
    window.addEventListener("keydown", (e) => {
      if (!$("#prompter").hidden || e.target.matches("input, textarea")) return;
      if (e.code === "Space") { e.preventDefault(); if (S.tapMode) tapNext(); else play(); }
      if (e.code === "ArrowRight") seek(S.t + (e.shiftKey ? 1 : 1 / FPS));
      if (e.code === "ArrowLeft") seek(S.t - (e.shiftKey ? 1 : 1 / FPS));
    });
    $$(".tabs button").forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
    document.addEventListener("click", async (e) => {
      const el = e.target.closest("button, label"); if (!el) return;
      if (el.dataset.tab && el.classList.contains("link")) showTab(el.dataset.tab);
      if (el.dataset.rec) recordBlock(el.dataset.rec);
      if (el.dataset.play) { const bl = S.blockBlobs[el.dataset.play]; if (bl) new Audio(URL.createObjectURL(bl)).play(); }
      if (el.dataset.del) { await DB.del(key(`bloco:${el.dataset.del}`)); await voiceChanged(); }
      if (el.dataset.go) { pause(); seek(+el.dataset.go); }
      if (el.dataset.nudge) { const c = el.dataset.nudge; setOff(c, offOf(c) + +el.dataset.d); LS.set(key("ajustes"), S.offsets); rebuild(); seek(S.built.C[c]); }
    });
    document.addEventListener("change", async (e) => {
      const inp = e.target;
      if (inp.dataset.up) { const f = inp.files[0]; if (f) { await saveAudio(`bloco:${inp.dataset.up}`, f, blockSpoken(inp.dataset.up)); await voiceChanged(); } }
      if (inp.id === "full-file") { const f = inp.files[0]; if (f) { await saveAudio("voz:unica", f, allSpoken()); await voiceChanged(); } }
    });
    $("#copy-display").onclick = () => copy(BQ.roteiro.scriptTexts(S.parsed).map((x) => x.display).join("\n\n"));
    $("#copy-spoken").onclick = () => copy(BQ.roteiro.scriptTexts(S.parsed).map((x) => x.spoken).join("\n\n"));
    $("#exp-btn").onclick = () => exportMp4();
    $("#exp-cancel").onclick = () => (cancelExport = true);
    $("#exp-cover").onclick = exportCover;
    $("#exp-sheet").onclick = () => exportContactSheet();
    $("#exp-caption").onclick = () => download(new Blob([S.project.publish || ""], { type: "text/plain" }), `${S.project.slug}-publicacao.txt`);
    $("#rep-copy").onclick = () => copy(reportText());
    $("#rep-sheet").onclick = () => exportContactSheet();
    $("#reset-offsets").onclick = () => { S.offsets = {}; LS.set(key("ajustes"), {}); rebuild(); toast("Ajustes manuais apagados."); };
    $("#tap-start").onclick = startTap;
    $("#sfx-vol").oninput = (e) => { S.project.sfxVolumeDb = +e.target.value; $("#sfx-vol-v").textContent = `${e.target.value} dB`; S.mixCache = null; };
  }
  function showTab(name) {
    $$(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
    $$(".tab").forEach((t) => (t.hidden = t.id !== `tab-${name}`));
    if (name === "relatorio") $("#rep-text").textContent = reportText();
    if (name === "sons") renderSoundReport();
  }

  // ---------- sincronia por toque ----------
  function startTap() {
    if (!S.voice) { toast("Grave ou suba a narração antes.", true); return; }
    const cues = Object.entries(S.built.C).filter(([c]) => c !== "hook" && c !== "end").sort((a, b) => a[1] - b[1]).map(([c]) => c);
    S.tapMode = { cues, i: 0, base: computeBuiltNoOffsets() };
    toast("Toque Espaço no começo de cada palavra destacada. Esc para sair.");
    pause(); seek(0); renderTap(); play();
  }
  function computeBuiltNoOffsets() { const save = S.offsets; S.offsets = {}; const b = computeBuilt(); S.offsets = save; return b; }
  function renderTap() { const el = $("#tap-next"); if (!el) return; if (!S.tapMode) { el.textContent = ""; return; } const c = S.tapMode.cues[S.tapMode.i]; const w = S.built.words.find((x) => x.cues.includes(c)); el.innerHTML = c ? `Próxima: <b>${esc(c)}</b> — “${esc(w ? w.display : "")}” (${S.tapMode.i + 1}/${S.tapMode.cues.length})` : "Pronto!"; }
  function tapNext() {
    const m = S.tapMode; const c = m.cues[m.i]; if (!c) return;
    const t = actx ? actx.currentTime - t0 : S.t;
    setOff(c, t - m.base.C[c] - 0.05);
    m.i++; renderTap();
    if (m.i >= m.cues.length) { S.tapMode = null; pause(); LS.set(key("ajustes"), S.offsets); rebuild(); toast("Sincronia por toque salva."); }
  }
  window.addEventListener("keydown", (e) => { if (e.code === "Escape" && S.tapMode) { S.tapMode = null; pause(); LS.set(key("ajustes"), S.offsets); rebuild(); renderTap(); } });

  // ---------- inicialização ----------
  BQ.boot = async function () {
    try {
      const data = JSON.parse($("#bq-project").textContent);
      S.project = data;
      document.title = `${data.title || data.slug} · Estúdio Bonequinho`;
      $("#title").textContent = data.title || data.slug;
      for (const er of [...(BQ.loadErrors || []), ...(window.__bqLoadErrors || [])]) problem("erro", `erro ao carregar o projeto: ${er}`);
      S.parsed = BQ.roteiro.parse(data.roteiro || "");
      for (const er of S.parsed.errors) problem("erro", `roteiro: ${er}`);
      for (const w of S.parsed.warnings) problem("aviso", `roteiro: ${w}`);
      if (!S.parsed.tokens.length) throw new Error("O roteiro está vazio.");
      createStage();
      await loadBrand();
      S.offsets = LS.get(key("ajustes"), {});
      bindUI();
      renderPublish();
      if (!window.isSecureContext || typeof VideoEncoder === "undefined") problem("erro", "Este navegador não consegue exportar vídeo. Abra o arquivo no Google Chrome ou no Microsoft Edge (computador).");
      let framed = false; try { framed = window.self !== window.top; } catch { framed = true; }
      if (framed) { S.inPreview = true; $("#preview-warn").hidden = false; }
      await loadVoice();
      rebuild();
      showTab("narracao");
      $("#app").classList.add("ready");
      BQ.ready = true;
    } catch (e) {
      problem("erro", e.message, e.stack);
      $("#app").classList.add("ready");
      BQ.ready = true;
    }
  };
})();
