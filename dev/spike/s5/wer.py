"""Taxa de erro de palavras (WER) entre o texto de referência e a transcrição de uma voz sintética."""
import json
import sys
import unicodedata

REF = ("Rebocou ontem? Já pode pintar? Ainda não. Seco por fora não é parede pronta. Camada um: esperar. "
       "Vinte e oito dias de cura. A ene bê erre treze mil duzentos e quarenta e cinco pede esperar a cura "
       "do reboco antes de pintar.")


def norm(s: str) -> list[str]:
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return "".join(c if c.isalnum() or c.isspace() else " " for c in s).split()


def wer(ref: list[str], hyp: list[str]) -> float:
    d = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, 1):
        prev, d[0] = d[0], i
        for j, h in enumerate(hyp, 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (r != h))
            prev, d[j] = d[j], cur
    return d[len(hyp)] / max(1, len(ref))


if __name__ == "__main__":
    data = json.load(open(sys.argv[1], encoding="utf-8"))
    words = data if isinstance(data, list) else data.get("words", [])
    hyp = " ".join(w.get("text", w.get("word", "")) for w in words)
    print(f"WER {wer(norm(REF), norm(hyp)):.2%}  |  {hyp}")
