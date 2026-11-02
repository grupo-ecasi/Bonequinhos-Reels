# Resultados do spike F0 (01/11/2026)

Máquina de teste: Windows 10, Chrome 156, Intel UHD 620 (GPU integrada, notebook comum).

## S1: ambiente de skills do claude.ai ✅
Detalhes em `s1/RESULTADO.md`. Resumo:
- skills ficam em `/mnt/skills/plugins/<nome>/`, e as skills irmãs ficam visíveis;
- Python 3.12, Node 22, ffmpeg 6.1, PIL/fontTools/numpy;
- npm funciona; CDN e HuggingFace não;
- sem Chrome, 1 CPU, comando de 90 s OK;
- download de 5 MB OK.

## S2: estúdio em `file://` exportando MP4 ✅
Arquivo: `s2/spike-s2.html` (2,2 MB), montado por `s2/build_spike.py`. Contém o bonequinho de R + bloom + card, callout e legenda em Canvas 2D + 2 sons sintetizados + voz real.

| Medida | Resultado |
|---|---|
| `isSecureContext` em `file://` | true (WebCodecs liberado) |
| H.264 | `avc1.64002A` (High 4.2) com hardware |
| AAC | Sim, mas o encoder do Windows **só aceita até 192 kbps** (256k falha e cai para Opus). Usar 192k |
| Export de 5 s | 8,3 s (1,67x o tempo real) |
| Export de 90 s | **125 s (1,39x o tempo real)**, 114 MB, 10 Mbps |
| Tempo por quadro | render 3D + tela ≈ 19-20 ms; espera do encoder ≈ 25-32 ms |
| ffprobe | H.264 High, yuv420p, 1080x1920, 30 fps constantes, 2.700 quadros, AAC LC 48 kHz estéreo, `moov` no início (faststart) |
| Quadros pretos | nenhum |
| Loudness sem master | -13,8 LUFS, TP +0,1 dBTP → o limitador do master é necessário (F4) |
| Cor | `color_transfer=iec61966-2-1` (sRGB); o render do HyperFrames marca bt709. Ver na F1 se vale forçar bt709 |
| OPFS em `file://` | **Bloqueado** (SecurityError). Cache API funciona, e localStorage também |
| Download pelo `<a download>` | Funciona (vai para Downloads) |
| Aceitação pelo Instagram | Falta testar com o usuário (o formato é idêntico ao do render atual) |

O S7 (custo da tela) está coberto: o quadro com card, número, callout, legenda e vinheta fica dentro dos cerca de 20 ms.

## S3: sincronia sem Whisper ✅
Arquivos: `s3/align.mjs` (algoritmo) e `s3/run_s3.mjs` (medição). O teste usa a voz do reboco-novo (71 s, 169 palavras) comparada ao `transcript.json` (Whisper, com tempos quantizados em 80 ms).

| | Mediana | p90 | Máx. |
|---|---|---|---|
| Todas as palavras | 0,08 s | 0,18 s | 0,33 s |
| 48 palavras-âncora (cues) | **0,08 s** | 0,18 s | **0,22 s** |

Tempo de cálculo: cerca de 2 s em Node. Parâmetros padrão: limiar relativo 0,5 e pausa mínima de 80 ms.

## S5: voz de IA grátis no navegador (em teste: falta a avaliação de ouvido)
Arquivos: `s5/s5.html` e as amostras em `s5/amostras/`. O texto é o trecho do reboco-novo (cerca de 13 s).

| Voz | Licença | Download | Velocidade (nesta máquina) |
|---|---|---|---|
| Piper `pt_BR-faber-medium` (vits-web) | Pesos MIT, **base lessac não comercial** | 60 MB | 33 s para 12,7 s de áudio, mas inclui baixar de novo a cada geração (sem cache em `file://`) |
| Kokoro `pf_dora` / `pm_alex` q8, WASM | Apache-2.0 | cerca de 90 MB | 8,2x o tempo real (70 s de narração ≈ 10 min) ❌ |
| Kokoro `pm_alex` / `pf_dora` fp32, **WebGPU** | Apache-2.0 | cerca de 310 MB (82 s na 1ª vez) | **2,25x o tempo real** (70 s ≈ 2,6 min) ✅ |

- **Fonemização pt-BR:** o `piper_phonemize` (espeak-ng em WASM, carregado do jsdelivr) funciona em `file://` e gera IPA certo. Exemplo: "pode" → `pˌɔdʒy`. O `phonemizer` do kokoro-js só tem inglês, por isso o Kokoro recebe o IPA do piper_phonemize.
- **Cache em `file://`:** o OPFS falha, mas a Cache API funciona. O adaptador do estúdio deve guardar os modelos na Cache API para não baixar de novo.
- **Pendente:** avaliação de ouvido das 3 amostras pelo usuário.

### Decisão (01/11): nenhuma voz aprovada
O usuário ouviu as 3 amostras e **nenhuma voz é boa o bastante**. A voz de IA no navegador sai do produto. A narração fica assim:
- gravar no estúdio (teleprompter);
- subir um áudio pronto, com guia para gerar a voz de graça num serviço externo de qualidade.

Consequências:
- o estúdio não baixa modelos de voz;
- o caminho principal da sincronia é o alinhamento do S3;
- o S4 (Whisper no navegador) fica como refinamento opcional, sem prioridade.

## S4 e S6
- S4 (Whisper em `file://`): adiado, porque o S3 já atende à meta.
- S6 (sons em JS × WAV de `synth_sfx.py`, medidor JS × ebur128): vai ser feito dentro da F4 (áudio).

## S3b: robustez da sincronia (`s3/robust.mjs`)
| Caso | Mediana | p90 | Máx. | ≤ 0,25 s |
|---|---|---|---|---|
| R limpo (referência) | 0,08 | 0,18 | 0,33 | 97% |
| E limpo (outro locutor, 203 palavras) | 0,08 | 0,18 | 0,74 | 96% |
| R "celular" (300–3400 Hz + ruído rosa + eco) | 0,11 | 0,23 | 0,52 | 91% |
| E "celular" | 0,12 | 0,23 | 0,64 | 92% |
| R com palavra pulada | 0,08 | 0,18 | 0,33 | 96% |
| E com palavra pulada | 0,08 | 0,21 | 1,05 | 93% |
| R / E um arquivo por bloco | 0,08 | 0,17 | 0,33 / 0,74 | 98% / 96% |
| E celular, um arquivo por bloco | 0,11 | 0,24 | 0,66 | 91% |

**Decisão:**
- Com áudio de celular a mediana passa um pouco da meta (0,11-0,12 s).
- O **ajuste manual das marcas (±50 ms, arrastar) e a sincronia por toque entram na F1 como recurso principal** da interface, junto com a lista das marcas que o algoritmo achou duvidosas.
- O arquivo por bloco continua recomendado, por dar limites exatos entre blocos e permitir refazer só um trecho.
