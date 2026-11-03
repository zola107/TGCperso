// Réglages du jeu (voir docs/regles-du-jeu.md).
// En vrai projet, ces valeurs vivent en base de données : ici, tout est réuni
// dans ce fichier pour qu'aucun chiffre ne soit en dur dans l'interface.
//
// Philosophie : créer le manque crée l'envie. Les coins sont rares, les hautes raretés
// encore plus ; une Mythique ou une Spectaculaire doit être un événement.
const CONFIG = {
  // prix : prix de référence au marché (et base de la vente rapide)
  rarities: [
    { id: "commun",        nom: "Commun",        c: "#9aa4b2", prix: 5 },
    { id: "peucommun",     nom: "Peu commun",    c: "#34d399", prix: 12 },
    { id: "rare",          nom: "Rare",          c: "#3b82f6", prix: 40 },
    { id: "epique",        nom: "Épique",        c: "#a855f7", prix: 150 },
    { id: "legendaire",    nom: "Légendaire",    c: "#f59e0b", prix: 600 },
    { id: "mythique",      nom: "Mythique",      c: "#f43f5e", prix: 3000 },
    { id: "spectaculaire", nom: "Spectaculaire", c: "#22e5ff", prix: 25000 },
  ],

  // Tirage standard, par carte. Chaque table doit totaliser exactement 100.
  // Une Légendaire toutes les ~13 packs, une Mythique toutes les ~54, une Spectaculaire toutes les ~670.
  standardOdds: { commun: 55, peucommun: 26, rare: 12.5, epique: 4.6, legendaire: 1.5, mythique: 0.37, spectaculaire: 0.03 },
  packSize: 5,

  // Packs thématiques : tirage parmi les personnages du tag, au moins 1 Rare ou mieux.
  themePacks: {
    prix: 250,
    minRarity: "rare",
    list: [
      { tag: "solo",        nom: "Solo & narratif",     c: "#8b5cf6" },
      { tag: "multi",       nom: "Multijoueur",         c: "#22e5ff" },
      { tag: "rpg",         nom: "RPG",                 c: "#34d399" },
      { tag: "combat",      nom: "Combat",              c: "#f43f5e" },
      { tag: "horreur",     nom: "Horreur",             c: "#b91c1c" },
      { tag: "plateforme",  nom: "Plateforme & arcade", c: "#f59e0b" },
      { tag: "nintendo",    nom: "Nintendo",            c: "#ef4444" },
      { tag: "playstation", nom: "PlayStation",         c: "#3b82f6" },
      { tag: "xbox",        nom: "Xbox",                c: "#22c55e" },
      { tag: "retro",       nom: "Rétro (avant 2000)",  c: "#ff2bd6" },
    ],
  },

  // Packs de rareté : 4 cartes standard + 1 carte tirée dans la table « garantie ».
  rarityPacks: [
    { id: "pack-epique", nom: "Pack Épique", prix: 800, c: "#a855f7",
      label: "1 Épique ou mieux garantie",
      garantie: { epique: 92, legendaire: 7, mythique: 0.9, spectaculaire: 0.1 } },
    { id: "pack-legendaire", nom: "Pack Légendaire", prix: 2000, c: "#f59e0b",
      label: "1 Légendaire ou mieux garantie",
      garantie: { legendaire: 93, mythique: 6.5, spectaculaire: 0.5 } },
    { id: "pack-mythique", nom: "Pack Mythique", prix: 5000, c: "#f43f5e",
      label: "1 Légendaire garantie, Mythique non garantie (19 %)",
      garantie: { legendaire: 80, mythique: 19, spectaculaire: 1 } },
  ],

  // Packs de rang : réservés aux joueurs qui ont atteint ce rang (emblème sur le sachet).
  rankPacks: [
    { id: "pack-or", nom: "Pack Or", rang: "or", prix: 600, c: "#facc15",
      label: "1 Épique ou mieux garantie, meilleures chances",
      garantie: { epique: 88, legendaire: 9.5, mythique: 2.2, spectaculaire: 0.3 } },
    { id: "pack-diamant", nom: "Pack Diamant", rang: "diamant", prix: 1800, c: "#7cc4ff",
      label: "1 Légendaire ou mieux garantie",
      garantie: { legendaire: 86, mythique: 12.5, spectaculaire: 1.5 } },
    { id: "pack-champion", nom: "Pack Champion", rang: "champion", prix: 8000, c: "#ff5d73",
      label: "1 Mythique ou mieux garantie",
      garantie: { mythique: 95, spectaculaire: 5 } },
  ],

  // God pack : très rarement, les 5 cartes sont toutes Légendaire ou mieux.
  godPack: { chance: 1 / 5000, table: { legendaire: 80, mythique: 18, spectaculaire: 2 } },
  // Version holo : n'importe quelle carte peut sortir brillante. Vaut 5 fois plus.
  holo: { chance: 0.01, valeur: 5 },
  // Éditions numérotées : chaque Spectaculaire n'existe qu'en ce nombre d'exemplaires.
  tirageLimite: { spectaculaire: 100 },

  // Poids d'une carte manquante contre 1 pour une carte déjà possédée (à rareté égale).
  missingWeight: 2,
  // Compteur de pitié : après N packs sans cette rareté ou mieux, la carte garantie y passe.
  pity: { epique: 15, legendaire: 60 },

  // Exemplaires : au-delà de 5, les copies sont converties en éclats.
  maxExemplaires: 5,
  eclats: {
    // éclats rendus par une copie en trop
    gain: { commun: 2, peucommun: 5, rare: 15, epique: 60, legendaire: 250, mythique: 1200, spectaculaire: 10000 },
    // l'atelier ne fabrique que les petites raretés (la rareté du haut ne s'achète pas)
    cout: { commun: 60, peucommun: 150, rare: 500 },
  },

  // Coins : rares. Les vrais gains viennent des défis et du marché.
  economy: { depart: 500, quotidien: 50, hebdo: 200, venteRapide: 0.20 },

  gratuit: {
    // Pack Aléatoire : tout le catalogue, tirage standard, au moins 1 Rare ou mieux.
    aleatoire: { nom: "Pack Aléatoire", c: "#ff7a45", intervalH: 8, max: 2, minRarity: "rare" },
    // Pack du jour : un pack thématique offert, le thème change chaque jour.
    packDuJour: true,
    // Série de connexions : tous les 7 jours d'affilée, un bon pour ce pack.
    serie: { jours: 7, bon: "pack-epique" },
  },

  // Défis : 3 du jour (tirés au hasard chaque jour), 3 de la semaine, et des succès uniques.
  // stat : compteur suivi (voir engine.js) ; recompense : coins, xp, bon (id de pack), eclats.
  defis: {
    quotidiens: 3,
    hebdomadaires: 3,
    jour: [
      { id: "j-packs", nom: "Ouvrir 3 packs", stat: "packs", cible: 3, recompense: { coins: 30, xp: 20 } },
      { id: "j-fiches", nom: "Lire 5 fiches de personnages", stat: "fiches", cible: 5, recompense: { coins: 15, xp: 10 } },
      { id: "j-rare", nom: "Obtenir une carte Rare ou mieux", stat: "rarePlus", cible: 1, recompense: { coins: 25, xp: 15 } },
      { id: "j-theme", nom: "Ouvrir un pack thématique", stat: "packsTheme", cible: 1, recompense: { coins: 40, xp: 15 } },
      { id: "j-annonce", nom: "Mettre une carte en vente", stat: "annonces", cible: 1, recompense: { coins: 25, xp: 15 } },
      { id: "j-achat", nom: "Acheter une carte au marché", stat: "achats", cible: 1, recompense: { coins: 20, xp: 15 } },
      { id: "j-nouvelles", nom: "Obtenir 5 nouvelles cartes", stat: "nouvelles", cible: 5, recompense: { coins: 30, xp: 20 } },
      { id: "j-gratuits", nom: "Ouvrir 2 packs gratuits", stat: "packsGratuits", cible: 2, recompense: { coins: 20, xp: 10 } },
      { id: "j-retourner", nom: "Retourner 15 cartes", stat: "cartes", cible: 15, recompense: { coins: 20, xp: 10 } },
    ],
    semaine: [
      { id: "s-packs", nom: "Ouvrir 25 packs", stat: "packs", cible: 25, recompense: { coins: 200, xp: 150 } },
      { id: "s-epique", nom: "Obtenir 2 cartes Épique ou mieux", stat: "epiquePlus", cible: 2, recompense: { coins: 150, xp: 100 } },
      { id: "s-nouvelles", nom: "Obtenir 40 nouvelles cartes", stat: "nouvelles", cible: 40, recompense: { coins: 200, xp: 150 } },
      { id: "s-ventes", nom: "Vendre 3 cartes au marché", stat: "ventes", cible: 3, recompense: { coins: 250, xp: 100 } },
      { id: "s-franchise", nom: "Compléter une franchise", stat: "franchises", cible: 1, recompense: { bon: "pack-epique", xp: 200 } },
      { id: "s-atelier", nom: "Fabriquer 2 cartes à l'atelier", stat: "fabriques", cible: 2, recompense: { eclats: 150, xp: 80 } },
    ],
    succes: [
      { id: "a-premier", nom: "Premier pack", stat: "packs", cible: 1, recompense: { coins: 100, xp: 50 } },
      { id: "a-packs100", nom: "100 packs ouverts", stat: "packs", cible: 100, recompense: { coins: 500, xp: 300 } },
      { id: "a-packs1000", nom: "1 000 packs ouverts", stat: "packs", cible: 1000, recompense: { bon: "pack-legendaire", xp: 3000 } },
      { id: "a-coll100", nom: "100 personnages différents", stat: "differentes", cible: 100, recompense: { coins: 300, xp: 200 } },
      { id: "a-coll500", nom: "500 personnages différents", stat: "differentes", cible: 500, recompense: { coins: 1500, xp: 1000 } },
      { id: "a-coll1500", nom: "1 500 personnages différents", stat: "differentes", cible: 1500, recompense: { bon: "pack-mythique", xp: 5000 } },
      { id: "a-leg", nom: "Première Légendaire", stat: "legendairePlus", cible: 1, recompense: { coins: 300, xp: 150 } },
      { id: "a-myth", nom: "Première Mythique", stat: "mythiquePlus", cible: 1, recompense: { coins: 1500, xp: 800 } },
      { id: "a-spect", nom: "Première Spectaculaire", stat: "spectaculaire", cible: 1, recompense: { coins: 10000, xp: 5000 } },
      { id: "a-holo", nom: "Première carte holo", stat: "holo", cible: 1, recompense: { coins: 500, xp: 300 } },
      { id: "a-god", nom: "God pack", stat: "godPacks", cible: 1, recompense: { coins: 20000, xp: 10000 } },
      { id: "a-fr5", nom: "5 franchises complétées", stat: "franchises", cible: 5, recompense: { coins: 1000, xp: 800 } },
      { id: "a-vente1", nom: "Première vente au marché", stat: "ventes", cible: 1, recompense: { coins: 100, xp: 50 } },
      { id: "a-or", nom: "Atteindre le rang Or", stat: "rang", cible: 2, recompense: { coins: 1000, xp: 0 } },
      { id: "a-diamant", nom: "Atteindre le rang Diamant", stat: "rang", cible: 4, recompense: { bon: "pack-legendaire", xp: 0 } },
      { id: "a-champion", nom: "Atteindre le rang Champion", stat: "rang", cible: 6, recompense: { bon: "pack-mythique", coins: 10000, xp: 0 } },
    ],
  },

  market: {
    commission: 0.10,
    prixMin: 1,            // en coins : pas de plafond, le marché fixe la valeur
    maxAnnonces: 20,
    dureeH: 72,
    rangMin: "argent",
    annoncesFictives: 30,  // prototype : vendeurs simulés
    acheteurDelaiS: 60,    // prototype : délai moyen d'un acheteur simulé au prix de référence
  },

  // Ranked : paliers exponentiels, il faut des milliers de packs pour atteindre Champion.
  ranks: [
    { id: "bronze",   nom: "Bronze",   xp: 0,      c: "#c47f4a" },
    { id: "argent",   nom: "Argent",   xp: 1000,   c: "#cbd5e1" },
    { id: "or",       nom: "Or",       xp: 4000,   c: "#facc15" },
    { id: "platine",  nom: "Platine",  xp: 12000,  c: "#5eead4" },
    { id: "diamant",  nom: "Diamant",  xp: 30000,  c: "#7cc4ff" },
    { id: "elite",    nom: "Élite",    xp: 70000,  c: "#c084fc" },
    { id: "champion", nom: "Champion", xp: 150000, c: "#ff5d73" },
  ],
  // Saisons : à chaque nouvelle saison, l'XP classée est divisée par 2 ; le meilleur rang reste dans l'historique.
  saison: { debut: "2026-11-01", jours: 90, garde: 0.5 },

  // XP d'une nouvelle carte selon sa rareté ; un doublon rapporte peu.
  xp: {
    nouvelle: { commun: 4, peucommun: 6, rare: 12, epique: 30, legendaire: 80, mythique: 250, spectaculaire: 1200 },
    doublon: 1, fiche: 1, franchise: 150, franchiseMin: 2,
  },
};

if (typeof module !== "undefined") module.exports = CONFIG;
