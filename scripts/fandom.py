"""Personnages récupérés sur les wikis de fans (Fandom), franchise par franchise.

Pour chaque franchise de scripts/franchises.json :
  - liste des pages des catégories de personnages
  - classement par importance : la longueur de l'article (un perso marquant a une longue page)
  - image : celle de l'infobox si son fichier porte le nom du perso, sinon une autre image de la page
    qui porte son nom (« render », « artwork »… de préférence) ; jamais un logo, une icône ou une capture
  - jeu et année : reconnus dans les catégories du perso (« jeux » de la franchise)
  - rôle : boss, antagoniste, protagoniste, d'après les catégories
"""
import json, re, sys, urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_characters as B  # noqa: E402

CONF = Path(__file__).resolve().parent / "franchises.json"
QUOTAS = {"S": 55, "A": 32, "B": 20, "C": 10}
ALIAS = json.loads(B.MANUAL.read_text()).get("alias", {}) if B.MANUAL.exists() else {}
# versions hors jeu (romans, films…) et pages de groupe (« Toy Animatronics », « Millicent's Sisters »)
OTHER_MEDIA = re.compile(r"\([^)]*\b(novels?|novel trilogy|film|movie|books?|comics?|manga|anime|tv|series|hbo|fazbear frights|tales from the pizzaplex|stitchwraith|graphic novel|live[- ]action|cartoon|animated|sonic x|archie|idw|item|soldiers|pre-super genesis wave)\b[^)]*\)", re.I)
GROUP = re.compile(r"\b(protagonists|empire|squad|ship|organization|animatronics|bots|skins|suits|children|sisters|brothers|souls|mannequins|catalog|members|family|gang|crew|soldiers|guards|enemies|units|minions|variants|versions|forms|outfits|types|cards|monsters|creatures|npcs|followers|knights)$", re.I)
SKIP_TITLE = re.compile(r"^(list|lists|gallery|category|template|timeline)\b|\b(protagonists|members|characters) in\b|\(disambiguation\)|/|\bcharacters?\b|\bmobs?\b$|^(bosses|heroes|agents|legends|enemies|npcs|outfits|survivors|killers|brawlers|operators|classes)$", re.I)
# une page dont les catégories parlent d'objet, de lieu ou d'organisation, et jamais de personnage, est écartée
NONCHAR_CAT = re.compile(r"\b(items?|objects?|locations?|places?|areas?|vehicles?|weapons?|food|songs?|music|soundtracks?|levels?|zones?|stages?|maps?|abilities|mechanics|organi[sz]ations?|compan(y|ies)|groups?|factions?|planets?|cities|buildings|episodes|chapters|merchandise|power-?ups|artifacts|emblems?|logos?|equipment|gadgets|technology|terminology|races|species)\b", re.I)
CHAR_CAT = re.compile(r"character|boss|enem|villain|antagonist|protagonist|npc|animatronic|\bbots?\b|champion|hero|agent|legend|brawler|operator|killer|survivor|compan(ion)?s?\b|creature|monster|human|\bmales?\b|females?|deceased|playable|members|sims\b|outfit|skin|warframe|villager|robot master|\bmobs?\b|class(es)?\b|deit(y|ies)|\bgods?\b|dragon|knight|assassin|templar|lord|demigod|empyrean|shardbearer|special infected|heister|troops?\b|cards?\b|birds\b|plants?\b|zombies\b", re.I)
BAD_FILE = re.compile(r"logo|icon|map\b|screenshot|screen_?shot|\.gif$|banner|cover|box_?art|title|concept|location|weapon|emote|spray|loading|card_?back|wallpaper|_hd_?wp|group|cast|comparison|ingame_?(screen|shot)|portal|badge|achievement|trophy", re.I)
GOOD_FILE = re.compile(r"render|artwork|official|portrait|model|full_?body|promo|key_?art|profile", re.I)


def api(wiki, **params):
    return B.fetch(f"https://{wiki}.fandom.com/api.php", {"action": "query", "format": "json", "formatversion": 2, **params})


def query_all(wiki, **params):
    """Suit les « continue » de l'API et renvoie toutes les réponses."""
    out, cont = [], {}
    for _ in range(60):
        r = api(wiki, **params, **cont)
        out.append(r)
        if "continue" not in r:
            break
        cont = r["continue"]
    return out


def members(wiki, cat, depth=1):
    titles = []
    for r in query_all(wiki, list="categorymembers", cmtitle=f"Category:{cat}", cmnamespace=0, cmlimit=500):
        titles += [m["title"] for m in r.get("query", {}).get("categorymembers", [])]
    if len(titles) < 5 and depth:  # personnages rangés dans des sous-catégories
        subs = []
        for r in query_all(wiki, list="categorymembers", cmtitle=f"Category:{cat}", cmtype="subcat", cmlimit=100):
            subs += [m["title"].split(":", 1)[1] for m in r.get("query", {}).get("categorymembers", [])]
        for s in subs[:25]:
            titles += members(wiki, s, depth - 1)
    return titles


def page_info(wiki, titles):
    pages = {}
    for i in range(0, len(titles), 20):
        for r in query_all(wiki, titles="|".join(titles[i:i + 20]), prop="info|pageimages|categories",
                           piprop="original|name", cllimit="max", clshow="!hidden", redirects=1):
            for p in r.get("query", {}).get("pages", []):
                if "missing" in p:
                    continue
                q = pages.setdefault(p["pageid"], {"title": p["title"], "length": 0, "cats": []})
                q["length"] = max(q["length"], p.get("length", 0))
                if "pageimage" in p:
                    q["pageimage"], q["original"] = p["pageimage"], (p.get("original") or {}).get("source")
                q["cats"] += [c["title"].split(":", 1)[1] for c in p.get("categories", [])]
    return pages


def page_files(wiki, titles):
    files = {}
    for i in range(0, len(titles), 20):
        for r in query_all(wiki, titles="|".join(titles[i:i + 20]), prop="images", imlimit="max"):
            for p in r.get("query", {}).get("pages", []):
                files.setdefault(p["title"], []).extend(x["title"].split(":", 1)[1] for x in p.get("images", []))
    return files


def file_urls(wiki, names):
    urls = {}
    for i in range(0, len(names), 50):
        r = api(wiki, titles="|".join("File:" + n for n in names[i:i + 50]), prop="imageinfo", iiprop="url")
        q = r.get("query", {})
        back = {n["to"]: n["from"] for n in q.get("normalized", [])}
        for p in q.get("pages", []):
            info = p.get("imageinfo")
            if info:
                t = back.get(p["title"], p["title"]).split(":", 1)[1]
                urls[t] = info[0]["url"]
    return urls


def thumb(url):
    """Vignette de 480 px servie par le CDN de Fandom."""
    return re.sub(r"/revision/latest(?=\?|$)", "/revision/latest/scale-to-width-down/480", url, count=1)


def pick_file(c, files):
    ok = [f for f in files if B.names_in(c, f) and not BAD_FILE.search(f) and re.search(r"\.(png|jpe?g|webp)$", f, re.I)]
    ok.sort(key=lambda f: (not GOOD_FILE.search(f), not f.lower().endswith(".png")))
    return ok[0] if ok else None


def role_of(cats):
    s = " | ".join(cats).lower()
    if "boss" in s: return "Boss"
    if re.search(r"antagonist|villain|killer", s): return "Antagoniste"
    if re.search(r"protagonist|playable|main character|hero|champion|agent|legend|brawler|operator|survivor|squad|compan|party", s): return "Protagoniste"
    return "Personnage"


def game_of(f, cats):
    best = None
    for pattern, v in (f.get("jeux") or {}).items():
        if any(pattern.lower() in c.lower() for c in cats):
            name, year = (v if isinstance(v, list) else (pattern, v))
            if best is None or year < best[1]:
                best = (name, year)
    return best or (f["nom"], f["annee"])


def clean_name(t):
    return re.sub(r"\s*\((character|personnage|boss|npc|enemy|creature|3d universe|hd universe|2d universe|game|program|reforged|outfit|protagonist|personnage)\)$", "", t, flags=re.I).strip()


def collect(only=None, workers=8):
    """Toutes les franchises, plusieurs wikis en parallèle (chacun reste interrogé une requête à la fois)."""
    from concurrent.futures import ThreadPoolExecutor
    conf = [f for f in json.loads(CONF.read_text())["franchises"] if not only or f["nom"] in only]
    with ThreadPoolExecutor(workers) as ex:
        parts = list(ex.map(collect_one, conf))
    return [c for part in parts for c in part]


def collect_one(f):
    out = []
    if True:
        wiki, quota = f["wiki"], f.get("quota") or QUOTAS[f["niveau"]]
        titles = []
        for cat in f.get("cats") or ["Characters"]:
            for t in members(wiki, cat):
                if t not in titles:
                    titles.append(t)
        titles = [t for t in titles if not SKIP_TITLE.search(t) and not OTHER_MEDIA.search(t) and not GROUP.search(t)
                  and B.norm(t) != B.norm(f["nom"])]
        if not titles:
            print(f"   ! {f['nom']} : aucune page de personnage trouvée", file=sys.stderr)
            return out
        info = sorted(page_info(wiki, titles).values(), key=lambda p: -p["length"])
        # strict : au moins une catégorie doit dire que c'est un personnage, et aucune ne doit en faire un objet ou un lieu
        is_char = lambda p: any(CHAR_CAT.search(c) for c in p["cats"]) and not (
            any(NONCHAR_CAT.search(c) for c in p["cats"]) and not any(re.search(r"character|boss|npc", c, re.I) for c in p["cats"]))
        info = [p for p in info if p["length"] > 1500 and is_char(p)][: quota * 3]

        # 1. l'image de l'infobox, si elle porte le nom du perso
        cands, need = [], []
        for p in info:
            c = {"nom": clean_name(p["title"]), "en_label": clean_name(p["title"]), "alias": ALIAS.get(clean_name(p["title"]), [])}
            name = p.get("pageimage") or ""
            if p.get("original") and B.names_in(c, name) and not BAD_FILE.search(name):
                p["image"] = p["original"]
            else:
                need.append(p["title"])
            cands.append((p, c))
        # 2. sinon une autre image de la page qui porte son nom
        if need:
            files = page_files(wiki, need)
            chosen = {}
            for p, c in cands:
                if p["title"] in files and "image" not in p:
                    fn = pick_file(c, files[p["title"]])
                    if fn:
                        chosen[p["title"]] = fn
            urls = file_urls(wiki, list(set(chosen.values())))
            for p, c in cands:
                if p["title"] in chosen and chosen[p["title"]] in urls:
                    p["image"] = urls[chosen[p["title"]]]

        kept = 0
        for p, c in cands:
            if "image" not in p or kept >= quota:
                continue
            jeu, annee = game_of(f, p["cats"])
            role = role_of(p["cats"])
            kept += 1
            out.append({
                "qid": f"{wiki}:{B.norm(p['title'])}", "nom": c["nom"], "en_label": c["nom"], "franchise": f["nom"],
                "jeu": jeu, "annee": annee, "role": role, "desc": "", "links": 0, "kind": "fandom",
                "works": 0, "tags": list(f.get("tags", [])), "alias": c["alias"][:2], "image": thumb(p["image"]), "niveau": f["niveau"],
                "length": p["length"], "boss": role == "Boss", "forced": False,
                "source": f"https://{wiki}.fandom.com/wiki/" + urllib.parse.quote(p["title"].replace(" ", "_")),
            })
        print(f"   {f['nom']:<28} {kept:>3}/{quota} (pages : {len(titles)})", file=sys.stderr)
    return out


if __name__ == "__main__":  # essai sur quelques franchises : python3 scripts/fandom.py "Red Dead Redemption" "Elden Ring"
    res = collect(set(sys.argv[1:]) or None)
    for c in res:
        print(f"{c['franchise']:<24} {c['nom']:<34} {c['role']:<12} {c['jeu']} ({c['annee']})  {c['length']:>7}  {c['image'][:90]}")
