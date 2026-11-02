# Bonequinhos-Reels: situação e próximos passos

*Escrito em 01/11/2026 para continuar em 02/11/2026.*

## Objetivo do produto
- Ferramenta completa, em skills para o claude.ai, que gera Reels de bonequinho 3D sobre qualquer tema, **com qualidade igual ou melhor que os vídeos atuais** (House reboco-novo, ECASI EP2).
- **Será vendida como infoproduto (Kiwify ou Cakto).** Por isso precisa funcionar bem para quem não é técnico, ter boa qualidade visual e ter licenças limpas para revenda.
- O único custo para o comprador é a assinatura do Claude.

## Onde estamos
**O que existe hoje:** duas skills, em `dist/`:
- `bonequinho-reels.zip`: orquestrador, roteiro viral, briefing e entrega;
- `bonequinho-estudio.zip`: motor, validador, montador e exemplo.

**Fluxo atual:**
1. A pessoa pede o vídeo no claude.ai.
2. O Claude escreve o roteiro, a cena 3D, os textos na tela e os sons.
3. O Claude valida e entrega **um arquivo HTML** (o estúdio).
4. A pessoa abre o HTML no Chrome ou Edge, grava ou sobe a narração e exporta o MP4.

**Validado nos testes locais:**
- export MP4 no formato do Reels (H.264 + AAC, 1080×1920, 30 fps), a cerca de 1,4x o tempo do vídeo;
- sincronia da narração com o texto: erro típico de 0,02 s, sem Whisper;
- áudio em −14 LUFS, pico ≤ −1 dB (igual ao `master.py`);
- determinismo: prévia = vídeo exportado;
- **ensaio cego:** um Claude só com as skills fez um vídeo coerente de 64 s (lavar carro ao sol, modo empresa);
- o validador pega erros de código, tempos curtos e enquadramento:
  - câmera dentro de objeto;
  - objeto cobrindo a tela;
  - bonequinho de costas ou com a cabeça cortada;
  - objeto escuro demais;
  - brilho estourado;
- correções feitas no teste do usuário:
  - a narração vem só como texto, sem títulos;
  - aviso quando o estúdio abre dentro da prévia do claude.ai;
  - narração enviada no chat embutida no HTML (`--voz`).

**Ainda NÃO validado:**
- o fluxo completo no claude.ai com o usuário. O teste da madeira parou porque o estúdio foi aberto na prévia e o MP3 não carregou (já corrigido);
- se o Instagram aceita o MP4 (o formato é idêntico ao render atual, mas falta testar);
- qualidade visual comparada aos vídeos atuais;
- qualidade com o Claude do claude.ai no esforço "Médio";
- velocidade do export em cena pesada (a do reboco-novo).

## Respostas às dúvidas (01/11)
1. **"Só os dois zips?"** Por enquanto, sim. Mas ainda não é o produto final: faltam a biblioteca visual rica, as outras skills e a validação real no claude.ai.
2. **"Dá para fazer tudo pelo Claude?"** O vídeo não pode ser renderizado dentro do claude.ai: o ambiente de código não tem navegador nem placa de vídeo e tem 1 processador. A renderização acontece no navegador da pessoa, e é isso que torna a ferramenta grátis.
   - **Talvez não precise baixar o HTML.** A prévia do claude.ai já mostra o 3D. Com a narração enviada no chat e embutida, falta só saber se a prévia **deixa baixar o MP4 exportado**. Isso não foi testado.
   - Se deixar, o fluxo fica 100% no claude.ai: pedir, mandar o MP3 no chat, Exportar na prévia, baixar o MP4.
   - **Gravar pelo microfone** provavelmente só funciona com o HTML baixado e aberto no Chrome ou Edge.
3. **"A fórmula ficou boa?"** Com a restrição de custo zero, sim: o Claude escreve, o validador serve de "olhos" e o navegador renderiza. As alternativas exigem pagar render na nuvem ou instalar programas.
   - **Riscos:**
     - o primeiro vídeo costuma precisar de 1 ou 2 rodadas de ajuste (folha de contato + relatório);
     - cada vídeo consome bastante do limite de uso do plano, porque são centenas de linhas de código.

## Plano para amanhã (em ordem)

### 1. Fechar a validação no claude.ai
- [ ] Subir os zips atualizados. Antes, apagar `bq-teste-a`, `bq-teste-b` e as versões antigas.
- [ ] Terminar o vídeo da madeira: baixar o HTML e abrir no Chrome ou Edge, **ou** mandar o MP3 no chat para o Claude embutir.
- [ ] **Testar se a exportação funciona dentro da prévia do claude.ai** e se o download do MP4 sai dali. Pode ser feito pelo Chrome com autorização.
- [ ] Subir o MP4 como rascunho no Instagram.
- [ ] Ler a conversa do claude.ai (link compartilhado) e anotar onde o Claude errou ou demorou.

### 2. Subir os cenários e efeitos dos vídeos atuais (qualidade)
Vem de R = `house/videos/reboco-novo` e E = `ecasi/.../ep2-residencial-v2`. Todos os detalhes e números de linha estão em `docs/ARQUITETURA.md` §3.
- [ ] **R:** casa com fachada, obra (andaime, betoneira), lupa de corte (`cutaway`) com camadas, timelapse dia/noite, defeitos de superfície (bolha, mancha, descascado, mofo), pó, gotas.
- [ ] **E:** bloom já existe. Faltam fluxo de energia nos fios, arcos elétricos, faíscas, fumaça, quadro elétrico, disjuntores, máquina de lavar, eletricista completo (capacete, colete, luvas).
- [ ] Ambientes: sala, quarto, cozinha, banheiro, lavanderia, escritório, fachada, rua, quintal, obra.
- [ ] Cerca de 40 objetos com âncoras: móveis, eletrodomésticos, ferramentas na mão (rolo, trincha, chave, furadeira, detector, celular, prancheta).
- [ ] Ações novas do bonequinho: sentar, ajoelhar, segurar ferramenta trabalhando, apontar com ferramenta.
- [ ] **Paridade:** refazer o reboco-novo só com a ferramenta e comparar com `R/renders`. Medir de novo a velocidade do export.

### 3. Banco de 100 temas com ideias de roteiro
- [ ] Criar `temas/` numa skill (provavelmente `bonequinho-roteiro`) com **100 temas variados**, cada um com:
  - título;
  - gancho;
  - as 3 camadas;
  - mito;
  - fonte sugerida;
  - cenário e objetos sugeridos.
- [ ] Nichos sugeridos (10 de cada):
  - casa e reforma;
  - limpeza;
  - plantas e jardim;
  - carro;
  - saúde e bem-estar;
  - finanças pessoais;
  - cozinha;
  - pets;
  - segurança doméstica e do trabalho;
  - tecnologia e golpes digitais.
- [ ] A pessoa pode pedir "me sugere um tema" ou "faz o tema 37". O Claude adapta para a marca dela.
- [ ] Revisar fontes e números de cada tema, marcando [VERIFICAR] o que não tiver fonte.

### 4. Completar as skills (as 9 do plano)
- [ ] Separar `bonequinho-roteiro`, `bonequinho-narracao`, `bonequinho-cena-3d`, `bonequinho-tela`, `bonequinho-sons`, `bonequinho-marca` e `bonequinho-publicacao`.
- [ ] Guia de voz grátis em serviço externo, conferindo os termos atuais (CapCut, Google AI Studio, Manus etc.).
- [ ] Mais 2 exemplos completos: `quadro-eletrico` e `cozinha`, em modos empresa e sem marca.
- [ ] Mix de áudio em Worker, para não travar a aba em vídeos de 80 s.

### 5. Preparar como infoproduto (Kiwify ou Cakto)
- [ ] **Licenças limpas para revenda.** Conferir e listar num `LICENCAS.md`:
  - Three.js (MIT), acorn (MIT), Mediabunny (conferir a licença exata) e fontes Barlow e Bricolage (OFL);
  - sons sintetizados (próprios) e os 5 MP3 MIT do `C:\Editor.Videos`, se forem usados;
  - **nada** de Pixabay, ElevenLabs, ECASI ou House.
- [ ] **Material para o comprador:**
  - guia de instalação com prints (Configurações → Personalização → Skills);
  - vídeo curto de demonstração;
  - FAQ (Chrome ou Edge, não funciona no celular, como gravar a voz, como pedir ajustes);
  - plano mínimo do Claude necessário (Pro?).
- [ ] **Teste com 2 ou 3 pessoas leigas** antes de vender, contando as dúvidas e os erros.
- [ ] Versão e changelog, para mandar atualizações aos compradores.
- [ ] Página de vendas: exemplos de vídeos gerados em nichos diferentes.

## Arquivos de referência
- `docs/PLANO.md`: plano aprovado.
- `docs/ARQUITETURA.md`: arquitetura detalhada (API, linhas portadas de R e E, riscos).
- `docs/PROGRESSO.md`: histórico do que foi feito.
- `dev/spike/RESULTADOS-F0.md`: testes técnicos iniciais.
- `dev/ensaio/`: ensaio cego (projeto + HTML).
- `dev/build/build_all.py`: gera os zips em `dist/`.
