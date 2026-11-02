// Cena: sala com uma planta na mesa; o morador rega demais e depois aprende o teste do dedo.
BQ.defineScene(({ THREE, lib, C, B, brand, u }) => {
  const room = lib.env.room({ kind: "sala" });
  const mesa = lib.place(lib.obj("table", { w: 1.0, d: 0.6 }), [0.6, 0, -1.6]);
  const planta = lib.place(lib.obj("plant", { leaf: "#7aa04a" }), [0.6, 0.76, -1.6]);
  lib.anchor("folha", () => planta.at("leaf"));
  lib.anchor("terra", () => planta.at("soil"));
  lib.anchor("vaso", () => planta.at("pot"));

  // regador montado com primitivas (exemplo de objeto novo)
  // lib.put(objeto, [x,y,z], [rotação x,y,z em graus]) posiciona e devolve o objeto
  const regador = lib.put(lib.prim.group(
    lib.prim.cyl(0.07, 0.14, "#2f9e6e", 16),
    lib.put(lib.prim.cyl(0.012, 0.18, "#2f9e6e", 8), [0.1, 0.03, 0], [0, 0, -57]),
  ), [0, -0.08, 0.05]);

  const morador = lib.place(lib.person({ shirt: "#e76f51", pants: "#3a5a8c", outfit: "tee-shorts", head: "hair", skin: 2, seed: 3 }), [-0.75, -0.55], 60);
  lib.attach(regador, morador, "R");
  lib.act(morador, [
    ["walk", 0.2, 1.5, { to: [0.05, -1.2] }],
    ["face", 1.6, 1.9, { toward: "folha" }],
    ["reach", 1.7, C.morreu - 0.1, { hand: "R", target: () => planta.at("top").add(new THREE.Vector3(-0.05, 0.12, 0.05)) }],
    ["headShake", C.morreu, C.morreu + 1.0],
    ["point", C.c1 - 0.2, C.c3 + 1.2, { hand: "L", target: "folha" }],
    ["face", C.mito - 0.6, C.mito, { camera: true }],
    ["reach", C.dedo - 0.3, C.umida + 0.6, { hand: "L", target: "terra" }],
    ["nod", C.seca, C.seca + 0.8],
    ["shrug", C.loop, C.loop + 1.2],
  ]);

  lib.fx.mark({ at: () => planta.at("top").add(new THREE.Vector3(0.25, 0.1, 0)), kind: "bad", from: C.amarela, until: C.c2 });
  lib.fx.mark({ at: () => planta.at("soil").add(new THREE.Vector3(0.25, 0.05, 0)), kind: "warn", from: C.molhada, until: C.c3 });
  lib.fx.mark({ at: () => planta.at("soil").add(new THREE.Vector3(-0.3, 0.15, 0)), kind: "ok", from: C.seca, until: C.loop });

  lib.camera.keys([
    { t: 0, look: [-0.1, 1.05, -1.1], dist: 4.6 },
    { t: C.morreu, look: [0.4, 1.2, -1.4], dist: 3.6 },
    { t: C.c1, look: "folha", dist: 2.0, yaw: 35 },
    { t: C.c2, look: "terra", dist: 1.7, yaw: 10, pitch: 25 },
    { t: C.c3, look: "vaso", dist: 1.9, yaw: -20 },
    { t: C.mito, look: [0.2, 1.2, -1.3], dist: 3.4 },
    { t: C.dedo, look: "terra", dist: 2.0, yaw: 50, pitch: 15 },
    { t: C.loop, look: [-0.1, 1.05, -1.1], dist: 4.4 },
    { t: C.end, look: [-0.1, 1.05, -1.1], dist: 4.6 },
  ]);

  // folhas murcham ao longo das camadas e voltam no loop (estado = função de t)
  const copa = planta.getObjectByName("copa");
  return (t) => {
    const murcha = u.track(t, [[0, 0], [C.c1, 0.6], [C.c3, 0.85], [C.loop, 0.85], [C.end, 0]]);
    copa.children.forEach((stem, i) => { stem.rotation.x = 0.35 + 0.5 * murcha + (i % 3) * 0.05; });
  };
});
BQ.defineScene(({ THREE, lib, C }) => {
  lib.env.room({ kind: "sala" });
  const p = lib.person({});
  const v = lib.obj("plant");
  let contador = 0;
  lib.camera.keys([{ t: 0, look: [0, 1, 0], dist: 4 }, { t: C.fim, look: [0, 1, 0], dist: 3 }]);
  
  return (t) => { contador += 0.01; p.position.x = contador; };
});
