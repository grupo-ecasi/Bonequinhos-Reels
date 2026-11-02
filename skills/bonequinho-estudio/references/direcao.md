# Direção de cena: como fazer o vídeo funcionar sem ver a tela

Você escreve a cena sem ver a tela. Estas regras vêm de vídeos que já funcionaram (pintura, mofo, quadro elétrico) e dos erros que já aconteceram.

## 1. Enquadramento vertical (9:16)
- **O quadro é estreito.** Com `fov` 34, a largura visível é cerca de **0,35 × dist**: a 5 m de distância cabem cerca de 1,8 m de largura; a 2 m, cerca de 0,7 m. Coloque personagem e objeto no mesmo `x` (±0,6 m) ou afaste a câmera.
- **Altura útil:** a 4,5 m cabem cerca de 2,8 m de altura. Um bonequinho inteiro (1,75 m) fica bem a 3,5–5 m. Close de mão ou objeto pequeno: 1,2–2 m.
- `look` na altura do assunto: peito do bonequinho ≈ 1,2; mesa ≈ 0,8; objeto no chão ≈ 0,2.
- **Topo e base da tela são da interface:** título e barra 1-2-3 ocupam y < 520, legendas ficam em y ≈ 1440. Deixe o assunto no meio. Se o assunto ficar alto, suba o `look` em 0,2–0,3 m para ele descer na tela.

## 2. Câmera
- **Uma chave por ideia:**
  - abertura média (`dist` 4–5);
  - aproxima no problema (`dist` 1,5–2,5, com `look` numa âncora);
  - volta média na explicação;
  - close no detalhe de cada camada;
  - fecha no loop igual à abertura.
- Gire `yaw` entre chaves (±20 a 40°) para dar movimento. Evite mudar `yaw` e `dist` muito de uma vez em menos de 0,8 s.
- **Mão encostando em algo:** câmera **de lado** (`yaw` 40–70) para ver o contato. De frente, a mão parece atravessar o objeto.
- **Loop:** a última chave (`t: C.end`) repete a primeira, e o título do gancho já aparece no quadro 0.
- `cut: true` para corte seco (mudança de lugar). Use pouco.

## 3. Personagens
- **Personagem da marca:** uniforme com `shirt: brand.color("accent")`, `head: "cap"`, `logo: true`. Ele **nunca** faz a prática errada: quem erra é o "morador/cliente" sem marca. No modo sem marca, ninguém tem logo.
- **Diversidade:** varie `skin` (0–5), `head` e cor de roupa entre personagens. Um personagem por ideia; dois no máximo em cena.
- **Antes de interagir com um objeto,** o bonequinho anda até ele (`walk` com `to` a cerca de 0,5 m do objeto) e vira para ele (`face` com `toward`).
- **Duração das ações:**
  - `walk`: 0,8 a 1,5 s por metro;
  - `reach`: dura pelo menos 0,8 s;
  - gestos (`headShake`, `nod`): 0,8 a 1,2 s.
- **Reação na hora da fala:**
  - "não": `headShake` na marca;
  - "certo": `nod` ou `thumbsUp`;
  - susto: `scare`;
  - explicação: `point` para o objeto.

## 4. Coerência entre fala, cena, tela e som
Cada acontecimento importante tem **a mesma marca** nos quatro lugares:
- roteiro: `[[bolha]]bolhas`;
- cena: algo muda em `C.bolha`;
- tela: `H.callout` a partir de `C.bolha - 0.1`;
- som: `["bolha", 0, "pop", 0]`.

Use `momentos.js` quando o instante não é uma palavra (ex.: `M.tampaFecha = C.abre + 0.9`).

## 5. Estados que mudam no tempo (sem guardar estado)

Tudo é função de `t`:

```js
return (t) => {
  const umido = u.track(t, [[0, 1], [C.esperar, 1], [C.secar + 1, 0], [C.loop, 0], [C.end, 1]]);
  parede.material.color.setRGB(0.55 + 0.4 * (1 - umido), 0.55 + 0.4 * (1 - umido), 0.55 + 0.38 * (1 - umido));
  mancha.visible = t > C.mancha && t < C.norma;
};
```

- Animação contínua: `Math.sin(t * vel)`.
- Aparecer com mola: `u.spring(u.prog(t, C.x, C.x + 0.6))`.
- Valor aleatório fixo: `u.hash(i)`.

## 6. Objeto novo com primitivas (exemplo: torneira)

```js
const torneira = lib.prim.group(
  lib.put(lib.prim.cyl(0.03, 0.25, "#c0c6cf", 12), [0, 0.12, 0]),            // cano vertical
  lib.put(lib.prim.cyl(0.025, 0.2, "#c0c6cf", 12), [0, 0.24, 0.09], [90, 0, 0]), // bico
  lib.put(lib.prim.box(0.12, 0.03, 0.03, "#8a939f"), [0, 0.3, 0]),           // registro
);
lib.place(torneira, [0.5, 0.9, -1.8]);
lib.anchor("bico", () => torneira.localToWorld(new THREE.Vector3(0, 0.24, 0.19)));
```

- Cores com contraste com a parede.
- Tamanhos reais em metros.
- Uma âncora em cada ponto que vai ser apontado, tocado ou rotulado.

## 7. Cor e luz
- **Nada grande quase preto:** carro, sofá ou parede escura em close vira quadro preto. Use tons médios (`#3b4252`, `#2f4f6f`) e reserve o preto para detalhes (pneu, frisos).
- **Brilho (`emissive`) só em luzes pequenas** (LED, lâmpada, faísca). Espuma, água, vidro e manchas usam cor clara sem emissive. Caso contrário o bloom estoura e vira bola branca.
- Contraste entre o assunto e o fundo: objeto claro em parede escura ou o contrário.

## 8. Erros que já aconteceram (evite)
- Câmera tão perto de um objeto grande que ele ocupa a tela inteira: o validador avisa "cobre mais de 80% da tela". Afaste (`dist` maior) ou mire numa âncora menor.
- Personagem fora do quadro no começo: confira se `x` dele está a ±0,9 m do `look` na abertura.
- Planta, objeto ou personagem flutuando: lembre que `lib.place(obj, [x, z])` põe no chão (y=0). Para pôr em cima da mesa use `[x, alturaDaMesa, z]` ou `mesa.at("top")`.
- Texto da tela cobrindo o assunto: mova o assunto (câmera) ou o widget (`y`). Card no meio-baixo (y ≈ 1000–1300) e título no topo.
- Dois widgets no mesmo lugar ao mesmo tempo, por exemplo `compare` + CTA: feche um (`until`) antes do outro abrir.
- Vídeo "parado": em cada bloco algo se mexe (câmera, personagem ou efeito). Mais de 3 s sem movimento perde a pessoa.
