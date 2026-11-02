# Como corrigir um vídeo a partir da folha de contato e do relatório

## O que a pessoa manda
- **Folha de contato** (PNG 1080×1920): 16 quadros do vídeo em grade 4×4, cada um com o tempo e a marca daquele momento (ex.: `5.9s amarela`, `11.2s #mito` = início do bloco mito). É a sua forma de "ver" o vídeo.
- **Relatório** (JSON): `marcas` (tempos reais depois da narração), `blocos`, `problemas` (erros que o navegador encontrou), `mixagem` (loudness e efeitos), `ajustesManuais` (marcas que a pessoa mexeu à mão) e `narracao` ("por bloco", "única" ou "nenhuma").

## Checklist quadro a quadro
1. **O assunto aparece?** O personagem ou objeto de que a fala trata deve estar inteiro e no meio. Se não estiver, ajuste `lib.camera.keys` (`look`, `dist`, `yaw`) na chave daquele trecho.
2. **Texto cobrindo o assunto?** Mova o widget (`y`) ou a câmera. Título e barra ficam no topo; cards no meio-baixo.
3. **A ação bate com a fala?** No quadro `amarela`, a câmera deve estar na folha e o selo ✗ visível.
4. **Movimento:** dois quadros seguidos iguais significam que nada se mexe. Acrescente um movimento de câmera, gesto ou efeito.
5. **Loop:** o primeiro e o último quadro devem ser quase iguais.
6. **Erros no relatório:** cada item de `problemas` traz arquivo, linha e mensagem. Corrija primeiro.

## Tempo e sincronia
- Se a pessoa disser que "a animação vem antes ou depois da fala", veja `ajustesManuais`.
  - Se ela já ajustou, o problema é do alinhamento. Os ajustes ficam salvos no navegador dela e continuam valendo depois de remontar.
  - Se não ajustou, explique a aba **Marcas** (−/+ 0,05 s) ou a **sincronia no toque**.
- Para a ação começar um pouco antes da palavra (antecipação natural), use `C.x - 0.2` no início da ação.

## Depois de corrigir
1. Valide (`check_project.mjs`).
2. Monte com o **mesmo slug** (o navegador reaproveita a narração e os ajustes).
3. Entregue o novo HTML dizendo **o que mudou** em 2 ou 3 itens.
