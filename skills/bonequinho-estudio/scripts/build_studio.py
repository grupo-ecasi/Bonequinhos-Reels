#!/usr/bin/env python3
"""Monta o estúdio: um único arquivo HTML com o motor, as bibliotecas, as fontes, a marca e o projeto.

Uso:
    python3 build_studio.py <pasta-do-projeto> [--out <pasta-de-saida>] [--skip-check]

A pasta do projeto contém:
    projeto.json   {"slug": "...", "title": "...", "cover": {"cue": "hook", "dt": 0.6}}
    roteiro.txt    roteiro com marcação ([[marca]], {exibe|fala}, # bloco)
    cena.js        BQ.defineScene(...)
    tela.js        BQ.defineHud(...)
    sons.js        BQ.defineSfx(...)            (opcional)
    momentos.js    BQ.defineMoments(...)        (opcional)
    marca.json     kit de marca                 (opcional; sem ele = modo sem marca)
    publicar.md    legenda e textos de postagem (opcional)

Sem rede e sem dependências além do Python 3. Roda o validador (Node) antes de gravar, se o Node existir.
"""
from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import pathlib
import re
import shutil
import subprocess
import sys

SKILL = pathlib.Path(__file__).resolve().parent.parent
RUNTIME = SKILL / "assets" / "runtime"
FONTS = SKILL / "assets" / "fontes"
RUNTIME_ORDER = ["base.js", "roteiro.js", "alinhamento.js", "audio.js", "lib3d.js", "tela.js", "estudio.js"]
PROJECT_PARTS = ["momentos.js", "cena.js", "tela.js", "sons.js"]
# fontes embutidas (OFL): família → [(peso, arquivo)]
BUILTIN_FONTS = {
    "Barlow Condensed": [(700, "BarlowCondensed-700.woff2"), (800, "BarlowCondensed-800.woff2"), (900, "BarlowCondensed-900.woff2")],
    "Bricolage Grotesque": [("200 800", "BricolageGrotesque-var.woff2")],
}


def fail(msg: str) -> None:
    print(f"ERRO: {msg}", file=sys.stderr)
    sys.exit(1)


def data_url(path: pathlib.Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    if path.suffix.lower() == ".svg":
        mime = "image/svg+xml"
    if path.suffix.lower() == ".woff2":
        mime = "font/woff2"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def script(code: str, name: str) -> str:
    code = code.replace("</script", "<\\/script").replace("<!--", "<\\!--")
    return f"<script>\n{code}\n//# sourceURL={name}\n</script>"


def font_faces(brand: dict, project_dir: pathlib.Path) -> str:
    css = []
    for fam, files in BUILTIN_FONTS.items():
        for weight, fname in files:
            p = FONTS / fname
            if p.exists():
                css.append(f'@font-face{{font-family:"{fam}";font-weight:{weight};font-style:normal;font-display:block;src:url({data_url(p)}) format("woff2");}}')
    for ff in brand.get("fontFiles", []) or []:
        p = (project_dir / ff["file"]).resolve()
        if not p.exists():
            fail(f"marca.json: fonte {ff['file']} não encontrada")
        css.append(f'@font-face{{font-family:"{ff["family"]}";font-weight:{ff.get("weight", 400)};font-style:normal;font-display:block;src:url({data_url(p)});}}')
    return "\n".join(css)


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("--out", default=None, help="pasta de saída (padrão: /mnt/user-data/outputs se existir, senão a pasta do projeto)")
    ap.add_argument("--skip-check", action="store_true")
    ap.add_argument("--voz", default=None, help="áudio da narração (mp3/wav/m4a/ogg) para embutir no HTML; o estúdio sincroniza sozinho ao abrir")
    a = ap.parse_args()

    pdir = pathlib.Path(a.project).resolve()
    if not pdir.is_dir():
        fail(f"pasta do projeto não existe: {pdir}")
    try:
        meta = json.loads((pdir / "projeto.json").read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail("falta projeto.json")
    except json.JSONDecodeError as e:
        fail(f"projeto.json inválido: {e}")
    slug = meta.get("slug", "")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,60}", slug):
        fail('projeto.json: "slug" deve ter só letras minúsculas sem acento, números e hífen (ex.: "regar-planta")')
    for req in ("roteiro.txt", "cena.js", "tela.js"):
        if not (pdir / req).exists():
            fail(f"falta {req} na pasta do projeto")

    brand: dict = {}
    if (pdir / "marca.json").exists():
        brand = json.loads((pdir / "marca.json").read_text(encoding="utf-8"))
    brand.setdefault("mode", "sem-marca")
    if brand.get("logo"):
        lp = (pdir / brand["logo"]).resolve()
        if not lp.exists():
            fail(f"marca.json: logo {brand['logo']} não encontrado")
        brand["logo"] = data_url(lp)
    if brand["mode"] == "sem-marca":
        brand.pop("logo", None)

    sources = {p: (pdir / p).read_text(encoding="utf-8") for p in PROJECT_PARTS if (pdir / p).exists()}
    project = {
        "api": 1,
        "slug": slug,
        "title": meta.get("title", slug),
        "cover": meta.get("cover", {"cue": "hook", "dt": 0.6}),
        "captions": meta.get("captions", {}),
        "bloom": meta.get("bloom", {"strength": 0.45, "radius": 0.28, "threshold": 0.85}),
        "sfxVolumeDb": meta.get("sfxVolumeDb", 0),
        "roteiro": (pdir / "roteiro.txt").read_text(encoding="utf-8"),
        "brand": brand,
        "publish": (pdir / "publicar.md").read_text(encoding="utf-8") if (pdir / "publicar.md").exists() else "",
        "sources": sources,
    }
    if a.voz:
        vp = pathlib.Path(a.voz).resolve()
        if not vp.exists():
            fail(f"--voz: arquivo não encontrado: {vp}")
        if vp.stat().st_size > 12 * 1024 * 1024:
            fail("--voz: arquivo maior que 12 MB; converta para MP3 (ex.: ffmpeg -i entrada -b:a 128k voz.mp3)")
        mime = mimetypes.guess_type(vp.name)[0] or "audio/mpeg"
        project["voice"] = {"name": vp.name, "mime": mime, "data": f"data:{mime};base64," + base64.b64encode(vp.read_bytes()).decode("ascii")}
        print(f"narração embutida: {vp.name} ({vp.stat().st_size / 1048576:.1f} MB)")

    if not a.skip_check:
        node = shutil.which("node")
        checker = SKILL / "scripts" / "check_project.mjs"
        if node and checker.exists():
            r = subprocess.run([node, str(checker), str(pdir)], capture_output=True, text=True, encoding="utf-8")
            print(r.stdout.rstrip())
            if r.returncode != 0:
                print(r.stderr.rstrip(), file=sys.stderr)
                fail("o validador encontrou erros; corrija e rode de novo (ou use --skip-check por sua conta)")
        else:
            print("aviso: Node não encontrado; validação pulada")

    tpl = (RUNTIME / "template.html").read_text(encoding="utf-8")
    vendor = (RUNTIME / "vendor.min.js").read_text(encoding="utf-8")
    scripts = [script(vendor, "vendor.min.js")]
    scripts += [script((RUNTIME / f).read_text(encoding="utf-8"), f"runtime/{f}") for f in RUNTIME_ORDER[:-1]]
    for part in PROJECT_PARTS:
        if part in sources:
            scripts.append(script(f"try {{\n{sources[part]}\n}} catch (e) {{ console.error(e); (window.__bqLoadErrors ||= []).push('{part}: ' + e.message); }}", f"projeto/{part}"))
    scripts.append(script((RUNTIME / "estudio.js").read_text(encoding="utf-8"), "runtime/estudio.js"))

    project_json = json.dumps(project, ensure_ascii=False).replace("<", "\\u003c")
    html = (tpl.replace("/*API*/", "1")
               .replace("/*FONTS*/", font_faces(brand, pdir))
               .replace("/*CSS*/", (RUNTIME / "estudio.css").read_text(encoding="utf-8"))
               .replace("/*PROJECT*/", project_json)
               .replace("<!--SCRIPTS-->", "\n".join(scripts)))

    if a.out:
        out_dir = pathlib.Path(a.out)
    elif pathlib.Path("/mnt/user-data/outputs").is_dir():
        out_dir = pathlib.Path("/mnt/user-data/outputs")
    else:
        out_dir = pdir
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{slug}-estudio.html"
    out.write_text(html, encoding="utf-8")
    print(f"OK: {out} ({out.stat().st_size / 1048576:.2f} MB)")


if __name__ == "__main__":
    main()
