// Moteur du jeu : tirages, économie, marché.
// En vrai projet, tout ce fichier tourne CÔTÉ SERVEUR : le navigateur envoie une
// demande (« ouvrir tel pack ») et reçoit le résultat. Ici, il travaille sur un
// objet d'état sauvegardé dans le navigateur, pour le prototype uniquement.
(function (root) {
  "use strict";

  const H = 3600e3;
  const SELLERS = ["PixelNomade", "Lvl99_Mamie", "CartoucheDor", "Sam_Respawn", "NeoKoopa",
    "HautLeScore", "MissCombo", "Gr1ndKing", "LaPetiteManette", "Vortex_FR", "Bit_Bardi", "Kaze404"];

  function create(config, characters, franchiseTags) {
    const ORDER = config.rarities.map((r) => r.id);
    const RAR = Object.fromEntries(config.rarities.map((r) => [r.id, r]));
    const rank = (id) => ORDER.indexOf(id);
    // tags : ceux du personnage (catalogue généré), sinon ceux de sa franchise ; « retro » avant 2000
    const tagsOf = (c) => [...new Set([...(c.tags || franchiseTags[c.franchise] || []), ...(c.annee < 2000 ? ["retro"] : [])])];
    const chars = characters.map((c, i) => ({ ...c, id: "PDX-" + String(i + 1).padStart(4, "0"), tags: tagsOf(c) }));
    const bySlug = Object.fromEntries(chars.map((c) => [c.slug, c]));
    const franchises = [...new Set(chars.map((c) => c.franchise))].sort();
    const M = config.market;

    const FREE = config.gratuit.aleatoire;
    const packs = [
      { id: "aleatoire", nom: FREE.nom, c: FREE.c, prix: 0, kind: "gratuit", minRarity: FREE.minRarity, filter: () => true },
      ...config.rarityPacks.map((p) => ({ ...p, kind: "rarete", filter: () => true })),
      ...config.themePacks.list.map((t) => ({
        id: "theme-" + t.tag, nom: "Pack " + t.nom, theme: t.nom, tag: t.tag, c: t.c, prix: config.themePacks.prix,
        kind: "theme", minRarity: config.themePacks.minRarity, filter: (c) => c.tags.includes(t.tag),
      })),
    ];
    const packById = (id) => packs.find((p) => p.id === id);

    /* ---------- tables de probabilités ---------- */
    const total = (t) => Object.values(t).reduce((a, b) => a + b, 0);
    const isValidTable = (t) => Object.keys(t).every((k) => k in RAR) && Math.abs(total(t) - 100) < 1e-6;
    const atLeast = (t, min) => Object.fromEntries(Object.entries(t).filter(([id]) => rank(id) >= rank(min)));

    function drawFrom(table, rng) {
      const ids = ORDER.filter((id) => table[id]);
      let t = rng() * total(table);
      for (const id of ids) { t -= table[id]; if (t < 0) return id; }
      return ids[ids.length - 1];
    }

    // Ce que l'admin vérifierait avant d'enregistrer un réglage.
    function problems() {
      const out = [];
      if (!isValidTable(config.standardOdds)) out.push(`Tirage standard : total ${total(config.standardOdds)} au lieu de 100.`);
      config.rarityPacks.forEach((p) => { if (!isValidTable(p.garantie)) out.push(`${p.nom} : total ${total(p.garantie)} au lieu de 100.`); });
      ORDER.forEach((r) => { if (!chars.some((c) => c.rarete === r)) out.push(`Aucun personnage ${RAR[r].nom} dans le catalogue.`); });
      chars.forEach((c) => { if (!RAR[c.rarete]) out.push(`${c.nom} : rareté inconnue « ${c.rarete} ».`); });
      packs.filter((p) => p.kind === "theme").forEach((p) => {
        const empty = emptyRarities(p);
        if (empty.length) out.push(`${p.nom} : aucun personnage ${empty.map((r) => RAR[r].nom).join(", ")} (repli sur tout le catalogue).`);
      });
      return out;
    }

    /* ---------- tirage d'un pack ---------- */
    const eligible = (pack, r) => chars.filter((c) => c.rarete === r && pack.filter(c));
    const emptyRarities = (pack) => ORDER.filter((r) => !eligible(pack, r).length);

    function pickCard(pack, r, owned, rng) {
      let pool = eligible(pack, r);
      if (!pool.length) pool = chars.filter((c) => c.rarete === r); // repli : tout le catalogue de cette rareté
      const w = pool.map((c) => (owned[c.slug] ? 1 : config.missingWeight));
      let t = rng() * total(w), i = 0;
      for (; i < pool.length - 1; i++) { t -= w[i]; if (t < 0) break; }
      return pool[i];
    }

    function drawPack(pack, owned, pity, rng) {
      const rs = Array.from({ length: config.packSize - 1 }, () => drawFrom(config.standardOdds, rng));
      let last;
      if (pack.kind === "rarete") last = drawFrom(pack.garantie, rng);
      else {
        last = drawFrom(config.standardOdds, rng);
        if (![...rs, last].some((r) => rank(r) >= rank(pack.minRarity))) last = drawFrom(atLeast(config.standardOdds, pack.minRarity), rng);
      }
      // compteur de pitié : la carte garantie monte si la malchance dure trop
      const best = () => Math.max(rank(last), ...rs.map(rank));
      let pityHit = null;
      for (const r of Object.keys(config.pity).sort((a, b) => rank(b) - rank(a))) {
        if ((pity[r] || 0) >= config.pity[r] && best() < rank(r)) { last = r; pityHit = r; break; }
      }
      rs.push(last);
      const top = best();
      const newPity = Object.fromEntries(Object.keys(config.pity).map((r) => [r, top >= rank(r) ? 0 : (pity[r] || 0) + 1]));

      const tmp = { ...owned };
      const cards = rs.map((r) => {
        const c = pickCard(pack, r, tmp, rng);
        const isNew = !tmp[c.slug];
        tmp[c.slug] = (tmp[c.slug] || 0) + 1;
        return { c, isNew };
      });
      return { cards, pity: newPity, pityHit };
    }

    /* ---------- état du joueur ---------- */
    function newState(now) {
      return { coins: config.economy.depart, xp: 0, owned: {}, vus: {}, franchises: {}, pity: {}, daily: "",
        created: now, log: [], annonces: [], marche: [], nextId: 1, lastTick: now,
        gratuit: { stock: FREE.max, t: now }, serie: { n: 0, last: "" }, hebdo: "", bons: {}, packJour: "", recent: [] };
    }

    /* ---------- calendrier (heure locale du joueur ; côté serveur : son fuseau) ---------- */
    const pad = (n) => String(n).padStart(2, "0");
    const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const weekKey = (t) => { const d = new Date(t); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dayKey(d.getTime()); }; // lundi
    const yesterday = (t) => { const d = new Date(t); d.setDate(d.getDate() - 1); return dayKey(d.getTime()); };
    const dayIndex = (t) => Math.floor(new Date(dayKey(t) + "T12:00:00").getTime() / 864e5);
    const themePacks = packs.filter((p) => p.kind === "theme");
    const packDuJour = (t) => themePacks[dayIndex(t) % themePacks.length];

    /* ---------- packs gratuits ---------- */
    // Recharge du Pack Aléatoire : +1 toutes les intervalH heures, jusqu'à max.
    function freeStatus(S, now) {
      const I = FREE.intervalH * H, g = S.gratuit;
      if (g.stock >= FREE.max) { g.stock = FREE.max; g.t = now; }
      else {
        const gained = Math.floor((now - g.t) / I);
        if (gained > 0) { g.stock = Math.min(FREE.max, g.stock + gained); g.t = g.stock >= FREE.max ? now : g.t + gained * I; }
      }
      return { stock: g.stock, max: FREE.max, next: g.stock < FREE.max ? g.t + I : null };
    }
    function freeOffers(S, now) {
      const jour = packDuJour(now);
      return {
        aleatoire: freeStatus(S, now),
        jour: config.gratuit.packDuJour ? { pack: jour, dispo: S.packJour !== dayKey(now) } : null,
        bons: Object.entries(S.bons).filter(([, n]) => n > 0).map(([id, n]) => ({ pack: packById(id), n })),
      };
    }
    function payFor(S, pack, pay, now) {
      if (pay === "coins") {
        if (pack.kind === "gratuit") return "Ce pack est uniquement gratuit.";
        if (S.coins < pack.prix) return "Pas assez de coins.";
        S.coins -= pack.prix;
        log(S, "pack", -pack.prix, pack.nom, now);
      } else if (pay === "gratuit") {
        if (pack.kind !== "gratuit") return "Ce pack n'est pas gratuit.";
        if (!freeStatus(S, now).stock) return "Aucun Pack Aléatoire disponible pour l'instant.";
        S.gratuit.stock--;
      } else if (pay === "jour") {
        if (!config.gratuit.packDuJour || pack !== packDuJour(now)) return "Ce n'est pas le pack du jour.";
        if (S.packJour === dayKey(now)) return "Pack du jour déjà ouvert.";
        S.packJour = dayKey(now);
      } else if (pay === "bon") {
        if (!(S.bons[pack.id] > 0)) return "Aucun bon pour ce pack.";
        S.bons[pack.id]--;
      } else return "Paiement inconnu.";
      return "";
    }

    /* ---------- rangs et divisions (III → II → I) ---------- */
    const DIVS = ["III", "II", "I"];
    function rankInfo(xp) {
      const i = rankOf(xp), r = config.ranks[i], nx = config.ranks[i + 1];
      if (!nx) return { i, r, div: "", label: r.nom, p: 1, to: null, next: null };
      const span = (nx.xp - r.xp) / 3, d = Math.min(2, Math.floor((xp - r.xp) / span));
      const from = r.xp + d * span, to = Math.round(from + span);
      return { i, r, div: DIVS[d], label: `${r.nom} ${DIVS[d]}`, p: (xp - from) / (to - from), to,
        next: d < 2 ? `${r.nom} ${DIVS[d + 1]}` : nx.nom };
    }
    function log(S, type, montant, label, now) {
      S.log.unshift({ t: now, type, montant, label });
      if (S.log.length > 60) S.log.length = 60;
    }
    function rankOf(xp) {
      let i = 0;
      config.ranks.forEach((r, k) => { if (xp >= r.xp) i = k; });
      return i;
    }
    function take(S, slug, n = 1) {
      S.owned[slug] -= n;
      if (S.owned[slug] <= 0) delete S.owned[slug];
    }

    // Ajoute des cartes à la collection ; vérifie les franchises complétées.
    function give(S, cards, withXp) {
      let xp = 0;
      const completed = [];
      cards.forEach(({ c, isNew }) => {
        S.owned[c.slug] = (S.owned[c.slug] || 0) + 1;
        if (withXp) xp += isNew ? config.xp.nouvelle : config.xp.doublon;
      });
      new Set(cards.map((x) => x.c.franchise)).forEach((f) => {
        const all = chars.filter((c) => c.franchise === f);
        if (S.franchises[f] || all.length < config.xp.franchiseMin || !all.every((c) => S.owned[c.slug])) return;
        S.franchises[f] = true;
        completed.push(f);
        xp += config.xp.franchise;
      });
      S.xp += xp;
      return { xp, completed };
    }

    // pay : "coins" (achat), "gratuit" (Pack Aléatoire rechargé), "jour" (pack du jour), "bon" (bon de série)
    function openPack(S, packId, now, rng, pay = "coins") {
      const pack = packById(packId);
      if (!pack) return { error: "Pack inconnu." };
      const err = payFor(S, pack, pay, now);
      if (err) return { error: err };
      const d = drawPack(pack, S.owned, S.pity, rng);
      S.pity = d.pity;
      const g = give(S, d.cards, true);
      S.recent = [...d.cards.map((x) => x.c.slug), ...S.recent].slice(0, 15);
      return { pack, pay, cards: d.cards, pityHit: d.pityHit, xp: g.xp, completed: g.completed };
    }

    function viewSheet(S, slug) {
      if (S.vus[slug] || !bySlug[slug]) return 0;
      S.vus[slug] = true;
      S.xp += config.xp.fiche;
      return config.xp.fiche;
    }

    // Récompense de connexion : coins du jour + série (bon tous les 7 jours) + bonus du lundi.
    function claimDaily(S, now) {
      const day = dayKey(now), E = config.economy, sr = config.gratuit.serie;
      if (S.daily === day) return { error: "Déjà récupéré aujourd'hui." };
      S.daily = day;
      S.serie = { n: S.serie.last === yesterday(now) ? S.serie.n + 1 : 1, last: day };
      let gain = E.quotidien, bon = null, hebdo = false;
      log(S, "quotidien", E.quotidien, "Connexion quotidienne", now);
      if (S.hebdo !== weekKey(now)) {
        S.hebdo = weekKey(now);
        gain += E.hebdo;
        hebdo = true;
        log(S, "hebdo", E.hebdo, "Bonus de la semaine", now);
      }
      if (S.serie.n % sr.jours === 0) {
        S.bons[sr.bon] = (S.bons[sr.bon] || 0) + 1;
        bon = packById(sr.bon);
      }
      S.coins += gain;
      return { gain, serie: S.serie.n, bon, hebdo };
    }
    const dailyDone = (S, now) => S.daily === dayKey(now);

    /* ---------- vente rapide ---------- */
    const quickSellValue = (r) => Math.round(RAR[r].prix * config.economy.venteRapide);

    function quickSell(S, slug, n, now) {
      const c = bySlug[slug];
      if (!c || (S.owned[slug] || 0) < n) return { error: "Carte non possédée." };
      take(S, slug, n);
      const gain = quickSellValue(c.rarete) * n;
      S.coins += gain;
      log(S, "vente-rapide", gain, `Vente rapide : ${c.nom}${n > 1 ? " ×" + n : ""}`, now);
      return { gain };
    }
    const duplicatesValue = (S) => chars.reduce((a, c) => a + Math.max(0, (S.owned[c.slug] || 0) - 1) * quickSellValue(c.rarete), 0);
    function quickSellDuplicates(S, now) {
      let gain = 0;
      chars.forEach((c) => { const q = S.owned[c.slug] || 0; if (q > 1) gain += quickSell(S, c.slug, q - 1, now).gain; });
      return { gain };
    }

    /* ---------- marché entre joueurs ---------- */
    const priceBounds = (r) => [Math.ceil(RAR[r].prix * M.prixMin), Math.floor(RAR[r].prix * M.prixMax)];
    const netOf = (prix) => Math.floor(prix * (1 - M.commission));
    const activeListings = (S) => S.annonces.filter((a) => a.statut === "active");

    function canSell(S) {
      const min = config.ranks.findIndex((r) => r.id === M.rangMin);
      if (rankOf(S.xp) < min) return `Il faut le rang ${config.ranks[min].nom} pour vendre au marché.`;
      if (activeListings(S).length >= M.maxAnnonces) return `Maximum ${M.maxAnnonces} annonces actives.`;
      return "";
    }

    function listCard(S, slug, prix, now) {
      const err = canSell(S);
      if (err) return { error: err };
      const c = bySlug[slug];
      if (!c || !S.owned[slug]) return { error: "Carte non possédée." };
      const [lo, hi] = priceBounds(c.rarete);
      prix = Math.round(prix);
      if (!(prix >= lo && prix <= hi)) return { error: `Le prix doit être entre ${lo} et ${hi} coins.` };
      take(S, slug); // séquestre : la carte quitte l'inventaire pendant la vente
      const a = { id: "a" + S.nextId++, slug, prix, cree: now, statut: "active" };
      S.annonces.unshift(a);
      return { annonce: a };
    }

    function cancelListing(S, id, now) {
      const a = S.annonces.find((x) => x.id === id && x.statut === "active");
      if (!a) return { error: "Annonce introuvable." };
      a.statut = "annulee";
      a.fin = now;
      S.owned[a.slug] = (S.owned[a.slug] || 0) + 1;
      return { annonce: a };
    }

    // Côté serveur : une seule transaction (solde vérifié, annonce verrouillée, transfert).
    function buyListing(S, id, now) {
      const a = S.marche.find((x) => x.id === id);
      if (!a) return { error: "Cette annonce n'est plus disponible." };
      if (a.vendeur === "moi") return { error: "Impossible d'acheter sa propre annonce." };
      if (S.coins < a.prix) return { error: "Pas assez de coins." };
      const c = bySlug[a.slug];
      S.marche = S.marche.filter((x) => x !== a);
      S.coins -= a.prix;
      log(S, "achat", -a.prix, `Achat : ${c.nom} (${a.vendeur})`, now);
      const isNew = !S.owned[c.slug];
      const g = give(S, [{ c, isNew }], false); // le marché ne donne pas d'XP de carte
      return { c, isNew, xp: g.xp, completed: g.completed };
    }

    function fakeListing(S, now, rng, age) {
      const r = drawFrom(config.standardOdds, rng);
      const pool = chars.filter((c) => c.rarete === r);
      const c = pool[Math.floor(rng() * pool.length)];
      const [lo, hi] = priceBounds(r);
      const prix = Math.min(hi, Math.max(lo, Math.round(RAR[r].prix * (0.8 + rng() * 1.7))));
      return { id: "m" + S.nextId++, slug: c.slug, prix, vendeur: SELLERS[Math.floor(rng() * SELLERS.length)], cree: now - age };
    }

    // Prototype : fait vivre le marché (expirations, acheteurs et vendeurs simulés).
    function tickMarket(S, now, rng) {
      const events = [];
      const dt = Math.max(0, now - (S.lastTick ?? now));
      S.lastTick = now;
      activeListings(S).forEach((a) => {
        if (now - a.cree >= M.dureeH * H) {
          a.statut = "expiree";
          a.fin = now;
          S.owned[a.slug] = (S.owned[a.slug] || 0) + 1;
          events.push({ type: "expiree", a });
          return;
        }
        const ratio = a.prix / RAR[bySlug[a.slug].rarete].prix;
        const tau = M.acheteurDelaiS * 1000 * ratio * ratio; // plus c'est cher, plus c'est long
        if (rng() < 1 - Math.exp(-dt / tau)) {
          a.statut = "vendue";
          a.fin = now;
          a.net = netOf(a.prix);
          S.coins += a.net;
          log(S, "vente", a.net, `Vente : ${bySlug[a.slug].nom} (${a.prix} − ${Math.round(M.commission * 100)} %)`, now);
          events.push({ type: "vendue", a });
        }
      });
      S.marche = S.marche.filter((x) => now - x.cree < M.dureeH * H);
      const init = !S.marche.length;
      while (S.marche.length < M.annoncesFictives) S.marche.push(fakeListing(S, now, rng, init ? rng() * 60 * H : 0));
      return events;
    }

    return {
      ORDER, RAR, rank, chars, bySlug, franchises, packs, packById,
      total, isValidTable, drawFrom, problems, eligible, emptyRarities, drawPack,
      newState, rankOf, rankInfo, openPack, viewSheet, claimDaily, dailyDone,
      dayKey, weekKey, packDuJour, freeStatus, freeOffers,
      quickSellValue, quickSell, duplicatesValue, quickSellDuplicates,
      priceBounds, netOf, activeListings, canSell, listCard, cancelListing, buyListing, tickMarket,
    };
  }

  const Engine = { create, H };
  if (typeof module !== "undefined") module.exports = Engine;
  else root.Engine = Engine;
})(this);
