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

## Catalogue des 1000 personnages

`prototype/data.js` est généré par un script, à relancer quand on veut mettre le catalogue à jour :

```bash
python3 scripts/build_characters.py
```

- **Personnages de jeux vidéo** : Wikidata (nom, franchise, premier jeu, année, notoriété) et Wikipédia (image de l'article du personnage, résumé en français). Seuls les personnages nés dans un jeu vidéo sont gardés, et l'image doit porter le nom du personnage (pas de logo, de jaquette ni de photo de cosplay).
- **Pokémon** : PokéAPI (illustration officielle, nom et description du Pokédex en français). Ils complètent le catalogue jusqu'à 1000.
- **Choix de l'équipe** : `scripts/rarete_manuelle.json` (raretés imposées, personnages ajoutés ou retirés).
- Les réponses des API sont gardées dans `scripts/.cache/` (non versionné) : relancer prend quelques secondes.
- Les images ne sont pas copiées dans le dépôt : elles restent hébergées par Wikimédia et PokéAPI. Elles appartiennent à leurs éditeurs ; à revoir avant toute mise en ligne publique ou commerciale.

### Limites du prototype

- Les autres joueurs du marché (vendeurs et acheteurs) sont simulés.
- La règle « compte de plus de 3 jours pour vendre » n'est pas appliquée (le rang Argent l'est).
- Les variantes d'un même personnage (Link d'Ocarina of Time, de Breath of the Wild…) ne sont pas encore générées : Wikipédia n'a qu'une image par personnage.
