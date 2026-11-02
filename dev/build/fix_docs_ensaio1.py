"""Aplica nos documentos das skills as correções apontadas pelo ensaio cego 1 (lavar carro ao sol)."""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2] / "skills"


def edit(path, pairs):
    p = ROOT / path
    s = p.read_text(encoding="utf-8")
    for a, b in pairs:
        assert a in s, (path, a[:70])
        s = s.replace(a, b)
    p.write_text(s, encoding="utf-8")


edit("bonequinho-estudio/SKILL.md", [
("""```bash
EST=$(dirname "$(dirname "$(find / -name build_studio.py -path '*bonequinho-estudio*' 2>/dev/null | head -1)")")
echo "$EST"   # ex.: /mnt/skills/plugins/bonequinho-estudio
```""",
"""```bash
F=$(find /mnt/skills -name build_studio.py -path '*bonequinho-estudio*' 2>/dev/null | head -1)
[ -z "$F" ] && F=$(find / -name build_studio.py -path '*bonequinho-estudio*' -not -path '/proc/*' 2>/dev/null | head -1)
EST=$(dirname "$(dirname "$F")"); echo "$EST"   # ex.: /mnt/skills/plugins/bonequinho-estudio
```
Use `python3` (ou `python`, se `python3` não existir) e `node`."""),
("""2. **Valide:** `node "$EST/scripts/check_project.mjs" /tmp/bq/<slug>`.
   - Corrija **todos** os ERROS. Avisos são para revisar.
   - Repita até aparecer `✓ validação ok`.""",
"""2. **Valide:** `node "$EST/scripts/check_project.mjs" /tmp/bq/<slug>`. Use `--json` se quiser a saída para máquina.
   - O validador mostra os **tempos estimados de cada bloco e de cada marca**. Use-os para conferir se as ações, os widgets e as chaves de câmera têm duração suficiente.
   - Corrija **todos** os ERROS.
   - Trate como erro os avisos de **enquadramento**: câmera dentro de objeto, objeto cobrindo a tela, objeto grande quase preto, brilho estourado. Eles são a sua "visão" do vídeo.
   - Os outros avisos (tempo curto, opção desconhecida, sobreposição com o CTA) também valem corrigir.
   - Repita até aparecer `✓ validação ok` sem avisos de enquadramento."""),
("""3. **Monte:** `python3 "$EST/scripts/build_studio.py" /tmp/bq/<slug>`.""",
"""3. **Monte:** `python3 "$EST/scripts/build_studio.py" /tmp/bq/<slug>` (`--out <pasta>` muda o destino)."""),
])

edit("bonequinho-estudio/references/contrato.md", [
("""- **`# nome`** começa um bloco. Use os nomes da estrutura: `gancho, promessa, problema, camada1, camada2, camada3, mito, norma, cta, loop`. Outros nomes também valem. O bloco `cta` só aparece no modo empresa.""",
"""- **`# nome`** começa um bloco. Use os nomes da estrutura: `gancho, promessa, problema, camada1, camada2, camada3, mito, norma` (ou `fonte`), `cta, loop`.
  - Qualquer nome vale; só dois têm efeito especial:
    - **`cta`**: o card de CTA aparece do início dele até 0,39 s depois do início do `loop`, só no modo empresa;
    - **`loop`**.
  - Cada bloco vira `B.nome = {start, end}`."""),
("""- **`{exibe|fala}`**: a legenda mostra `exibe`; a voz e a sincronia usam `fala`.""",
"""- **`// comentário`** (linha inteira) é ignorado pela legenda, pela voz e pelo texto copiado. Ponha as **fontes** aí, no fim do roteiro.
- **`{exibe|fala}`**: a legenda mostra `exibe`; a voz e a sincronia usam `fala`. Marca antes de chave vale: `[[graus]]{60 °C|sessenta graus}`."""),
("""- `lib.env.outdoor({ sky="day", ground="grass", wall=null|true|{w,h,color,z}, trees=3, street=false, fog=true })`: área externa.
  - `sky`: `day | sunset | night | studio`.
  - Pontos: `center, wall`.""",
"""- `lib.env.outdoor({ sky="day", ground="grass", wall=null|true|{w,h,color,z}, trees=3, street=false, fog=true })`: área externa.
  - `sky`: `day | sunset | night | studio`. `ground`: `grass | concrete | asphalt | tile | wood`.
  - Pontos: `center, wall`.
  - **Onde fica cada coisa:**
    - chão grande em y=0;
    - `wall` (muro de 5 m) em z = −1,5, centrado em x = 0;
    - `street` é uma faixa de asfalto em z ≈ +4 a +10;
    - árvores em x = ±4 a ±8, z = −4 a −8, longe do centro;
    - o sol vem de (6, 12, 8): de cima, à direita e da frente.
  - Deixe a ação em x de −1,5 a 1,5 e z de −2 a 1."""),
("""- `cor` pode ser `"#rrggbb"` ou um material (`lib.mat(cor, extras)`, plano; `lib.smooth(cor, extras)`, liso).""",
"""- `cor` pode ser `"#rrggbb"` ou um material: `lib.mat(cor, extras)`, plano, ou `lib.smooth(cor, extras)`, liso.
  - `extras` são opções do `THREE.MeshStandardMaterial`: `roughness`, `metalness`, `transparent`, `opacity`, `emissive`, `emissiveIntensity`, `map`.
  - **`emissive` faz a peça brilhar com bloom: use só em luzes e LEDs pequenos.**"""),
("""- **Posicionar:** `lib.put(obj, [x,y,z], [rx,ry,rz] em graus, escala)` devolve o próprio objeto.""",
"""- **Posicionar:** `lib.put(obj, [x,y,z], [rx,ry,rz] em graus, escala)` devolve o próprio objeto. `escala` pode ser um número ou `[sx,sy,sz]`.
  - Cilindros e cones nascem **em pé (eixo Y)**. Roda de carro: `[0, 0, 90]` (deitada no eixo X)."""),
("""- Mãos: `pessoa.hand("R")`, `pessoa.hand("L")`. Prender ferramenta na mão: `lib.attach(obj, pessoa, "R")`.""",
"""- Mãos: `pessoa.hand("R")`, `pessoa.hand("L")`. `"R"` é a mão direita **do bonequinho**: com ele de frente para a câmera (yaw 0), ela aparece à **esquerda** da tela.
- Prender ferramenta na mão: `lib.attach(obj, pessoa, "R")`.
- O logo fica num círculo branco no peito e nas costas, então funciona em qualquer cor de camiseta."""),
("""- `wave`, `thumbsUp`, `hold` (segura na frente do corpo).""",
"""- `wave`, `thumbsUp`, `hold` (segura na frente do corpo). Todos aceitam `hand`."""),
("""- Ações entram e saem suaves (0,3 s). Ações de braço escolhem a mão por `hand` (padrão `"R"`). Ações iguais podem se repetir em tempos diferentes.""",
"""- Ações entram e saem suaves (0,3 s, ajustável com `in`/`out`). Ações de braço escolhem a mão por `hand` (padrão `"R"`). Ações iguais podem se repetir em tempos diferentes.
- **Durações mínimas** (o validador avisa): `walk`/`reach`/`point` 0,6 s; `scrub`/`paint`/`wave`/`celebrate` 0,8 s; gestos de cabeça 0,6 s.
- Opções desconhecidas geram aviso "opção … não existe e foi ignorada"."""),
("""- `dist`: distância em metros.""",
"""- `dist`: distância em metros.
- **Posição da câmera** = `look + dir × dist`, com `dir = (sen yaw·cos pitch, sen pitch, cos yaw·cos pitch)`. Sem `yaw`/`pitch`/`dir`, o padrão equivale a yaw ≈ 23° e pitch ≈ 8°."""),
("""- `mark({at, kind: "ok"|"bad"|"warn"|"plus", from, until, size})`: selo ✓ ✗ ! + que brilha.
- `glow({at, color, from, until, radius})`: ponto pulsante.
- `pop(obj, {from, until, scale})`: objeto aparece com "pop" e some.""",
"""- `mark({at, kind: "ok"|"bad"|"warn"|"plus", from, until, size=0.32})`: selo ✓ ✗ ! + que brilha (`size` em metros).
- `glow({at, color, from, until, radius=0.12})`: ponto pulsante (`radius` em metros).
- `pop(obj, {from, until, scale})`: objeto invisível antes de `from`, aparece com "pop" e some em `until`. Ele é adicionado à cena sozinho."""),
("""| `H.card` | card com ícone, título e texto | `title, text, icon, tone, y=1080, w` |""",
"""| `H.card` | card com ícone, título e texto | `title, text, icon` (1–2 caracteres ou emoji: "✓", "!", "💧"), `tone, y=1080, w` |"""),
("""| `H.callout` | rótulo preso a uma âncora 3D | `anchor, text, tone, dx=140, dy=-110, top, bottom` |""",
"""| `H.callout` | rótulo preso a uma âncora 3D | `anchor, text, tone, dx=140, dy=-110, top=330, bottom=1320`. A largura acompanha o texto e o rótulo é mantido em x 60–1020 |"""),
("""  - **CTA** com logo, nome, @ e WhatsApp no bloco `cta`, só no modo empresa.""",
"""  - **CTA** com logo, nome, @ e WhatsApp no bloco `cta`, só no modo empresa: card em y ≈ 1020–1350. Feche `card`/`compare`/`list`/`bigNumber` antes de `C.cta`, e deixe o personagem da marca no terço de cima.
- Cada widget deve ficar **pelo menos 1 s** na tela."""),
])

edit("bonequinho-estudio/references/direcao.md", [
("""## 7. Erros que já aconteceram (evite)""",
"""## 7. Cor e luz
- **Nada grande quase preto:** carro, sofá ou parede escura em close vira quadro preto. Use tons médios (`#3b4252`, `#2f4f6f`) e reserve o preto para detalhes (pneu, frisos).
- **Brilho (`emissive`) só em luzes pequenas** (LED, lâmpada, faísca). Espuma, água, vidro e manchas usam cor clara sem emissive. Caso contrário o bloom estoura e vira bola branca.
- Contraste entre o assunto e o fundo: objeto claro em parede escura ou o contrário.

## 8. Erros que já aconteceram (evite)
- Câmera tão perto de um objeto grande que ele ocupa a tela inteira: o validador avisa "cobre mais de 80% da tela". Afaste (`dist` maior) ou mire numa âncora menor."""),
])

edit("bonequinho-reels/SKILL.md", [
("""Se a pessoa disser "faça direto" ou já der tudo, não pergunte. Use: sem marca, voz própria, 60 a 80 s.""",
"""Se a pessoa disser "faça direto" ou já der tudo, não pergunte. Use o que ela deu. No que faltar, use: sem marca (só se ela não deu dados de marca), voz própria, 60 a 80 s."""),
("""- as **fontes** dos números e normas, com `[VERIFICAR]` no que você não tem certeza.""",
"""- as **fontes** dos números e normas, com `[VERIFICAR]` no que você não tem certeza. No `roteiro.txt` as fontes vão em linhas `// …` no fim: não entram na voz nem na legenda.
- **Se algum número ou afirmação mostrado na tela tiver `[VERIFICAR]`, avise isso também na mensagem final de entrega.**"""),
])

edit("bonequinho-reels/references/roteiro-viral.md", [
("""| `gancho` | Parar o dedo em até 1,5 s | Situação real + pergunta + resposta curta que contraria o senso comum | "Rebocou ontem. Já pode pintar? Ainda não." |""",
"""| `gancho` | Parar o dedo | O **título na tela já aparece no quadro 0**. A pergunta e a resposta curta falada terminam **até cerca de 3 s**. Situação real + pergunta + resposta que contraria o senso comum | "Rebocou ontem. Já pode pintar? Ainda não." |"""),
("""| `camada1`, `camada2`, `camada3` | Uma ação clara por camada | Começa com "Camada um: [palavra]." + 1 frase do como + 1 número quando der | "Camada um: esperar. Vinte e oito dias de cura." |""",
"""| `camada1`, `camada2`, `camada3` | Uma ação clara por camada | Começa com a mesma palavra da promessa ("Camada um:", "Passo um:" ou "Sinal um:") + [palavra-chave]. + 1 frase do como + 1 número quando der | "Camada um: esperar. Vinte e oito dias de cura." |"""),
])
print("documentos atualizados")
