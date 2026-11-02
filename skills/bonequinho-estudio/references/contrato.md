# Contrato do projeto (API 1)

Um projeto é uma pasta com estes arquivos. O `build_studio.py` junta tudo num único `<slug>-estudio.html`.

| Arquivo | Obrigatório | O que é |
|---|---|---|
| `projeto.json` | sim | `{"slug": "regar-planta", "title": "Título do vídeo", "cover": {"cue": "hook", "dt": 0.6}}` |
| `roteiro.txt` | sim | texto da narração com marcação (abaixo) |
| `cena.js` | sim | `BQ.defineScene(...)`: cenário, bonequinhos, ações, câmera, efeitos |
| `tela.js` | sim | `BQ.defineHud(...)`: textos na tela |
| `sons.js` | não | `BQ.defineSfx(...)`: efeitos sonoros |
| `momentos.js` | não | `BQ.defineMoments(...)`: instantes derivados das marcas, usados na cena e nos sons |
| `marca.json` | não | kit de marca. Sem ele = modo sem marca (sem logo, sem CTA) |
| `publicar.md` | não | legenda do Instagram, hashtags, texto alternativo, comentário fixado (seções `## Título`) |

Opcionais do `projeto.json`:
- `"captions": {"y": 1440, "enabled": true}`: altura das legendas;
- `"bloom": {"strength": 0.45, "radius": 0.28, "threshold": 0.85}` ou `false`;
- `"sfxVolumeDb": 0`.

**Unidades:** metros, segundos e graus (quando a API diz "graus"). Eixo Y para cima. A câmera padrão olha de +Z para −Z.

---

## 1. `roteiro.txt` (a fonte dos tempos)

```
// comentário
# gancho
Regou todo dia e a planta [[morreu]]morreu?
# promessa
[[promessa]]São {3|três} sinais de água [[demais]]demais.
```

- **`# nome`** começa um bloco. Use os nomes da estrutura: `gancho, promessa, problema, camada1, camada2, camada3, mito, norma` (ou `fonte`), `cta, loop`.
  - Qualquer nome vale; só dois têm efeito especial:
    - **`cta`**: o card de CTA aparece do início dele até 0,39 s depois do início do `loop`, só no modo empresa;
    - **`loop`**.
  - Cada bloco vira `B.nome = {start, end}`.
- **`[[marca]]palavra`** cria a marca `C.marca` = instante em que **essa palavra começa** a ser falada.
  - O nome tem letras sem acento, números e `_`.
  - `hook` e `end` são reservadas: `C.hook = 0` e `C.end` = fim do vídeo.
- **`// comentário`** (linha inteira) é ignorado pela legenda, pela voz e pelo texto copiado. Ponha as **fontes** aí, no fim do roteiro.
- **`{exibe|fala}`**: a legenda mostra `exibe`; a voz e a sincronia usam `fala`. Marca antes de chave vale: `[[graus]]{60 °C|sessenta graus}`. Use para todo número, sigla e nome que se fala diferente: `{28|vinte e oito}`, `{NBR 5410|ene bê erre cinco mil quatrocentos e dez}`, `{House|Ráus}`.
- Pontuação conta, porque gera pausa: `.?!` pausa média, `,` pausa curta, `...` pausa longa.
- **Os tempos nunca são escritos à mão.**
  - Sem narração, o estúdio estima por sílabas (cerca de 0,17 s por sílaba).
  - Com narração, alinha a fala ao texto e recalcula todas as marcas.
  - **Por isso tudo no código usa `C.x`, nunca segundos fixos.**

## 2. `cena.js`

```js
BQ.defineScene(({ THREE, lib, C, B, M, brand, u }) => {
  const sala = lib.env.room({ kind: "cozinha" });
  const pia = lib.place(lib.obj("table", { w: 1.2 }), [0.5, 0, -1.5]);
  const ana = lib.place(lib.person({ shirt: "#e76f51", head: "bun", skin: 1 }), [-0.6, -0.4], 45);
  lib.anchor("pia", () => pia.at("top"));
  lib.act(ana, [
    ["walk", 0.2, 1.4, { to: [0.1, -1.1] }],
    ["reach", C.abre - 0.3, C.fecha, { hand: "R", target: "pia" }],
    ["headShake", C.nao, C.nao + 0.9],
  ]);
  lib.camera.keys([
    { t: 0, look: [0, 1.1, -1], dist: 4.5 },
    { t: C.abre, look: "pia", dist: 2.0, yaw: 30 },
    { t: C.end, look: [0, 1.1, -1], dist: 4.5 },
  ]);
  return (t) => { /* mexe em objetos em função de t (opcional) */ };
});
```

Recebe:
- `THREE`: Three.js 0.184;
- `lib`: biblioteca (abaixo);
- `C`: marcas;
- `B`: blocos `{start, end}`;
- `M`: momentos;
- `brand`: marca;
- `u`: utilidades.

**Ler marca, bloco ou momento que não existe dá erro na hora, com a lista dos que existem.**

**O que devolver:**
- uma função `(t) => {}`, que roda **antes** dos atores e da câmera a cada quadro (para mexer em objetos); ou
- `{update(t), late(t)}`, em que `late` roda **depois** (para seguir a mão de um ator, por exemplo); ou
- nada.

**Regra de ouro (determinismo):**
- o quadro em `t` tem que depender só de `t`;
- **não** use `+=`, contador, "último valor", `Math.random`, `Date`, timers, `fetch` ou DOM;
- use `u.track`, `u.prog`, `u.window` e `u.rng(semente)`;
- o validador barra o resto.

### 2.1 Ambientes (cada cena usa UM)
- `lib.env.room({ kind, w=6, d=5, h=2.8, wall, floor, window=true })`: cômodo visto de frente.
  - `kind`: `sala | quarto | escritorio | cozinha | banheiro | lavanderia | neutro`.
  - `wall`: cor `"#rrggbb"` ou textura `"wallTile"`.
  - `floor`: `wood | tile | concrete | grass`.
  - Pontos (`sala.at(nome)`): `center, backWall, leftWall, floor, window`.
  - A parede do fundo fica em z = −d+1 (≈ −4), a parede esquerda em x = −w/2, e o chão útil vai de z ≈ −4 a +1.
- `lib.env.outdoor({ sky="day", ground="grass", wall=null|true|{w,h,color,z}, trees=3, street=false, fog=true })`: área externa.
  - `sky`: `day | sunset | night | studio`. `ground`: `grass | concrete | asphalt | tile | wood`.
  - Pontos: `center, wall`.
  - **Onde fica cada coisa:**
    - chão grande em y=0;
    - `wall` (muro de 5 m) em z = −1,5, centrado em x = 0;
    - `street` é uma faixa de asfalto em z ≈ +4 a +10;
    - árvores em x = ±4 a ±8, z = −4 a −8, longe do centro;
    - o sol vem de (6, 12, 8): de cima, à direita e da frente.
  - Deixe a ação em x de −1,5 a 1,5 e z de −2 a 1.

### 2.2 Objetos prontos: `lib.obj(tipo, opções)`
Cada um devolve um grupo com `.at(ponto)` (Vector3 no mundo).

| tipo | opções | pontos `.at()` |
|---|---|---|
| `table` | `w, d, h, color` | `top`, `front` |
| `chair` | `color` | `seat`, `top` |
| `plant` | `pot, leaf, h, leaves` (tem um grupo `"copa"` com os galhos) | `top`, `leaf`, `soil`, `pot` |
| `bucket` | `color` | `top`, `handle` |
| `crate` | `s, color` | `top`, `front` |
| `sign` | `text, w, h, bg, fg, post` | `center` |
| `door` | `color, w, h` | `handle`, `center` |
| `shelf` | `w, h, color` | `top`, `middle` |
| `tree` | `h, leaf` | `top` |

**Objeto que não existe na lista:** monte com primitivas (20 a 60 linhas). Veja `references/direcao.md`.

### 2.3 Primitivas: `lib.prim`
- `box(w, h, d, cor, {round})`, `cyl(r, h, cor, segmentos, rBase)`, `sph(r, cor)`, `cone(r, h, cor)`, `torus(r, tubo, cor, arco)`, `plane(w, h, cor)`.
- `label(texto, {w, h, bg, fg})`: placa com texto.
- `group(...filhos)`.
- `cor` pode ser `"#rrggbb"` ou um material: `lib.mat(cor, extras)`, plano, ou `lib.smooth(cor, extras)`, liso.
  - `extras` são opções do `THREE.MeshStandardMaterial`: `roughness`, `metalness`, `transparent`, `opacity`, `emissive`, `emissiveIntensity`, `map`.
  - **`emissive` faz a peça brilhar com bloom: use só em luzes e LEDs pequenos.**
- Texturas prontas: `lib.tex(nome)`, com nome em `grass, concrete, wood, tile, wallTile, plaster, brick, asphalt`.
- **Posicionar:** `lib.put(obj, [x,y,z], [rx,ry,rz] em graus, escala)` devolve o próprio objeto. `escala` pode ser um número ou `[sx,sy,sz]`.
  - Cilindros e cones nascem **em pé (eixo Y)**. Roda de carro: `[0, 0, 90]` (deitada no eixo X).
  - **Nunca** use `Object.assign(obj, {position: ...})`, porque não funciona no Three.js.
- Colocar na cena: `lib.place(obj, [x, z] ou [x, y, z], yawGraus)` (também adiciona à cena) ou `lib.add(obj)`.

### 2.4 Bonequinho: `lib.person(opções)`

| opção | valores |
|---|---|
| `skin` | 0 (mais claro) a 5 (mais escuro), ou `"#cor"` |
| `shirt`, `pants`, `shoes` | cores |
| `outfit` | `tee-pants` (padrão), `tee-shorts`, `longsleeve`, `overall` (macacão), `coat` (jaleco branco) |
| `head` | `hair` (padrão), `bun` (coque), `long`, `bald`, `cap` (boné), `helmet`, `hardhat` (capacete amarelo de obra) |
| `hair`, `capColor` | cores |
| `glasses`, `beard`, `vest` (faixas refletivas), `gloves` (true ou cor) | true/false |
| `logo` | `true` (peito e costas) ou `{chest, back, cap}`. Só aparece no modo empresa |
| `seed` | número (varia piscada e respiração) |

- O boneco olha para **+Z** e tem cerca de 1,75 m.
- `lib.place(pessoa, [x, z], yaw)`: yaw 0 = de frente para a câmera; 90 = olhando para +X.
- Mãos: `pessoa.hand("R")`, `pessoa.hand("L")`. `"R"` é a mão direita **do bonequinho**: com ele de frente para a câmera (yaw 0), ela aparece à **esquerda** da tela.
- Prender ferramenta na mão: `lib.attach(obj, pessoa, "R")`.
- O logo fica num círculo branco no peito e nas costas, então funciona em qualquer cor de camiseta.

### 2.5 Ações no tempo: `lib.act(pessoa, [[tipo, início, fim, opções], ...])`
- `walk`: `{to: [x, z], thenFace: yawGraus}`. Anda até o ponto e vira na direção do movimento.
- `face` / `turn`: `{yaw: graus}`, `{toward: alvo}` ou `{camera: true}`.
- `reach`: `{hand: "R"|"L", target}`. Encosta a mão no alvo (IK de braço). Também `press` (aperta) e `scrub` (esfrega).
- `paint`: o mesmo que `reach`, com sobe e desce.
- `point`: aponta para o alvo com o braço esticado.
- `wave`, `thumbsUp`, `hold` (segura na frente do corpo). Todos aceitam `hand`.
- `headShake` (não), `nod` (sim), `look` (`{at: alvo}`), `talk` (mexe a boca).
- `celebrate` (braços para cima e pulinhos), `shrug` (ombros), `scare` (susto), `jump`, `crouch` (agacha).
- **Alvo** (`target`, `toward`, `at`): `[x,y,z]`, nome de âncora, objeto 3D ou função que devolve Vector3.
- Ações entram e saem suaves (0,3 s, ajustável com `in`/`out`). Ações de braço escolhem a mão por `hand` (padrão `"R"`). Ações iguais podem se repetir em tempos diferentes.
- **Durações mínimas** (o validador avisa): `walk`/`reach`/`point` 0,6 s; `scrub`/`paint`/`wave`/`celebrate` 0,8 s; gestos de cabeça 0,6 s.
- Opções desconhecidas geram aviso "opção … não existe e foi ignorada".

### 2.6 Âncoras
- `lib.anchor("nome", alvo)` dá nome a um ponto que se move, para callouts (`H.callout`), alvos e câmera.
- `lib.at(alvo)` devolve o Vector3 no mundo.

### 2.7 Câmera: `lib.camera.keys([{t, look, dist, yaw, pitch, fov, dir, cut, shake, roll}, ...])`
- `look`: ponto `[x,y,z]` ou nome de âncora (segue).
- `dist`: distância em metros.
- **Posição da câmera** = `look + dir × dist`, com `dir = (sen yaw·cos pitch, sen pitch, cos yaw·cos pitch)`. Sem `yaw`/`pitch`/`dir`, o padrão equivale a yaw ≈ 23° e pitch ≈ 8°.
- Direção:
  - `yaw` (graus, 0 = de frente, positivo = câmera à direita);
  - `pitch` (graus, positivo = de cima);
  - ou `dir: [x,y,z]`.
  - Padrão: levemente à direita e de cima.
- `fov`: padrão 34 (vertical). `cut: true` faz corte seco nessa chave. `shake` treme (0,02 a 0,05).
- Interpolação suave entre chaves.
- **A última chave deve repetir a primeira**, para o Reels emendar em loop.

### 2.8 Efeitos: `lib.fx`
- `mark({at, kind: "ok"|"bad"|"warn"|"plus", from, until, size=0.32})`: selo ✓ ✗ ! + que brilha (`size` em metros).
- `glow({at, color, from, until, radius=0.12})`: ponto pulsante (`radius` em metros).
- `pop(obj, {from, until, scale})`: objeto invisível antes de `from`, aparece com "pop" e some em `until`. Ele é adicionado à cena sozinho.

### 2.9 Utilidades `u` (também `lib.u`)
- `u.track(t, [[t0, v0], [t1, v1], ...])`: interpola números ou arrays com suavização.
- `u.prog(t, a, b)`: de 0 a 1 entre `a` e `b`.
- `u.window(t, de, até, entrada, saída)`: 0 a 1 com entrada e saída suaves.
- `u.spring(x)`, `u.easeInOut(x)`, `u.easeOut(x)`, `u.lerp(a, b, x)`, `u.clamp(x, a, b)`, `u.deg(graus)`.
- `u.hash(n)`: pseudoaleatório fixo de 0 a 1.
- `u.rng(semente)`: gerador.

---

## 3. `tela.js`

```js
BQ.defineHud(({ H, C, B, M, brand }) => [
  H.title({ from: 0, until: C.promessa - 0.1, kicker: "Regou todo dia?", lines: ["E a planta", "*morreu?*"] }),
  H.steps({ from: C.c1 - 0.2, until: C.mito, labels: ["Folha", "Terra", "Cheiro"], at: [C.c1, C.c2, C.c3] }),
]);
```

Todo widget tem `from` e `until` (use marcas) e entra e sai animado. `*palavra*` pinta a palavra com a cor de destaque. Tons: `accent`, `danger`, `success`, `info`, `warn`, `ink`.

| widget | uso | opções |
|---|---|---|
| `H.title` | gancho no topo (aparece já no quadro 0) | `kicker, lines[], y=260, size, bg` |
| `H.answer` | carimbo no centro ("Ainda não.") | `text` (`\n` quebra), `tone="danger"`, `y=700`, `tilt` |
| `H.bigNumber` | número gigante num círculo | `value, unit, label, side="right"\|"left"\|"center", x, y=820, radius, tone` |
| `H.steps` | barra 1-2-3 no topo | `labels[], at[]` (instante em que cada passo fica ativo), `y=230` |
| `H.card` | card com ícone, título e texto | `title, text, icon` (1–2 caracteres ou emoji: "✓", "!", "💧"), `tone, y=1080, w` |
| `H.compare` | lado a lado (mito × verdade) | `left:{title, value, text, tone, icon}`, `right:{...}`, `y=980, h` |
| `H.list` | lista item a item | `title, items:[{text, at, ok}], y=900` |
| `H.callout` | rótulo preso a uma âncora 3D | `anchor, text, tone, dx=140, dy=-110, top=330, bottom=1320`. A largura acompanha o texto e o rótulo é mantido em x 60–1020 |
| `H.text` | texto livre | `text, x, y, size, color, align` |
| `H.flash` | clarão de impacto | `at, dur=0.35, strength, color` |

- **Automáticos:**
  - **legendas palavra a palavra** (y ≈ 1440);
  - **CTA** com logo, nome, @ e WhatsApp no bloco `cta`, só no modo empresa: card em y ≈ 1020–1350. Feche `card`/`compare`/`list`/`bigNumber` antes de `C.cta`, e deixe o personagem da marca no terço de cima.
- Cada widget deve ficar **pelo menos 1 s** na tela.
- **Zonas seguras** (1080×1920):
  - nada importante acima de y=200 ou abaixo de y=1560 (interface do Instagram);
  - nada na faixa direita (x > 960) na metade de baixo.

## 4. `sons.js`

```js
BQ.defineSfx(({ C, M }) => [
  ["hook", 0.15, "whoosh-short", 0],   // [marca ou segundos, deslocamento, "som", ganho dB]
  ["c1", 0, "pop", 0],
]);
```

Sons (todos sintetizados, livres de direitos):
- **transições:** `whoosh`, `whoosh-short`, `swoosh`, `riser`;
- **destaques:** `pop`, `click`, `click-soft`, `tick`, `ding`, `chime`, `sparkle`, `notification`;
- **positivo e negativo:** `success`, `error`, `buzz`;
- **impacto:** `impact-bass`, `thud`;
- **objetos:** `drop` (gota), `page`, `glitch`, `spark`.

O estúdio nivela e mixa sozinho: efeitos ficam de 4 a 12 dB abaixo da voz (autoajuste) e o master vai a −14 LUFS. Use `dB` só para preferência (−4 mais baixo, +3 mais alto). Um som por acontecimento visual, no mesmo instante da animação.

## 5. `momentos.js` (opcional)

```js
BQ.defineMoments((C, B) => ({ tampaFecha: C.abre + 0.9, meioCamada2: (B.camada2.start + B.camada2.end) / 2 }));
```

Fica disponível como `M.tampaFecha` na cena, na tela e nos sons (em `sons.js` também como string `"tampaFecha"`).

## 6. `marca.json` (modo empresa)

```json
{
  "mode": "empresa",
  "name": "Verde Vivo Jardinagem",
  "handle": "@verdevivo",
  "whatsapp": "(11) 90000-0000",
  "logo": "logo.png",
  "ctaText": "Chama no WhatsApp (11) 90000-0000",
  "colors": { "accent": "#1f7a4d", "accentLight": "#8fe3a8", "ink": "#0f2a1c", "success": "#16a34a", "danger": "#dc2626" },
  "fonts": { "display": "\"Barlow Condensed\"", "text": "\"Bricolage Grotesque\"" },
  "fontFiles": [{ "family": "Poppins", "weight": 800, "file": "fontes/poppins-800.woff2" }]
}
```

- **`mode`:** `"sem-marca"` (padrão) remove logo, CTA e uniforme de marca.
- **`logo`:** PNG, JPG, SVG ou WebP na pasta do projeto, de preferência quadrado.
- **Cores:**
  - `accent` é a principal;
  - `accentLight` é o destaque em fundo escuro;
  - `ink` é o fundo escuro dos cards.
- **No cena.js:** `brand.color("accent")` devolve a cor; `brand.logo` é a textura (ou null).
