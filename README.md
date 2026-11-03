# TGCperso

Projet TCG de personnages de jeux vidéo, première version.

Les règles complètes sont dans [docs/regles-du-jeu.md](docs/regles-du-jeu.md).

## Prototype jouable

Le dossier `prototype/` contient une version jouable sans serveur (HTML, CSS et JavaScript). La progression est sauvegardée dans le navigateur.

```bash
python3 -m http.server 8765 --directory prototype
```

Ouvrir ensuite http://localhost:8765.

| Fichier | Rôle |
|---|---|
| `config.js` | Tous les réglages : raretés, probabilités, packs (payants et gratuits), prix, marché, rangs, XP |
| `data.js` | Les 1000 personnages (fichier généré, voir ci-dessous) |
| `engine.js` | Le moteur : tirages, packs gratuits, coins, marché, rangs. En vrai projet, il tourne côté serveur |
| `emblems.js` | Les emblèmes dessinés : 7 gemmes de rareté, 7 emblèmes de rang |
| `script.js`, `style.css`, `index.html` | L'interface : Hub, Boutique, Classeur, Codex, Marché |
| `verification.html` | Tests des règles + simulation de 10 000 ouvertures par pack |

Le site a 4 styles (Néon, Holo, Arcade, Royal), chacun en clair et en sombre : bouton « Style » et bouton clair/sombre dans la barre latérale.

Après chaque changement de réglage, ouvrir http://localhost:8765/verification.html : tous les tests doivent être verts, et la colonne « Bilan revente » doit rester en perte.

## Catalogue des 3 000 personnages

`prototype/data.js` est généré par un script, à relancer quand on veut mettre le catalogue à jour :

```bash
python3 scripts/build_characters.py
```

| Source | Persos | Ce qu'elle apporte |
|---|---|---|
| Wikis de fans (Fandom), 137 franchises | ~2 300 | Plusieurs persos par franchise, rendus officiels, importance (longueur de la page), boss / héros / antagonistes |
| Wikidata + Wikipédia | ~530 | Persos les plus connus : nom et résumé en français, notoriété mondiale |
| PokéAPI | 150 | Pokémon : illustration officielle, nom et Pokédex en français |

- **Franchises et quotas** : `scripts/franchises.json` (niveau S = 55 persos, A = 32, B = 20, C = 10 ; catégories de personnages du wiki ; année par jeu).
- **Choix de l'équipe** : `scripts/rarete_manuelle.json`
  - `raretes` : rareté imposée (les ~55 Spectaculaires sont toutes choisies ici) ;
  - `plancher` : rareté minimum des persos marquants (Arthur Morgan, Freddy, Malenia… ne descendent jamais sous Légendaire) ;
  - `inclure`, `exclure`, `exclure_wikipedia`, `alias`.
- **Filtres** : seuls les persos nés dans un jeu vidéo ; pas de versions film, série ou roman ; pas d'objets, de lieux ni de groupes ; l'image doit porter le nom du perso (pas de logo, de jaquette ni de capture).
- **Rareté** : chaque perso reçoit un score « marquant » (son rang dans sa franchise, le niveau de la franchise, sa notoriété, boss ou héros), puis les raretés suivent la répartition cible ; les planchers passent devant.
- Les réponses des API sont gardées dans `scripts/.cache/` (non versionné) : relancer prend une à deux minutes.
- Les images ne sont pas copiées dans le dépôt : elles restent hébergées par Fandom, Wikimédia et PokéAPI, et appartiennent à leurs éditeurs. À revoir avant toute mise en ligne publique ou commerciale (idéalement : un cache d'images sur notre futur serveur).

### Limites du prototype

- Les autres joueurs du marché (vendeurs et acheteurs) sont simulés.
- La règle « compte de plus de 3 jours pour vendre » n'est pas appliquée (le rang Argent l'est).
- Les variantes d'un même personnage (Link d'Ocarina of Time, de Breath of the Wild…) ne sont pas encore générées.
- Les images sont chargées directement depuis Fandom : trop de requêtes d'un coup (un contrôle de masse) déclenche leur protection anti-robots pendant un moment.
