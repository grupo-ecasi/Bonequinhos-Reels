# Arquitetura detalhada — Bonequinhos-Reels

> **Atualização de 01/11 (após o spike F0):**
> - a voz de IA no navegador (Kokoro/Piper) **saiu do produto**, porque o usuário não aprovou a qualidade;
> - a narração é gravada no estúdio ou enviada pronta, de preferência um arquivo por bloco;
> - o AAC é 192k (limite do Windows).
>
> Resultados em `dev\spike\RESULTADOS-F0.md`.

Complemento do `PLANO.md`. Origem: análise de `house\videos\reboco-novo` (**R**) e `ecasi\series\energia-eletrica\ep2-residencial-v2` (**E**) no repositório `C:\app.Modelar-Concorrentes-MKT` (01/11/2026).

## 0. Decisões-chave
- **Código só em `bonequinho-estudio`** (motor, lib 3D, áudio, exportador, montador, validadores). As outras 8 skills são só conhecimento e não executam arquivos umas das outras.
- **Sem dependência de rede em render, mix e export.** O HTML embute:
  - `vendor.min.js` (Three 0.184.0 + addons + Mediabunny);
  - fontes e logo em data URL;
  - SFX MIT em base64.

  Nada é baixado em uso normal. Só um Whisper opcional futuro baixaria modelo, e só se a pessoa pedir.
- **Tempos calculados no navegador.** O tema nunca usa segundos absolutos, só marcas `C.x`. O estúdio estima `C` por sílabas, recalcula com a voz e reconstrói a cena.
- **Marcação no roteiro** substitui `cues_spec.json` e `fix_transcript.py`.
- **Sem GSAP.** O motor tem um avaliador próprio de timeline (`track` + easings de R).
- **Whisper sai do caminho principal.** O texto é conhecido, então o alinhamento é feito por pausas + programação dinâmica + sílabas.

## 1. Skills
| Skill | Gatilho (≤200 caracteres) | Arquivos principais |
|---|---|---|
| `bonequinho-reels` | Cria Reels de bonequinho 3D sobre qualquer tema: roteiro, cena, sons e estúdio HTML que exporta MP4 no Chrome. | `SKILL.md`, `scripts/locate_suite.py`, `references/{fluxo-detalhado,briefing,entrega-e-iteracao,resumo-minimo}.md` |
| `bonequinho-roteiro` | Roteiro viral (gancho, 3 camadas, mito, fonte, loop) e texto da narração com marcas de tempo. | `references/{estrutura-viral,marcacao,fontes-e-revisao}.md`, `references/exemplos/*.md` |
| `bonequinho-narracao` | Texto para a fala, gravação bloco a bloco no estúdio, guia para gerar a voz grátis em serviço externo e subir o áudio, sincronia. | `references/{escrever-para-fala,gravar-a-voz,voz-externa-gratis,sincronia}.md` |
| `bonequinho-cena-3d` | Personagens, cenários, ações com IK, câmera e efeitos da biblioteca do estúdio. | `references/{api-lib3d,plano-de-cenas,personagens,cenarios-e-objetos,acoes-e-ik,camera,efeitos,objeto-novo,licoes}.md` |
| `bonequinho-tela` | Título, cards, número gigante, barra 1-2-3, callouts, legendas e CTA nas zonas seguras. | `references/{api-tela,layout-e-zonas-seguras,gramatica-visual,cta}.md` |
| `bonequinho-sons` | Efeitos sintetizados presos às animações, mixados abaixo da voz, master -14 LUFS. | `references/{catalogo-sons,mixagem}.md` |
| `bonequinho-marca` | Modo empresa (logo, cores, fontes, @, WhatsApp, CTA) ou modo sem marca. | `references/{paletas,fontes,uniformes}.md` |
| `bonequinho-publicacao` | Legenda do Instagram com SEO, texto alternativo, título da capa, comentário fixado, checklist. | `assets/modelo-legenda.md`, `references/seo-instagram.md` |
| `bonequinho-estudio` | Motor: gera o HTML que pré-visualiza e exporta MP4, valida a cena e reabre projetos. | ver §1.2 |

### 1.1 Como as skills se encontram
- **Marcador:** cada skill tem um `bq-suite.json`, por exemplo `{"suite":"bonequinho-reels","skill":"…","versao":"1.0.0","api":1}`.
- **`locate_suite.py`** procura os marcadores nesta ordem:
  1. pasta-mãe da própria skill;
  2. `/mnt/skills/*/*/`;
  3. `~/.claude/skills/*/`;
  4. pasta atual;
  5. `os.walk('/')` com profundidade até 6.

  Ele imprime `{skill: caminho}` e para com uma instrução clara se faltar o estúdio.
- **Leitura prévia:** o orquestrador lê o SKILL.md de cada skill antes de usá-la (o claude.ai pode copiar a pasta só depois dessa leitura).
- **Caminhos:** no claude.ai, `${CLAUDE_SKILL_DIR}` não é expandido. Usar caminhos absolutos devolvidos pelo `locate_suite.py`.

### 1.2 `bonequinho-estudio/`
```
SKILL.md, bq-suite.json
scripts/  build_studio.py, check_project.mjs, contract_test.mjs, brand_kit.py, extract_project.py,
          lib/{acorn.mjs, stubs.mjs, font-metrics.json, api-index.json}
assets/runtime/  template.html, estudio.css, vendor.min.js, base.js, timeline.js, lib3d-*.js (6),
                 tela.js, legendas.js, audio-synth.js, audio-mix.js, narracao.js, alinhamento.js,
                 exportar.js, relatorio.js, ui.js, LICENCAS.txt
assets/fontes/   Barlow Condensed 700/800/900, Bricolage Grotesque (OFL.txt)
assets/sfx-mit/  impact-boom, zhhh, riser, glass-shatter, pop-back + LICENSE
exemplos/        pintura-reboco/, quadro-eletrico/, cozinha/  (anonimizados)
references/      contrato.md, validacao.md, exportar-e-problemas.md
```

### 1.3 Pasta de desenvolvimento
```
C:\app.Bonequinhos-Reels\
  LEIA-ME.md, docs\
  skills\bonequinho-*\     código-fonte das 9 skills
  dist\                    bonequinho-*.zip + pacote-completo\COMO-INSTALAR.md
  dev\vendor\              package.json (three@0.184.0, mediabunny, esbuild, acorn), build_vendor.mjs
  dev\build\build_all.py   gera api-*.md e catalogo-sons.md do JSDoc, valida limites, zipa
  dev\test\                unit (node --test), run_e2e.mjs, check_mp4.py, check_mix.py, parity_reboco.py, fixtures\ (nunca zipado)
  dev\spike\               F0
```

### 1.4 Limites do empacotamento
- O zip tem como raiz a pasta com o mesmo nome do `name`.
- `name`: minúsculas, números e hífen, até 64 caracteres.
- `description` ≤ 200 caracteres.
- SKILL.md < 500 linhas.
- < 200 arquivos e cerca de 3 MB por zip.

## 2. Contrato do projeto (`api: 1`)

### 2.1 Arquivos do tema (pasta de trabalho `/tmp/bq/<slug>/`)
- **`projeto.json`:** `{api:1, slug, titulo, modo:"empresa"|"sem-marca", fps:30, capa:{marca:"hook", dt:0.4}}`.
- **`roteiro.txt`:**
  ```
  # gancho
  [[ontem]]Rebocou ontem. Já [[pode]]pode [[pintar]]pintar? [[ainda]]Ainda [[nao]]não.
  # camada1
  [[c1]]Camada {1|um}: [[esperar]]esperar. {28|Vinte e oito} dias de [[cura]]cura.
  ```
  Regras:
  - `[[x]]` marca a próxima palavra;
  - `{exibe|fala}`: a legenda usa o texto da esquerda e a voz o da direita;
  - `...` é pausa longa;
  - blocos fixos: `gancho, promessa, problema, camada1-3, mito, norma, cta, loop, extra-*`.
- **`momentos.js`** (opcional): `BQ.defineMoments(C => ({ tampaFecha: C.hook + 0.93 }))`. É a fonte única dos instantes usados pela cena e pelos sons.
- **`cena.js`, `tela.js`, `sons.js`, `publicar.md`.**

### 2.2 API
Scripts clássicos, sem `import`.
```js
BQ.defineScene(({ THREE, lib, C, M, B, brand, stage }) => {
  const set = lib.env.house({ facade: "reboco", site: true, street: true });
  const pintor = lib.person({ role: "brand", outfit: "tee-pants", shirt: brand.color("accent"),
                              head: "cap", logo: brand.logo && { back: "large", chest: "small" }, skin: 4 });
  lib.act(pintor, [["walk", C.c2 - 0.9, C.limpar + 0.3, { to: [0.25, 0, 0.66] }],
                   ["reach", C.escova - 0.5, C.esfarela - 0.2, { hand: "R", target: set.at("wall"), wiggle: "scrub" }]]);
  lib.camera.keys([{ t: 0, look: [1.25, 1.95, 0.6], dist: 6.6 }, { t: C.end, look: [1.25, 1.95, 0.6], dist: 6.6 }]);
  return (t) => { /* atualização específica do tema */ };
});
BQ.defineHud(({ H, C, M, B, brand }) => [
  H.title({ from: 0, until: C.ainda - 0.12, holdFromStart: true, kicker: "Rebocou ontem.", lines: ["Já pode", "*pintar?*"] }),
  H.steps({ from: C.camadas, labels: ["Esperar", "Limpar", "Selar"], states: [[C.c1, 1, "on"]] }),
  H.callout({ anchor: "agua", text: "água", from: C.agua - 0.1, until: C.agora }),
]);
BQ.defineSfx(({ C, M }) => [["hook", 0.3, "whoosh-short", 2], ["ainda", 0, "impact-bass", 0]]);
```
- **`C`** é um Proxy: ler uma marca inexistente lança erro com a lista de marcas.
  - `C.hook = 0`;
  - `C.end = max(fimÚltimaPalavra + 0.9, duraçãoVoz + 0.2)` (regra de `sync_cues.py:44`);
  - `B.<bloco> = {start, end}`.
- **CTA:** dura de `C.cta` até `C.loop + 0.39` (`sync_cues.py:81`). Só existe no modo empresa.
- **`brand`:** cores por papel (ink, ground, accent, success, danger, captionBg, captionNum), fontes, `logo` (Texture | null), nome, @, WhatsApp.

### 2.3 Fluxo dos tempos
1. **Estimado:** `C` calculado por sílabas pt-BR + pausas por pontuação (constantes calibradas em R e E).
2. **Voz:**
   - **um arquivo por bloco** (recomendado): gravado no teleprompter ou enviado assim. Os limites dos blocos saem exatos, e o alinhamento só trabalha dentro de cada bloco;
   - arquivo único: alinhamento completo (S3).

   A saída tem o formato de `transcript.json`.
3. **Reconstrução:** se `C` mudou, `dispose` da cena + `defineScene` de novo + tela, legendas e mix (< 300 ms).
4. **Ajuste manual:** ±50 ms por marca, com arrasto na timeline; exporta `sincronia.json`.

### 2.4 Quadro e export
1. **Montagem de cada quadro `frame(t)`:**
   1. `update(t)` do tema;
   2. a lib atualiza atores, câmera e efeitos;
   3. `composer.render()` (bloom);
   4. no canvas 2D de 1080x1920: drawImage do WebGL, vinheta, callouts, tela, legendas, CTA.
2. **Export (Mediabunny):**
   - `Output(Mp4OutputFormat{fastStart:"in-memory"}, BufferTarget)`;
   - `CanvasSource` H.264 10 Mbps, quadro-chave a cada 2 s, codecs testados `avc1.64002A`, `4D402A`, `42E02A` (hardware → software);
   - laço `t=i/30` com `await source.add(t,1/30)`;
   - `wakeLock`, aviso de aba oculta, tratamento de `webglcontextlost`;
   - áudio: `AudioBufferSource` AAC 48 kHz, testando 256k → 192k → 160k → 128k → Opus (o Windows só aceita até 192k).
3. **Saídas:** `<slug>.mp4`, `<slug>-capa.jpg` (sem legendas), `<slug>-legenda.txt`; opcionais `-mix.wav` e `.srt`.

### 2.5 Interface
- **Prévia 9:16:** timeline com blocos e marcas.
- **Abas:**
  - **Narração:** gravar com teleprompter por bloco (refazer só um bloco); subir arquivo (um por bloco ou único); sincronia (ajuste ±50 ms, toque); copiar texto.
  - **Sons:** volume e relatório de mix.
  - **Exportar.**
  - **Publicar:** botões de copiar.
  - **Relatório:** problemas, "Copiar relatório para o Claude", "Folha de contato" (PNG 4x4 com 16 quadros nas marcas).

### 2.6 Montador `build_studio.py`
- **Ordem dentro do HTML:**
  1. `<style>` com CSS + `@font-face` em data URL;
  2. `<script type="application/json" id="bq-project">` com fontes, marca e publicação (permite reabrir);
  3. `vendor.min.js`;
  4. runtime;
  5. SFX base64;
  6. cada parte do projeto num `<script>` com `//# sourceURL=cena.js`;
  7. `BQ.boot()`.
- **Cuidados:** escapa `</script`, roda os validadores e grava em `/mnt/user-data/outputs/<slug>-estudio.html` (cerca de 2 MB).
- **`brand_kit.py`** (Pillow, fontTools):
  - logo quadrado, em círculo e transparente;
  - paleta por k-means;
  - contraste WCAG;
  - fontes via `npm pack @fontsource/<familia>` (latin woff2), com fallback para as fontes embutidas;
  - métricas das fontes.

### 2.7 Validadores
- **`check_project.mjs`** (acorn):
  - sintaxe;
  - proíbe `Math.random`, `Date`, `performance`, rAF, timers, `fetch`/XHR, `import`/`export`, `eval`/`Function`, `document`/`window`/`navigator`/`localStorage`, `while(true)`;
  - todo `C.x` tem `[[x]]`, as marcas estão em ordem;
  - sons, `H.*` e `lib.*` conferidos contra `api-index.json` (Levenshtein);
  - número ou sigla fora de `{exibe|fala}` gera aviso;
  - duração estimada entre 55 e 95 s.
- **`contract_test.mjs`** (THREE real em `vm` + renderer e canvas falsos):
  - `update(t)` de 0 a `C.end` a cada 0,1 s sem exceção nem NaN;
  - hash de matrizes, cores e opacidades em 20 tempos igual entre contextos, em ordem e pulando direto para o tempo;
  - loop (t=0 ≈ t=end, 5 cm);
  - texto transbordando, sobreposição, zonas seguras;
  - âncoras fora do quadro;
  - erro de IK > 3 cm;
  - sons fora de [0,end], ataques a < 60 ms, densidade.

## 3. Biblioteca 3D (cerca de 3.800 linhas)
| Módulo | Linhas | Origem |
|---|---|---|
| `lib3d-base.js` | ~450 | Utilidades determinísticas (R 157-187; E 214-253). `mat/smooth/canvasTex/textTex` (R 190-214; E 255-281). Texturas grama, concreto, asfalto, tijolo, telha, reboco, umidade (R 215-301); porcelanato, azulejo, metal, sprite, queimado, faixa refletiva (E 282-412). Primitivas e `bendPath/wire` (E 446-492). |
| `lib3d-stage.js` | ~300 | Renderer ACES/PCFSoft (R 144-151). Composer, bloom, PMREM RoomEnvironment (E 97-106, 199-212). Céu, sol, lua, nuvens (R 354-397). Timelapse dia/noite (R 1157-1221). Luz interna (E 724-750). `dispose()`. |
| `lib3d-world.js` | ~1.050 | `env.house` (R 417-508). `env.site` (R 510-622). Árvores (R 624-649). Chão e rua (R 399-415). `env.room(kind)`: sala, cozinha, banheiro, quarto, escritório, área de serviço (E 752-812), rua, quintal. Cerca de 40 objetos com âncoras (`obj.at('torneira')`); máquina de lavar (E 1031-1088); quadro elétrico (E 813-1030). |
| `lib3d-people.js` | ~700 | `person(opts)` = `makePerson` (R 756-904) + `makeElectrician` (E 1198-1428): 6 tons de pele, cabelos, boné, capacetes, óculos, barba, 7 roupas, calçados, luvas, cinto, crachá, logo no peito, nas costas (estampa cilíndrica de E 1268-1294) e no boné. `seed`. Cerca de 15 ferramentas: rolo e trincha (R 906-929), detector (E 1179-1196) e outras. |
| `lib3d-motion.js` | ~550 | IK `reach` com polo e slerp (E 1430-1458). `animateBody`, `idleArms`, piscada (R 967-990; E 1459-1479). `lib.act()`: walk, face, reach, point, wave, thumbsUp, shrug, headShake, nod, celebrate, scare, press, scrub, paint, look, kneel, sit, hold. Câmera `shot/keys/cameraAt` (R 1029-1073), `camera.frame`, `shake` (E 1686-1688). `anchor/worldOf` (R 1078-1081). |
| `lib3d-fx.js` | ~750 | Fluxo de energia (E 494-543), superfície eletrificada (E 545-568), arcos com Line2 (E 570-635), faíscas (E 637-695), fumaça (E 697-722), pó (R 745-752). `cutaway`/lupa (R 651-743, 1240-1308). `surfaceDefects` (R 694-721). Água, marcadores ✅/❌, confete, pulso, raio-x. |

Callouts passam de DOM/SVG para Canvas 2D (R 1113-1146, E 1604-1638).

## 4. Áudio
- **`audio-synth.js` (~800 linhas):**
  - Port de `synth_sfx.py` 18-124: `t_axis`, `band` (FFT radix-2, Butterworth com fase zero), `norm`, `fade`, `clicks`, `buzz`, `hum`, `sh_flicker`, `env_adsr`, `modes`. PRNG xoshiro128** + Box-Muller.
  - Os 20 sons (306-327): arc-crackle, zap-short, big-arc, spark-burst, spark-small, hum-swell, overload-hum, sizzle, breaker-on/off, dr-trip, button, rattle, surge, power-down/up, ground-flow, leak, lid-close/open. Pós-processamento 340-345.
  - Genéricos com os nomes dos arquivos Pixabay: pop, whoosh(-short), click(-soft), chime, ping, notification, error, glitch-1/3, impact-bass(-1), sparkle, success, ding, tick.
  - Sons de objetos: página, gota, respingo, bolha, spray, escova, rolo, batida, furadeira, passos, porta, interruptor, bipe, digitação.
- **`audio-mix.js` (~650 linhas, tudo em Float32Array):**
  - Cada som: corta o início em 5% do pico, nivela o RMS dos primeiros 250 ms a -18 dBFS, limita o pico a -3 dBFS, aplica `SOUND_GAIN` (`build_sfx.py:160-171`).
  - Barramento: sidechain pela voz (limiar 0,1, razão 2, ataque 5 ms, liberação 200 ms), passa-alta 90 Hz, limitador 0,7 com 5 ms de antecipação (`build_sfx.py:189-201`).
  - Autoajuste (`measure_mix.py`): diferença entre -8 e -3 dB (alvo -6), pico do SFX abaixo do pico da voz, 2 passadas.
  - Voz: passa-alta 70 Hz, -16 LUFS / -1,5 dBTP.
  - Master: BS.1770-4 (ponderação K, blocos de 400 ms, cortes em -70 e -10), alvo -14 LUFS; pico verdadeiro com sobreamostragem 4x; limitador a -1 dBTP.
- **`narracao.js` + `alinhamento.js`:**
  - Gravação com getUserMedia + MediaRecorder, bloco a bloco, com teleprompter.
  - Upload: um arquivo por bloco ou arquivo único.
  - Alinhamento (porte de `dev/spike/s3/align.mjs`): VAD por energia (10 ms, limiar relativo 0,5, pausa ≥ 80 ms) → programação dinâmica entre fronteiras de palavra e pausas → divisão por sílabas no tempo de fala.
  - Ajuste manual ±50 ms e sincronia por toque. Whisper fica como possível refinamento futuro.
- **`legendas.js`** (`build_captions.py:22-52`):
  - até 5 palavras / 24 caracteres;
  - quebra em pausa de 0,15 s;
  - início `max(.12, ini-.05)`, fim `min(fim+.5, próximo-.05)`;
  - opacidade 0,45 → 1;
  - números em destaque.

## 5. Riscos
| Risco | Mitigação |
|---|---|
| Narração depende de gravação ou de serviço externo | Teleprompter bom no estúdio; guia passo a passo do serviço externo, com os termos conferidos na F9 |
| Alinhamento falha em áudio ruim (celular, ruído) | Arquivo por bloco; ajuste manual; toque; teste de robustez do S3 (outra voz, ruído, palavra pulada) |
| Claude escreve a cena sem ver o resultado | API declarativa, `camera.frame`, validadores, exemplos, folha de contato |
| API inventada | `api-index.json` + docs gerados do código |
| `file://` (cache de modelos, workers, contexto seguro) | Plano B `abrir-estudio.bat` (servidor PowerShell HttpListener com COOP/COEP); plano C: motor no Cloudflare Pages |
| Sem AAC (Windows N, Linux) | AAC WebCodecs → WASM → ffmpeg.wasm só para o áudio |
| Export lento | Sombra 1024, bloom desligado, 720p; wakeLock; MediaRecorder como último recurso |
| Conteúdo técnico errado | Fontes obrigatórias, [VERIFICAR], revisão humana |

## 6. Spike F0
- **S1, claude.ai:** `ls -R /mnt/skills`, `find / -name bq-suite.json`, Python e Node, `npm view @fontsource/poppins`, PIL e fontTools, download de 5 MB, script de 90 s, descrição de 200 caracteres.
- **S2, núcleo em `file://`:**
  - Conteúdo: `makePerson` de R + bloom de E + card + 2 sons + voz de R; export de 5 s e de 90 s.
  - Registrar: `isSecureContext`, codecs suportados, fps do export, memória, aba oculta, ffprobe, cor, aceitação pelo Instagram.
  - Meta: ≤ 2,5x o tempo real (referência atual: 5m49 para R, 11m08 para E).
- **S3, alinhamento sem modelo:** vs `R\assets\transcript.json` (169 palavras); erro mediano ≤ 0,10 s, máximo ≤ 0,25 s.
- **S4, Whisper:** tiny/base, WASM/WebGPU, CORS do HF, cache, tempo para 71 s.
- **S5, vozes:** Kokoro (pf_dora, pm_alex) vs Piper (faber, cadu, jeff); tamanho, velocidade, pronúncia de `{NBR|ene bê erre}`.
- **S6, áudio:** sons JS vs WAV de `E\assets\sfx\synth\` (correlação de envelope ≥ 0,9; centroide ±15%); medidor JS vs ebur128 (±0,3 LU).
- **S7, tela:** o momento mais carregado de R em ≤ 8 ms por quadro.

## Fontes
- Skills: https://claude.com/docs/skills/how-to
- Vozes Piper pt_BR: https://huggingface.co/rhasspy/piper-voices/tree/main/pt/pt_BR (model cards de faber, cadu, jeff, edresson)
- Licença lessac (Blizzard 2013): https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html
- kokoro.js: https://github.com/hexgrad/kokoro/tree/main/kokoro.js · vits-web: https://github.com/diffusionstudio/vits-web
- Mediabunny: https://mediabunny.dev/api/ · AudioEncoder: https://developer.mozilla.org/docs/Web/API/AudioEncoder
- Timestamps do Whisper em WebGPU: https://github.com/huggingface/transformers.js/issues/820
