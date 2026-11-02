# Bonequinhos Reels

Geração de **Reels verticais (1080×1920) com bonequinho 3D low-poly** explicando qualquer tema, no estilo "bonequinho explicando". Tudo roda no navegador, de graça: o resultado é **um único arquivo HTML** que abre no Chrome ou no Edge, onde a pessoa grava (ou sobe) a narração e exporta o MP4.

## Como funciona

O projeto é composto por duas skills do Claude que trabalham juntas:

| Skill | Papel |
|---|---|
| `bonequinho-reels` | Orquestrador: briefing, roteiro viral (gancho → promessa → problema → 3 camadas → mito → fonte → CTA → loop) e entrega. |
| `bonequinho-estudio` | Motor: cena 3D, telas, sons sintetizados, sincronia da narração, prévia e exportação em MP4. |

Fluxo de uso:

1. Peça ao Claude um Reels sobre um tema (com ou sem marca/CTA de empresa).
2. Aprove o roteiro.
3. Baixe o HTML gerado e abra no Chrome/Edge do computador.
4. Em **Narração**, grave a voz ou suba um áudio; confira; clique em **Exportar MP4**.

> A prévia dentro do claude.ai não grava, não carrega a narração e não exporta. Abra o HTML no navegador.

## Estrutura do repositório

```
skills/
  bonequinho-reels/     Skill orquestradora (SKILL.md + references)
  bonequinho-estudio/   Skill do motor (SKILL.md, assets/runtime, scripts, exemplos)
dist/                   Zips das skills prontos para instalar no Claude
docs/                   ARQUITETURA.md, PLANO.md, PROGRESSO.md
dev/                    Build, testes, spikes e ensaios de desenvolvimento
PROXIMOS-PASSOS.md      Próximas etapas
```

## Instalação das skills

1. Baixe `dist/bonequinho-estudio.zip` e `dist/bonequinho-reels.zip`.
2. No Claude, vá em **Configurações → Personalização → Skills** e envie os dois zips (com a execução de código ativada).
3. Peça: "faça um reels de bonequinho sobre ...".

Para regenerar os zips: `python dev/build/build_all.py`.

## Desenvolvimento

Requisitos: Python 3 e Node.js.

- Montar o HTML do estúdio: `python skills/bonequinho-estudio/scripts/build_studio.py`
- Validar um projeto: `node skills/bonequinho-estudio/scripts/check_project.mjs`
- Testes de áudio, alinhamento e runtime: `dev/test/*.mjs`

O motor fica em `skills/bonequinho-estudio/assets/runtime/` (`base`, `roteiro`, `alinhamento`, `audio`, `lib3d`, `tela`, `estudio`). Detalhes em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Status

Fases F0 (spike) e F1 + F2/F3 mínimas concluídas. Veja [`docs/PROGRESSO.md`](docs/PROGRESSO.md) e [`docs/PLANO.md`](docs/PLANO.md).

## Destaques técnicos

- Sincronia de narração com legendas sem modelo de IA (mediana 0,02 s).
- Export MP4 H.264 + AAC no navegador, determinístico.
- Mix com ducking e master em −14 LUFS, com 21 sons sintetizados.
- Sem custo e sem servidor: tudo local no navegador.
