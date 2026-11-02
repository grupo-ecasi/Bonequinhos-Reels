---
name: bq-teste-a
description: Teste técnico da suíte Bonequinhos-Reels. Use somente quando o usuário pedir "rodar teste bq" ou "teste do ambiente bonequinho".
---

# Teste do ambiente (S1)

Quando acionada, faça exatamente isto, sem pular etapas:

1. Rode `python3 scripts/probe.py` a partir da pasta desta skill. Descubra o caminho absoluto da pasta com `find / -name probe.py -path "*bq-teste-a*" 2>/dev/null`.
2. Copie para o chat a saída completa (o bloco JSON).
3. Ofereça para baixar o arquivo `/mnt/user-data/outputs/teste-5mb.bin` gerado pelo script (ou o caminho de saída que o script informar).
4. Não interprete os resultados nem tente corrigir nada.
