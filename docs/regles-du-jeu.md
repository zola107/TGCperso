# Règles du jeu

Document de référence pour toutes les règles de collection. Toutes les valeurs chiffrées sont des **réglages** : dans l'application, elles vivent en base de données (ou dans un fichier de config typé), jamais en dur dans les composants.

Valeurs reprises du prototype (`prototype/script.js`) pour rester cohérent.

---

## 1. Personnage ≠ carte

| | Personnage (encyclopédie) | Carte (collection) |
|---|---|---|
| Nature | Fiche d'information | Objet de jeu |
| Quantité | 1 par personnage | 1 définition par personnage (+ variantes plus tard), N exemplaires par joueur |
| Contenu | Nom, alias, franchise, jeu, année, résumé, relations | Rareté, identifiant `PDX-0001`, illustration, prix de référence |

Un joueur possède des **exemplaires** : en base, une ligne `(utilisateur, carte, quantité)`.

---

## 2. Raretés (7 niveaux)

| Ordre | Id | Nom | Couleur | Prix de référence | Effets visuels |
|---|---|---|---|---|---|
| 1 | `commun` | Commun | `#9aa4b2` gris | 5 | Cadre simple |
| 2 | `peucommun` | Peu commun | `#34d399` vert | 12 | Cadre + liseré lumineux |
| 3 | `rare` | Rare | `#3b82f6` bleu | 40 | Lueur bleue |
| 4 | `epique` | Épique | `#a855f7` violet | 150 | Lueur + reflet qui suit le curseur |
| 5 | `legendaire` | Légendaire | `#f59e0b` or | 600 | Reflet + particules dorées |
| 6 | `mythique` | Mythique | `#f43f5e` rouge-rose | 3 000 | Bordure animée + flash à l'ouverture |
| 7 | `spectaculaire` | Spectaculaire | prisme (`#22e5ff` → `#ff2bd6` → or) | 25 000 | Holographie plein cadre, bordure arc-en-ciel animée, animation d'ouverture dédiée |

### Probabilités du tirage standard (par carte)

| Commun | Peu commun | Rare | Épique | Légendaire | Mythique | Spectaculaire | **Total** |
|---|---|---|---|---|---|---|---|
| 55 % | 26 % | 12,5 % | 4,6 % | 1,5 % | 0,37 % | 0,03 % | **100 %** |

En moyenne : une Épique tous les ~4 packs, une Légendaire tous les ~13, une Mythique tous les ~54, une Spectaculaire tous les ~670. **Créer le manque crée l'envie** : une haute rareté doit être un événement.

**Règle absolue :** chaque table de probabilités doit totaliser exactement 100. Un test automatisé le vérifie, et l'admin refuse d'enregistrer une table invalide.

### Répartition cible du catalogue

Pour que les raretés gardent leur valeur, le catalogue doit respecter à peu près :

| Commun | Peu commun | Rare | Épique | Légendaire | Mythique | Spectaculaire |
|---|---|---|---|---|---|---|
| ~27 % | ~23 % | ~20 % | ~13 % | ~10 % | ~5 % | ~2 % (5 personnages max pour 150) |

Catalogue actuel (3 000 personnages, généré par `scripts/build_characters.py`) : 815 / 690 / 600 / 390 / 300 / 150 / 55.

**Principe** : les persos marquants (icônes, boss de fin, héros cultes) sont forcément en haut ; les figurants en bas. Il faut que tirer un perso nul déçoive et que tirer un perso haut de gamme soit un événement.

---

## 3. Comment attribuer une rareté

On ne se base **ni sur la puissance** du personnage dans son jeu, **ni sur nos goûts**. On note chaque personnage sur 100 :

| Critère | Points | Comment le mesurer |
|---|---|---|
| **Impact culturel** | 35 | Nombre de Wikipédias qui ont un article sur lui (`sitelinks` Wikidata) : c'est un bon indicateur objectif de notoriété mondiale |
| **Importance dans sa série** | 30 | Protagoniste/mascotte = 30, antagoniste principal = 25, allié majeur = 18, secondaire = 8 |
| **Longévité** | 20 | Nombre d'années depuis la 1re apparition et nombre de jeux (champ `games` de Giant Bomb) |
| **Statut culte** | 15 | Jugement de l'équipe : personnage culte, marquant, « pépite » |

| Score | Rareté |
|---|---|
| 95-100 | Spectaculaire (réservé aux icônes absolues du jeu vidéo) |
| 85-94 | Mythique |
| 72-84 | Légendaire |
| 58-71 | Épique |
| 42-57 | Rare |
| 25-41 | Peu commun |
| 0-24 | Commun |

### Exemples (raretés du CSV actuel)

| Personnage | Rareté | Pourquoi |
|---|---|---|
| Mario, Link, Pikachu | Spectaculaire | Icônes mondiales, mascottes, 30 à 40 ans de jeux |
| Sonic, Master Chief, Kratos, Sephiroth, Lara Croft | Mythique | Visages de leur console ou de leur genre, très forte notoriété |
| Zelda, Geralt, Cloud, Ryu | Légendaire | Personnages majeurs et reconnus bien au-delà de leur série |
| Garrus Vakarian | Rare | Allié majeur adoré, mais moins connu hors des joueurs de Mass Effect |
| Tails, Toad, Isabelle, Claptrap | Peu commun | Personnages secondaires très connus |

À propos de Sonic : on peut le trouver « moins ouf » que Link, mais selon la grille (mascotte de SEGA, 30 ans de jeux, notoriété mondiale), il est Mythique. La grille sert justement à éviter que les goûts personnels décident des raretés. Si l'équipe veut faire une exception, elle la note dans le CSV avec une justification.

### Automatisation (ticket D-4)

`scripts/build_characters.py` calcule le score automatiquement : impact culturel (nombre de Wikipédias, via Wikidata), importance dans la série (protagoniste, mascotte, légendaire, rang dans la franchise), longévité (années depuis la 1re apparition et nombre de jeux). Le « statut culte » reste un choix de l'équipe. Les raretés sont ensuite attribuées dans l'ordre du score pour respecter la répartition cible.

Les décisions de l'équipe sont dans `scripts/rarete_manuelle.json` : raretés imposées (dont **toutes les Spectaculaires**, jamais attribuées automatiquement), personnages ajoutés ou retirés à la main. Un humain relit toujours le catalogue avant publication.

---

## 4. Packs

Tous les packs contiennent **5 cartes de personnages**. Les cartes que le joueur n'a pas encore sortent deux fois plus souvent (à rareté égale). Les probabilités de chaque pack sont affichées sur sa fiche. **Tout le tirage se fait côté serveur** (voir `architecture.md`).

| Pack | Prix | Contenu |
|---|---|---|
| Thématique (10 thèmes) | 250 | 5 cartes du thème, au moins 1 Rare ou mieux |
| Épique | 800 | 4 standard + 1 garantie : Épique 92 · Légendaire 7 · Mythique 0,9 · Spectaculaire 0,1 |
| Légendaire | 2 000 | 4 standard + 1 garantie : Légendaire 93 · Mythique 6,5 · Spectaculaire 0,5 |
| Mythique | 5 000 | 4 standard + 1 garantie : Légendaire 80 · Mythique 19 · Spectaculaire 1 (une Légendaire garantie, pas une Mythique) |
| **Or** (rang Or requis) | 600 | 4 standard + 1 garantie : Épique 88 · Légendaire 9,5 · Mythique 2,2 · Spectaculaire 0,3 |
| **Diamant** (rang Diamant requis) | 1 800 | 4 standard + 1 garantie : Légendaire 86 · Mythique 12,5 · Spectaculaire 1,5 |
| **Champion** (rang Champion requis) | 8 000 | 4 standard + 1 garantie : Mythique 95 · Spectaculaire 5 |

Les packs de rang portent l'emblème de leur rang sur le sachet et restent verrouillés tant que le joueur n'a pas ce rang (dans la saison en cours).

### Surprises

- **Holo** : chaque carte a 1 % de chances de sortir en version holo (film irisé). Une holo vaut 5 fois le prix de référence et n'est jamais convertie en éclats.
- **God pack** : 1 pack sur 5 000 contient 5 cartes Légendaire ou mieux (Légendaire 80 · Mythique 18 · Spectaculaire 2).
- **Éditions numérotées** : chaque Spectaculaire n'existe qu'en **100 exemplaires**, numérotés (« n° 37/100 »). En vrai projet, le compteur est global (tous les joueurs).
- **Compteur de pitié** : après 15 packs sans Épique ou mieux, la carte garantie passe Épique ; après 60 packs sans Légendaire ou mieux, elle passe Légendaire.

### Ouverture

1. On déchire le haut du sachet en glissant le doigt ou la souris (ou bouton « Ouvrir sans glisser »).
2. Les cartes sortent du sachet face cachée ; on les retourne une à une (ou « Tout retourner »).
3. Juste avant le retournement, le dos prend la couleur de la rareté ; halo pour Épique et plus, reflet pour Rare et plus.
4. Badges « Nouveau », « Doublon », « Holo », « +X éclats » ; numéro d'édition sur les Spectaculaires.
5. Récapitulatif : XP gagnée, nouvelles cartes, holo, god pack, éclats, bouton « Ouvrir un autre ».

---

## 5. Économie

Une seule monnaie gratuite, les **coins**, volontairement rares. Aucun achat avec de l'argent réel.

| Source | Gain |
|---|---|
| Départ | 500 |
| Connexion quotidienne | 50 |
| Bonus de la semaine (1re connexion) | 200 |
| Défis du jour (3 par jour) | 15 à 40 chacun |
| Défis de la semaine (3 par semaine) | 150 à 250, ou un bon de pack |
| Succès (une seule fois chacun) | 100 à 20 000, ou un bon de pack |
| Vente rapide | 20 % du prix de référence |
| Vente au marché | prix libre − 10 % de commission |

### Packs gratuits

| Pack | Fréquence |
|---|---|
| Pack Aléatoire (tout le catalogue, au moins 1 Rare) | +1 toutes les 8 h, 2 en stock max |
| Pack du jour (un thème qui change à minuit) | 1 par jour |
| Bon de série (Pack Épique) | tous les 7 jours de connexion d'affilée |

Journée type d'un joueur assidu : 3 Packs Aléatoires + 1 pack du jour + ~1 pack acheté avec les coins (~210 coins par jour, dont ~130 des défis) ≈ **5 packs par jour**. Un Pack Légendaire demande donc une dizaine de jours d'économies.

### Exemplaires et éclats

- Un joueur garde **au maximum 5 exemplaires** de chaque carte (hors holo). Au-delà, la copie est convertie en **éclats** : Commun 2 · Peu commun 5 · Rare 15 · Épique 60 · Légendaire 250 · Mythique 1 200 · Spectaculaire 10 000.
- **Atelier** : les éclats fabriquent une carte manquante de petite rareté (Commun 60 · Peu commun 150 · Rare 500). Les hautes raretés ne se fabriquent jamais : elles se tirent ou s'achètent au marché.

### Équilibre (vérifié par `prototype/verification.html`)

Aucun pack ne rapporte plus qu'il ne coûte en revente rapide (exemples : Thématique 250 → ~55, Légendaire 2 000 → ~225, Mythique 5 000 → ~310). Les puits de coins (commission, vente rapide à 20 %, prix des packs) empêchent l'inflation.

---

## 6. Marché entre joueurs

L'objectif final : **un marché où les cartes prennent de la valeur parce qu'elles sont rares et désirées.**

1. **Vendre** : le joueur choisit une carte (normale ou holo) et fixe **un prix libre, sans plafond** (on peut vendre une carte 10 000 000 si on veut). La carte est retirée de son inventaire pendant la vente (séquestre).
2. **Valeur de marché** : moyenne des 5 dernières ventes de la carte (sinon le prix de référence). Chaque fiche affiche les dernières ventes.
3. **Acheter** : l'acheteur paie, reçoit la carte (sauf s'il a déjà 5 exemplaires), le vendeur reçoit le prix − 10 %.
4. **Annuler** : la carte revient. Une annonce expire au bout de **72 h**.
5. **Vente rapide** : vendre tout de suite au site, à 20 % du prix de référence.

Règles anti-abus (vraie version) : transaction atomique côté serveur, impossible d'acheter sa propre annonce, **20 annonces actives** max, rang **Argent** minimum pour vendre, compte de plus de 3 jours, journal de toutes les transactions. À venir : enchères, offres d'achat, alerte « liste de souhaits ».

Dans le prototype, sans serveur, les autres vendeurs et acheteurs sont simulés.

---

## 7. Rangs des joueurs (ranked)

Les noms reprennent les paliers classiques des jeux compétitifs ; les emblèmes sont **originaux**. Paliers exponentiels : atteindre Champion demande **des milliers de packs**.

| Rang | XP |
|---|---|
| Bronze | 0 |
| Argent | 1 000 |
| Or | 4 000 |
| Platine | 12 000 |
| Diamant | 30 000 |
| Élite | 70 000 |
| Champion | 150 000 |

Chaque rang (sauf Champion) est découpé en **3 divisions** de même taille : III → II → I.

| Gain d'XP | XP |
|---|---|
| Nouvelle carte | Commun 4 · Peu commun 6 · Rare 12 · Épique 30 · Légendaire 80 · Mythique 250 · Spectaculaire 1 200 |
| Doublon | 1 |
| Lire une nouvelle fiche | 1 |
| Compléter une franchise | 150 |
| Défis et succès | 10 à 10 000 |

**Saisons** de 90 jours : à chaque nouvelle saison, l'XP classée est divisée par 2 et le rang atteint est gardé dans l'historique du joueur. Les packs de rang suivent le rang de la saison en cours. On récompense la découverte, la complétion et les défis ; la vente au marché ne donne pas d'XP.
