/* Bonequinhos-Reels · lib3d.js
 * Biblioteca 3D do estúdio: ambientes, primitivas, objetos, bonequinho com IK, ações no tempo,
 * câmera por chaves, âncoras e efeitos. Portada de house/reboco-novo e ecasi/ep2-v2.
 * Tudo é função do tempo t (determinístico e "pulável"): nada guarda estado entre quadros.
 * Funciona no navegador e no Node (sem renderer) para os validadores.
 */
(function (root) {
  "use strict";
  const BQ = (root.BQ = root.BQ || {});
  const U = BQ.util;

  /**
   * Cria a cena e a biblioteca `lib` que o cena.js usa.
   * @param {{THREE:any, addons?:any, brand:any, makeCanvas:(w:number,h:number)=>any, logoTex?:any}} o
   */
  BQ.createLib3D = function (o) {
    const { THREE, brand } = o;
    const makeCanvas = o.makeCanvas;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, BQ.W / BQ.H, 0.05, 300);
    const actors = [], fxs = [], anchors = new Map(), disposables = [];
    let camKeys = null, userUpdate = null;
    const V = (a) => (a && a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));
    const tmpV = new THREE.Vector3();

    // ---------- materiais e texturas ----------
    const track = (x) => { disposables.push(x); return x; };
    const mat = (color, extra = {}) => track(new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...extra }));
    const smooth = (color, extra = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...extra }));
    const basic = (color, extra = {}) => track(new THREE.MeshBasicMaterial({ color, ...extra }));
    function canvasTex(w, h, draw, rep = [1, 1]) {
      const cv = makeCanvas(w, h);
      draw(cv.getContext("2d"), w, h);
      const tx = track(new THREE.CanvasTexture(cv));
      tx.colorSpace = THREE.SRGBColorSpace;
      tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
      tx.repeat.set(rep[0], rep[1]);
      tx.anisotropy = 4;
      return tx;
    }
    const fontOf = (kind) => (kind === "text" ? brand.fonts.text : brand.fonts.display);
    function textTex(lines, { bg = "#ffffff", fg = "#0b1220", w = 512, h = 256, size = 96, weight = 800, font = "display" } = {}) {
      lines = Array.isArray(lines) ? lines : String(lines).split("\n");
      return canvasTex(w, h, (g) => {
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `${weight} ${size}px ${fontOf(font)}`;
        lines.forEach((ln, i) => g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.05));
      });
    }
    const H = U.hash;
    const TEX = {};
    const tex = (name) => {
      if (TEX[name]) return TEX[name];
      const make = {
        grass: () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#86b85a"; g.fillRect(0, 0, w, h); for (let i = 0; i < 1800; i++) { const v = H(i * 1.7); g.fillStyle = v > 0.5 ? "rgba(110,160,70,0.6)" : "rgba(150,195,95,0.55)"; g.fillRect(H(i + 0.2) * w, H(i + 0.5) * h, 2, 4 + v * 5); } }, [14, 14]),
        concrete: () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#cfcac0"; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const v = 170 + H(i) * 60; g.fillStyle = `rgba(${v},${v - 4},${v - 10},0.5)`; g.fillRect(H(i + 0.3) * w, H(i + 0.6) * h, 2, 2); } g.strokeStyle = "rgba(90,85,75,0.3)"; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); } }, [10, 10]),
        wood: () => canvasTex(512, 512, (g, w, h) => { g.fillStyle = "#8a5f3c"; g.fillRect(0, 0, w, h); const pw = 64; for (let c = 0; c < w / pw; c++) for (let r = -1; r < 4; r++) { const v = H(c * 7 + r * 3 + 11); g.fillStyle = `rgb(${168 + v * 30},${120 + v * 22},${78 + v * 14})`; const off = (c % 2) * 64; g.fillRect(c * pw, r * 128 + off, pw - 2, 126); g.fillStyle = "rgba(90,55,30,0.18)"; for (let k = 0; k < 6; k++) g.fillRect(c * pw + 6 + H(c + k + r) * 50, r * 128 + off, 1.5, 126); } }, [4, 4]),
        tile: () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#cfd4d8"; g.fillRect(0, 0, w, h); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const v = H(r * 5 + c); g.fillStyle = `rgb(${232 + v * 14},${234 + v * 12},${236 + v * 10})`; g.fillRect(c * 64 + 2, r * 64 + 2, 60, 60); } }, [6, 6]),
        wallTile: () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#b9c6cf"; g.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { const v = H(r * 3 + c * 11); g.fillStyle = `rgb(${224 + v * 18},${236 + v * 12},${242 + v * 8})`; g.fillRect(c * 64 + 2, r * 32 + 2, 60, 28); } }, [5, 3]),
        plaster: () => canvasTex(512, 256, (g, w, h) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h); for (let i = 0; i < 2200; i++) { const v = 225 + Math.floor(H(i) * 30); g.fillStyle = `rgb(${v},${v},${v - 3})`; g.fillRect(H(i + 0.3) * w, H(i + 0.7) * h, 1 + H(i + 0.9) * 3, 1 + H(i + 0.1) * 3); } }, [3, 2]),
        brick: () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#d9c9b0"; g.fillRect(0, 0, w, h); const bh = 32; for (let r = 0; r < h / bh; r++) { const off = r % 2 ? 0 : 32; for (let c = -1; c < w / 64 + 1; c++) { const v = H(r * 31 + c); g.fillStyle = `rgb(${190 + v * 30},${92 + v * 25},${58 + v * 15})`; g.fillRect(c * 64 + off + 3, r * bh + 3, 58, bh - 6); } } }, [4, 3]),
        asphalt: () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#4b5058"; g.fillRect(0, 0, w, h); for (let i = 0; i < 1400; i++) { const v = 60 + H(i) * 40; g.fillStyle = `rgba(${v},${v + 3},${v + 8},0.6)`; g.fillRect(H(i + 0.4) * w, H(i + 0.8) * h, 2, 2); } }, [8, 2]),
      }[name];
      if (!make) throw new Error(`textura "${name}" não existe (grass, concrete, wood, tile, wallTile, plaster, brick, asphalt)`);
      return (TEX[name] = make());
    };

    // ---------- primitivas ----------
    const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
    const asMat = (c, flat = true) => (c && c.isMaterial ? c : flat ? mat(c ?? "#cccccc") : smooth(c ?? "#cccccc"));
    const prim = {
      box: (w, h, d, color, { round = 0 } = {}) => shadowed(new THREE.Mesh(round > 0 && o.addons ? new o.addons.RoundedBoxGeometry(w, h, d, 3, round) : new THREE.BoxGeometry(w, h, d), asMat(color))),
      cyl: (r, h, color, seg = 18, r2 = r) => shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, seg), asMat(color, false))),
      sph: (r, color, seg = 18) => shadowed(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.75))), asMat(color, false))),
      cone: (r, h, color, seg = 18) => shadowed(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), asMat(color, false))),
      torus: (r, tube, color, arc = Math.PI * 2) => shadowed(new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 24, arc), asMat(color, false))),
      plane: (w, h, color) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), asMat(color)); m.receiveShadow = true; return m; },
      /** Placa com texto (ex.: rótulo de lata, aviso na parede). */
      label: (text, { w = 0.6, h = 0.3, bg = "#ffffff", fg = "#0b1220", size, weight = 800 } = {}) => {
        const px = 512, py = Math.round((512 * h) / w);
        const t = textTex(text, { bg, fg, w: px, h: py, size: size || Math.round(py * 0.42), weight });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), smooth("#ffffff", { map: t }));
        return m;
      },
      group: (...children) => { const g = new THREE.Group(); children.forEach((c) => c && g.add(c)); return g; },
    };
    const at = (obj, x, y, z) => { obj.position.set(x, y, z); return obj; };
    /** Posiciona/gira/escala um objeto e devolve o próprio objeto: lib.put(obj, [x,y,z], [rx,ry,rz] em graus, escala). */
    const put = (obj, pos, rotDeg, scale) => {
      if (pos) obj.position.set(pos[0], pos[1], pos[2]);
      if (rotDeg) obj.rotation.set(U.deg(rotDeg[0] || 0), U.deg(rotDeg[1] || 0), U.deg(rotDeg[2] || 0));
      if (scale != null) Array.isArray(scale) ? obj.scale.set(scale[0], scale[1], scale[2]) : obj.scale.setScalar(scale);
      return obj;
    };

    // ---------- palco: céu, luzes, neblina ----------
    const SKY = {
      day: { top: "#5fa8e8", bottom: "#e8f3fb", sun: "#fff1dc", sunI: 2.6, hemiSky: "#dbeeff", hemiGround: "#8aa36a", hemiI: 1.25, fog: "#dcecf8" },
      sunset: { top: "#3b5fa8", bottom: "#f6b78c", sun: "#ffc58a", sunI: 2.2, hemiSky: "#f2d2c0", hemiGround: "#6b5a4a", hemiI: 1.0, fog: "#f0cdb4" },
      night: { top: "#0b1430", bottom: "#24345e", sun: "#a8bfff", sunI: 0.7, hemiSky: "#4a5a8a", hemiGround: "#1d2433", hemiI: 0.55, fog: "#1b2442" },
      studio: { top: "#e9edf2", bottom: "#f7f8fa", sun: "#ffffff", sunI: 2.2, hemiSky: "#ffffff", hemiGround: "#c9ced6", hemiI: 1.3, fog: "#eef1f5" },
    };
    const lights = {};
    function setupSky(kind = "day", { fog = true } = {}) {
      const s = SKY[kind] || SKY.day;
      const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), track(new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new THREE.Color(s.top) }, bottom: { value: new THREE.Color(s.bottom) } },
        vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+0.12,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.8)),1.0); }",
      })));
      sky.name = "ceu";
      scene.add(sky);
      lights.hemi = new THREE.HemisphereLight(s.hemiSky, s.hemiGround, s.hemiI);
      lights.sun = new THREE.DirectionalLight(s.sun, s.sunI);
      lights.sun.position.set(6, 12, 8);
      lights.sun.castShadow = true;
      lights.sun.shadow.mapSize.set(2048, 2048);
      Object.assign(lights.sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 45 });
      lights.sun.shadow.bias = -0.0005;
      lights.sun.shadow.radius = 4;
      scene.add(lights.hemi, lights.sun, lights.sun.target);
      if (fog) scene.fog = new THREE.Fog(s.fog, 24, 70);
      return s;
    }

    // ---------- âncoras ----------
    function resolve(target) {
      if (target == null) return null;
      if (typeof target === "string") {
        if (!anchors.has(target)) throw new Error(`âncora "${target}" não existe. Crie com lib.anchor("${target}", [x,y,z]). Existentes: ${[...anchors.keys()].join(", ") || "(nenhuma)"}`);
        return resolve(anchors.get(target));
      }
      if (typeof target === "function") return resolve(target());
      if (target.isObject3D) { target.updateWorldMatrix(true, false); return target.getWorldPosition(new THREE.Vector3()); }
      if (target.isVector3) return target.clone();
      if (Array.isArray(target)) return new THREE.Vector3(target[0], target[1], target[2]);
      throw new Error("alvo inválido: use [x,y,z], nome de âncora, objeto 3D ou função");
    }

    // ---------- objetos prontos ----------
    function withAnchors(g, list) { g.userData.anchors = list; g.at = (name = "top") => { const p = list[name]; if (!p) throw new Error(`ponto "${name}" não existe neste objeto (${Object.keys(list).join(", ")})`); g.updateWorldMatrix(true, false); return g.localToWorld(new THREE.Vector3(...p)); }; return g; }
    const OBJ = {
      table: ({ w = 1.2, d = 0.7, h = 0.76, color = "#b07b4f" } = {}) => {
        const g = prim.group(at(prim.box(w, 0.05, d, color, { round: 0.015 }), 0, h - 0.025, 0));
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(at(prim.box(0.05, h - 0.05, 0.05, color), x * (w / 2 - 0.06), (h - 0.05) / 2, z * (d / 2 - 0.06)));
        return withAnchors(g, { top: [0, h, 0], front: [0, h, d / 2] });
      },
      chair: ({ color = "#3a5a8c" } = {}) => {
        const g = prim.group(at(prim.box(0.45, 0.05, 0.45, color, { round: 0.01 }), 0, 0.45, 0), at(prim.box(0.45, 0.45, 0.05, color, { round: 0.01 }), 0, 0.7, -0.2));
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(at(prim.box(0.04, 0.45, 0.04, "#2b2f36"), x * 0.19, 0.225, z * 0.19));
        return withAnchors(g, { seat: [0, 0.47, 0], top: [0, 0.95, -0.2] });
      },
      plant: ({ pot = "#c4693f", leaf = "#5f9e4a", h = 0.6, leaves = 9 } = {}) => {
        const g = prim.group(at(prim.cyl(0.15, 0.26, pot, 18, 0.11), 0, 0.13, 0), at(prim.cyl(0.14, 0.02, "#5a3a22"), 0, 0.25, 0));
        const leafMat = smooth(leaf), stemMat = smooth("#4d7a33");
        const crown = new THREE.Group(); crown.position.y = 0.26; crown.name = "copa"; g.add(crown);
        for (let i = 0; i < leaves; i++) {
          const a = i * 2.39996, lift = 0.35 + 0.65 * ((i * 0.618) % 1), len = h * (0.55 + 0.45 * lift);
          const stem = new THREE.Group(); stem.rotation.set(0.35 + 0.5 * (1 - lift), a, 0); crown.add(stem);
          const st = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, len, 6), stemMat)); st.position.y = len / 2; stem.add(st);
          const lf = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), leafMat)); lf.scale.set(0.55, 1.5, 0.22); lf.position.set(0, len + 0.06, 0); stem.add(lf);
        }
        return withAnchors(g, { top: [0, 0.26 + h * 0.95, 0], leaf: [0.08, 0.26 + h * 0.7, 0.08], soil: [0, 0.26, 0], pot: [0, 0.15, 0.15] });
      },
      bucket: ({ color = "#2f6fd6" } = {}) => {
        const g = prim.group(at(prim.cyl(0.17, 0.32, color, 18, 0.14), 0, 0.16, 0), at(prim.torus(0.15, 0.008, "#2b2f36", Math.PI), 0, 0.32, 0));
        return withAnchors(g, { top: [0, 0.32, 0], handle: [0, 0.47, 0] });
      },
      crate: ({ s = 0.5, color = "#c8a46a" } = {}) => withAnchors(prim.group(at(prim.box(s, s, s, color, { round: 0.02 }), 0, s / 2, 0)), { top: [0, s, 0], front: [0, s / 2, s / 2] }),
      sign: ({ text = "AVISO", w = 0.9, h = 0.5, bg = "#facc15", fg = "#0b1220", post = true } = {}) => {
        const g = prim.group();
        const l = prim.label(text, { w, h, bg, fg }); l.position.set(0, post ? 1.4 : 0, 0.03); g.add(l);
        g.add(at(prim.box(w + 0.06, h + 0.06, 0.04, "#2b2f36"), 0, post ? 1.4 : 0, 0));
        if (post) g.add(at(prim.cyl(0.03, 1.2, "#8a939f", 8), 0, 0.6, -0.03));
        return withAnchors(g, { center: [0, post ? 1.4 : 0, 0.04] });
      },
      door: ({ color = "#8b5a34", w = 0.9, h = 2.1 } = {}) => withAnchors(prim.group(at(prim.box(w, h, 0.06, color, { round: 0.01 }), 0, h / 2, 0), at(prim.sph(0.035, "#d4af37"), w * 0.38, h * 0.48, 0.05)), { handle: [w * 0.38, h * 0.48, 0.06], center: [0, h / 2, 0.04] }),
      shelf: ({ w = 1.0, h = 1.6, color = "#f2efe9" } = {}) => {
        const g = prim.group();
        for (let i = 0; i < 4; i++) g.add(at(prim.box(w, 0.03, 0.32, color), 0, 0.05 + i * (h / 3.2), 0));
        g.add(at(prim.box(0.03, h, 0.32, color), -w / 2, h / 2, 0), at(prim.box(0.03, h, 0.32, color), w / 2, h / 2, 0));
        return withAnchors(g, { top: [0, h, 0], middle: [0, h / 2, 0.16] });
      },
      tree: ({ h = 3, leaf = "#5f9e4a" } = {}) => {
        const g = prim.group(at(prim.cyl(0.12, h * 0.45, "#7a5232", 8, 0.16), 0, h * 0.22, 0));
        for (let i = 0; i < 4; i++) { const s = prim.sph(0.6 + H(i + 9) * 0.35, leaf, 8); s.position.set(Math.sin(i * 1.9) * 0.35, h * 0.55 + H(i) * 0.6, Math.cos(i * 1.9) * 0.35); g.add(s); }
        return withAnchors(g, { top: [0, h, 0] });
      },
    };
    function obj(kind, opts) {
      if (!OBJ[kind]) throw new Error(`objeto "${kind}" não existe. Disponíveis: ${Object.keys(OBJ).join(", ")}. Para algo novo, monte com lib.prim (box, cyl, sph, cone, torus, plane, label).`);
      const OPTS = { table: ["w", "d", "h", "color"], chair: ["color"], plant: ["pot", "leaf", "h", "leaves"], bucket: ["color"], crate: ["s", "color"], sign: ["text", "w", "h", "bg", "fg", "post"], door: ["color", "w", "h"], shelf: ["w", "h", "color"], tree: ["h", "leaf"] };
      BQ.checkOpts(`lib.obj("${kind}")`, opts, OPTS[kind]);
      return OBJ[kind](opts || {});
    }

    // ---------- ambientes ----------
    const env = {
      /** Área externa: céu, chão de grama/concreto, opcional muro, árvores e rua. */
      outdoor(op = {}) {
        BQ.checkOpts("lib.env.outdoor", op, ["sky", "ground", "wall", "trees", "street", "fog"]);
        const { sky = "day", ground = "grass", wall = null, trees = 3, street = false, fog = true } = op;
        setupSky(sky, { fog });
        const g = new THREE.Group(); g.name = "ambiente";
        const gr = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat("#ffffff", { map: tex(ground) }));
        gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true; g.add(gr);
        if (street) { const s = prim.box(40, 0.02, 6, mat("#ffffff", { map: tex("asphalt") })); s.position.set(0, 0.01, 7); g.add(s); }
        if (wall) { const w = { w: 5, h: 2.8, color: "#e9e6df", z: -1.5, ...(wall === true ? {} : wall) }; const m = prim.box(w.w, w.h, 0.22, mat(w.color, { map: tex("plaster") })); m.position.set(0, w.h / 2, w.z); m.name = "muro"; g.add(m); }
        for (let i = 0; i < trees; i++) { const t = obj("tree", { h: 2.6 + H(i + 4) * 1.2 }); t.position.set((i % 2 ? 1 : -1) * (4 + i * 1.6), 0, -4 - H(i) * 4); g.add(t); }
        scene.add(g);
        return withAnchors(g, { center: [0, 0, 0], wall: [0, 1.4, (wall && wall.z) || -1.39] });
      },
      /** Cômodo com chão, parede do fundo, parede lateral e janela. Visto de frente (câmera em +Z). */
      room(op = {}) {
        BQ.checkOpts("lib.env.room", op, ["kind", "w", "d", "h", "wall", "floor", "window"]);
        const { kind = "sala", w = 6, d = 5, h = 2.8, wall, floor, window: win = true } = op;
        const P = {
          sala: { wall: "#e6dccb", floor: "wood" }, quarto: { wall: "#dce6ee", floor: "wood" }, escritorio: { wall: "#e2e6ea", floor: "wood" },
          cozinha: { wall: "wallTile", floor: "tile" }, banheiro: { wall: "wallTile", floor: "tile" }, lavanderia: { wall: "wallTile", floor: "tile" },
          neutro: { wall: "#e4e7eb", floor: "concrete" },
        }[kind];
        if (!P) throw new Error(`cômodo "${kind}" não existe (sala, quarto, escritorio, cozinha, banheiro, lavanderia, neutro)`);
        setupSky("studio", { fog: false });
        lights.hemi.intensity = 0.85; lights.sun.intensity = 1.25; lights.sun.position.set(3, 6, 6);
        const g = new THREE.Group(); g.name = "comodo";
        const wallSpec = wall || P.wall, floorSpec = floor || P.floor;
        const wallMat = wallSpec.startsWith("#") ? mat(wallSpec, { map: tex("plaster") }) : mat("#ffffff", { map: tex(wallSpec) });
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat("#ffffff", { map: tex(floorSpec) }));
        fl.rotation.x = -Math.PI / 2; fl.position.z = -d / 2 + 1; fl.receiveShadow = true; g.add(fl);
        const back = prim.box(w, h, 0.12, wallMat); back.position.set(0, h / 2, -d + 1); g.add(back);
        const left = prim.box(0.12, h, d, wallMat); left.position.set(-w / 2, h / 2, -d / 2 + 1); g.add(left);
        const base = prim.box(w, 0.1, 0.03, "#ffffff"); base.position.set(0, 0.05, -d + 1.075); g.add(base);
        if (win) {
          const wx = w * 0.18, wy = 1.55, wz = -d + 1.07;
          const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.0), basic("#cfe8fb")); glass.position.set(wx, wy, wz); g.add(glass);
          for (const [sx, sy, bw, bh] of [[0, 0.52, 1.42, 0.06], [0, -0.52, 1.42, 0.06], [-0.68, 0, 0.06, 1.1], [0.68, 0, 0.06, 1.1], [0, 0, 0.04, 1.0]]) g.add(at(prim.box(bw, bh, 0.06, "#ffffff"), wx + sx, wy + sy, wz + 0.02));
        }
        const lamp = new THREE.PointLight("#fff3e0", 5, 9, 1.6); lamp.position.set(0.5, h - 0.25, -d / 2 + 1); g.add(lamp);
        scene.add(g);
        return withAnchors(g, { center: [0, 0, -d / 2 + 1], backWall: [0, 1.4, -d + 1.07], leftWall: [-w / 2 + 0.07, 1.4, -d / 2 + 1], floor: [0, 0, 0], window: [w * 0.18, 1.55, -d + 1.08] });
      },
    };

    // ---------- bonequinho (porte de R makePerson 756-904 + roupas de E) ----------
    const SKINS = ["#f1c7a5", "#e0a882", "#c68a62", "#a86d47", "#7d4e32", "#5b3622"];
    const HAIR = ["#2b1d14", "#4a2f1c", "#7a4b24", "#c49a5a", "#1b1b1f", "#8a8f99"];
    function person(opts = {}) {
      BQ.checkOpts("lib.person", opts, ["skin", "shirt", "pants", "shoes", "outfit", "head", "hair", "capColor", "glasses", "beard", "vest", "gloves", "logo", "logoTex", "belt", "seed", "name"]);
      const seed = opts.seed ?? 1;
      const skinC = typeof opts.skin === "string" ? opts.skin : SKINS[U.clamp(opts.skin ?? 1, 0, 5) | 0];
      const SKIN = smooth(skinC);
      const shirtC = opts.shirt ?? "#e76f51", pantsC = opts.pants ?? "#3a5a8c", shoesC = opts.shoes ?? "#2b2f36";
      const outfit = opts.outfit ?? "tee-pants"; // tee-pants | tee-shorts | longsleeve | overall | coat
      const head = opts.head ?? "hair"; // hair | cap | helmet | hardhat | bun | long | bald
      const shirt = smooth(shirtC), pants = smooth(pantsC), shoes = smooth(shoesC);
      const g = new THREE.Group(), hips = new THREE.Group();
      hips.position.y = 0.92; g.add(hips);
      const cap = (r, len, m) => shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), m));
      const legs = [];
      for (const s of [-1, 1]) {
        const thigh = new THREE.Group(); thigh.position.set(s * 0.1, 0, 0);
        const th = cap(0.07, 0.3, pants); th.position.y = -0.22; thigh.add(th);
        const knee = new THREE.Group(); knee.position.y = -0.45;
        const sh = cap(0.058, 0.3, outfit === "tee-shorts" ? SKIN : pants); sh.position.y = -0.2; knee.add(sh);
        if (outfit === "tee-shorts") { const cuff = prim.cyl(0.075, 0.08, pants, 12); knee.add(cuff); }
        const foot = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.14, 4, 10), shoes));
        foot.rotation.x = Math.PI / 2; foot.position.set(0, -0.43, 0.05); knee.add(foot);
        thigh.add(knee); hips.add(thigh); legs.push({ thigh, knee });
      }
      const torso = cap(0.17, 0.3, outfit === "overall" ? pants : shirt); torso.scale.set(1.18, 1, 0.78); torso.position.y = 0.32; hips.add(torso);
      if (outfit === "overall") { const bib = prim.box(0.26, 0.2, 0.02, shirt); bib.position.set(0, 0.42, 0.135); hips.add(bib); }
      if (outfit === "coat") { const coat = cap(0.18, 0.42, smooth("#f8f8f6")); coat.scale.set(1.2, 1, 0.82); coat.position.y = 0.26; hips.add(coat); }
      const belt = prim.cyl(0.19, 0.06, smooth(opts.belt ?? "#2b2f36"), 16); belt.scale.set(1.05, 1, 0.75); belt.position.y = 0.06; hips.add(belt);
      if (opts.vest) { for (const y of [0.24, 0.4]) { const band = prim.cyl(0.205, 0.035, smooth("#d9dde3", { emissive: "#9aa3b2", emissiveIntensity: 0.25 }), 18); band.scale.set(1.2, 1, 0.8); band.position.y = y; hips.add(band); } }
      // logo (peito e costas): textura do kit de marca
      const logoTex = opts.logo === false ? null : (opts.logoTex || (opts.logo ? o.logoTex : null));
      if (logoTex) {
        const lp = (z, ry, s) => {
          const patch = new THREE.Mesh(new THREE.CircleGeometry(0.1 * s, 24), smooth("#ffffff")); patch.position.set(0, 0.38, z); patch.rotation.y = ry;
          const logo = new THREE.Mesh(new THREE.CircleGeometry(0.088 * s, 24), basic("#ffffff", { map: logoTex })); logo.position.set(0, 0.38, z + (z > 0 ? 0.002 : -0.002)); logo.rotation.y = ry;
          hips.add(patch, logo);
        };
        const where = typeof opts.logo === "object" ? opts.logo : { chest: true, back: true };
        if (where.chest !== false) lp(0.138, 0, 0.6);
        if (where.back !== false) lp(-0.138, Math.PI, 1.0);
      }
      const neck = prim.cyl(0.05, 0.1, SKIN, 10); neck.position.y = 0.63; hips.add(neck);
      const headG = new THREE.Group(); headG.position.y = 0.8; hips.add(headG);
      const skull = prim.sph(0.145, SKIN, 24); skull.scale.set(1, 1.08, 0.98); headG.add(skull);
      const eyeMat = smooth("#1b1b1f", { roughness: 0.3 }), eyes = [];
      const hairC = opts.hair ?? HAIR[(seed * 7) % HAIR.length];
      for (const s of [-1, 1]) {
        const e = prim.sph(0.021, eyeMat, 12); e.position.set(s * 0.052, 0.015, 0.128);
        const hl = prim.sph(0.007, basic("#ffffff"), 8); hl.position.set(0.006, 0.007, 0.018); e.add(hl);
        headG.add(e); eyes.push(e);
        const brow = prim.box(0.05, 0.012, 0.012, smooth(head === "bald" ? "#3b2a1e" : hairC)); brow.position.set(s * 0.053, 0.06, 0.132); brow.rotation.z = -s * 0.12; headG.add(brow);
        const ear = prim.sph(0.03, SKIN, 10); ear.scale.set(0.6, 1, 0.8); ear.position.set(s * 0.145, 0, 0); headG.add(ear);
      }
      const nose = prim.sph(0.02, SKIN, 10); nose.position.set(0, -0.012, 0.145); headG.add(nose);
      const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 16, Math.PI), smooth("#8a3b2e")); mouth.rotation.z = Math.PI; mouth.position.set(0, -0.055, 0.128); headG.add(mouth);
      if (opts.glasses) { for (const s of [-1, 1]) { const r = prim.torus(0.03, 0.005, "#1b1b1f"); r.position.set(s * 0.052, 0.015, 0.15); headG.add(r); } }
      if (opts.beard) { const b = prim.sph(0.12, smooth(hairC), 16); b.scale.set(1, 0.7, 0.75); b.position.set(0, -0.07, 0.04); headG.add(b); headG.add(mouth); }
      const hairCap = (frac, c) => { const m = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.152, 20, 10, 0, Math.PI * 2, 0, Math.PI / frac), smooth(c))); return m; };
      if (head === "cap") {
        const cc = opts.capColor ?? shirtC;
        const top = hairCap(2, cc); top.position.y = 0.035;
        const brim = prim.cyl(0.13, 0.015, smooth(cc), 16); brim.scale.set(1, 1, 0.75); brim.position.set(0, 0.04, 0.12);
        headG.add(top, brim);
        if (opts.logo && logoTex && opts.logo.cap) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.04, 20), basic("#ffffff", { map: logoTex })); l.position.set(0, 0.11, 0.135); l.rotation.x = -0.5; headG.add(l); }
      } else if (head === "helmet" || head === "hardhat") {
        const hc = opts.capColor ?? (head === "hardhat" ? "#facc15" : "#f8f8f6");
        const top = hairCap(1.9, hc); top.scale.set(1.08, 1.05, 1.08); top.position.y = 0.04;
        const rim = prim.cyl(0.19, 0.018, smooth(hc), 20); rim.position.y = 0.045;
        headG.add(top, rim);
      } else if (head !== "bald") {
        const hair = hairCap(2.2, hairC); hair.position.y = 0.02; hair.rotation.x = -0.15; headG.add(hair);
        if (head === "bun") { const bun = prim.sph(0.07, smooth(hairC), 12); bun.position.set(0, 0.14, -0.11); headG.add(bun); }
        if (head === "long") { const back = cap(0.13, 0.18, smooth(hairC)); back.scale.set(1.05, 1, 0.55); back.position.set(0, -0.08, -0.07); headG.add(back); }
      }
      const arms = [];
      const sleeveLong = outfit === "longsleeve" || outfit === "coat";
      for (const s of [-1, 1]) {
        const shoulder = new THREE.Group(); shoulder.position.set(s * 0.235, 0.52, 0);
        const sleeve = cap(0.062, 0.1, outfit === "coat" ? smooth("#f8f8f6") : shirt); sleeve.position.y = -0.06;
        const upper = cap(0.05, 0.18, sleeveLong ? (outfit === "coat" ? smooth("#f8f8f6") : shirt) : SKIN); upper.position.y = -0.15;
        shoulder.add(upper, sleeve);
        const elbow = new THREE.Group(); elbow.position.y = -0.29;
        const fore = cap(0.045, 0.17, sleeveLong ? (outfit === "coat" ? smooth("#f8f8f6") : shirt) : SKIN); fore.position.y = -0.12; elbow.add(fore);
        const hand = new THREE.Group(); hand.position.y = -0.27;
        const handMat = opts.gloves ? smooth(opts.gloves === true ? "#e8a33d" : opts.gloves) : SKIN;
        const palm = prim.sph(0.05, handMat, 12); palm.scale.set(0.8, 1.05, 0.6);
        const thumb = cap(0.016, 0.03, handMat); thumb.position.set(-s * 0.035, 0, 0.02); thumb.rotation.z = s * 0.6;
        hand.add(palm, thumb); elbow.add(hand); shoulder.add(elbow); hips.add(shoulder);
        arms.push({ shoulder, elbow, hand, side: s });
      }
      g.userData = { hips, torso, head: headG, eyes, mouth, legs, arms, seed, isPerson: true };
      // mão direita do personagem = lado -X (ele olha para +Z)
      g.hand = (which = "R") => (which === "R" ? arms[0] : arms[1]).hand;
      g.name = opts.name || "pessoa";
      scene.add(g);
      const actor = makeActor(g);
      actors.push(actor);
      g.userData.actor = actor;
      return g;
    }

    // ---------- IK de dois ossos (R 931-966), misturando com a pose atual ----------
    const L1 = 0.29, L2 = 0.27, DOWN = new THREE.Vector3(0, -1, 0);
    const qU = new THREE.Quaternion(), qF = new THREE.Quaternion();
    function reach(who, arm, targetW, k) {
      const { shoulder, elbow, side } = arm;
      if (k <= 0.001) return;
      who.updateMatrixWorld(true);
      const T = who.userData.hips.worldToLocal(targetW.clone());
      const S = shoulder.position.clone(), v = T.clone().sub(S);
      const d = Math.min(L1 + L2 - 0.002, Math.max(0.08, v.length())), dir = v.normalize();
      const pole = new THREE.Vector3(side * 0.7, -1, -0.5).normalize();
      const n = new THREE.Vector3().crossVectors(dir, pole); if (n.lengthSq() < 1e-6) n.set(1, 0, 0); n.normalize();
      const a = Math.acos(U.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      const upperDir = dir.clone().applyAxisAngle(n, a);
      qU.setFromUnitVectors(DOWN, upperDir);
      const E = S.clone().addScaledVector(upperDir, L1), Td = S.clone().addScaledVector(dir, d);
      const foreDir = Td.sub(E).normalize().applyQuaternion(qU.clone().invert());
      qF.setFromUnitVectors(DOWN, foreDir);
      shoulder.quaternion.slerp(qU, k);
      elbow.quaternion.slerp(qF, k);
    }

    // ---------- ações no tempo ----------
    const ARM_ACTIONS = ["reach", "point", "wave", "press", "hold", "thumbsUp", "scrub", "paint"];
    const ACTIONS = ["walk", "face", "turn", ...ARM_ACTIONS, "headShake", "nod", "look", "celebrate", "shrug", "scare", "talk", "jump", "crouch"];
    function makeActor(g) {
      const A = { g, pos0: [g.position.x, g.position.z], yaw0: g.rotation.y, posKeys: null, yawKeys: null, list: [] };
      A.rebuild = () => {
        const list = A.list.slice().sort((a, b) => a[1] - b[1]);
        let p = A.pos0.slice(), yaw = A.yaw0;
        const posKeys = [[-1e9, p.slice()]], yawKeys = [[-1e9, yaw]];
        for (const [type, t0, t1, op = {}] of list) {
          if (type === "walk") {
            const to = op.to ? [op.to[0], op.to.length === 3 ? op.to[2] : op.to[1]] : p;
            const dir = Math.atan2(to[0] - p[0], to[1] - p[1]);
            posKeys.push([t0, p.slice()], [t1, to.slice()]);
            const turn = Math.min(0.3, (t1 - t0) / 3);
            yawKeys.push([t0, yaw], [t0 + turn, dir], [t1, dir]);
            p = to; yaw = dir;
            if (op.thenFace != null) { const fy = U.deg(op.thenFace); yawKeys.push([t1 + 0.35, fy]); yaw = fy; }
          } else if (type === "face" || type === "turn") {
            let target = yaw;
            if (op.yaw != null) target = U.deg(op.yaw);
            else if (op.to || op.toward) { const q = resolve(op.to || op.toward); target = Math.atan2(q.x - p[0], q.z - p[1]); }
            else if (op.camera) target = 0;
            yawKeys.push([t0, yaw], [t1, target]);
            yaw = target;
          }
        }
        A.posKeys = posKeys; A.yawKeys = yawKeys; A.sorted = list;
      };
      A.update = (t) => {
        if (!A.posKeys) A.rebuild();
        // posição e direção
        const pk = A.posKeys;
        let px = pk[0][1][0], pz = pk[0][1][1];
        for (let i = 0; i < pk.length - 1; i++) {
          const [ta, a] = pk[i], [tb, b] = pk[i + 1];
          if (t >= tb) { px = b[0]; pz = b[1]; continue; }
          if (t >= ta) { const x = tb === ta ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * (t - ta) / (tb - ta)); px = U.lerp(a[0], b[0], x); pz = U.lerp(a[1], b[1], x); }
          break;
        }
        const yk = A.yawKeys;
        let yaw = yk[0][1];
        for (let i = 0; i < yk.length - 1; i++) {
          const [ta, a] = yk[i], [tb, b] = yk[i + 1];
          if (t >= tb) { yaw = b; continue; }
          if (t >= ta) yaw = U.angLerp(a, b, U.easeInOut(tb === ta ? 1 : (t - ta) / (tb - ta)));
          break;
        }
        let y = g.userData.baseY || 0, walk = 0;
        const u = g.userData;
        for (const [type, t0, t1] of A.sorted) if (type === "walk") walk = Math.max(walk, U.window(t, t0, t1, 0.25, 0.25));
        // corpo: pernas, respiração, piscada (R animateBody)
        const seed = u.seed * 1.37;
        const ph = t * 8.5 + seed, sw = Math.sin(ph) * walk;
        u.legs.forEach((l, i) => { const s = i === 0 ? sw : -sw; l.thigh.rotation.set(0.5 * s, 0, 0); l.knee.rotation.set(walk * 0.75 * Math.max(0, Math.sin(ph + (i === 0 ? 0.9 : 0.9 + Math.PI))), 0, 0); });
        u.hips.position.y = 0.92 + 0.025 * Math.abs(Math.sin(ph)) * walk;
        u.torso.scale.y = 1 + 0.012 * Math.sin(t * 2.1 + seed);
        u.head.rotation.set(0, 0, 0.03 * Math.sin(t * 0.9 + seed));
        const bl = (t + seed * 0.37) % 3.4 < 0.13 ? 0.12 : 1;
        u.eyes.forEach((e) => (e.scale.y = bl));
        u.mouth.scale.set(1, 1, 1);
        u.hips.rotation.set(0, 0, 0);
        // braços soltos (R swingArms)
        u.arms.forEach((a, i) => {
          a.shoulder.quaternion.setFromEuler(new THREE.Euler((i === 0 ? -sw : sw) * 0.45 + 0.03 * Math.sin(t * 1.3 + i + seed), 0, a.side * 0.08));
          a.elbow.quaternion.setFromEuler(new THREE.Euler(-0.25 - 0.2 * Math.abs(sw), 0, 0));
        });
        // ações de corpo
        for (const [type, t0, t1, op = {}] of A.sorted) {
          const k = U.window(t, t0, t1, op.in ?? 0.3, op.out ?? 0.3);
          if (k <= 0) continue;
          const lt = t - t0;
          if (type === "jump" || type === "celebrate") y += Math.abs(Math.sin(lt * 7)) * 0.12 * k;
          if (type === "scare") { y += Math.max(0, Math.sin(Math.min(1, lt / 0.35) * Math.PI)) * 0.15; }
          if (type === "crouch") { u.hips.position.y -= 0.25 * k; u.legs.forEach((l) => { l.thigh.rotation.x -= 1.0 * k; l.knee.rotation.x += 1.6 * k; }); }
          if (type === "headShake") u.head.rotation.y = Math.sin(lt * 2 * Math.PI * 2.4) * 0.38 * k;
          if (type === "nod") u.head.rotation.x = Math.max(0, Math.sin(lt * 2 * Math.PI * 1.8)) * 0.28 * k;
          if (type === "talk") u.mouth.scale.set(1, 1 + 1.2 * Math.abs(Math.sin(lt * 13)) * k, 1);
          if (type === "look" && op.at) { /* resolvido depois da posição */ }
        }
        g.position.set(px, y, pz);
        g.rotation.set(0, yaw, 0);
        g.updateMatrixWorld(true);
        // olhar
        for (const [type, t0, t1, op = {}] of A.sorted) {
          if (type !== "look") continue;
          const k = U.window(t, t0, t1, 0.3, 0.3); if (k <= 0) continue;
          const q = u.head.worldToLocal(resolve(op.at || op.to));
          u.head.rotation.y += U.clamp(Math.atan2(q.x, q.z), -1.1, 1.1) * k;
          u.head.rotation.x += U.clamp(-Math.atan2(q.y, Math.hypot(q.x, q.z)), -0.5, 0.5) * k;
        }
        // braços: a ação mais forte de cada mão
        for (const [ai, arm] of u.arms.entries()) {
          const handName = ai === 0 ? "R" : "L";
          for (const [type, t0, t1, op = {}] of A.sorted) {
            const both = type === "celebrate" || type === "shrug" || type === "scare";
            if (!ARM_ACTIONS.includes(type) && !both) continue;
            if (!both && (op.hand || "R") !== handName && op.hand !== "both") continue;
            const k = U.easeInOut(U.window(t, t0, t1, op.in ?? 0.35, op.out ?? 0.35));
            if (k <= 0.001) continue;
            const lt = t - t0;
            const local = (x, yy, z) => u.hips.localToWorld(new THREE.Vector3(x, yy, z));
            let target;
            if (type === "reach" || type === "press" || type === "scrub" || type === "paint") {
              target = resolve(op.target ?? op.to);
              if (type === "press") target.add(new THREE.Vector3(0, 0, 0).setFromMatrixColumn(g.matrixWorld, 2).multiplyScalar(-0.04 * Math.max(0, Math.sin(lt * 6))));
              if (type === "scrub") target.add(new THREE.Vector3(Math.sin(lt * 14) * 0.06, Math.cos(lt * 7) * 0.03, 0));
              if (type === "paint") target.add(new THREE.Vector3(0, Math.sin(lt * 4.5) * 0.18, 0));
            } else if (type === "point") {
              const S = arm.shoulder.getWorldPosition(new THREE.Vector3());
              const tg = resolve(op.target ?? op.to);
              target = S.add(tg.sub(S).normalize().multiplyScalar(0.6));
            } else if (type === "wave") {
              target = local(arm.side * 0.42 + Math.sin(lt * 9) * 0.08, 1.12, 0.12);
            } else if (type === "thumbsUp") {
              target = local(arm.side * 0.18, 0.55, 0.42);
            } else if (type === "hold") {
              target = op.target ? resolve(op.target) : local(arm.side * 0.14, 0.28, 0.36);
            } else if (type === "celebrate") {
              target = local(arm.side * 0.32, 1.25 + Math.sin(lt * 7 + ai) * 0.05, 0.05);
            } else if (type === "shrug") {
              target = local(arm.side * 0.42, 0.42, 0.28);
            } else if (type === "scare") {
              target = local(arm.side * 0.3, 0.95, 0.3);
            }
            if (target) reach(g, arm, target, k);
          }
        }
      };
      return A;
    }
    function act(who, list) {
      const A = who && who.userData && who.userData.actor;
      if (!A) throw new Error("lib.act: o primeiro argumento precisa ser um bonequinho criado com lib.person()");
      for (const a of list) {
        if (!Array.isArray(a) || typeof a[0] !== "string") throw new Error(`lib.act: cada ação é ["tipo", início, fim, {opções}]. Recebido: ${JSON.stringify(a)}`);
        if (!ACTIONS.includes(a[0])) throw new Error(`ação "${a[0]}" não existe. Ações: ${ACTIONS.join(", ")}`);
        if (!(Number.isFinite(a[1]) && Number.isFinite(a[2]))) throw new Error(`ação "${a[0]}": início e fim precisam ser números (use marcas C.x). Recebido: ${a[1]}, ${a[2]}`);
        if (a[2] < a[1]) throw new Error(`ação "${a[0]}": fim (${a[2]}) antes do início (${a[1]})`);
        BQ.checkOpts(`lib.act "${a[0]}"`, a[3], ["to", "thenFace", "yaw", "toward", "camera", "hand", "target", "at", "in", "out"]);
        A.list.push(a);
      }
      A.posKeys = null;
      return who;
    }
    function place(objct, p, yawDeg = 0) {
      objct.position.set(p[0], p.length === 3 ? p[1] : 0, p.length === 3 ? p[2] : p[1]);
      objct.rotation.y = U.deg(yawDeg);
      const A = objct.userData && objct.userData.actor;
      if (A) { A.pos0 = [objct.position.x, objct.position.z]; A.yaw0 = objct.rotation.y; objct.userData.baseY = objct.position.y; A.posKeys = null; }
      if (!objct.parent) scene.add(objct);
      return objct;
    }
    function attach(objct, who, handName = "R") {
      const hand = who.hand ? who.hand(handName) : who;
      hand.add(objct);
      return objct;
    }

    // ---------- câmera por chaves ----------
    const DEF_DIR = [0.42, 0.14, 1];
    function camState(k) {
      const look = resolve(k.look ?? [0, 1.2, 0]);
      let dir;
      if (k.dir) dir = V(k.dir).normalize();
      else if (k.yaw != null || k.pitch != null) { const yw = U.deg(k.yaw ?? 22), pt = U.deg(k.pitch ?? 8); dir = new THREE.Vector3(Math.sin(yw) * Math.cos(pt), Math.sin(pt), Math.cos(yw) * Math.cos(pt)); }
      else dir = V(DEF_DIR).normalize();
      return { look, dir, dist: k.dist ?? 5, fov: k.fov ?? 34, roll: k.roll ?? 0 };
    }
    const camera3 = {
      keys(list) {
        if (!Array.isArray(list) || !list.length) throw new Error("lib.camera.keys precisa de uma lista de chaves [{t, look, dist, ...}]");
        for (const k of list) { if (!Number.isFinite(k.t)) throw new Error(`chave de câmera sem t numérico: ${JSON.stringify(k)}`); BQ.checkOpts("lib.camera.keys", k, ["t", "look", "dist", "yaw", "pitch", "fov", "dir", "cut", "shake", "roll"]); }
        camKeys = list.slice().sort((a, b) => a.t - b.t);
      },
      /** Atalho para um enquadramento: olhar para o alvo a uma distância. */
      shot(look, dist = 5, extra = {}) { return { look, dist, ...extra }; },
    };
    const lastLook = new THREE.Vector3();
    function updateCamera(t) {
      if (!camKeys) camKeys = [{ t: 0, look: [0, 1.2, 0], dist: 6 }];
      let a = camKeys[0], b = camKeys[0], x = 0;
      if (t >= camKeys[camKeys.length - 1].t) a = b = camKeys[camKeys.length - 1];
      else for (let i = 0; i < camKeys.length - 1; i++) if (t >= camKeys[i].t && t <= camKeys[i + 1].t) { a = camKeys[i]; b = camKeys[i + 1]; x = U.easeInOut((t - a.t) / Math.max(1e-6, b.t - a.t)); if (b.cut) x = 1; break; }
      const A = camState(a), B = camState(b);
      const look = A.look.clone().lerp(B.look, x);
      lastLook.copy(look);
      const dir = A.dir.clone().lerp(B.dir, x).normalize();
      const dist = U.lerp(A.dist, B.dist, x);
      camera.position.copy(look).addScaledVector(dir, dist);
      const sk = (a.shake || 0) * (1 - x) + (b.shake || 0) * x;
      if (sk) camera.position.add(new THREE.Vector3(Math.sin(t * 37) * sk, Math.sin(t * 29 + 1) * sk, 0));
      camera.fov = U.lerp(A.fov, B.fov, x);
      camera.updateProjectionMatrix();
      camera.lookAt(look);
      if (A.roll || B.roll) camera.rotateZ(U.deg(U.lerp(A.roll, B.roll, x)));
      camera.updateMatrixWorld(true);
    }

    // ---------- efeitos ----------
    function spriteTex(kind, color) {
      return canvasTex(256, 256, (g, w) => {
        g.clearRect(0, 0, w, w);
        g.fillStyle = color; g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#ffffff"; g.lineWidth = 26; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
        if (kind === "ok") { g.moveTo(70, 132); g.lineTo(112, 174); g.lineTo(188, 92); }
        else if (kind === "bad") { g.moveTo(84, 84); g.lineTo(172, 172); g.moveTo(172, 84); g.lineTo(84, 172); }
        else if (kind === "warn") { g.moveTo(128, 70); g.lineTo(128, 140); g.moveTo(128, 182); g.lineTo(128, 184); }
        else { g.moveTo(128, 80); g.lineTo(128, 176); g.moveTo(80, 128); g.lineTo(176, 128); }
        g.stroke();
      });
    }
    const fx = {
      /** Selo ✓ (ok), ✗ (bad), ! (warn) ou + (plus) flutuando num ponto, com brilho. */
      mark(op) {
        BQ.checkOpts("lib.fx.mark", op, ["at", "kind", "from", "until", "size", "color"]);
        const { at: where, kind = "ok", from, until, size = 0.32, color } = op;
        if (!Number.isFinite(from) || !Number.isFinite(until)) throw new Error("fx.mark precisa de from e until (use marcas C.x)");
        const col = color || (kind === "ok" ? brand.colors.success : kind === "bad" ? brand.colors.danger : kind === "warn" ? "#f59e0b" : brand.colors.accent);
        const m = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: spriteTex(kind, col), transparent: true, depthTest: false, toneMapped: false })));
        m.renderOrder = 10; scene.add(m);
        fxs.push((t) => {
          const k = U.window(t, from, until, 0.45, 0.25);
          m.visible = k > 0.001;
          if (!m.visible) return;
          const s = size * U.spring(U.prog(t, from, from + 0.6)) * (t > until - 0.25 ? k : 1);
          m.scale.set(s, s, s);
          const p = resolve(where); m.position.copy(p).add(new THREE.Vector3(0, 0.04 * Math.sin((t - from) * 3), 0));
          m.material.opacity = Math.min(1, k * 1.5);
        });
        return m;
      },
      /** Brilho pulsante num ponto (atrai o olhar; usa o bloom). */
      glow(op) {
        BQ.checkOpts("lib.fx.glow", op, ["at", "color", "from", "until", "radius", "pulse"]);
        const { at: where, color, from, until, radius = 0.12, pulse = 1 } = op;
        const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), track(new THREE.MeshBasicMaterial({ color: color || brand.colors.accent, transparent: true, toneMapped: false })));
        scene.add(m);
        fxs.push((t) => { const k = U.window(t, from, until, 0.3, 0.3); m.visible = k > 0.001; if (!m.visible) return; m.position.copy(resolve(where)); const s = (1 + 0.15 * Math.sin(t * 6) * pulse) * k; m.scale.set(s, s, s); m.material.opacity = 0.85 * k; });
        return m;
      },
      /** Mostra/esconde um objeto com "pop" entre from e until. */
      pop(objct, op) {
        BQ.checkOpts("lib.fx.pop", op, ["from", "until", "scale"]);
        const { from, until = Infinity, scale = 1 } = op;
        if (!objct.parent) scene.add(objct);
        fxs.push((t) => { const k = until === Infinity ? U.prog(t, from, from + 0.01) : U.window(t, from, until, 0.01, 0.2); objct.visible = k > 0; const s = scale * U.spring(U.prog(t, from, from + 0.6)) * (t > until - 0.2 ? k : 1); objct.scale.setScalar(Math.max(0.0001, s)); });
        return objct;
      },
    };

    // ---------- API pública para o cena.js ----------
    const lib = {
      THREE, u: U, util: U, prim, obj, env, person, act, place, put, attach, camera: camera3, fx, tex, textTex, canvasTex, mat, smooth,
      add: (...objs) => { objs.forEach((x) => scene.add(x)); return objs[0]; },
      anchor: (name, target) => { if (typeof name !== "string") throw new Error("lib.anchor(nome, alvo)"); anchors.set(name, target); return name; },
      at: (target) => resolve(target),
      scene,
      SKINS, ACTIONS, OBJECTS: Object.keys(OBJ),
    };
    return {
      lib, scene, camera, anchors,
      cameraKeys: () => camKeys,
      cameraLook: () => lastLook.clone(),
      /** O cena.js pode devolver uma função (roda ANTES dos atores e da câmera, para mexer em objetos)
       *  ou {update, late}: `late` roda DEPOIS (para seguir mãos/atores). */
      setUserUpdate: (fn) => {
        if (typeof fn === "function") userUpdate = { update: fn };
        else if (fn && (typeof fn.update === "function" || typeof fn.late === "function")) userUpdate = fn;
        else userUpdate = null;
      },
      update(t) {
        if (userUpdate && userUpdate.update) userUpdate.update(t);
        scene.updateMatrixWorld(true);
        for (const a of actors) a.update(t);
        for (const f of fxs) f(t);
        updateCamera(t);
        if (userUpdate && userUpdate.late) userUpdate.late(t);
        scene.updateMatrixWorld(true);
        camera.updateMatrixWorld(true);
      },
      /** Posição na tela (px) de uma âncora, para callouts. */
      screen(name) {
        const p = resolve(name).project(camera);
        return { x: (p.x * 0.5 + 0.5) * BQ.W, y: (-p.y * 0.5 + 0.5) * BQ.H, visible: p.z > -1 && p.z < 1 };
      },
      resolve,
      /** Estado numérico da cena (para o teste de determinismo). */
      stateHash() {
        let h = 0;
        const mix = (v) => { h = (h * 31 + Math.round(v * 1000)) | 0; };
        scene.traverse((ob) => { if (!ob.visible) { mix(-7); return; } const e = ob.matrixWorld.elements; for (let i = 12; i < 15; i++) mix(e[i]); mix(e[0]); mix(e[5]); });
        camera.matrixWorld.elements.forEach(mix);
        return h;
      },
      dispose() {
        scene.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); });
        for (const d of disposables) if (d && d.dispose) d.dispose();
        actors.length = 0; fxs.length = 0; anchors.clear();
      },
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
