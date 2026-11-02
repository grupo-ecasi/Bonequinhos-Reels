# Progresso

## 01/11/2026

### F0: spike (concluído)
Ver `dev/spike/RESULTADOS-F0.md`.
- S1, S2 e S3 passaram.
- S5: o usuário reprovou as vozes de IA no navegador, então a narração fica gravada no estúdio ou enviada pronta.
- O teste de microfone em `file://` passou no Edge.

### F1 + F2/F3 mínimas (concluído)
Motor do estúdio em `skills/bonequinho-estudio/assets/runtime/`:

| Arquivo | Papel |
|---|---|
| `base.js` | utilidades determinísticas, registro do tema, `BQ.strict` (erro claro ao ler marca inexistente) |
| `roteiro.js` | marcação `[[marca]]`/`{exibe\|fala}`/`# bloco`, estimativa por sílabas calibrada (0,172 s/unid.), C/B, legendas |
| `alinhamento.js` | porte do S3 (sincronia sem modelo) |
| `audio.js` | 21 sons sintetizados, mix com ducking, autoajuste (efeito 4–12 dB abaixo da voz), master −14 LUFS no estéreo (mono duplicado = +3,01 LU), limitador (TP ≤ −1) |
| `lib3d.js` | palco, ambientes `room`/`outdoor`, primitivas + `lib.put`, 9 objetos, `person` parametrizado, `act` (19 ações), IK, câmera por chaves, âncoras, `fx` (mark/glow/pop) |
| `tela.js` | 10 widgets em Canvas 2D, legendas palavra a palavra, CTA do modo empresa |
| `estudio.js` | boot, reconstrução, prévia, narração por bloco (teleprompter) ou arquivo único, marcas ±50 ms + toque, export MP4 (bt709), capa, folha de contato, relatório, testes |

Ferramentas:
- `scripts/build_studio.py`: monta o HTML (1,3 MB).
- `scripts/check_project.mjs`:
  - sintaxe, proibições, marcas, nomes da API com sugestão;
  - estado no `update`;
  - contrato com THREE real (NaN, determinismo, loop, tela, sons).

Medições no exemplo `planta-agua-demais` (30 s, voz Maria do Windows):
- **Sincronia:** mediana 0,02 s e máximo 0,38 s, contra o gabarito exato da voz.
- **Export:** 1,41x o tempo real. H.264 High + AAC 192k, faststart.
- **Áudio:** −13,8 LUFS, pico verdadeiro −2,0 dBTP.
- **Determinismo:** quadros em ordem e pulando direto são idênticos.
- **Persistência:** a narração volta sozinha ao reabrir (IndexedDB). Roteiro mudado deixa a narração de lado com aviso (impressão digital do texto).

Skills mínimas para o teste antecipado: `bonequinho-reels` (orquestrador) e `bonequinho-estudio`. Os zips ficam em `dist/` (`dev/build/build_all.py`).

### Ensaio cego 1 (agente novo, só com as skills)
Tema: "lavar o carro no sol forte mancha?", modo empresa, logo SVG fictício. Resultado em `dev/ensaio/`.
- Um vídeo coerente de 64 s, validado na 2ª execução, sem erros no navegador e com determinismo ok.
- Problemas vistos na folha de contato:
  - quadros escuros e "dentro" do carro: carro quase preto com câmera perto demais;
  - espuma estourada pelo bloom: emissive.
- O que mudou por causa disso:
  - o validador mostra os tempos de blocos e marcas;
  - a "visão cega" avisa sobre câmera dentro de objeto, objeto cobrindo mais de 80% da tela (exceto o assunto do close), objeto grande quase preto e emissive forte;
  - avisos de tempo curto (ações, widgets menores que 1 s, chaves de câmera menores que 0,7 s), sobreposição com o CTA e opções desconhecidas;
  - a documentação ganhou o layout do outdoor, a fórmula da câmera, o lado das mãos, os nomes de bloco especiais, as fontes em `//` e as regras de cor e luz;
  - a folha de contato não repete o mesmo momento;
  - a narração antiga é deixada de lado se o roteiro mudou (impressão digital) e os ajustes de marca ficam presos à palavra.

### Próximo
- Teste no claude.ai com o usuário (zips em `dist/`).
- F2/F3 completas: paridade com o reboco-novo e nova medição da velocidade de export numa cena pesada.
- Depois: F4 (mix em Worker), F5 (polimento da narração), F6/F7 (efeitos, ambientes, objetos), F8 (ferramentas), F9 (as 9 skills).
