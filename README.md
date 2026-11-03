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
| `data.js` | Les personnages et les tags de packs par franchise |
| `engine.js` | Le moteur : tirages, packs gratuits, coins, marché, rangs. En vrai projet, il tourne côté serveur |
| `emblems.js` | Les emblèmes dessinés : 7 gemmes de rareté, 7 emblèmes de rang |
| `script.js`, `style.css`, `index.html` | L'interface : Hub, Boutique, Classeur, Codex, Marché |

Le site a 4 styles (Néon, Holo, Arcade, Royal), chacun en clair et en sombre : bouton « Style » et bouton clair/sombre dans la barre latérale.
| `verification.html` | Tests des règles + simulation de 10 000 ouvertures par pack |

Après chaque changement de réglage, ouvrir http://localhost:8765/verification.html : tous les tests doivent être verts, et la colonne « Bilan revente » doit rester en perte.

### Limites du prototype

- Les autres joueurs du marché (vendeurs et acheteurs) sont simulés.
- La règle « compte de plus de 3 jours pour vendre » n'est pas appliquée (le rang Argent l'est).
- 49 personnages d'exemple au lieu des 150 du CSV : plusieurs packs thématiques n'ont pas toutes les raretés et retombent sur tout le catalogue pour celles-ci (c'est affiché dans leurs probabilités).
