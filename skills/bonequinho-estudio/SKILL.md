---
name: bonequinho-estudio
description: Motor do estúdio de Reels de bonequinho 3D. Monta o HTML único que pré-visualiza e exporta o MP4 no Chrome, valida a cena e corrige o vídeo. Use para montar, validar ou ajustar o vídeo.
---

# Estúdio Bonequinho (motor)

Transforma um projeto (roteiro, cena, tela e sons) em **um único arquivo HTML**.
- A pessoa abre o arquivo no Chrome ou no Edge do computador.
- Lá ela grava ou sobe a narração, vê a prévia e clica **Exportar MP4** (1080×1920, 30 fps, AAC).
- O vídeo é gerado no computador dela, de graça.

**Você não renderiza vídeo aqui:** o sandbox não tem navegador. Você escreve o projeto, valida e monta o HTML.

## Onde estão os arquivos desta skill

```bash
F=$(find /mnt/skills -name build_studio.py -path '*bonequinho-estudio*' 2>/dev/null | head -1)
[ -z "$F" ] && F=$(find / -name build_studio.py -path '*bonequinho-estudio*' -not -path '/proc/*' 2>/dev/null | head -1)
EST=$(dirname "$(dirname "$F")"); echo "$EST"   # ex.: /mnt/skills/plugins/bonequinho-estudio
```
Use `python3` (ou `python`, se `python3` não existir) e `node`.

Leia antes de escrever código:
1. `$EST/references/contrato.md`: a API completa (roteiro, cena, tela, sons, marca). **Obrigatório.**
2. `$EST/references/direcao.md`: como enquadrar e dirigir sem ver a tela. **Obrigatório na 1ª vez.**
3. `$EST/exemplos/planta-agua-demais/`: projeto completo de exemplo. Leia os 6 arquivos.
4. `$EST/references/correcoes.md`: como corrigir a partir da folha de contato e do relatório.

## Fluxo

1. **Crie a pasta do projeto** em `/tmp/bq/<slug>/`. O `slug` tem minúsculas, números e hífen.
   - Escreva `projeto.json`, `roteiro.txt`, `cena.js`, `tela.js`, `sons.js` e `publicar.md`.
   - No modo empresa, escreva também `marca.json` e copie o logo. Para achar o logo anexado no chat, rode `ls -R /mnt/user-data/` (os anexos costumam ficar em `uploads/`).
2. **Valide:** `node "$EST/scripts/check_project.mjs" /tmp/bq/<slug>`. Use `--json` se quiser a saída para máquina.
   - O validador mostra os **tempos estimados de cada bloco e de cada marca**. Use-os para conferir se as ações, os widgets e as chaves de câmera têm duração suficiente.
   - Corrija **todos** os ERROS.
   - Trate como erro os avisos de **enquadramento**: câmera dentro de objeto, objeto cobrindo a tela, objeto grande quase preto, brilho estourado. Eles são a sua "visão" do vídeo.
   - Os outros avisos (tempo curto, opção desconhecida, sobreposição com o CTA) também valem corrigir.
   - Repita até aparecer `✓ validação ok` sem avisos de enquadramento.
3. **Monte:** `python3 "$EST/scripts/build_studio.py" /tmp/bq/<slug>` (`--out <pasta>` muda o destino).
   - **Se a pessoa mandou o áudio da narração no chat** (MP3, WAV, M4A), embuta: `--voz /mnt/user-data/uploads/<arquivo>`. Rode `ls -R /mnt/user-data/` para achar o arquivo. O estúdio abre já com a voz sincronizada e ela não precisa subir nada.
   - Para áudios em outro formato ou maiores que 12 MB, converta antes: `ffmpeg -i entrada -ac 1 -b:a 128k /tmp/bq/voz.mp3`.
   - O HTML vai para `/mnt/user-data/outputs/<slug>-estudio.html` (cerca de 1,3 MB).
4. **Entregue** o HTML (apresente o arquivo para download) com estas instruções curtas:
   - **Baixe o arquivo** (botão de download) e abra com dois cliques no **Chrome ou Edge do computador**. **Não use a prévia que abre dentro do claude.ai:** ali a narração, a gravação e a exportação não funcionam. Celular não serve.
   - Aba **Narração**: grave bloco a bloco (o texto aparece na tela) ou suba um áudio pronto. A sincronia é automática.
   - Confira tocando (Espaço). Se uma animação estiver fora de tempo, ajuste na aba **Marcas**.
   - Aba **Exportar** → **Exportar MP4**, com a aba aberta e na frente. Leva mais ou menos o tempo do vídeo. O arquivo vai para Downloads.
   - Para pedir ajustes: aba **Relatório** → baixe a **folha de contato**, copie o **relatório** e mande os dois aqui.

## Regras que o validador cobra (e por quê)
- **Tempos só por marcas** (`C.x`, `B.x`, `M.x`): a narração real muda os tempos e o estúdio recalcula tudo.
- **Determinismo:** o quadro em `t` depende só de `t`. Não use `Math.random`, `Date`, timers, `fetch`, DOM nem variáveis que acumulam no `update`. A prévia pula no tempo e o export vai em ordem, e os dois têm que dar o mesmo quadro.
- **Só use a API documentada.** O validador lista os nomes certos quando você erra.

## Correções
Quando a pessoa mandar a folha de contato (imagem com 16 quadros e tempos) e o relatório (JSON), siga `references/correcoes.md`:
1. olhe cada quadro;
2. ache o problema (enquadramento, texto cobrindo, ação errada, tempo);
3. corrija os arquivos do projeto;
4. valide;
5. monte de novo com o **mesmo slug**. A narração gravada continua no navegador da pessoa: ao abrir o novo HTML ela é reaproveitada.

Se o projeto não estiver mais em `/tmp/bq/`, peça o HTML antigo e extraia as fontes. Elas ficam no `<script id="bq-project">`, campo `sources`, junto com `roteiro`, `brand` e `publish`.
