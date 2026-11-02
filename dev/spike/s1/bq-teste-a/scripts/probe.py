"""Sonda do ambiente de skills do claude.ai (spike S1 do Bonequinhos-Reels)."""
import json, os, platform, shutil, subprocess, sys, time

def run(cmd, timeout=60):
    try:
        p = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return (p.stdout + p.stderr).strip()[-800:]
    except Exception as e:
        return f"ERRO: {e}"

r = {}
here = os.path.dirname(os.path.abspath(__file__))
r["skill_dir"] = os.path.dirname(here)
r["python"] = sys.version
r["platform"] = platform.platform()
r["cpu"] = os.cpu_count()
r["node"] = run("node --version")
r["npm"] = run("npm --version")
r["ffmpeg"] = run("ffmpeg -version | head -1")
r["chrome"] = [b for b in ("chromium", "chromium-browser", "google-chrome") if shutil.which(b)]
r["markers"] = run("find / -name bq-suite.json -not -path '/proc/*' 2>/dev/null", 90)
r["mnt_skills"] = run("ls -R /mnt/skills 2>/dev/null | head -60")
r["outputs_dir"] = run("ls -ld /mnt/user-data/outputs 2>&1")
r["peso_1mb_ok"] = os.path.getsize(os.path.join(here, "peso-1mb.bin")) == 1048576
for mod in ("PIL", "fontTools", "numpy"):
    try:
        __import__(mod); r[f"import_{mod}"] = "ok"
    except Exception as e:
        r[f"import_{mod}"] = f"falhou: {e}"
r["pip_fonttools"] = run("pip install --quiet fonttools brotli 2>&1 | tail -2", 120)
r["npm_view_fontsource"] = run("npm view @fontsource/poppins version", 60)
r["npm_pack_fontsource"] = run("cd /tmp && npm pack @fontsource/poppins --silent 2>&1 | tail -1", 120)
r["rede_hf"] = run("curl -sI -m 10 https://huggingface.co | head -1")
r["rede_jsdelivr"] = run("curl -sI -m 10 https://cdn.jsdelivr.net/npm/three@0.184.0/package.json | head -1")
out_dir = "/mnt/user-data/outputs" if os.path.isdir("/mnt/user-data/outputs") else "/tmp/outputs"
os.makedirs(out_dir, exist_ok=True)
with open(os.path.join(out_dir, "teste-5mb.bin"), "wb") as f:
    f.write(os.urandom(5 * 1024 * 1024))
r["arquivo_5mb"] = os.path.join(out_dir, "teste-5mb.bin")
t0 = time.time(); r["sleep_90s"] = run("sleep 90 && echo terminou", 100); r["sleep_90s_tempo"] = round(time.time() - t0, 1)
print(json.dumps(r, ensure_ascii=False, indent=2))
