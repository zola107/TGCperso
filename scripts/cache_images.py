#!/usr/bin/env python3
"""Copie locale des images des cartes, pour que le site ne dépende plus des sites d'origine.

Les images sont rangées dans prototype/images/ (non versionné : elles appartiennent à leurs éditeurs)
et listées dans prototype/images/index.js, que le site lit s'il existe.

On télécharge lentement (une image à la fois, avec une pause) pour ne pas déclencher les protections
anti-robots. Si un site renvoie sa page de vérification (Cloudflare), on s'arrête net : relancer le
script plus tard reprend là où il en était.

Usage :
  python3 scripts/cache_images.py                 # tout ce qui manque
  python3 scripts/cache_images.py --sauf fandom   # tout sauf les wikis de fans
  python3 scripts/cache_images.py --attendre      # attend la fin d'un blocage (1 essai / 10 min) puis télécharge
"""
import argparse, json, re, sys, time, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "prototype" / "data.js"
OUT = ROOT / "prototype" / "images"
UA = "TGCperso/0.1 (https://github.com/zola107/TGCperso)"
PAUSE = {"fandom": 1.5, "wikimedia": 0.6, "pokeapi": 0.2}
EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif", "image/svg+xml": ".svg"}


class Blocked(Exception):
    pass


def characters():
    s = DATA.read_text()
    return json.loads("[" + s[s.index("const CHARACTERS = [") + 20: s.rindex("];")] + "]")


def host(url):
    return "fandom" if "wikia.nocookie.net" in url else "pokeapi" if "PokeAPI" in url else "wikimedia"


def download(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/webp,image/png,image/*;q=0.8"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            body, ctype = r.read(), r.headers.get_content_type()
    except urllib.error.HTTPError as e:
        page = e.read(2000).decode("utf-8", "ignore")
        if e.code in (403, 429, 503) and ("Just a moment" in page or "cloudflare" in page.lower() or e.code == 429):
            raise Blocked(f"{e.code} : protection anti-robots")
        raise
    if not ctype.startswith("image/"):
        raise Blocked(f"réponse inattendue ({ctype})")
    return body, ctype


def write_index(done):
    lines = ",\n".join(f"  {json.dumps(k)}: {json.dumps(v)}" for k, v in sorted(done.items()))
    (OUT / "index.js").write_text(f"// Généré par scripts/cache_images.py : copies locales des images (non versionnées).\nconst LOCAL_IMAGES = {{\n{lines}\n}};\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sauf", choices=["fandom", "wikimedia", "pokeapi"])
    ap.add_argument("--seulement", choices=["fandom", "wikimedia", "pokeapi"])
    ap.add_argument("--attendre", action="store_true")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    chars = characters()
    done = {p.stem: f"images/{p.name}" for p in OUT.iterdir() if p.suffix in EXT.values()}
    todo = [c for c in chars if c["slug"] not in done and c.get("image")
            and host(c["image"]) != args.sauf and (not args.seulement or host(c["image"]) == args.seulement)]
    print(f"{len(done)} images déjà copiées, {len(todo)} à télécharger", file=sys.stderr)

    if args.attendre and any(host(c["image"]) == "fandom" for c in todo):
        probe = next(c["image"] for c in todo if host(c["image"]) == "fandom")
        while True:
            try:
                download(probe)
                break
            except Blocked:
                print(time.strftime("%H:%M"), "toujours bloqué, nouvel essai dans 10 min", file=sys.stderr, flush=True)
                time.sleep(600)

    failed = 0
    for i, c in enumerate(todo, 1):
        h = host(c["image"])
        try:
            body, ctype = download(c["image"])
        except Blocked as e:
            write_index(done)
            print(f"\nArrêt : {h} bloque ({e}). {len(done)} images copiées ; relancer plus tard reprendra ici.", file=sys.stderr)
            sys.exit(2)
        except Exception as e:
            failed += 1
            print(f"  ! {c['nom']} : {e}", file=sys.stderr)
            continue
        name = c["slug"] + EXT.get(ctype, ".img")
        (OUT / name).write_bytes(body)
        done[c["slug"]] = f"images/{name}"
        if i % 50 == 0:
            write_index(done)
            print(f"  {i}/{len(todo)}", file=sys.stderr, flush=True)
        time.sleep(PAUSE[h])
    write_index(done)
    print(f"Terminé : {len(done)} images copiées, {failed} en échec.", file=sys.stderr)


if __name__ == "__main__":
    main()
