#!/usr/bin/env python3
"""Construit le catalogue de personnages (prototype/data.js) depuis Wikidata et Wikipédia.

Sources (gratuites, sans clé) :
  - Wikidata : personnages, première apparition, franchise, année, alias, notoriété (sitelinks)
  - Wikipédia : image de l'article du personnage (son infobox, donc bien lui) et résumé en français

Règles appliquées (voir docs/regles-du-jeu.md) :
  - on garde un personnage seulement s'il est né dans un jeu vidéo (première apparition = jeu)
  - un personnage sans image ou sans année est écarté
  - au plus MAX_PAR_FRANCHISE personnages par franchise, pour garder un catalogue varié
  - rareté : score sur 100 (grille de la section 3), puis répartition cible du catalogue
  - exceptions décidées par l'équipe : scripts/rarete_manuelle.json

Usage :  python3 scripts/build_characters.py [--total 1000]
Les réponses des API sont mises en cache dans scripts/.cache (relancer est rapide).
"""
import argparse, hashlib, json, math, os, re, sys, time, unicodedata, urllib.parse, urllib.request
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).resolve().parent / ".cache"
OUT = ROOT / "prototype" / "data.js"
MANUAL = Path(__file__).resolve().parent / "rarete_manuelle.json"
DEBUG = set(os.environ.get("DEBUG_QIDS", "").split(","))  # ex. DEBUG_QIDS=Q652022 : suit ces personnages
UA = "TGCperso/0.1 (https://github.com/zola107/TGCperso)"
WD_API, WDQS = "https://www.wikidata.org/w/api.php", "https://query.wikidata.org/sparql"
LANGS = ["en", "fr", "es", "it", "de", "pt", "ru", "ja"]  # ordre de préférence pour l'image
WIKI = {l: f"https://{l}.wikipedia.org/w/api.php" for l in LANGS}

MAX_PAR_FRANCHISE = 40
# Pokémon : pris dans PokéAPI (illustration officielle, nom et Pokédex en français) pour compléter le total
POKEAPI = "https://pokeapi.co/api/v2"
ARTWORK = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/{}.png"
GEN_LIMITS = [151, 251, 386, 493, 649, 721, 809, 905, 1025]
# répartition cible du catalogue (section 2 des règles)
REPARTITION = [("spectaculaire", .02), ("mythique", .05), ("legendaire", .10), ("epique", .13),
               ("rare", .20), ("peucommun", .23), ("commun", .27)]

VIDEO_GAME_CHARACTER, VIDEO_GAME, POKEMON_SPECIES = "Q1569167", "Q7889", "Q3966183"
POKEMON_GENERATIONS = {  # première génération → jeu et année de sortie au Japon
    "first": ("Pokémon Rouge et Vert", 1996), "second": ("Pokémon Or et Argent", 1999),
    "third": ("Pokémon Rubis et Saphir", 2002), "fourth": ("Pokémon Diamant et Perle", 2006),
    "fifth": ("Pokémon Noir et Blanc", 2010), "sixth": ("Pokémon X et Y", 2013),
    "seventh": ("Pokémon Soleil et Lune", 2016), "eighth": ("Pokémon Épée et Bouclier", 2019),
    "ninth": ("Pokémon Écarlate et Violet", 2022),
}


# ---------------------------------------------------------------- accès réseau (avec cache)
def fetch(url, params, method="GET"):
    key = hashlib.sha1((url + json.dumps(params, sort_keys=True)).encode()).hexdigest()
    path = CACHE / f"{key}.json"
    if path.exists():
        return json.loads(path.read_text())
    data = urllib.parse.urlencode(params).encode()
    for attempt in range(5):
        try:
            req = urllib.request.Request(url if method == "POST" else f"{url}?{data.decode()}",
                                         data=data if method == "POST" else None,
                                         headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                out = json.loads(r.read())
            CACHE.mkdir(exist_ok=True)
            path.write_text(json.dumps(out))
            time.sleep(0.2)
            return out
        except Exception as e:  # limite de débit ou coupure : on réessaie plus tard
            wait = 5 * (attempt + 1)
            print(f"  ! {e} — nouvel essai dans {wait} s", file=sys.stderr)
            time.sleep(wait)
    raise SystemExit(f"Échec de la requête {url}")


def sparql(query):
    return fetch(WDQS, {"query": query, "format": "json"}, "POST")["results"]["bindings"]


def entities(ids, props="labels|descriptions|aliases|claims|sitelinks"):
    out, ids = {}, sorted(set(ids))
    for i in range(0, len(ids), 50):
        r = fetch(WD_API, {"action": "wbgetentities", "ids": "|".join(ids[i:i + 50]), "props": props,
                           "languages": "fr|en", "sitefilter": "|".join(l + "wiki" for l in LANGS), "format": "json"})
        out.update(r.get("entities", {}))
        print(f"  entités {min(i + 50, len(ids))}/{len(ids)}", end="\r", file=sys.stderr)
    print(file=sys.stderr)
    return out


def wiki_query(lang, titles, **params):
    """Requête MediaWiki par lots ; renvoie {titre demandé: page}."""
    out, titles = {}, sorted(set(titles))
    step = 20 if "extracts" in params.get("prop", "") else 50
    for i in range(0, len(titles), step):
        batch = titles[i:i + step]
        r = fetch(WIKI[lang], {"action": "query", "titles": "|".join(batch), "format": "json",
                               "formatversion": 2, "redirects": 1, **params})
        q = r.get("query", {})
        alias = {n["from"]: n["to"] for n in q.get("normalized", []) + q.get("redirects", [])}
        pages = {p["title"]: p for p in q.get("pages", [])}
        for t in batch:
            t2 = alias.get(alias.get(t, t), alias.get(t, t))
            if t2 in pages:
                out[t] = pages[t2]
        print(f"  {lang}.wikipedia {min(i + step, len(titles))}/{len(titles)}", end="\r", file=sys.stderr)
    print(file=sys.stderr)
    return out


# ---------------------------------------------------------------- lecture des entités
def label(e, langs=("fr", "en")):
    for l in langs:
        if l in e.get("labels", {}):
            return e["labels"][l]["value"]
    return None


def claim_ids(e, prop):
    out = []
    for c in e.get("claims", {}).get(prop, []):
        v = c["mainsnak"].get("datavalue", {}).get("value")
        if isinstance(v, dict) and "id" in v:
            out.append(v["id"])
    return out


def claim_years(e, prop):
    out = []
    for c in e.get("claims", {}).get(prop, []):
        v = c["mainsnak"].get("datavalue", {}).get("value")
        if isinstance(v, dict) and "time" in v:
            m = re.match(r"[+-](\d{4})", v["time"])
            if m and 1950 < int(m.group(1)) <= date.today().year:
                out.append(int(m.group(1)))
    return out


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


# ---------------------------------------------------------------- 1. candidats
def candidates():
    # trois requêtes simples plutôt qu'une grosse (le serveur coupe au-delà de 60 s) ;
    # l'existence d'un article Wikipédia est vérifiée ensuite, avec les fiches
    parts = [
        ("vgc", f"?c wdt:P31/wdt:P279* wd:{VIDEO_GAME_CHARACTER} ."),
        ("perso", f"?c wdt:P4584 ?g . ?g wdt:P31 wd:{VIDEO_GAME} ."),
        ("pokemon", f"?c wdt:P31/wdt:P279* wd:{POKEMON_SPECIES} ."),
    ]
    out = {}
    for kind, pattern in parts:
        rows = sparql(f"SELECT DISTINCT ?c ?links WHERE {{ {pattern} ?c wikibase:sitelinks ?links . FILTER(?links >= 2) }}")
        for b in rows:
            qid = b["c"]["value"].rsplit("/", 1)[1]
            prev = out.get(qid, (0, ""))[1]
            if prev != "pokemon" and not (prev == "vgc" and kind == "perso"):
                out[qid] = (int(b["links"]["value"]), kind)
    return out


# ---------------------------------------------------------------- tags des packs thématiques
def tags_from(genres, platforms, modes, companies):
    """Libellés anglais (en minuscules) du jeu de première apparition."""
    G, P, M, C = (" | ".join(x) for x in (genres, platforms, modes, companies))
    t = set()
    if "platform" in G or "arcade" in G or "arcade" in P: t.add("plateforme")
    if "role-playing" in G: t.add("rpg")
    if "fighting" in G or "beat 'em up" in G: t.add("combat")
    if "horror" in G: t.add("horreur")
    if re.search(r"battle arena|battle royale|shooter|massively|mmo", G) or re.search(r"online|massively", M): t.add("multi")
    if re.search(r"adventure|stealth|interactive|visual novel", G) or (M and "multiplayer" not in M): t.add("solo")
    nin = lambda x: re.search(r"nintendo|game boy|wii|famicom|super nes|game & watch|virtual boy", x)
    # une console seulement si l'éditeur est le constructeur ou si le jeu est exclusif à ses machines
    if "nintendo" in C or (platforms and all(nin(x) for x in platforms)): t.add("nintendo")
    if "sony" in C or (platforms and all("playstation" in x for x in platforms)): t.add("playstation")
    if re.search(r"microsoft (game )?studios|xbox game studios|bungie|343 industries", C) or (platforms and all("xbox" in x for x in platforms)): t.add("xbox")
    return t


FRANCHISE_ALIASES = {"Sonic": "Sonic the Hedgehog", "Mario": "Super Mario", "Grand Theft Auto 3D": "Grand Theft Auto",
                     "Grand Theft Auto HD": "Grand Theft Auto", "Zelda": "The Legend of Zelda", "Metal Gear Solid": "Metal Gear"}


def clean_franchise(f):
    f = re.sub(r"^(univers|série|franchise|saga) (de |d['’]|du |des )", "", f, flags=re.I)
    f = re.sub(r"\s*\((franchise|série|series|video game series|fictional universe|univers de fiction)\)$", "", f, flags=re.I)
    f = re.sub(r"\s+(universe|franchise|series|video game series)$", "", f, flags=re.I)
    return FRANCHISE_ALIASES.get(f, f)


# ---------------------------------------------------------------- programme principal
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--total", type=int, default=1000)
    args = ap.parse_args()

    print("1. Candidats (Wikidata)…", file=sys.stderr)
    cand = candidates()
    print(f"   {len(cand)} candidats", file=sys.stderr)

    print("2. Fiches des personnages…", file=sys.stderr)
    ents = entities(list(cand))

    # éléments cités (première apparition, franchise, classes) : libellés + quelques propriétés
    refs = set()
    for e in ents.values():
        for p in ("P4584", "P8345", "P31", "P1441", "P1080", "P179"):
            refs.update(claim_ids(e, p)[:12])
    print(f"3. Éléments liés ({len(refs)})…", file=sys.stderr)
    ref = entities(list(refs), "labels|claims")
    sub = set()
    for qid in refs:
        e = ref.get(qid, {})
        for p in ("P31", "P8345", "P179", "P136", "P400", "P404", "P123", "P178"):
            sub.update(claim_ids(e, p)[:10])
    sub -= set(ref)
    print(f"   + libellés ({len(sub)})…", file=sys.stderr)
    ref.update(entities(list(sub), "labels"))
    lab = lambda q, langs=("fr", "en"): label(ref.get(q, {}), langs) or ""

    def is_game(q):
        e = ref.get(q, {})
        return bool(claim_ids(e, "P400")) or any(re.search(r"video game|game\b|shooter|platformer", lab(t, ("en",)).lower()) for t in claim_ids(e, "P31"))

    manual = json.loads(MANUAL.read_text()) if MANUAL.exists() else {}
    forced = {n.lower() for n in manual.get("inclure", [])}
    excluded = {n.lower() for n in manual.get("exclure", [])}
    not_char = re.compile(r"\b(level|stage|sword|weapon|item|object|location|place|vehicle|organi[sz]ation|team|family|meme|creepypasta|folklore|urban legend|world|building|spacecraft|planet|city|book|film|song|album|track|course|circuit|map|arena|mode)\b")

    print("4. Filtrage et données…", file=sys.stderr)
    chars, dropped = [], Counter()
    dbg = lambda qid, msg: qid in DEBUG and print(f'   [debug] {qid} : {msg}', file=sys.stderr)
    for qid, (links, kind) in cand.items():
        e = ents.get(qid)
        if not e or "missing" in e:
            continue
        if not e.get("sitelinks"):
            dropped["sans article Wikipédia"] += 1; dbg(qid, "sans article Wikipédia"); continue
        nom = label(e)
        if not nom or re.match(r"^Q\d+$", nom):
            dropped["sans nom"] += 1; dbg(qid, "sans nom"); continue
        if nom.lower() in excluded or (label(e, ("en",)) or "").lower() in excluded:
            dropped["exclu par l'équipe"] += 1; dbg(qid, "exclu"); continue
        is_forced = nom.lower() in forced or (label(e, ("en",)) or "").lower() in forced
        tlabels = [lab(t, ("en",)).lower() for t in claim_ids(e, "P31")]
        if any(not_char.search(t) for t in tlabels) and not any("character" in t or "human" in t for t in tlabels):
            dropped["pas un personnage"] += 1; dbg(qid, "pas un personnage"); continue
        fa = claim_ids(e, "P4584")
        jeu, annee, game_q = None, None, None
        if kind == "pokemon":
            gen = next((lab(q, ("en",)).split()[0] for q in fa if "generation" in lab(q, ("en",)).lower()), "")
            if gen.lower() not in POKEMON_GENERATIONS:
                dropped["pokémon sans génération"] += 1; dbg(qid, "pokémon sans génération"); continue
            jeu, annee = POKEMON_GENERATIONS[gen.lower()]
            franchise = "Pokémon"
        else:
            games = [q for q in fa if is_game(q)]
            if fa and not games and not is_forced:
                dropped["né hors du jeu vidéo"] += 1; dbg(qid, "né hors du jeu vidéo"); continue
            if not fa:  # pas de première apparition : il doit être un « personnage de jeu vidéo » sans autre origine
                types = " | ".join(lab(t, ("en",)).lower() for t in claim_ids(e, "P31"))
                works = claim_ids(e, "P1441")
                games = [q for q in works if is_game(q)]
                only_games = bool(works) and len(games) == len(works)
                if not is_forced and (kind != "vgc" or (re.search(r"film|comic|literary|television|anime|manga|animated|novel", types) and not only_games)):
                    dropped["origine incertaine"] += 1; dbg(qid, "origine incertaine"); continue
            game_q = games[0] if games else (fa[0] if fa and is_forced else None)
            years = claim_years(ref.get(game_q, {}), "P577") if game_q else []
            years = years or claim_years(e, "P571") or [y for g in games + fa for y in claim_years(ref.get(g, {}), "P577")]
            if not years:
                dropped["sans année"] += 1; dbg(qid, "sans année"); continue
            annee, jeu = min(years), lab(game_q) if game_q else ""
            fr_ids = (claim_ids(e, "P8345") + claim_ids(e, "P1080") + claim_ids(e, "P179")
                      + [x for q in ([game_q] if game_q else []) + games for p in ("P8345", "P179") for x in claim_ids(ref.get(q, {}), p)])
            franchise = lab(fr_ids[0]) if fr_ids else (jeu or "")
            franchise = clean_franchise(franchise)
        if not franchise:
            dropped["sans franchise"] += 1; dbg(qid, "sans franchise"); continue

        # tags : genres, plateformes, modes, éditeur et développeur du jeu de première apparition
        g = ref.get(game_q, {}) if game_q else {}
        glabels = {k: [lab(x, ("en",)).lower() for x in claim_ids(g, p)] for k, p in
                   (("genres", "P136"), ("platforms", "P400"), ("modes", "P404"), ("companies", "P123"))}
        glabels["companies"] += [lab(x, ("en",)).lower() for x in claim_ids(g, "P178")]
        types = [lab(t, ("en",)).lower() for t in claim_ids(e, "P31")]
        role = ("Mascotte" if any("mascot" in t for t in types) else
                "Antagoniste" if any(k in t for t in types for k in ("antagonist", "villain")) else
                "Protagoniste" if any("protagonist" in t for t in types) else
                "Pokémon" if kind == "pokemon" else "Personnage")
        aliases = []
        for l in ("fr", "en"):
            for a in e.get("aliases", {}).get(l, []):
                v = a["value"]
                if v.lower() != nom.lower() and v not in aliases and len(v) < 40:
                    aliases.append(v)
        site = e.get("sitelinks", {})
        chars.append({
            "qid": qid, "nom": nom, "en_label": label(e, ("en",)) or nom, "franchise": franchise, "jeu": jeu or franchise, "annee": annee, "role": role,
            "alias": aliases[:3], "desc": e.get("descriptions", {}).get("fr", {}).get("value", ""),
            "links": links, "kind": "pokemon" if kind == "pokemon" else "perso", "works": len(claim_ids(e, "P1441")),
            "titles": {l: site[l + "wiki"]["title"] for l in LANGS if l + "wiki" in site},
            "fr": site.get("frwiki", {}).get("title"), "p18": (e.get("claims", {}).get("P18") or [{}])[0].get("mainsnak", {}).get("datavalue", {}).get("value"),
            "tags": sorted(tags_from(**glabels)), "forced": is_forced,
        })
    print(f"   {len(chars)} gardés ; écartés : {dict(dropped)}", file=sys.stderr)

    # les Pokémon viennent de PokéAPI ; on garde seulement leur notoriété Wikidata pour les classer
    poke_links = {norm(c["en_label"]): c["links"] for c in chars if c["kind"] == "pokemon"}
    chars = [c for c in chars if c["kind"] != "pokemon"]

    print("5. Images (Wikipédia, puis Wikimedia Commons)…", file=sys.stderr)
    # image de l'infobox de l'article du personnage ; on refuse les logos et les images partagées
    bad = re.compile(r"logo|\.svg|cosplay|wordmark|title|cover|box ?art|screenshot|gameplay|expo|con\b|_as_|convention|figur", re.I)
    found = defaultdict(list)
    for lang in LANGS:
        titles = [c["titles"][lang] for c in chars if lang in c["titles"]]
        pages = wiki_query(lang, titles, prop="pageimages", piprop="thumbnail|name", pithumbsize=480, pilicense="any")
        for c in chars:
            p = pages.get(c["titles"].get(lang, ""))
            # une image hébergée par la Wikipédia elle-même (et non par Commons) est une illustration
            # officielle en usage équitable ; celles de Commons sont presque toujours des photos
            name = p.get("pageimage", "") if p else ""
            # le fichier doit porter le nom du personnage : sinon c'est souvent une jaquette, un menu ou une image de groupe
            own = names_in(c, name)
            drawing = re.search(r"\.(png|svg)$", name, re.I) and "logo" not in name.lower()
            if p and "thumbnail" in p and own and (drawing or ("/commons/" not in p["thumbnail"]["source"] and not bad.search(name))):
                found[c["qid"]].append((p["pageimage"], p["thumbnail"]["source"], lang))
    shared = Counter(n for lst in found.values() for n in {x[0] for x in lst})
    img = {}
    for c in chars:
        ok = [x for x in found.get(c["qid"], []) if shared[x[0]] == 1]
        if ok:
            name, url, lang = ok[0]
            src = f"https://{lang}.wikipedia.org/wiki/" + urllib.parse.quote(c["titles"][lang].replace(" ", "_"))
            img[c["qid"]] = (url, src)
    for c in chars:
        if c["qid"] in DEBUG:
            print(f"   [debug] {c['qid']} images : {found.get(c['qid'])} partagées : {[shared[x[0]] for x in found.get(c['qid'], [])]}", file=sys.stderr)
    chars = [dict(c, image=img[c["qid"]][0], source=img[c["qid"]][1]) for c in chars if c["qid"] in img]
    print(f"   {len(chars)} avec image", file=sys.stderr)

    # sélection : les plus connus d'abord, avec un plafond par franchise
    chars.sort(key=lambda c: -c["links"])
    per, chosen = Counter(), []
    for c in chars:
        if c["franchise"] != "Pokémon" and (c["forced"] or per[c["franchise"]] < MAX_PAR_FRANCHISE):
            per[c["franchise"]] += 1
            chosen.append(c)
        if len(chosen) == args.total:
            break
    print(f"   {len(chosen)} personnages de jeux (hors Pokémon)", file=sys.stderr)

    print("6. Résumés en français…", file=sys.stderr)
    ext = wiki_query("fr", [c["fr"] for c in chosen if c["fr"]], prop="extracts", exintro=1, explaintext=1, exsentences=2)
    for c in chosen:
        if "resume" in c:
            continue
        t = (ext.get(c["fr"] or "", {}).get("extract") or "").strip()
        t = re.sub(r"\s*\([^()]*\)", "", t)          # retire prononciations, dates, noms japonais
        t = re.sub(r"\s+", " ", t).strip()
        about = any(w.lower() in t.lower() for w in re.findall(r"\w{3,}", c["nom"] + " " + c["en_label"])[:3])
        c["resume"] = t if 40 < len(t) < 420 and about else (
            f"{c['nom']} est un personnage de {c['franchise']}, apparu pour la première fois dans {c['jeu']} en {c['annee']}."
            + (f" {c['desc'][0].upper()}{c['desc'][1:]}." if c["desc"] else ""))

    print("6b. Pokémon (PokéAPI) pour compléter…", file=sys.stderr)
    chosen += pokemon_fill(args.total - len(chosen), poke_links)
    if len(chosen) < args.total:
        print(f"   ! seulement {len(chosen)} personnages disponibles", file=sys.stderr)

    # tags par franchise : un personnage sans tag hérite de ceux de sa franchise
    ftags = defaultdict(Counter)
    for c in chosen:
        ftags[c["franchise"]].update(c["tags"])
    for c in chosen:
        if not c["tags"]:
            c["tags"] = [t for t, _ in ftags[c["franchise"]].most_common(2)]

    print("7. Raretés…", file=sys.stderr)
    assign_rarities(chosen)

    # numérotation : par franchise (la plus connue d'abord), comme un set de cartes
    fame = defaultdict(int)
    for c in chosen:
        fame[c["franchise"]] = max(fame[c["franchise"]], c["links"])
    chosen.sort(key=lambda c: (-fame[c["franchise"]], c["franchise"], -c["links"]))
    write(chosen)


def norm(s):
    return re.sub(r"[^a-z0-9]", "", slugify(s))


GENERIC = {"the", "of", "de", "la", "le", "les", "des", "du", "and", "mr", "dr", "princess", "princesse", "king", "roi",
           "queen", "reine", "captain", "capitaine", "doctor", "docteur", "lord", "lady", "sir", "jr", "junior", "super", "big"}


def names_in(c, filename):
    """Vrai si un mot significatif du nom (ou d'un alias) du personnage figure dans le nom du fichier."""
    f = norm(filename)
    words = re.findall(r"[\w'’-]+", " ".join([c["nom"], c["en_label"], *c["alias"]]))
    full = norm(c["en_label"])
    return any(len(w) >= 3 and w.lower() not in GENERIC and norm(w) in f for w in words) or (len(full) >= 4 and full in f)


def pokemon_fill(n, links):
    """Les n Pokémon les plus connus (notoriété Wikidata, puis ordre du Pokédex)."""
    if n <= 0:
        return []
    species = fetch(f"{POKEAPI}/pokemon-species", {"limit": 2000})["results"]
    ranked = sorted(((links.get(norm(s["name"]), 1), i, s["name"]) for i, s in enumerate(species, 1) if i <= GEN_LIMITS[-1]),
                    key=lambda x: (-x[0], x[1]))
    games, out = list(POKEMON_GENERATIONS.values()), []
    for k, (lk, pid, name) in enumerate(ranked[:n]):
        d = fetch(f"{POKEAPI}/pokemon-species/{pid}", {})
        fr = lambda key, field: [x[field] for x in d[key] if x["language"]["name"] == "fr"]
        gen = next(g for g, lim in enumerate(GEN_LIMITS) if pid <= lim)
        jeu, annee = games[gen]
        nom = (fr("names", "name") or [name.title()])[0]
        flavor = fr("flavor_text_entries", "flavor_text")
        role = "Fabuleux" if d["is_mythical"] else "Légendaire" if d["is_legendary"] else "Pokémon"
        out.append({
            "qid": f"pokeapi-{pid}", "nom": nom, "en_label": name, "franchise": "Pokémon", "jeu": jeu, "annee": annee,
            "role": role, "alias": (fr("genera", "genus") or [])[:1], "desc": "", "links": lk, "kind": "pokemon", "works": 0,
            "tags": ["rpg", "nintendo"], "image": ARTWORK.format(pid), "source": f"https://pokeapi.co/api/v2/pokemon-species/{pid}",
            "resume": re.sub(r"\s+", " ", flavor[-1]).strip() if flavor else f"{nom}, Pokémon de la génération {gen + 1}.",
        })
        print(f"  Pokémon {k + 1}/{n}", end="\r", file=sys.stderr)
    print(file=sys.stderr)
    return out


def assign_rarities(chars):
    """Score sur 100 (grille des règles), puis rareté selon la répartition cible."""
    top = max(c["links"] for c in chars)
    fam_rank = defaultdict(list)
    for c in chars:
        fam_rank[c["franchise"]].append(c)
    for lst in fam_rank.values():
        lst.sort(key=lambda c: -c["links"])
    year = date.today().year
    for c in chars:
        impact = 35 * math.log(c["links"]) / math.log(top)
        pos = fam_rank[c["franchise"]].index(c)
        named = c["nom"].split()[0].lower() in (c["franchise"] + " " + c["jeu"]).lower()
        importance = 30 if (named or c["role"] in ("Mascotte", "Légendaire", "Fabuleux") or pos == 0) else 25 if c["role"] == "Antagoniste" or pos == 1 else 18 if pos < 4 else 8
        longevite = 10 * min(year - c["annee"], 40) / 40 + 10 * min(c["works"], 25) / 25
        c["score"] = round(impact + importance + longevite, 1)  # « statut culte » (15) : décidé par l'équipe
    manual = json.loads(MANUAL.read_text()).get("raretes", {}) if MANUAL.exists() else {}
    manual = {k.lower(): v for k, v in manual.items()}
    for c in chars:
        r = manual.get(c["nom"].lower()) or manual.get(c["en_label"].lower())
        if r:
            c["rarete"] = r
    missing = set(manual) - {c["nom"].lower() for c in chars} - {c["en_label"].lower() for c in chars}
    if missing:
        print(f"   ! raretés manuelles sans personnage correspondant : {sorted(missing)}", file=sys.stderr)
    rest = sorted([c for c in chars if "rarete" not in c], key=lambda c: -c["score"])
    n = len(chars)
    for rid, share in REPARTITION:
        if rid == "spectaculaire":  # réservé aux icônes absolues, choisies par l'équipe
            continue
        quota = max(0, round(share * n) - sum(1 for c in chars if c.get("rarete") == rid))
        for c in rest[:quota]:
            c["rarete"] = rid
        rest = rest[quota:]
    for c in rest:
        c["rarete"] = "commun"


def write(chars):
    used, out = set(), []
    for c in chars:
        s = slugify(c["nom"])
        if s in used:
            s = f"{s}-{slugify(c['franchise'])}"
        used.add(s)
        out.append({"slug": s, "nom": c["nom"], "franchise": c["franchise"], "jeu": c["jeu"], "annee": c["annee"],
                    "role": c["role"], "rarete": c["rarete"], "alias": c["alias"], "tags": c["tags"],
                    "image": c["image"], "source": c["source"], "wikidata": c["qid"], "resume": c["resume"]})
    counts = Counter(c["rarete"] for c in out)
    lines = ",\n".join("  " + json.dumps(c, ensure_ascii=False) for c in out)
    OUT.write_text(f"""// Fichier généré par scripts/build_characters.py — ne pas modifier à la main.
// {len(out)} personnages. Sources : Wikidata (données) et Wikipédia (images et résumés).
// Les images restent hébergées par Wikimédia ; elles appartiennent à leurs éditeurs.
// Raretés : {dict(counts)}

// Tags des packs thématiques : calculés pour chaque personnage (champ « tags »).
const FRANCHISE_TAGS = {{}};

const CHARACTERS = [
{lines}
];

if (typeof module !== "undefined") module.exports = {{ CHARACTERS, FRANCHISE_TAGS }};
""")
    print(f"→ {OUT.relative_to(ROOT)} : {len(out)} personnages, {len(set(c['franchise'] for c in out))} franchises, raretés {dict(counts)}", file=sys.stderr)


if __name__ == "__main__":
    main()
