# Roteiro viral de bonequinho: estrutura e regras

Molde testado em Reels de pintura (reboco, massa, mofo) e elétrica (quadro, NR-10).
- **Duração:** 60 a 90 s.
- **Ritmo:** cerca de 2,4 palavras por segundo.
- **Tamanho:** 70 s ≈ 170 palavras; 85 s ≈ 205 palavras.

## Estrutura (nomes de bloco do roteiro.txt)

| Bloco | Função | Regras | Exemplo (pintura) |
|---|---|---|---|
| `gancho` | Parar o dedo | O **título na tela já aparece no quadro 0**. A pergunta e a resposta curta falada terminam **até cerca de 3 s**. Situação real + pergunta + resposta que contraria o senso comum | "Rebocou ontem. Já pode pintar? Ainda não." |
| `promessa` | Dar o mapa | "São **três** camadas / sinais / passos antes de…" (sempre 3) | "Seco por fora não é parede pronta. São três camadas antes da tinta." |
| `problema` | Mostrar o que dá errado e por quê | Causa → efeito visível, com 1 número se tiver | "Reboco novo ainda tem água e cal. Se pintar agora, aparecem bolhas e manchas." |
| `camada1`, `camada2`, `camada3` | Uma ação clara por camada | Começa com a mesma palavra da promessa ("Camada um:", "Passo um:" ou "Sinal um:") + [palavra-chave]. + 1 frase do como + 1 número quando der | "Camada um: esperar. Vinte e oito dias de cura." |
| `mito` | Derrubar a crença comum | Pergunta da crença + "Não." + comparação com número | "Passou a mão e está seco? Não basta. pH perto de treze: um milhão de vezes mais alcalino que a água." |
| `norma` | Autoridade | Norma, órgão ou estudo pelo nome; uma frase | "A NBR 13245 pede esperar a cura do reboco antes de pintar." |
| `cta` | Só no modo empresa | Nome da marca + oferta concreta + canal | "Na dúvida, chama a House Pinturas. Orçamento grátis no WhatsApp." |
| `loop` | Emendar no começo | Repete a pergunta do gancho e resume as 3 camadas; a última frase termina onde o vídeo começa | "Rebocou ontem? Espera, prepara e sela… antes de pintar." |

- **Sem marca:** pule o `cta`. O `loop` pode terminar com "salva para não esquecer".
- **Tema sem norma:** o bloco `norma` vira "fonte" (fabricante, órgão público, estudo) ou sai.

## Como mostrar a narração para a pessoa
- **Só o texto falado**, num bloco de código para copiar e colar na IA de voz ou para ler. Blocos separados por uma linha em branco.
- **Sem** "Gancho:", "Passo 1:" ou qualquer rótulo, **sem** marcação `[[...]]` / `{...|...}` e **sem** `[VERIFICAR]`. A estrutura (nomes dos blocos) fica só na tabela "Na tela / Cena" e no `roteiro.txt`.
- Para IA de voz, números e siglas por extenso ("trinta por cento", "ene bê erre"). É exatamente o texto do botão "Copiar texto para IA de voz" do estúdio.

## Escrita para a fala
- Frases curtas (até 12 palavras). Uma ideia por frase.
- Números e siglas: no `roteiro.txt` use `{28|vinte e oito}`, `{NBR 13245|ene bê erre treze mil duzentos e quarenta e cinco}`, `{pH|pê agá}`. A legenda mostra o número; a voz lê por extenso.
- Nomes de marca com pronúncia diferente: `{House|Ráus}`.
- Reticências `...` criam pausa dramática (use 2 ou 3 no vídeo todo).
- **Palavras-âncora:** marque com `[[marca]]` a palavra em que algo acontece na tela.
  - Mínimo: o início de cada camada (`[[c1]]Camada um`), a resposta do gancho, cada número e o mito.
  - Média: 1 marca a cada 3 a 5 s.

## "Na tela" (planeje junto com o texto)
| Bloco | O que aparece |
|---|---|
| Gancho | Título no topo (já no quadro 0) + carimbo da resposta ("Ainda não.") |
| Promessa | Barra 1-2-3 com as 3 palavras das camadas |
| Problema | Close no defeito + callouts presos ao objeto ("bolha", "mancha") |
| Cada camada | Passo da barra acende + número gigante quando houver número + ação do personagem |
| Mito | Comparação lado a lado (crença ✗ × verdade ✓) ou número gigante |
| Norma | Card com o nome da norma ou fonte |
| CTA | Automático (logo, @, WhatsApp) + personagem da marca acenando |
| Loop | Mesmo enquadramento do início |

## Fontes
- Liste as fontes no fim do roteiro: norma e item, fabricante, órgão.
- Número sem fonte confiável vira frase qualitativa ou leva `[VERIFICAR]`.
- Nunca invente número de norma, item ou estatística.

## Conferência antes de entregar o roteiro
- O gancho tem pergunta e resposta nos primeiros 3 s?
- São exatamente 3 camadas, cada uma com um verbo de ação?
- Tem pelo menos 1 número concreto?
- O loop repete o gancho?
- Total entre 140 e 210 palavras?
