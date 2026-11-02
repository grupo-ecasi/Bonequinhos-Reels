"""Monta o HTML único do spike S2 (embute vendor, fonte e voz)."""
import base64
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
VENDOR = HERE.parent.parent / "vendor" / "vendor.min.js"
REF = pathlib.Path(r"C:\app.Modelar-Concorrentes-MKT\house\videos\reboco-novo\assets")
FONT = REF / "fonts" / "BarlowCondensed-800.woff2"
VOICE = REF / "narracao-norm.mp3"


def b64(p: pathlib.Path) -> str:
    return base64.b64encode(p.read_bytes()).decode("ascii")


def main(out_name: str = "spike-s2.html") -> None:
    src = (HERE / "spike.src.html").read_text(encoding="utf-8")
    vendor = VENDOR.read_text(encoding="utf-8").replace("</script", "<\\/script")
    for token, value in (
        ("/*VENDOR*/", vendor),
        ('"/*FONT_B64*/"', f'"{b64(FONT)}"'),
        ('"/*VOICE_B64*/"', f'"{b64(VOICE)}"'),
    ):
        if src.count(token) != 1:
            raise SystemExit(f"marcador {token!r} aparece {src.count(token)} vezes")
        src = src.replace(token, value)
    out = HERE / out_name
    out.write_text(src, encoding="utf-8")
    print(out, f"{out.stat().st_size / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main(*sys.argv[1:])
