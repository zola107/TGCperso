// Réglages du jeu (voir docs/regles-du-jeu.md).
// En vrai projet, ces valeurs vivent en base de données : ici, tout est réuni
// dans ce fichier pour qu'aucun chiffre ne soit en dur dans l'interface.
const CONFIG = {
  rarities: [
    { id: "commun",        nom: "Commun",        c: "#9aa4b2", prix: 5 },
    { id: "peucommun",     nom: "Peu commun",    c: "#34d399", prix: 10 },
    { id: "rare",          nom: "Rare",          c: "#3b82f6", prix: 25 },
    { id: "epique",        nom: "Épique",        c: "#a855f7", prix: 60 },
    { id: "legendaire",    nom: "Légendaire",    c: "#f59e0b", prix: 150 },
    { id: "mythique",      nom: "Mythique",      c: "#f43f5e", prix: 500 },
    { id: "spectaculaire", nom: "Spectaculaire", c: "#22e5ff", prix: 1500 },
  ],

  // Tirage standard, par carte. Chaque table doit totaliser exactement 100.
  standardOdds: { commun: 45, peucommun: 25, rare: 15, epique: 9, legendaire: 4.5, mythique: 1.2, spectaculaire: 0.3 },
  packSize: 5,

  // Packs thématiques : tirage parmi les personnages du tag, au moins 1 Rare ou mieux.
  themePacks: {
    prix: 150,
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
    { id: "pack-epique", nom: "Pack Épique", prix: 300, c: "#a855f7",
      label: "1 Épique ou mieux garantie",
      garantie: { epique: 85, legendaire: 12, mythique: 2.5, spectaculaire: 0.5 } },
    { id: "pack-legendaire", nom: "Pack Légendaire", prix: 450, c: "#f59e0b",
      label: "1 Légendaire ou mieux garantie",
      garantie: { legendaire: 90, mythique: 8.5, spectaculaire: 1.5 } },
    { id: "pack-mythique", nom: "Pack Mythique", prix: 750, c: "#f43f5e",
      label: "1 Légendaire garantie, Mythique non garantie (25 %)",
      garantie: { legendaire: 70, mythique: 25, spectaculaire: 5 } },
  ],

  // Poids d'une carte manquante contre 1 pour une carte déjà possédée (à rareté égale).
  missingWeight: 2,
  // Compteur de pitié : après N packs sans cette rareté ou mieux, la carte garantie y passe.
  pity: { epique: 10, legendaire: 40 },

  economy: { depart: 600, quotidien: 150, venteRapide: 0.30 },

  market: {
    commission: 0.10,
    prixMin: 0.5,          // × prix de référence
    prixMax: 5,            // plafond recommandé (le premier prototype allait jusqu'à 10)
    maxAnnonces: 20,
    dureeH: 72,
    rangMin: "argent",
    annoncesFictives: 24,  // prototype : vendeurs simulés
    acheteurDelaiS: 60,    // prototype : délai moyen d'un acheteur simulé au prix de référence
  },

  ranks: [
    { id: "bronze",   nom: "Bronze",   xp: 0,    c: "#c47f4a" },
    { id: "argent",   nom: "Argent",   xp: 150,  c: "#cbd5e1" },
    { id: "or",       nom: "Or",       xp: 400,  c: "#facc15" },
    { id: "platine",  nom: "Platine",  xp: 900,  c: "#5eead4" },
    { id: "diamant",  nom: "Diamant",  xp: 1800, c: "#7cc4ff" },
    { id: "elite",    nom: "Élite",    xp: 3200, c: "#c084fc" },
    { id: "champion", nom: "Champion", xp: 5000, c: "#ff5d73" },
  ],

  // franchiseMin : une franchise ne compte comme « complétée » qu'à partir de 2 personnages.
  xp: { nouvelle: 10, doublon: 2, fiche: 1, franchise: 50, franchiseMin: 2 },
};

if (typeof module !== "undefined") module.exports = CONFIG;
