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
| 2 | `peucommun` | Peu commun | `#34d399` vert | 10 | Cadre + liseré lumineux |
| 3 | `rare` | Rare | `#3b82f6` bleu | 25 | Lueur bleue |
| 4 | `epique` | Épique | `#a855f7` violet | 60 | Lueur + reflet qui suit le curseur |
| 5 | `legendaire` | Légendaire | `#f59e0b` or | 150 | Reflet + particules dorées |
| 6 | `mythique` | Mythique | `#f43f5e` rouge-rose | 500 | Bordure animée + flash à l'ouverture |
| 7 | `spectaculaire` | Spectaculaire | prisme (`#22e5ff` → `#ff2bd6` → or) | 1500 | Holographie plein cadre, bordure arc-en-ciel animée, animation d'ouverture dédiée |

### Probabilités du tirage standard (par carte)

| Commun | Peu commun | Rare | Épique | Légendaire | Mythique | Spectaculaire | **Total** |
|---|---|---|---|---|---|---|---|
| 45 % | 25 % | 15 % | 9 % | 4,5 % | 1,2 % | 0,3 % | **100 %** |

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

Deux familles de packs, toutes de **5 cartes**, toujours des cartes de **personnages**. Le thème indique seulement l'origine des personnages.

### 4.1 Packs thématiques (150 coins)

Ils tirent uniquement parmi les personnages qui ont le tag correspondant, avec les probabilités standard et **au moins 1 Rare ou mieux**.

| Tag | Pack | Couleur |
|---|---|---|
| `solo` | Solo & narratif | `#8b5cf6` |
| `multi` | Multijoueur | `#22e5ff` |
| `rpg` | RPG | `#34d399` |
| `combat` | Combat | `#f43f5e` |
| `horreur` | Horreur | `#b91c1c` |
| `plateforme` | Plateforme & arcade | `#f59e0b` |
| `nintendo` | Nintendo | `#ef4444` |
| `playstation` | PlayStation | `#3b82f6` |
| `xbox` | Xbox | `#22c55e` |
| `retro` | Rétro (avant 2000) | `#ff2bd6` |

Les tags viennent de la franchise (`FRANCHISE_TAGS` dans `build_site_data.py`) et `retro` est ajouté automatiquement si l'année < 2000. Plus tard : tags éditables par personnage dans l'admin.

**Si une rareté n'a aucun personnage éligible dans un thème**, on retombe sur tout le catalogue de cette rareté (et on l'affiche dans la description du pack). Mieux : l'admin avertit quand un pack a une rareté vide.

À ajouter plus tard : PC & indé, Monde ouvert, Esport, packs événementiels (anniversaire d'une franchise, Halloween = horreur).

### 4.2 Packs de rareté

4 cartes tirées avec les probabilités standard + **1 carte « garantie »** tirée avec une table spéciale :

| Pack | Prix | Carte garantie (table de la 5e carte) | Total |
|---|---|---|---|
| **Épique** | 300 | Épique 85 · Légendaire 12 · Mythique 2,5 · Spectaculaire 0,5 | 100 |
| **Légendaire** | 450 | Légendaire 90 · Mythique 8,5 · Spectaculaire 1,5 | 100 |
| **Mythique** | 750 | Légendaire 70 · Mythique 25 · Spectaculaire 5 | 100 |

Le pack Mythique **garantit une Légendaire** mais **pas une Mythique** : c'est voulu (« on n'est pas sûr d'en avoir, mais on a forcément une Légendaire »). Le libellé doit le dire clairement.

### 4.3 Règles communes

- Les **cartes manquantes sont favorisées** à rareté égale (poids 2 contre 1).
- **Compteur de pitié** (V2) : au bout de 10 packs sans Épique+, la carte garantie passe Épique ; au bout de 40 packs sans Légendaire+, elle passe Légendaire.
- Les probabilités de chaque pack sont **affichées** sur sa page.
- **Tout le tirage se fait côté serveur** (voir `architecture.md`).

### 4.4 Ouverture

1. Le joueur clique sur « Ouvrir » : le serveur débite, tire et enregistre, puis renvoie le résultat.
2. Animation : le pack s'ouvre, 5 cartes face cachée, le joueur les retourne une à une (ou « Tout retourner »).
3. La couleur du dos de carte trahit légèrement la rareté juste avant le retournement (suspense).
4. Badges « Nouveau » ou « Doublon ».
5. Récapitulatif : XP gagnée, nouvelles cartes, bouton « Ouvrir un autre ».

---

## 5. Économie (coins)

Une seule monnaie gratuite : les **coins**. Aucun achat avec de l'argent réel.

| Source | Gain |
|---|---|
| Départ | 600 |
| Connexion quotidienne | 250 |
| Bonus de la semaine (1re connexion de la semaine) | 500 |
| Vente rapide d'une carte | 30 % du prix de référence |
| Vente au marché | prix fixé par le vendeur − 10 % de commission |
| Succès, montées de rang (V2) | variable |

### Packs gratuits

| Pack | Fréquence | Contenu |
|---|---|---|
| **Pack Aléatoire** | +1 toutes les 4 h, 3 en stock max (6 par jour) | Tout le catalogue, tirage standard, au moins 1 Rare. Mythique 1,2 % et Spectaculaire 0,3 % par carte |
| **Pack du jour** | 1 par jour | Un pack thématique offert ; le thème change chaque jour à minuit |
| **Bon de série** | tous les 7 jours de connexion d'affilée | 1 Pack Épique offert. Un jour manqué remet la série à zéro |

Journée type d'un joueur assidu : 6 Packs Aléatoires + 1 pack du jour + ~2 packs thématiques achetés avec les coins ≈ **9 packs par jour** (calcul détaillé dans `prototype/verification.html`). Les packs gratuits comptent pour le compteur de pitié.

| Dépense | Coût |
|---|---|
| Pack thématique | 150 |
| Pack Épique / Légendaire / Mythique | 300 / 450 / 750 |
| Achat d'une carte au marché | prix du vendeur |

### Équilibre (vérifié)

Valeur moyenne d'une carte standard : 0,45×5 + 0,25×10 + 0,15×25 + 0,09×60 + 0,045×150 + 0,012×500 + 0,003×1500 ≈ **31 coins**.

- Pack thématique : 5 × 31 ≈ **156** de valeur pour 150 coins. Revendu en vente rapide : ≈ 47 coins. **Impossible de gagner des coins en boucle** en ouvrant et revendant.
- Pack Épique ≈ 214 de valeur pour 300, Légendaire ≈ 325 pour 450, Mythique ≈ 430 pour 750 : on paie la garantie. Le pack Mythique est le moins rentable : à surveiller.
- Les **puits de coins** (commission de 10 %, vente rapide à 30 %) empêchent l'inflation.

À faire : script `scripts/simulate-economy` qui simule 10 000 ouvertures et vérifie ces chiffres après chaque changement de réglage.

---

## 6. Marché entre joueurs

### Fonctionnement

1. **Vendre** : le joueur choisit une carte (doublon conseillé), fixe un prix, la carte est **retirée de son inventaire** et mise en vente (séquestre).
2. **Prix** : un prix de référence par rareté est proposé par défaut. Le vendeur peut le modifier entre **50 %** et **1000 %** du prix de référence (prototype). Recommandé pour la vraie version : plafond à **500 %** pour limiter les transferts entre comptes.
3. **Acheter** : l'acheteur paie, reçoit la carte, le vendeur reçoit le prix − 10 %.
4. **Annuler** : la carte revient dans l'inventaire.
5. **Vente rapide** : vendre instantanément au site à 30 % du prix de référence.

### Écrans

- **Acheter** : grille d'annonces, filtres (rareté, franchise, prix max, cartes manquantes uniquement), tri (prix, récentes).
- **Mes ventes** : annonces actives, vendues, expirées.
- **Prix de référence** : tableau par rareté + historique des dernières ventes d'une carte (V2).

### Règles anti-abus (vraie version)

- Transaction **atomique** côté serveur : vérifier le solde, verrouiller l'annonce, transférer.
- Impossible d'acheter sa propre annonce.
- Max **20 annonces actives** par joueur, durée **72 h**.
- Compte de plus de 3 jours et rang Argent minimum pour vendre.
- Journal de toutes les transactions (`CoinTransaction`).

Dans le prototype, sans serveur, le marché est simulé avec des vendeurs fictifs.

---

## 7. Rangs des joueurs

Distincts des raretés de cartes. Les noms reprennent les paliers classiques des jeux compétitifs ; les emblèmes sont **originaux** (voir `design.md`).

| Rang | XP |
|---|---|
| Bronze | 0 |
| Argent | 150 |
| Or | 400 |
| Platine | 900 |
| Diamant | 1800 |
| Élite | 3200 |
| Champion | 5000 |

Chaque rang (sauf Champion) est découpé en **3 divisions** de même taille : III → II → I. Exemple : Bronze III de 0 à 49 XP, Bronze II de 50 à 99, Bronze I de 100 à 149, puis Argent III. Les emblèmes de rang et de rareté sont dessinés pour le projet (`prototype/emblems.js`).

| Gain d'XP | XP |
|---|---|
| Nouvelle carte | 10 (bonus selon rareté en V2) |
| Doublon | 2 |
| Consulter une nouvelle fiche (1 fois par personnage) | 1 |
| Compléter une franchise | 50 |
| Succès | 20 à 200 |

On récompense la **découverte et la complétion**, pas le temps passé ni la vente en masse. La vente au marché ne donne pas d'XP.
