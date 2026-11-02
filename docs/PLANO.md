# Plano — Bonequinhos-Reels: ferramenta genérica em Skills para claude.ai

## Contexto
Hoje os Reels de bonequinho 3D (House reboco-novo, mofo; ECASI EP1/EP2-v2) são feitos aqui no Claude Code com HyperFrames + Three.js + ffmpeg + Python, narração ElevenLabs (pago) e Whisper para sincronia. O usuário quer uma **cópia independente, gratuita e genérica** (qualquer tema), separada em skills, que qualquer pessoa use **só anexando os .zip das skills no claude.ai** e pedindo "faça um reels de bonequinho sobre X". Sem a ferramenta de busca/pesquisa de concorrentes.

Restrição verificada: o sandbox do claude.ai só acessa npm/PyPI, tem tempo limitado por chamada e não tem Chrome → o render HyperFrames/ffmpeg não roda lá.

### Decisões do usuário
- **Onde roda:** claude.ai + **estúdio HTML**. O Claude entrega um único `.html`, a pessoa abre no Chrome do computador, pré-visualiza e clica **Exportar MP4**. O export é feito quadro a quadro no navegador (WebCodecs + Mediabunny), de forma determinística e sem instalar nada. As mesmas skills também funcionam no Claude Code.
- **Narração (revisada em 01/11 após o spike S5):** o Claude **sempre entrega o texto da narração**, e há duas formas de levar a voz ao estúdio:
  - (a) **gravar no estúdio**, com teleprompter por bloco e microfone;
  - (b) **subir um áudio pronto**. A skill `bonequinho-narracao` traz um guia passo a passo para gerar a voz de graça num serviço externo de boa qualidade (ex.: Google AI Studio, CapCut), com aviso sobre os termos de uso comercial de cada um.
  - ~~Voz de IA no navegador (Kokoro/Piper)~~ **foi descartada**: o usuário ouviu as amostras e nenhuma ficou boa. O Piper pt-BR também tem licença não comercial.
- **Marca:** dois modos:
  - **empresa:** logo, cores, fontes livres (OFL), @, WhatsApp, logo na roupa e CTA final;
  - **sem marca:** sem logo, sem CTA, roupas neutras.
- **Destino:** pasta local `C:\app.Bonequinhos-Reels` + `.zip` de cada skill, sem git.

## Arquitetura
- **Todo o código vive em uma skill, `bonequinho-estudio`.** As outras são skills de conhecimento (SKILL.md + references + exemplos) que orientam o Claude a escrever os arquivos do tema. Assim, nenhuma skill depende de executar arquivos de outra.
- **O estúdio é um único HTML autocontido**, montado no sandbox por `build_studio.py` (Python puro, sem rede):
  - Three.js 0.184 + addons + Mediabunny pré-empacotados em `vendor.min.js`;
  - fontes e SFX MIT em base64;
  - motor;
  - arquivos do tema.
  - Nada é baixado da rede em uso normal. Só o Whisper opcional baixaria um modelo, e só se a pessoa pedir.
- **Arquivos que o Claude escreve por tema** (cerca de 600 linhas no máximo):
  - `projeto.json`;
  - `roteiro.txt` com marcação: `[[marca]]` antes da palavra-âncora e `{exibe|fala}` para números e siglas. Isso substitui `cues_spec.json` e `fix_transcript.py`;
  - `cena.js`: `BQ.defineScene(({THREE, lib, C, brand}) => update(t))`;
  - `tela.js`: `BQ.defineHud` com widgets desenhados em Canvas 2D (título, resposta, barra 1-2-3, número gigante, cards, callouts, CTA);
  - `sons.js`: `BQ.defineSfx`, no mesmo formato de `EVENTS` de `build_sfx.py`;
  - `momentos.js` (opcional);
  - `publicar.md`.
- **Tempos calculados no navegador:**
  1. o estúdio começa com `C` estimado por sílabas;
  2. ao receber a voz, alinha e reconstrói a cena;
  3. a pessoa pode ajustar as marcas à mão (±50 ms).
  - **Um áudio por bloco é o caminho recomendado.** O teleprompter grava bloco a bloco, e o upload também aceita um arquivo por bloco. Assim os limites dos blocos saem exatos e o alinhamento só trabalha dentro de cada bloco.
  - Com um áudio único, o alinhamento usa detecção de pausas + programação dinâmica com o roteiro + divisão por sílabas (S3: mediana de 0,08 s). Ajuste manual das marcas e sincronia por toque ficam disponíveis; Whisper opcional fica para depois.
- **Ciclo de correção:** o estúdio gera uma "folha de contato" (PNG com 16 quadros nas marcas) e um relatório. A pessoa arrasta os dois de volta no chat, e o Claude corrige o tema e remonta o HTML. `extract_project.py` reabre projetos antigos a partir do próprio HTML.
- **Validação no sandbox (sem navegador):**
  - `check_project.mjs` (acorn):
    - sintaxe;
    - proíbe `Math.random`, `Date`, DOM e `fetch`;
    - confere se toda marca `C.x` existe no roteiro;
    - confere a API contra o `api-index.json`, com sugestões.
  - `contract_test.mjs` (THREE real + stubs):
    - sem exceção nem NaN;
    - determinismo (mesmo resultado em ordem e pulando direto para o tempo);
    - loop (primeiro quadro igual ao último);
    - layout e zonas seguras;
    - IK;
    - densidade de sons.

## Skills (9)
| Skill | Papel |
|---|---|
| `bonequinho-reels` | Orquestrador: briefing curto (tema, modo de marca, como vai narrar), 1 aprovação do roteiro (pulável), `locate_suite.py` para achar o motor, entrega e iteração |
| `bonequinho-roteiro` | Estrutura viral (Gancho, Promessa 1-2-3, Problema, Camadas 1-3, Mito, Norma/Fonte, CTA, Loop), marcação, ritmo de cerca de 2,4 palavras/s, fontes com [VERIFICAR] |
| `bonequinho-narracao` | Texto escrito para a fala (números e siglas por extenso), guia de gravação (teleprompter, celular, bloco a bloco), guia para gerar a voz grátis em serviço externo (termos de uso conferidos na F9, não de memória), como corrigir a sincronia |
| `bonequinho-cena-3d` | API da biblioteca 3D, plano de cenas, câmera, efeitos, como modelar objeto novo, lições aprendidas |
| `bonequinho-tela` | Textos na tela, legendas palavra a palavra, callouts, CTA, zonas seguras do Reels |
| `bonequinho-sons` | Catálogo de sons sintetizados, regras de mix (SFX 3-8 dB abaixo da voz), master -14 LUFS |
| `bonequinho-marca` | Kit de marca (modo empresa) ou modo sem marca; `brand_kit.py` (logo, paleta, contraste, fontes via `@fontsource` do npm) |
| `bonequinho-publicacao` | Legenda Instagram/SEO, texto alternativo, título da capa, comentário fixado, checklist (porte de `legenda-instagram-seo.md`) |
| `bonequinho-estudio` | Motor ("renderizar"): runtime, biblioteca 3D, áudio, exportador, montador, validadores, exemplos |

Empacotamento:
- o zip tem uma pasta-raiz com o mesmo nome do `name`;
- `description` com no máximo 200 caracteres;
- SKILL.md com menos de 500 linhas;
- menos de 200 arquivos e cerca de 3 MB por zip;
- cada skill tem um marcador `bq-suite.json`.

`dev\build\build_all.py` valida tudo isso e gera `dist\*.zip` + `LEIA-ME.md` / `COMO-INSTALAR.md`.

## O que é portado (reuso do repositório atual)
**Base:** R = `house\videos\reboco-novo\` e E = `ecasi\series\energia-eletrica\ep2-residencial-v2\`.

### Biblioteca 3D: `lib3d-*.js`, cerca de 3.800 linhas (cerca de 1.700 adaptadas)
- **Utilidades determinísticas, texturas canvas e primitivas:**
  - R `world.html` 157-301;
  - E `world.html` 214-492.
- **Renderer ACES/PCFSoft, bloom (EffectComposer/UnrealBloom), céu/sol e timelapse:**
  - R 144-151, 354-397, 1157-1221;
  - E 97-106, 199-212.
- **`person(opts)`:** une `makePerson` (R 756-904) e `makeElectrician` (E 1199). Parâmetros:
  - pele, cabelo, boné e capacete;
  - roupas, luvas;
  - logo no peito e nas costas;
  - cerca de 15 ferramentas.
- **Movimento:**
  - IK `reach` (R 932-966, E 1430-1458);
  - `animateBody`/`swingArms`;
  - ações declarativas `lib.act()` (walk, reach, point, headShake, celebrate, scrub, paint…);
  - câmera `shot`/`keys`/`cameraAt` (R 1030-1070) + `camera.frame`.
- **Cenários:**
  - casa e obra (R 417-622);
  - `env.room(kind)` com 8 ambientes (base em E 752-812);
  - cerca de 40 objetos com âncoras.
- **Efeitos:**
  - energia, arco, faíscas, fumaça (E 494-723);
  - `cutaway`/lupa (R 651-743);
  - defeitos de superfície;
  - água;
  - marcadores ✅/❌.
- **Callouts:** passam de DOM/SVG para Canvas (R 1113, E 1604-1638).

### Tela
Porte de R `hud.html` (CSS 1-319, funções 512-625), `cta.html` e `build_captions.py:22-52` (até 5 palavras / 24 caracteres).

### Áudio
- **Síntese:** os 20 sons de `synth_sfx.py` em JS (FFT e filtros iguais, semente fixa) + sons genéricos sintetizados com os nomes dos arquivos Pixabay (pop, whoosh, click, chime, impact-bass…) + sons de objetos. Os 5 MP3 MIT de `C:\Editor.Videos` vão com a licença.
- **Mixagem:**
  - nivelamento a -18 dBFS RMS e `SOUND_GAIN` (`build_sfx.py:160-201`);
  - ducking com sidechain feito à mão;
  - passa-alta e limitador;
  - autoajuste pelas regras de `measure_mix.py`.
- **Master:** BS.1770 a -14 LUFS / -1 dBTP, AAC 192k (equivale ao `master.py`; o AAC do Windows não aceita 256k).

### Publicação
`E\legenda-instagram-seo.md` como modelo.

### O que não vai
- `app\`, `*\pesquisa\`, relatórios, `.git`;
- SFX Pixabay (a licença não permite redistribuir);
- narrações ElevenLabs, logos House/ECASI, renders.

Exemplos (`pintura-reboco`, `quadro-eletrico`, `cozinha`) vão **anonimizados**, com uma marca fictícia. Fixtures reais ficam só em `dev\test\fixtures`, para os testes de paridade.

## Narração: decisão após o spike
- O S5 testou Kokoro (Apache-2.0) e Piper (pt-BR com base não comercial) no navegador.
- O usuário ouviu as amostras e **nenhuma voz ficou boa**, então a voz de IA no navegador saiu do produto.
- Ficam:
  - gravar no estúdio, bloco a bloco;
  - subir um áudio pronto (um por bloco ou um arquivo único), com guia de serviço externo grátis.
- Resultados completos em `dev\spike\RESULTADOS-F0.md`.

## Fases
0. **Salvar o plano nos arquivos (primeira ação após aprovar):**
   - criar `C:\app.Bonequinhos-Reels\docs\PLANO.md` com este plano;
   - criar `C:\app.Bonequinhos-Reels\docs\ARQUITETURA.md` com a arquitetura detalhada: contrato `BQ.defineScene` / `defineHud` / `defineSfx`, marcação do roteiro, montador, validadores, mapa de linhas portadas, riscos e spike S1–S7;
   - adicionar um ponteiro na memória do projeto.
1. **F0, spike de risco (decide o resto):**
   - **S1:** mecânica de skills no claude.ai (zip de teste: caminhos `/mnt/skills`, Node/Python, Pillow/fontTools, download de 5 MB, limite de tempo, descrição de 200 caracteres).
   - **S2:** HTML com bonequinho de R + bloom + card + 2 sons + 5 s de voz, aberto em `file://`, exportando 5 s e 90 s. Medir:
     - suporte a H.264/AAC;
     - tempo (meta ≤ 2,5x o tempo real);
     - ffprobe;
     - aceitação pelo Instagram.
   - **S3:** alinhamento sem modelo contra `R\assets\transcript.json` (erro mediano ≤ 0,10 s).
   - **S4:** Whisper em `file://`.
   - **S5:** Kokoro vs Piper.
   - **S6:** sons JS vs WAV de `E\assets\sfx\synth`; medidor JS vs ffmpeg ebur128.
   - **S7:** desempenho da tela.
   - **Plano B se `file://` falhar:** `abrir-estudio.bat` (servidor local PowerShell, sem instalar nada).
2. **F1, esqueleto do motor:**
   - template, `ui`, `timeline` (Proxy de `C`), compositor, exportador, `build_studio.py` e `check_project.mjs` v0;
   - **também na F1** (puxado da F8):
     - reconstrução quando `C` muda (dispose + `defineScene` de novo);
     - hash de determinismo comparando quadros em ordem e pulando direto para o tempo (a prévia e a folha de contato pulam; o export roda em ordem);
   - vendor com Mediabunny reduzido (imports nomeados);
   - decidir a marcação de cor (sRGB × bt709) comparando pixels.
   - Saída: "olá" exportado em MP4.
3. **F2 mínima + F3 mínima:** `person`, 1 ambiente, câmera por keyframes, cerca de 3 widgets de tela, legendas.
4. **Teste antecipado no claude.ai (risco de produto):**
   - montar uma suíte de 2 skills (orquestrador + estúdio);
   - subir no claude.ai e fazer um tema simples de ponta a ponta, incluindo o ciclo da folha de contato;
   - ajustar a API enquanto ela ainda é pequena;
   - **só depois** investir em amplitude (F6/F7).
5. **F2/F3 completas:** paridade de tela e 3D com o exemplo `pintura-reboco` (paridade com `R\renders`). **Medir de novo a velocidade do export na cena completa de R** e corrigir o número informado ao usuário, se mudar.
6. **F4:** áudio (síntese, mix, master a -14 LUFS com AAC 192k, relatório) + S6.
7. **F5:** narração (teleprompter por bloco, upload por bloco ou arquivo único, alinhamento, ajuste manual, toque).
8. **F6:** efeitos de E + exemplo `quadro-eletrico`.
9. **F7:** ambientes, objetos, ferramentas + exemplo `cozinha` (sem marca).
10. **F8:** validadores completos, `brand_kit.py`, `extract_project.py`, docs de API gerados do JSDoc.
11. **F9:** SKILL.md e references das 9 skills, `build_all.py`, zips, LEIA-ME. Avisar o usuário para remover as skills de teste `bq-teste-a`/`bq-teste-b`.
12. **F10:** ponta a ponta, primeiro no Claude Code (skills em `~/.claude/skills`), depois no claude.ai. Ajuste das descrições com skill-creator.

As fases usam subagentes com esforço máximo, como pedido. Nada é alterado neste repositório: tudo é criado em `C:\app.Bonequinhos-Reels`.

## Verificação
1. **reboco-novo em modo empresa:** usando só as skills, refazer o vídeo com `R\assets\narracao-norm.mp3` por upload.
   - Alinhamento: erro mediano ≤ 0,1 s contra o `transcript.json`.
   - Duração: 71,09 s ±1 quadro.
   - Folha de contato vs quadros de `R\renders\` (pintor com logo, lupa, timelapse, número gigante, barra 1-2-3, CTA).
   - Loudness: ebur128 -14 ±0,5 LU, TP ≤ -1, `check_mix.py`.
   - ffprobe: H.264 yuv420p 1080x1920, 30 fps constantes, AAC 48 kHz, faststart.
   - Sem quadros pretos; primeiro quadro igual ao último.
2. **Tema novo em modo sem marca + voz gravada no estúdio:** ex. "desentupir a pia sem soda cáustica".
   - Validadores sem erro.
   - Sem logo e sem CTA.
   - Gravação bloco a bloco pelo teleprompter.
   - 60-90 s, gancho em até 1,5 s, loop.
3. **Automação local:** chrome-devtools MCP abre o HTML (`?teste=1`), sobe a voz, roda `BQ.test.export()` e checa o MP4 com `check_mp4.py`.
4. **claude.ai (manual, com o usuário):**
   1. subir os 9 zips;
   2. pedir um tema;
   3. ver o roteiro e aprovar;
   4. receber o HTML, gravar ou subir a voz, exportar;
   5. devolver a folha de contato e receber a v2;
   6. testar também "só roteiro", "sem marca" e reabrir o HTML em outro chat.
