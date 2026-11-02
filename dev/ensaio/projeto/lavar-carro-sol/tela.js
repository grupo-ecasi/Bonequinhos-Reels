BQ.defineHud(({ H, C, B, M, brand }) => [
  // gancho
  H.title({ from: 0, until: C.promessa - 0.1, kicker: "Lavar no sol forte?", lines: ["Mancha a", "*pintura?*"] }),
  H.answer({ from: C.sim, until: C.promessa + 1.2, text: "Mancha,\nsim.", tone: "danger", y: 700 }),
  H.flash({ at: C.sim, strength: 0.3 }),
  // promessa + camadas
  H.steps({ from: C.promessa + 0.2, until: C.mito - 0.1, labels: ["Sombra", "Por partes", "Secar"], at: [C.c1, C.c2, C.c3] }),
  // problema
  H.callout({ anchor: "capo", text: "xampu secando", from: C.xampu - 0.1, until: C.mancha - 0.1, tone: "warn", dx: 140, dy: -160 }),
  H.callout({ anchor: "manchaA", text: "manchas brancas", from: C.mancha - 0.1, until: C.c1 - 0.1, tone: "danger", dx: -160, dy: -150 }),
  H.flash({ at: C.mancha, strength: 0.25 }),
  // camadas
  H.callout({ anchor: "capoDir", text: "lataria fria", from: C.fria - 0.1, until: C.c2 - 0.1, tone: "success", dx: -150, dy: -150 }),
  H.callout({ anchor: "porta", text: "1 painel por vez", from: C.partes - 0.1, until: C.c3 - 0.1, tone: "info", dx: -160, dy: -160 }),
  H.callout({ anchor: "toalha", text: "microfibra", from: C.secar - 0.1, until: C.mito - 0.2, tone: "success", dx: -150, dy: -150 }),
  // mito
  H.answer({ from: C.nao, until: C.graus - 0.1, text: "Não.", tone: "danger", y: 700 }),
  H.bigNumber({ from: C.graus - 0.1, until: C.fonte - 0.2, value: "60", unit: "°C", label: "lataria escura ao sol", side: "right", tone: "danger" }),
  H.callout({ anchor: "manchaA", text: "vira mancha", from: C.mancha2 - 0.1, until: C.fonte - 0.1, tone: "danger", dx: -160, dy: -150 }),
  // fonte (fecha antes do CTA automático)
  H.card({ from: C.fonte - 0.1, until: C.cta - 0.1, title: "Rótulo do xampu automotivo", text: "Sem sol direto e sem lataria quente", tone: "info", y: 1150 }),
]);
