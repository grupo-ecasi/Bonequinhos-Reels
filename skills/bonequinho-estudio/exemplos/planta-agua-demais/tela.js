BQ.defineHud(({ H, C, B }) => [
  H.title({ from: 0, until: C.promessa - 0.1, kicker: "Regou todo dia?", lines: ["E a planta", "*morreu?*"] }),
  H.answer({ from: C.demais, until: C.c1 + 0.6, text: "Água\ndemais", tone: "danger" }),
  H.steps({ from: C.c1 - 0.2, until: C.mito - 0.1, labels: ["Folha", "Terra", "Cheiro"], at: [C.c1, C.c2, C.c3] }),
  H.callout({ anchor: "folha", text: "amarela e mole", from: C.amarela - 0.1, until: C.c2 - 0.1, tone: "danger", dx: -140, dy: -160 }),
  H.callout({ anchor: "terra", text: "molhada há dias", from: C.molhada - 0.1, until: C.c3 - 0.1, tone: "warn", dx: 140, dy: -140 }),
  H.callout({ anchor: "vaso", text: "cheiro ruim", from: C.cheiro - 0.1, until: C.mito - 0.2, tone: "danger", dx: 140, dy: 120 }),
  H.compare({ from: C.dedo - 0.2, until: C.loop - 0.1, y: 1000, left: { title: "Seca", value: "REGA", tone: "success" }, right: { title: "Úmida", value: "ESPERA", tone: "info" } }),
  H.flash({ at: C.morreu, strength: 0.35 }),
]);
