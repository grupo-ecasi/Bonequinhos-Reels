---
name: bonequinho-reels
description: Cria Reels de bonequinho 3D sobre qualquer tema (roteiro viral, cena, textos, sons) e entrega um estúdio HTML que exporta o MP4 no Chrome, grátis. Use ao pedirem reels ou vídeo de bonequinho.
---

# Reels de bonequinho 3D (orquestrador)

Você conduz a pessoa do tema até um vídeo vertical (1080×1920) no estilo "bonequinho low-poly explicando".

A estrutura é:
**gancho → promessa de 3 camadas → problema → camadas 1, 2 e 3 → mito → fonte → CTA → loop**.

O vídeo é montado pela skill **`bonequinho-estudio`** (motor). O resultado é **um arquivo HTML** que a pessoa abre no Chrome ou no Edge do computador. Ali ela grava ou sobe a narração e exporta o MP4, sem custo.

## 0. Antes de tudo
Confirme que o motor está disponível:

```bash
find / -name build_studio.py -path '*bonequinho-estudio*' 2>/dev/null | head -1
```

Se não aparecer nada, diga: "Ative a skill **bonequinho-estudio** em Configurações → Personalização → Skills (e a execução de código)". Pare aí.

## 1. Briefing (no máximo UMA rodada de perguntas)
Pergunte só o que faltar, numa mensagem só e com opções:
1. **Tema e público.** Ex.: "regar planta demais", para quem tem planta em casa.
2. **Marca:**
   - **empresa:** nome, @ do Instagram, WhatsApp, logo anexado e cores (se souber);
   - **sem marca:** sem logo e sem CTA.
3. **Narração:** a pessoa vai **gravar a própria voz** no estúdio (recomendado) ou **gerar numa IA de voz** e subir o áudio? Nos dois casos você entrega o texto.
4. **Duração:** padrão de 60 a 80 s.

Se a pessoa disser "faça direto" ou já der tudo, não pergunte. Use o que ela deu. No que faltar, use: sem marca (só se ela não deu dados de marca), voz própria, 60 a 80 s.

## 2. Roteiro (mostre e espere o OK)
Siga `references/roteiro-viral.md`. Mostre:
- **A narração: SÓ o texto falado, pronto para copiar e colar.**
  - Vai num único bloco de código (```), com os blocos separados por uma linha em branco.
  - **Não ponha títulos nem rótulos** ("Gancho:", "Promessa:", "Passo 1:"), nem marcas `[[...]]`, `{...|...}`, `[VERIFICAR]` ou comentários. Só o que a voz vai dizer.
  - Se a pessoa vai usar **IA de voz**, escreva **números, siglas e símbolos por extenso**: "doze por cento", "quarenta a sessenta centímetros", "ene bê erre". Isso é a forma falada do `{exibe|fala}`.
  - Se vai gravar a própria voz, pode usar a forma normal ("12%").
  - Antes do bloco, uma linha: "Narração (copie e cole na sua IA de voz):" ou "Narração (texto para ler):".
- **Depois**, separado, uma tabela curta **Bloco | Na tela | Cena**. Os nomes dos blocos aparecem só aqui, nunca dentro do texto da narração;
- as **fontes** dos números e normas, com `[VERIFICAR]` no que você não tem certeza. No `roteiro.txt` as fontes vão em linhas `// …` no fim: não entram na voz nem na legenda.
- **Se algum número ou afirmação mostrado na tela tiver `[VERIFICAR]`, avise isso também na mensagem final de entrega.**

Pergunte: "Posso montar o vídeo assim?". Se a pessoa pediu "faça direto", siga sem esperar.

## 3. Montar o vídeo
Leia `SKILL.md` e as referências da skill **bonequinho-estudio** (`references/contrato.md` e `references/direcao.md`) e o exemplo `exemplos/planta-agua-demais/`. Depois:
1. escreva o projeto em `/tmp/bq/<slug>/`: `roteiro.txt` com marcação, `cena.js`, `tela.js`, `sons.js`, `projeto.json`, `publicar.md` e, se for o caso, `marca.json` + logo;
2. rode o validador até `✓ validação ok`;
3. rode o `build_studio.py` e apresente o HTML para download.

**Planeje antes de codar** (5 a 10 linhas para você mesmo):
- o cenário (um ambiente);
- os personagens: o da marca nunca erra; quem erra é o morador ou cliente;
- os objetos e âncoras;
- 1 ou 2 acontecimentos visuais por bloco, cada um preso a uma marca;
- as chaves de câmera.

## 4. Entrega (mensagem final curta)
- O arquivo HTML.
- Os 4 passos de uso, que estão no SKILL.md do estúdio:
  1. abrir no Chrome do computador;
  2. Narração → gravar ou subir;
  3. conferir;
  4. Exportar MP4.
- **Avise com destaque:** baixe o HTML e abra com dois cliques no Chrome ou Edge. A prévia dentro do claude.ai não grava, não carrega a narração e não exporta.
- Se a pessoa **mandar o áudio da narração aqui no chat**, remonte com `--voz` (veja o SKILL.md do estúdio) e entregue o HTML já com a voz.
- Se a pessoa vai usar IA de voz:
  - repita **a narração final em um único bloco de código, só o texto falado**: sem títulos de bloco, com números por extenso e na versão que foi para o `roteiro.txt`;
  - diga para copiar, colar na IA de voz, gerar e baixar o áudio, e então **mandar o áudio aqui no chat** (você embute no HTML) **ou** subir no estúdio em **"Escolher arquivo da narração"**;
  - o mesmo texto também sai no botão **"Copiar texto para IA de voz"** do estúdio.
- Lembre que a legenda do Instagram, as hashtags e o texto alternativo estão na aba **Publicar**.
- Como pedir ajustes: aba Relatório → folha de contato + relatório, mandados aqui.

## 5. Ajustes
Siga `references/correcoes.md` da skill bonequinho-estudio. Remonte sempre com o **mesmo slug**, porque a narração gravada é reaproveitada. Diga em 2 ou 3 itens o que mudou.

## Tom e cuidado com o conteúdo
- Português do Brasil, conversa direta, sem jargão desnecessário. **Não use medo como argumento**: explique o porquê e cite a fonte.
- Números e normas: só afirme o que tem fonte. Na dúvida, marque `[VERIFICAR]` no roteiro e avise a pessoa.
- Temas de saúde, elétrica, estrutura e química: inclua "procure um profissional" quando fizer sentido.
