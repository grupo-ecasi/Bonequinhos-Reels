"""Valida as skills e gera os .zip para subir no claude.ai (Configurações → Personalização → Skills).

Uso: python dev/build/build_all.py [nome-da-skill ...]
- Copia o vendor.min.js atual para a skill do estúdio.
- Confere: frontmatter (name igual à pasta, description ≤ 200), SKILL.md < 500 linhas,
  < 200 arquivos e < 8 MB por zip.
- Grava dist/<skill>.zip com a pasta da skill na raiz do zip.
"""
from __future__ import annotations

import json
import pathlib
import re
import shutil
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
SKILLS = ROOT / "skills"
DIST = ROOT / "dist"
VERSION = "0.1.0"
EXCLUDE = re.compile(r"(__pycache__|\.pyc$|\.DS_Store$|node_modules|/out/|\.tmp$)")


def frontmatter(md: str) -> dict:
    m = re.match(r"^---\n(.*?)\n---\n", md, re.S)
    if not m:
        return {}
    out = {}
    for line in m.group(1).splitlines():
        k, _, v = line.partition(":")
        out[k.strip()] = v.strip()
    return out


def check(skill: pathlib.Path) -> list[str]:
    errs = []
    md_path = skill / "SKILL.md"
    if not md_path.exists():
        return [f"{skill.name}: falta SKILL.md"]
    md = md_path.read_text(encoding="utf-8")
    fm = frontmatter(md)
    if fm.get("name") != skill.name:
        errs.append(f"{skill.name}: name do frontmatter ({fm.get('name')}) diferente da pasta")
    if not re.fullmatch(r"[a-z0-9-]{1,64}", fm.get("name", "")):
        errs.append(f"{skill.name}: name inválido")
    desc = fm.get("description", "")
    if not desc or len(desc) > 200:
        errs.append(f"{skill.name}: description com {len(desc)} caracteres (máx. 200)")
    if md.count("\n") >= 500:
        errs.append(f"{skill.name}: SKILL.md com {md.count(chr(10))} linhas (máx. 499)")
    files = [p for p in skill.rglob("*") if p.is_file() and not EXCLUDE.search(p.as_posix())]
    if len(files) >= 200:
        errs.append(f"{skill.name}: {len(files)} arquivos (máx. 199)")
    size = sum(p.stat().st_size for p in files)
    if size > 8 * 1024 * 1024:
        errs.append(f"{skill.name}: {size / 1048576:.1f} MB (máx. 8)")
    return errs


def main() -> None:
    names = sys.argv[1:] or sorted(p.name for p in SKILLS.iterdir() if p.is_dir())
    vendor = ROOT / "dev" / "vendor" / "vendor.min.js"
    est = SKILLS / "bonequinho-estudio" / "assets" / "runtime" / "vendor.min.js"
    if vendor.exists() and est.parent.exists():
        shutil.copy2(vendor, est)
    DIST.mkdir(exist_ok=True)
    problems = []
    for n in names:
        skill = SKILLS / n
        (skill / "bq-suite.json").write_text(json.dumps({"suite": "bonequinho-reels", "skill": n, "versao": VERSION, "api": 1}), encoding="utf-8")
        errs = check(skill)
        if errs:
            problems += errs
            continue
        out = DIST / f"{n}.zip"
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for p in sorted(skill.rglob("*")):
                if p.is_file() and not EXCLUDE.search(p.as_posix()):
                    z.write(p, f"{n}/{p.relative_to(skill).as_posix()}")
        fm = frontmatter((skill / "SKILL.md").read_text(encoding="utf-8"))
        print(f"OK  {out.name:32s} {out.stat().st_size / 1024:8.0f} KB  descrição {len(fm['description'])} car.")
    if problems:
        print("\n".join("ERRO " + e for e in problems))
        sys.exit(1)


if __name__ == "__main__":
    main()
