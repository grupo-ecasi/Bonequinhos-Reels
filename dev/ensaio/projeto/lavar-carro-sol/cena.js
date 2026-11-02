// Cena: rua ao ar livre com sol forte. O cliente lava o carro escuro no sol e mancha a pintura;
// o profissional da Brilho Auto Estética monta a tenda (sombra), lava por partes e seca com microfibra.
BQ.defineScene(({ THREE, lib, C, B, brand, u }) => {
  const P = lib.prim;
  lib.env.outdoor({ sky: "day", ground: "concrete", street: true, trees: 2, fog: true });

  // ---------- Sol (fica no céu, à esquerda, visível nos planos abertos com yaw 25) ----------
  const sunMat = lib.mat("#ffd23f", { emissive: "#ffb703", emissiveIntensity: 1.2, fog: false });
  const raios = P.group();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * 360;
    const r = P.cone(0.12, 0.45, sunMat);
    const rad = u.deg(a);
    lib.put(r, [Math.cos(rad) * 0.85, Math.sin(rad) * 0.85, 0], [0, 0, a - 90]);
    raios.add(r);
  }
  const sol = lib.place(P.group(P.sph(0.55, sunMat), raios), [-7.1, 2.3, -10.9]);
  lib.anchor("sol", () => sol.position.clone());
  lib.fx.glow({ at: "sol", color: "#ffd166", from: 0, until: C.end, radius: 1.2 });

  // ---------- Carro com primitivas (comprimento no eixo Z, frente para +Z = câmera) ----------
  const pintura = lib.smooth("#1f232b");
  const vidro = lib.smooth("#24384d");
  const borracha = "#151515";
  const carroceria = P.group(
    lib.put(P.box(1.7, 0.55, 3.6, pintura, { round: 0.08 }), [0, 0.6, 0]),               // corpo
    lib.put(P.box(1.5, 0.5, 1.8, pintura, { round: 0.1 }), [0, 1.12, -0.3]),              // cabine
    lib.put(P.box(1.54, 0.32, 1.6, vidro), [0, 1.15, -0.3]),                             // janelas laterais
    lib.put(P.box(1.38, 0.34, 0.04, vidro), [0, 1.13, 0.6], [-18, 0, 0]),                 // para-brisa
    lib.put(P.box(1.38, 0.3, 0.04, vidro), [0, 1.13, -1.2], [15, 0, 0]),                  // vidro traseiro
    lib.put(P.box(1.74, 0.14, 0.12, "#2a2d33"), [0, 0.38, 1.82]),                         // para-choque dianteiro
    lib.put(P.box(1.74, 0.14, 0.12, "#2a2d33"), [0, 0.38, -1.82]),                        // para-choque traseiro
    lib.put(P.box(0.6, 0.12, 0.03, "#0d0d0d"), [0, 0.62, 1.81]),                          // grade
    lib.put(P.box(0.32, 0.1, 0.04, "#fff4c7"), [-0.56, 0.72, 1.8]),                       // farol E
    lib.put(P.box(0.32, 0.1, 0.04, "#fff4c7"), [0.56, 0.72, 1.8]),                        // farol D
    lib.put(P.box(0.3, 0.1, 0.04, "#d62828"), [-0.58, 0.72, -1.8]),                       // lanterna E
    lib.put(P.box(0.3, 0.1, 0.04, "#d62828"), [0.58, 0.72, -1.8]),                        // lanterna D
    lib.put(P.box(0.12, 0.08, 0.06, pintura), [-0.86, 1.0, 0.45]),                        // retrovisor E
    lib.put(P.box(0.12, 0.08, 0.06, pintura), [0.86, 1.0, 0.45]),                         // retrovisor D
    lib.put(P.box(0.02, 0.03, 0.18, "#9aa3ad"), [0.86, 0.78, -0.1]),                      // maçaneta D
    lib.put(P.box(0.02, 0.03, 0.18, "#9aa3ad"), [-0.86, 0.78, -0.1]),                     // maçaneta E
  );
  for (const [x, z] of [[-0.82, 1.15], [0.82, 1.15], [-0.82, -1.15], [0.82, -1.15]]) {
    carroceria.add(lib.put(P.cyl(0.33, 0.24, borracha, 18), [x, 0.33, z], [0, 0, 90]));     // pneu
    carroceria.add(lib.put(P.cyl(0.17, 0.26, "#c0c6cf", 12), [x, 0.33, z], [0, 0, 90]));    // calota
  }
  const carro = lib.place(carroceria, [0, -1.5], 0);
  const naCarro = (x, y, z) => () => carro.localToWorld(new THREE.Vector3(x, y, z));
  lib.anchor("capo", naCarro(0, 0.88, 1.15));          // centro do capô
  lib.anchor("capoEsq", naCarro(-0.45, 0.9, 1.1));     // onde o cliente esfrega
  lib.anchor("capoDir", naCarro(0.45, 0.9, 1.1));      // onde o profissional encosta a mão
  lib.anchor("teto", naCarro(0, 1.38, -0.3));
  lib.anchor("porta", naCarro(0.87, 0.72, -0.1));      // porta direita
  lib.anchor("portaBaixo", naCarro(0.87, 0.5, -0.3));

  // ---------- Espuma, vapor, manchas e gotas (todos em função de t) ----------
  const espumaMat = lib.mat("#ffffff");
  const espuma = [];
  for (let i = 0; i < 9; i++) {
    const s = P.sph(0.05 + 0.04 * u.hash(i + 1), espumaMat);
    lib.put(s, [-0.65 + 1.3 * u.hash(i + 11), 0.9, 0.75 + 0.9 * u.hash(i + 21)]);
    carro.add(s); espuma.push(s);
  }
  const vaporMat = lib.mat("#f1f5f9", { transparent: true, opacity: 0.55 });
  const vapor = [];
  for (let i = 0; i < 6; i++) {
    const s = P.sph(0.06, vaporMat);
    carro.add(s); vapor.push(s);
  }
  const manchaMat = lib.mat("#e6ebf1");
  const manchas = [];
  for (let i = 0; i < 16; i++) {
    const m = P.cyl(0.03 + 0.035 * u.hash(i + 31), 0.008, manchaMat, 12);
    lib.put(m, [-0.65 + 1.3 * u.hash(i + 41), 0.877, 0.7 + 1.0 * u.hash(i + 51)]);
    carro.add(m); manchas.push(m);
  }
  lib.anchor("manchaA", naCarro(-0.2, 0.88, 1.35));
  const gotaMat = lib.smooth("#8ecae6", { transparent: true, opacity: 0.85 });
  const gotas = [];
  for (let i = 0; i < 12; i++) {
    const g = P.sph(0.022, gotaMat);
    lib.put(g, [0.865, 0.45 + 0.35 * u.hash(i + 61), -0.95 + 1.5 * u.hash(i + 71)]);
    carro.add(g); gotas.push(g);
  }

  // ---------- Tenda da marca (a "sombra" do passo um) ----------
  const azul = brand.color("accent");
  const tenda = P.group(
    lib.put(P.box(3.7, 0.12, 4.6, azul), [0, 2.55, 0]),                                     // teto da tenda
    lib.put(P.box(3.7, 0.3, 0.05, azul), [0, 2.4, 2.3]),                                    // faixa da frente
    lib.put(P.label("BRILHO AUTO ESTÉTICA", { w: 2.4, h: 0.26, bg: azul, fg: "#ffffff" }), [0, 2.4, 2.33]),
    lib.put(P.cyl(0.035, 2.5, "#c0c6cf", 8), [-1.8, 1.25, 2.25]),
    lib.put(P.cyl(0.035, 2.5, "#c0c6cf", 8), [1.8, 1.25, 2.25]),
    lib.put(P.cyl(0.035, 2.5, "#c0c6cf", 8), [-1.8, 1.25, -2.25]),
    lib.put(P.cyl(0.035, 2.5, "#c0c6cf", 8), [1.8, 1.25, -2.25]),
    lib.put(P.plane(3.6, 4.5, lib.mat("#000000", { transparent: true, opacity: 0.22 })), [0, 0.012, 0], [-90, 0, 0]), // sombra no chão
  );
  lib.place(tenda, [0, 0, -1.5]);
  lib.fx.pop(tenda, { from: C.sombra - 0.1, until: C.mito - 0.2, scale: 1 });

  // ---------- Objetos de mão ----------
  const esponja = P.box(0.15, 0.06, 0.1, "#ffd60a", { round: 0.02 });
  const toalha = P.box(0.22, 0.03, 0.16, "#ffd166", { round: 0.01 });
  lib.place(lib.obj("bucket", { color: "#e63946" }), [-1.2, -2.3]);

  // ---------- Personagens ----------
  // Cliente (sem marca): é quem lava no sol e erra.
  const cliente = lib.place(lib.person({ shirt: "#f4a261", pants: "#3a5a8c", outfit: "tee-shorts", head: "hair", hair: "#3b2a1e", skin: 1, seed: 4 }), [-1.15, -0.4], 90);
  lib.attach(esponja, cliente, "R");
  // Profissional da marca: uniforme azul, boné, logo. Nunca erra.
  const pro = lib.place(lib.person({ shirt: azul, pants: "#1b263b", outfit: "tee-pants", head: "cap", capColor: azul, skin: 4, gloves: true, logo: true, seed: 9 }), [3.6, -0.5], -90);
  lib.attach(toalha, pro, "R");
  lib.anchor("toalha", toalha);

  lib.act(cliente, [
    ["scrub", 0, C.sim - 0.3, { hand: "R", target: "capoEsq" }],
    ["scare", C.sim - 0.1, C.sim + 0.8],
    ["scrub", C.problema, C.mancha - 0.1, { hand: "R", target: "capoEsq" }],
    ["scare", C.mancha, C.mancha + 0.9],
    ["walk", C.c1 - 0.2, C.c1 + 1.3, { to: [-1.3, 0.6] }],
    ["face", C.c1 + 1.3, C.c1 + 1.8, { toward: pro }],
    ["nod", C.fria + 0.6, C.fria + 1.5],
    ["walk", C.mito - 0.9, C.mito + 0.3, { to: [-1.15, -0.4], thenFace: 90 }],
    ["scrub", C.mito + 0.3, C.mancha2 - 0.1, { hand: "R", target: "capoEsq" }],
    ["scare", C.mancha2, C.mancha2 + 0.9],
    ["face", C.fonte, C.fonte + 0.4, { camera: true }],
    ["nod", C.cta + 0.3, C.cta + 1.2],
    ["face", C.loop - 0.4, C.loop, { yaw: 90 }],
    ["scrub", C.loop + 0.1, C.end, { hand: "R", target: "capoEsq" }],
  ]);

  lib.act(pro, [
    ["walk", C.c1 - 0.6, C.sombra + 1.6, { to: [1.3, -0.45], thenFace: -90 }],
    ["reach", C.mao - 0.2, C.fria + 0.3, { hand: "R", target: "capoDir" }],
    ["walk", C.c2 - 0.1, C.c2 + 1.0, { to: [1.35, -1.55], thenFace: -90 }],
    ["scrub", C.partes + 0.15, C.enxagua + 1.2, { hand: "R", target: "porta" }],
    ["scrub", C.secar - 0.2, C.sozinha + 0.6, { hand: "R", target: "portaBaixo" }],
    ["face", C.mito - 0.3, C.mito + 0.3, { toward: cliente }],
    ["headShake", C.nao, C.nao + 1.0],
    ["point", C.mancha2, C.mancha2 + 1.3, { hand: "L", target: "manchaA" }],
    ["face", C.fonte - 0.2, C.fonte + 0.3, { camera: true }],
    ["thumbsUp", C.fonte + 0.3, C.fonte + 1.5, { hand: "R" }],
    ["wave", C.cta, C.whats + 0.8, { hand: "R" }],
    ["walk", C.loop, C.loop + 2.6, { to: [3.6, -0.5] }],
  ]);

  // ---------- Selos ----------
  lib.fx.mark({ at: () => lib.at("manchaA").add(new THREE.Vector3(0.3, 0.15, 0)), kind: "bad", from: C.mancha, until: C.c1 - 0.1 });
  lib.fx.mark({ at: () => lib.at("capoDir").add(new THREE.Vector3(0.1, 0.3, 0)), kind: "ok", from: C.fria, until: C.c2 - 0.1 });
  lib.fx.mark({ at: () => lib.at("porta").add(new THREE.Vector3(0.1, 0.45, 0)), kind: "ok", from: C.secar + 1.5, until: C.mito - 0.2 });
  lib.fx.mark({ at: () => lib.at("manchaA").add(new THREE.Vector3(0.3, 0.15, 0)), kind: "bad", from: C.mancha2, until: C.fonte - 0.1 });

  // ---------- Câmera (yaw e pitch explícitos em todas as chaves) ----------
  const abertura = { look: [-0.6, 1.0, -1.0], dist: 6.5, yaw: 25, pitch: 6 };
  lib.camera.keys([
    { t: 0, ...abertura },
    { t: C.sim, look: "capoEsq", dist: 3.0, yaw: 35, pitch: 18 },
    { t: C.promessa + 1.5, look: [0, 1.0, -1.2], dist: 5.6, yaw: -20, pitch: 8 },
    { t: C.problema, look: "capoEsq", dist: 3.4, yaw: 40, pitch: 15 },
    { t: C.evapora, look: "capo", dist: 2.0, yaw: 30, pitch: 38 },
    { t: C.mancha, look: "capo", dist: 1.6, yaw: 10, pitch: 45 },
    { t: C.c1, look: [0.1, 1.2, -1.4], dist: 8.0, yaw: 15, pitch: 10 },
    { t: C.mao, look: "capoDir", dist: 2.2, yaw: 60, pitch: 20 },
    { t: C.c2, look: "porta", dist: 3.0, yaw: 75, pitch: 10 },
    { t: C.enxagua, look: "porta", dist: 2.2, yaw: 60, pitch: 8 },
    { t: C.c3, look: "porta", dist: 1.9, yaw: 45, pitch: 12 },
    { t: C.mito, look: [-0.6, 1.0, -1.0], dist: 6.2, yaw: 25, pitch: 6 },
    { t: C.nao, look: [0.1, 1.0, -1.0], dist: 6.5, yaw: -20, pitch: 8 },
    { t: C.graus, look: [0.1, 1.0, -0.6], dist: 3.6, yaw: 15, pitch: 15 },
    { t: C.mancha2, look: "capo", dist: 1.7, yaw: -15, pitch: 42 },
    { t: C.fonte, look: [1.2, 0.85, -1.3], dist: 3.6, yaw: 20, pitch: 8 },
    { t: C.cta, look: [1.2, 0.9, -1.3], dist: 3.8, yaw: 10, pitch: 6 },
    { t: C.loop, look: [-0.6, 1.0, -1.0], dist: 6.3, yaw: 25, pitch: 6 },
    { t: C.end, ...abertura },
  ]);

  // ---------- Estados que mudam no tempo ----------
  return (t) => {
    raios.rotation.z = t * 0.25;
    // espuma: presente enquanto o cliente lava; seca no problema e no mito
    const esp = u.track(t, [[0, 1], [C.evapora, 1], [C.xampu + 0.6, 0], [C.mito + 0.2, 0], [C.mito + 0.8, 1], [C.graus, 1], [C.mancha2, 0], [C.loop, 0], [C.loop + 0.6, 1], [C.end, 1]]);
    espuma.forEach((s, i) => { const k = Math.max(0.001, esp * (0.8 + 0.2 * Math.sin(t * 3 + i))); s.scale.set(k, k * 0.7, k); s.visible = esp > 0.02; });
    // vapor sobe do capô quente
    const vap = u.window(t, C.evapora - 0.2, C.mancha + 0.5, 0.3, 0.4) + u.window(t, C.graus, C.mancha2 + 0.5, 0.3, 0.4);
    vapor.forEach((s, i) => {
      const f = (t * 0.5 + u.hash(i + 81)) % 1;
      lib.put(s, [-0.5 + u.hash(i + 91), 0.95 + f * 0.6, 0.8 + 0.8 * u.hash(i + 101)], [0, 0, 0], Math.max(0.001, vap * (1 - f)));
      s.visible = vap > 0.02;
    });
    // manchas brancas: aparecem no problema e no mito (sempre no carro do cliente, no sol)
    const man = u.track(t, [[0, 0], [C.mancha - 0.05, 0], [C.mancha + 0.4, 1], [C.c1 - 0.2, 1], [C.c1 + 0.3, 0], [C.mancha2 - 0.05, 0], [C.mancha2 + 0.4, 1], [C.fonte, 1], [C.cta, 0], [C.end, 0]]);
    manchas.forEach((m, i) => { const k = Math.max(0.001, u.clamp(man * 1.6 - u.hash(i + 111) * 0.6, 0, 1)); m.scale.set(k, 1, k); m.visible = k > 0.01; });
    // gotas do enxágue: aparecem no passo dois e somem quando a toalha passa
    const got = u.track(t, [[0, 0], [C.enxagua, 0], [C.enxagua + 0.4, 1], [C.secar, 1], [C.sozinha + 0.4, 0], [C.end, 0]]);
    gotas.forEach((g, i) => { const k = Math.max(0.001, u.clamp(got * 1.5 - u.hash(i + 121) * 0.5, 0, 1)); g.scale.set(k, k * 1.3, k); g.visible = k > 0.01; });
  };
});
