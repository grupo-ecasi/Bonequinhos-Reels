# Spike S1: ambiente de skills do claude.ai (01/11/2026)

Teste feito com `bq-teste-a` e `bq-teste-b` (conta Grupo Ecasi, Opus 5.5). Para acionar: "rodar teste bq".

| Item | Resultado | Consequência |
|---|---|---|
| Pasta da skill | `/mnt/skills/plugins/<nome>/` | `locate_suite.py` procura primeiro `/mnt/skills/plugins/*/bq-suite.json` |
| Skill irmã visível | Sim: o marcador de `bq-teste-b` foi achado sem a skill ser acionada | A suíte funciona com as 9 skills; o estúdio pode ser lido pelas outras |
| Python / Node / npm | 3.12.3 / v22.22.2 / 10.9.7 | Montador em Python e validadores em Node funcionam |
| ffmpeg | 6.1.1 presente | Dá para checar e converter a narração enviada no sandbox (opcional) |
| Chrome | Ausente | Render só no navegador da pessoa: o estúdio HTML está confirmado |
| CPU | 1 núcleo | Nada pesado no sandbox |
| PIL, fontTools, numpy | Já instalados | `brand_kit.py` funciona sem instalar nada |
| pip install | Bloqueado pelo PEP 668 (só com `--break-system-packages`) | Não depender de pip |
| npm (registro) | Funciona: `npm pack @fontsource/poppins` → 5.3.0 | Fontes da marca via @fontsource |
| huggingface.co / cdn.jsdelivr.net | Sem acesso | Nada de CDN no sandbox; o vendor vai pré-empacotado no zip |
| Comando de 90 s | OK (90,0 s) | Limite por chamada acima de 90 s |
| Zip de 1 MB | OK | Zip de cerca de 3 MB deve passar (testar no S2/F9) |
| Saída `/mnt/user-data/outputs` | Existe; arquivo de 5 MB oferecido para download | O HTML de cerca de 2 MB é entregue normalmente |
| Descrição | Aceita (descrições de cerca de 150 caracteres) | Manter ≤ 200 |
