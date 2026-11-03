// Moteur du jeu : tirages, économie, défis, rangs, marché.
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
    const rankIndex = (id) => config.ranks.findIndex((r) => r.id === id);

    const FREE = config.gratuit.aleatoire;
    const packs = [
      { id: "aleatoire", nom: FREE.nom, c: FREE.c, prix: 0, kind: "gratuit", minRarity: FREE.minRarity, filter: () => true },
      ...config.rarityPacks.map((p) => ({ ...p, kind: "rarete", filter: () => true })),
      ...config.rankPacks.map((p) => ({ ...p, kind: "rang", filter: () => true })),
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
      const tables = [["Tirage standard", config.standardOdds], ["God pack", config.godPack.table],
        ...[...config.rarityPacks, ...config.rankPacks].map((p) => [p.nom, p.garantie])];
      tables.forEach(([n, t]) => { if (!isValidTable(t)) out.push(`${n} : total ${total(t)} au lieu de 100.`); });
      ORDER.forEach((r) => { if (!chars.some((c) => c.rarete === r)) out.push(`Aucun personnage ${RAR[r].nom} dans le catalogue.`); });
      chars.forEach((c) => { if (!RAR[c.rarete]) out.push(`${c.nom} : rareté inconnue « ${c.rarete} ».`); });
      packs.filter((p) => p.kind === "theme").forEach((p) => {
        const empty = emptyRarities(p);
        if (empty.length) out.push(`${p.nom} : aucun personnage ${empty.map((r) => RAR[r].nom).join(", ")} (repli sur tout le catalogue).`);
      });
      return out;
    }

    /* ---------- tirage d'un pack ---------- */
    // personnages éligibles par pack et par rareté, calculés une seule fois (3 000 personnages)
    const pools = new Map();
    const byRarity = Object.fromEntries(ORDER.map((r) => [r, chars.filter((c) => c.rarete === r)]));
    const eligible = (pack, r) => {
      const key = pack.id + "|" + r;
      if (!pools.has(key)) pools.set(key, byRarity[r].filter(pack.filter));
      return pools.get(key);
    };
    const emptyRarities = (pack) => ORDER.filter((r) => !eligible(pack, r).length);

    function pickCard(pack, r, owned, rng) {
      let pool = eligible(pack, r);
      if (!pool.length) pool = byRarity[r]; // repli : tout le catalogue de cette rareté
      const w = pool.map((c) => (owned[c.slug] ? 1 : config.missingWeight));
      let t = rng() * total(w), i = 0;
      for (; i < pool.length - 1; i++) { t -= w[i]; if (t < 0) break; }
      return pool[i];
    }

    function drawPack(pack, owned, pity, rng) {
      const n = config.packSize;
      let rs, god = false, pityHit = null;
      if (rng() < config.godPack.chance) {        // god pack : tout est Légendaire ou mieux
        god = true;
        rs = Array.from({ length: n }, () => drawFrom(config.godPack.table, rng));
      } else {
        rs = Array.from({ length: n - 1 }, () => drawFrom(config.standardOdds, rng));
        let last;
        if (pack.garantie) last = drawFrom(pack.garantie, rng);
        else {
          last = drawFrom(config.standardOdds, rng);
          if (![...rs, last].some((r) => rank(r) >= rank(pack.minRarity))) last = drawFrom(atLeast(config.standardOdds, pack.minRarity), rng);
        }
        // compteur de pitié : la carte garantie monte si la malchance dure trop
        const best = () => Math.max(rank(last), ...rs.map(rank));
        for (const r of Object.keys(config.pity).sort((a, b) => rank(b) - rank(a))) {
          if ((pity[r] || 0) >= config.pity[r] && best() < rank(r)) { last = r; pityHit = r; break; }
        }
        rs.push(last);
      }
      const top = Math.max(...rs.map(rank));
      const newPity = Object.fromEntries(Object.keys(config.pity).map((r) => [r, top >= rank(r) ? 0 : (pity[r] || 0) + 1]));

      const tmp = { ...owned };
      const cards = rs.map((r) => {
        const c = pickCard(pack, r, tmp, rng);
        const isNew = !tmp[c.slug];
        tmp[c.slug] = (tmp[c.slug] || 0) + 1;
        return { c, isNew, holo: rng() < config.holo.chance };
      });
      return { cards, pity: newPity, pityHit, god };
    }

    /* ---------- état du joueur ---------- */
    function newState(now) {
      return { coins: config.economy.depart, xp: 0, owned: {}, vus: {}, franchises: {}, pity: {}, daily: "",
        created: now, log: [], annonces: [], marche: [], nextId: 1, lastTick: now,
        gratuit: { stock: FREE.max, t: now }, serie: { n: 0, last: "" }, hebdo: "", bons: {}, packJour: "", recent: [],
        holo: {}, serials: {}, eclats: 0, stats: {}, defis: {}, rangMax: 0, saison: 0, saisons: [], histo: {},
        encheres: [], encheresMarche: [], offres: [], offresRecues: [], echanges: [], echangesRecus: [], souhaits: {}, vitrine: [] };
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
    const rankLock = (S, pack) => pack.kind === "rang" && rankOf(S.xp) < rankIndex(pack.rang)
      ? `Réservé au rang ${config.ranks[rankIndex(pack.rang)].nom}.` : "";
    function payFor(S, pack, pay, now) {
      if (pay === "coins") {
        if (pack.kind === "gratuit") return "Ce pack est uniquement gratuit.";
        const lock = rankLock(S, pack);
        if (lock) return lock;
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

    /* ---------- rangs, divisions (III → II → I) et saisons ---------- */
    const DIVS = ["III", "II", "I"];
    function rankOf(xp) {
      let i = 0;
      config.ranks.forEach((r, k) => { if (xp >= r.xp) i = k; });
      return i;
    }
    function rankInfo(xp) {
      const i = rankOf(xp), r = config.ranks[i], nx = config.ranks[i + 1];
      if (!nx) return { i, r, div: "", label: r.nom, p: 1, to: null, next: null };
      const span = (nx.xp - r.xp) / 3, d = Math.min(2, Math.floor((xp - r.xp) / span));
      const from = r.xp + d * span, to = Math.round(from + span);
      return { i, r, div: DIVS[d], label: `${r.nom} ${DIVS[d]}`, p: (xp - from) / (to - from), to,
        next: d < 2 ? `${r.nom} ${DIVS[d + 1]}` : nx.nom };
    }
    function seasonInfo(now) {
      const start = new Date(config.saison.debut + "T00:00:00").getTime(), len = config.saison.jours * 864e5;
      const n = Math.max(0, Math.floor((now - start) / len));
      return { numero: n + 1, debut: start + n * len, fin: start + (n + 1) * len };
    }
    // Nouvelle saison : l'XP classée est réduite, le meilleur rang de la saison passée est gardé.
    function checkSeason(S, now) {
      const s = seasonInfo(now);
      if (S.saison === s.numero) return null;
      let ended = null;
      if (S.saison) {
        ended = { saison: S.saison, rang: rankOf(S.xp) };
        S.saisons.push(ended);
        S.xp = Math.floor(S.xp * config.saison.garde);
      }
      S.saison = s.numero;
      return ended;
    }
    function addXp(S, n) {
      S.xp += n;
      S.rangMax = Math.max(S.rangMax || 0, rankOf(S.xp));
    }
    function log(S, type, montant, label, now) {
      S.log.unshift({ t: now, type, montant, label });
      if (S.log.length > 60) S.log.length = 60;
    }

    /* ---------- statistiques (pour les défis et les succès) ---------- */
    const bump = (S, k, n = 1) => { if (n) S.stats[k] = (S.stats[k] || 0) + n; };
    function statValue(S, stat) {
      if (stat === "differentes") return Object.keys(S.owned).length;
      if (stat === "franchises") return Object.keys(S.franchises).length;
      if (stat === "rang") return S.rangMax || 0;
      return S.stats[stat] || 0;
    }

    /* ---------- collection ---------- */
    const holoCount = (S, slug) => S.holo[slug] || 0;
    const plainCount = (S, slug) => (S.owned[slug] || 0) - holoCount(S, slug);
    function take(S, slug, n = 1, holo = false) {
      S.owned[slug] -= n;
      if (holo) S.holo[slug] -= n;
      if (S.holo[slug] <= 0) delete S.holo[slug];
      if (S.owned[slug] <= 0) delete S.owned[slug];
    }
    // Numéro d'édition limitée (#37/100) pour les raretés concernées.
    function mintSerial(S, c, rng) {
      const max = config.tirageLimite[c.rarete];
      if (!max) return null;
      const used = new Set(S.serials[c.slug] || []);
      const free = Array.from({ length: max }, (_, i) => i + 1).filter((n) => !used.has(n));
      if (!free.length) return null;
      const n = free[Math.floor(rng() * free.length)];
      (S.serials[c.slug] = S.serials[c.slug] || []).push(n);
      return n;
    }

    // Ajoute des cartes à la collection. Au-delà de maxExemplaires (hors holo), la copie devient des éclats.
    function give(S, cards, withXp, rng = Math.random) {
      let xp = 0, eclats = 0;
      const completed = [];
      cards.forEach((x) => {
        const { c } = x;
        if (!x.holo && plainCount(S, c.slug) >= config.maxExemplaires) {
          x.converti = config.eclats.gain[c.rarete];
          eclats += x.converti;
        } else {
          S.owned[c.slug] = (S.owned[c.slug] || 0) + 1;
          if (x.holo) S.holo[c.slug] = holoCount(S, c.slug) + 1;
          x.serial = mintSerial(S, c, rng);
        }
        if (withXp) xp += x.isNew ? config.xp.nouvelle[c.rarete] : config.xp.doublon;
      });
      new Set(cards.map((x) => x.c.franchise)).forEach((f) => {
        const all = chars.filter((c) => c.franchise === f);
        if (S.franchises[f] || all.length < config.xp.franchiseMin || !all.every((c) => S.owned[c.slug])) return;
        S.franchises[f] = true;
        completed.push(f);
        xp += config.xp.franchise;
      });
      S.eclats += eclats;
      addXp(S, xp);
      return { xp, completed, eclats };
    }

    // pay : "coins" (achat), "gratuit" (Pack Aléatoire rechargé), "jour" (pack du jour), "bon" (bon de défi ou de série)
    function openPack(S, packId, now, rng, pay = "coins") {
      const pack = packById(packId);
      if (!pack) return { error: "Pack inconnu." };
      const err = payFor(S, pack, pay, now);
      if (err) return { error: err };
      const rankBefore = rankOf(S.xp);
      const d = drawPack(pack, S.owned, S.pity, rng);
      S.pity = d.pity;
      const g = give(S, d.cards, true, rng);
      S.recent = [...d.cards.map((x) => x.c.slug), ...S.recent].slice(0, 15);
      // statistiques
      const atLeastR = (r) => d.cards.filter((x) => rank(x.c.rarete) >= rank(r)).length;
      bump(S, "packs");
      bump(S, { theme: "packsTheme", gratuit: "packsGratuits", rarete: "packsRarete", rang: "packsRang" }[pack.kind]);
      if (pay === "jour" || pay === "gratuit") bump(S, "packsGratuits", pay === "jour" ? 1 : 0);
      bump(S, "cartes", d.cards.length);
      bump(S, "nouvelles", d.cards.filter((x) => x.isNew).length);
      bump(S, "rarePlus", atLeastR("rare"));
      bump(S, "epiquePlus", atLeastR("epique"));
      bump(S, "legendairePlus", atLeastR("legendaire"));
      bump(S, "mythiquePlus", atLeastR("mythique"));
      bump(S, "spectaculaire", atLeastR("spectaculaire"));
      bump(S, "holo", d.cards.filter((x) => x.holo).length);
      bump(S, "godPacks", d.god ? 1 : 0);
      return { pack, pay, cards: d.cards, pityHit: d.pityHit, god: d.god, xp: g.xp, completed: g.completed,
        eclats: g.eclats, rankUp: rankOf(S.xp) > rankBefore };
    }

    function viewSheet(S, slug) {
      if (S.vus[slug] || !bySlug[slug]) return 0;
      S.vus[slug] = true;
      bump(S, "fiches");
      addXp(S, config.xp.fiche);
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

    /* ---------- défis ---------- */
    // tirage du jour / de la semaine, identique pour une même date (côté serveur : identique pour tous)
    function seeded(list, n, seed) {
      const a = [...list];
      let x = seed * 9301 + 49297;
      for (let i = a.length - 1; i > 0; i--) {
        x = (x * 9301 + 49297) % 233280;
        const j = Math.floor((x / 233280) * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a.slice(0, n);
    }
    function refreshDefis(S, now) {
      const D = S.defis, day = dayKey(now), week = weekKey(now);
      if (D.jour !== day) {
        D.jour = day;
        D.q = seeded(config.defis.jour, config.defis.quotidiens, dayIndex(now)).map((d) => ({ id: d.id, base: statValue(S, d.stat) }));
      }
      if (D.semaine !== week) {
        D.semaine = week;
        D.h = seeded(config.defis.semaine, config.defis.hebdomadaires, Math.floor(dayIndex(now) / 7)).map((d) => ({ id: d.id, base: statValue(S, d.stat) }));
      }
      D.faits = D.faits || {};
    }
    function defisList(S, now) {
      refreshDefis(S, now);
      const D = S.defis;
      const row = (def, base, key) => {
        const progress = Math.min(def.cible, statValue(S, def.stat) - base);
        return { def, key, progress, done: progress >= def.cible, claimed: !!D.faits[key] };
      };
      const find = (list, id) => list.find((d) => d.id === id);
      return {
        jour: D.q.map((q) => row(find(config.defis.jour, q.id), q.base, `${D.jour}:${q.id}`)),
        semaine: D.h.map((q) => row(find(config.defis.semaine, q.id), q.base, `${D.semaine}:${q.id}`)),
        succes: config.defis.succes.map((d) => row(d, 0, d.id)),
      };
    }
    const claimable = (S, now) => { const l = defisList(S, now); return [...l.jour, ...l.semaine, ...l.succes].filter((x) => x.done && !x.claimed).length; };
    function claimDefi(S, key, now) {
      const l = defisList(S, now), x = [...l.jour, ...l.semaine, ...l.succes].find((r) => r.key === key);
      if (!x) return { error: "Défi introuvable." };
      if (x.claimed) return { error: "Récompense déjà récupérée." };
      if (!x.done) return { error: "Défi pas encore réussi." };
      S.defis.faits[key] = true;
      const r = x.def.recompense;
      if (r.coins) { S.coins += r.coins; log(S, "defi", r.coins, `Défi : ${x.def.nom}`, now); }
      if (r.xp) addXp(S, r.xp);
      if (r.eclats) S.eclats += r.eclats;
      if (r.bon) S.bons[r.bon] = (S.bons[r.bon] || 0) + 1;
      return { def: x.def, recompense: r, bon: r.bon ? packById(r.bon) : null };
    }

    /* ---------- atelier : éclats → carte de petite rareté ---------- */
    function craft(S, slug, now) {
      const c = bySlug[slug], cost = c && config.eclats.cout[c.rarete];
      if (!cost) return { error: "Cette rareté ne se fabrique pas." };
      if (S.eclats < cost) return { error: `Il faut ${cost} éclats.` };
      if (plainCount(S, slug) >= config.maxExemplaires) return { error: `Vous avez déjà ${config.maxExemplaires} exemplaires.` };
      S.eclats -= cost;
      const g = give(S, [{ c, isNew: !S.owned[slug] }], false);
      bump(S, "fabriques");
      log(S, "atelier", 0, `Atelier : ${c.nom} (−${cost} éclats)`, now);
      return { c, completed: g.completed };
    }

    /* ---------- vente rapide ---------- */
    const refPrice = (r, holo) => RAR[r].prix * (holo ? config.holo.valeur : 1);
    const quickSellValue = (r, holo = false) => Math.round(refPrice(r, holo) * config.economy.venteRapide);

    function quickSell(S, slug, n, now, holo = false) {
      const c = bySlug[slug];
      if (!c || (holo ? holoCount(S, slug) : plainCount(S, slug)) < n) return { error: "Carte non possédée." };
      take(S, slug, n, holo);
      const gain = quickSellValue(c.rarete, holo) * n;
      S.coins += gain;
      bump(S, "ventesRapides", n);
      log(S, "vente-rapide", gain, `Vente rapide : ${c.nom}${holo ? " (holo)" : ""}${n > 1 ? " ×" + n : ""}`, now);
      return { gain };
    }
    const duplicatesValue = (S) => chars.reduce((a, c) => a + Math.max(0, plainCount(S, c.slug) - 1) * quickSellValue(c.rarete), 0);
    function quickSellDuplicates(S, now) {
      let gain = 0;
      chars.forEach((c) => { const q = plainCount(S, c.slug); if (q > 1) gain += quickSell(S, c.slug, q - 1, now).gain; });
      return { gain };
    }

    /* ---------- marché entre joueurs (sans plafond de prix) ---------- */
    const netOf = (prix) => Math.floor(prix * (1 - M.commission));
    const activeListings = (S) => S.annonces.filter((a) => a.statut === "active");
    function record(S, slug, prix, holo, now) {
      const h = (S.histo[slug] = S.histo[slug] || []);
      h.unshift({ t: now, prix, holo: !!holo });
      if (h.length > 12) h.length = 12;
    }
    // Valeur de marché : moyenne des dernières ventes (sinon prix de référence)
    function marketValue(S, slug, holo = false) {
      const c = bySlug[slug], h = (S.histo[slug] || []).filter((x) => !!x.holo === !!holo).slice(0, 5);
      return h.length ? Math.round(h.reduce((a, x) => a + x.prix, 0) / h.length) : refPrice(c.rarete, holo);
    }

    function canSell(S) {
      const min = rankIndex(M.rangMin);
      if (rankOf(S.xp) < min) return `Il faut le rang ${config.ranks[min].nom} pour vendre au marché.`;
      if (activeListings(S).length >= M.maxAnnonces) return `Maximum ${M.maxAnnonces} annonces actives.`;
      return "";
    }

    function listCard(S, slug, prix, now, holo = false) {
      const err = canSell(S);
      if (err) return { error: err };
      const c = bySlug[slug];
      if (!c || (holo ? holoCount(S, slug) : plainCount(S, slug)) < 1) return { error: "Carte non possédée." };
      prix = Math.round(prix);
      if (!(prix >= M.prixMin) || !Number.isFinite(prix)) return { error: `Le prix doit être d'au moins ${M.prixMin} coin.` };
      take(S, slug, 1, holo); // séquestre : la carte quitte l'inventaire pendant la vente
      const a = { id: "a" + S.nextId++, slug, prix, holo: !!holo, cree: now, statut: "active" };
      S.annonces.unshift(a);
      bump(S, "annonces");
      return { annonce: a };
    }

    function cancelListing(S, id, now) {
      const a = S.annonces.find((x) => x.id === id && x.statut === "active");
      if (!a) return { error: "Annonce introuvable." };
      a.statut = "annulee";
      a.fin = now;
      S.owned[a.slug] = (S.owned[a.slug] || 0) + 1;
      if (a.holo) S.holo[a.slug] = holoCount(S, a.slug) + 1;
      return { annonce: a };
    }

    // Côté serveur : une seule transaction (solde vérifié, annonce verrouillée, transfert).
    function buyListing(S, id, now) {
      const a = S.marche.find((x) => x.id === id);
      if (!a) return { error: "Cette annonce n'est plus disponible." };
      if (a.vendeur === "moi") return { error: "Impossible d'acheter sa propre annonce." };
      if (S.coins < a.prix) return { error: "Pas assez de coins." };
      const c = bySlug[a.slug];
      if (!a.holo && plainCount(S, c.slug) >= config.maxExemplaires) return { error: `Vous avez déjà ${config.maxExemplaires} exemplaires de cette carte.` };
      S.marche = S.marche.filter((x) => x !== a);
      S.coins -= a.prix;
      log(S, "achat", -a.prix, `Achat : ${c.nom}${a.holo ? " (holo)" : ""} (${a.vendeur})`, now);
      record(S, c.slug, a.prix, a.holo, now);
      bump(S, "achats");
      const isNew = !S.owned[c.slug];
      const g = give(S, [{ c, isNew, holo: a.holo }], false); // le marché ne donne pas d'XP de carte
      return { c, isNew, holo: a.holo, xp: g.xp, completed: g.completed };
    }

    // perso tiré pour une annonce simulée : de temps en temps, un perso de la liste de souhaits
    function fakePick(S, rng, table = config.standardOdds) {
      const wished = Object.keys(S.souhaits || {}).filter((s) => bySlug[s]);
      if (wished.length && rng() < 0.1) return bySlug[wished[Math.floor(rng() * wished.length)]];
      const pool = byRarity[drawFrom(table, rng)];
      return pool[Math.floor(rng() * pool.length)];
    }
    function fakeListing(S, now, rng, age) {
      const c = fakePick(S, rng);
      const holo = rng() < 0.03;
      const prix = Math.max(M.prixMin, Math.round(marketValue(S, c.slug, holo) * (0.7 + rng() * 1.8)));
      return { id: "m" + S.nextId++, slug: c.slug, prix, holo, vendeur: SELLERS[Math.floor(rng() * SELLERS.length)], cree: now - age };
    }

    // Prototype : fait vivre le marché (expirations, acheteurs et vendeurs simulés, historique des prix).
    function tickMarket(S, now, rng) {
      const events = [];
      const dt = Math.max(0, now - (S.lastTick ?? now));
      S.lastTick = now;
      activeListings(S).forEach((a) => {
        if (now - a.cree >= M.dureeH * H) {
          a.statut = "expiree";
          a.fin = now;
          S.owned[a.slug] = (S.owned[a.slug] || 0) + 1;
          if (a.holo) S.holo[a.slug] = holoCount(S, a.slug) + 1;
          events.push({ type: "expiree", a });
          return;
        }
        const ratio = a.prix / marketValue(S, a.slug, a.holo);
        const tau = M.acheteurDelaiS * 1000 * Math.max(0.2, ratio) ** 3; // plus c'est cher par rapport au marché, plus c'est long
        if (rng() < 1 - Math.exp(-dt / tau)) {
          a.statut = "vendue";
          a.fin = now;
          a.net = netOf(a.prix);
          S.coins += a.net;
          record(S, a.slug, a.prix, a.holo, now);
          bump(S, "ventes");
          log(S, "vente", a.net, `Vente : ${bySlug[a.slug].nom} (${a.prix} − ${Math.round(M.commission * 100)} %)`, now);
          events.push({ type: "vendue", a });
        }
      });
      // les autres joueurs achètent aussi entre eux : les bonnes affaires partent, l'historique se remplit
      S.marche = S.marche.filter((x) => {
        if (now - x.cree >= M.dureeH * H) return false;
        const ratio = x.prix / refPrice(bySlug[x.slug].rarete, x.holo);
        if (rng() < 1 - Math.exp(-dt / (6 * H * ratio * ratio))) { record(S, x.slug, x.prix, x.holo, now); return false; }
        return true;
      });
      const init = !S.marche.length;
      while (S.marche.length < M.annoncesFictives) {
        const x = fakeListing(S, now, rng, init ? rng() * 60 * H : 0);
        S.marche.push(x);
        if (!init && S.souhaits[x.slug]) events.push({ type: "souhait", slug: x.slug, prix: x.prix, ou: "annonce" });
      }
      return events.concat(tickTrading(S, now, dt, rng));
    }

    /* ---------- enchères ---------- */
    const EN = M.encheres, OF = M.offres;
    const minBid = (a) => a.offre ? Math.ceil(a.offre * (1 + EN.incrementMin)) : a.depart;
    const bidder = (rng) => SELLERS[Math.floor(rng() * SELLERS.length)];

    function createAuction(S, slug, depart, heures, now, holo = false) {
      const err = canSell(S);
      if (err) return { error: err };
      if (S.encheres.filter((a) => a.statut === "active").length >= EN.max) return { error: `Maximum ${EN.max} enchères en cours.` };
      if (!EN.durees.includes(heures)) return { error: "Durée inconnue." };
      const c = bySlug[slug];
      if (!c || (holo ? holoCount(S, slug) : plainCount(S, slug)) < 1) return { error: "Carte non possédée." };
      depart = Math.round(depart);
      if (!(depart >= M.prixMin)) return { error: `Mise à prix d'au moins ${M.prixMin} coin.` };
      take(S, slug, 1, holo); // séquestre
      const a = { id: "e" + S.nextId++, slug, holo: !!holo, depart, offre: 0, meneur: null, nb: 0, cree: now, fin: now + heures * H, statut: "active" };
      S.encheres.unshift(a);
      bump(S, "annonces");
      return { enchere: a };
    }
    // Enchérir sur une enchère d'un autre joueur : les coins sont bloqués jusqu'à la fin (rendus si on est dépassé)
    function bid(S, id, montant, now) {
      const a = S.encheresMarche.find((x) => x.id === id);
      if (!a || a.fin <= now) return { error: "Cette enchère est terminée." };
      montant = Math.round(montant);
      if (montant < minBid(a)) return { error: `L'enchère minimum est de ${minBid(a)} coins.` };
      const mine = a.meneur === "moi" ? a.offre : 0;  // on ne paie que la différence si on menait déjà
      if (S.coins + mine < montant) return { error: "Pas assez de coins." };
      S.coins += mine - montant;
      a.offre = montant; a.meneur = "moi"; a.nb++;
      log(S, "enchere", -(montant - mine), `Enchère : ${bySlug[a.slug].nom}`, now);
      return { enchere: a };
    }
    function fakeAuction(S, now, rng) {
      // aux enchères, les joueurs mettent surtout leurs belles cartes
      const c = fakePick(S, rng, { rare: 40, epique: 34, legendaire: 18, mythique: 7, spectaculaire: 1 }), holo = rng() < 0.04;
      const v = marketValue(S, c.slug, holo);
      return { id: "f" + S.nextId++, slug: c.slug, holo, depart: Math.max(M.prixMin, Math.round(v * (0.3 + rng() * 0.5))),
        offre: 0, meneur: null, nb: 0, vendeur: bidder(rng), cree: now, fin: now + (5 + rng() * 180) * 60e3 };
    }
    // Un acheteur simulé enchérit tant que le prix reste sous ce que la carte « vaut » pour lui
    function simulatedBid(S, a, dt, rng) {
      const v = marketValue(S, a.slug, a.holo) * (0.9 + rng() * 0.8);
      const p = a.offre || a.depart;
      if (p >= v * 1.5) return false;
      const tau = EN.delaiS * 1000 * Math.max(0.3, p / v) ** 3;
      if (rng() >= 1 - Math.exp(-dt / tau)) return false;
      a.offre = a.offre ? Math.ceil(a.offre * (1 + EN.incrementMin + rng() * 0.1)) : a.depart;
      a.nb++;
      return true;
    }

    /* ---------- offres d'achat ---------- */
    function postOffer(S, slug, prix, now, holo = false) {
      const c = bySlug[slug];
      if (!c) return { error: "Carte inconnue." };
      if (S.offres.filter((o) => o.statut === "active").length >= OF.max) return { error: `Maximum ${OF.max} offres en cours.` };
      if (!holo && plainCount(S, slug) >= config.maxExemplaires) return { error: `Vous avez déjà ${config.maxExemplaires} exemplaires.` };
      prix = Math.round(prix);
      if (!(prix >= M.prixMin)) return { error: `Offre d'au moins ${M.prixMin} coin.` };
      if (S.coins < prix) return { error: "Pas assez de coins." };
      S.coins -= prix; // coins bloqués jusqu'à ce qu'un vendeur accepte ou que l'offre expire
      const o = { id: "o" + S.nextId++, slug, holo: !!holo, prix, cree: now, fin: now + OF.dureeH * H, statut: "active" };
      S.offres.unshift(o);
      log(S, "offre", -prix, `Offre d'achat : ${c.nom}${holo ? " (holo)" : ""} (coins bloqués)`, now);
      return { offre: o };
    }
    function cancelOffer(S, id, now) {
      const o = S.offres.find((x) => x.id === id && x.statut === "active");
      if (!o) return { error: "Offre introuvable." };
      o.statut = "annulee"; o.closed = now;
      S.coins += o.prix;
      log(S, "offre", o.prix, `Offre annulée : ${bySlug[o.slug].nom}`, now);
      return { offre: o };
    }
    // Accepter une offre faite par un autre joueur sur une de vos cartes
    function acceptOffer(S, id, now) {
      const o = S.offresRecues.find((x) => x.id === id);
      if (!o || o.fin <= now) return { error: "Cette offre n'est plus valable." };
      if ((o.holo ? holoCount(S, o.slug) : plainCount(S, o.slug)) < 1) return { error: "Vous n'avez plus cette carte." };
      take(S, o.slug, 1, o.holo);
      const net = netOf(o.prix);
      S.coins += net;
      S.offresRecues = S.offresRecues.filter((x) => x !== o);
      record(S, o.slug, o.prix, o.holo, now);
      bump(S, "ventes");
      log(S, "vente", net, `Offre acceptée : ${bySlug[o.slug].nom} (${o.acheteur})`, now);
      return { net, c: bySlug[o.slug] };
    }

    /* ---------- échanges carte contre carte ---------- */
    const EX = M.echanges;
    const tradeValue = (S, cards) => cards.reduce((a, x) => a + marketValue(S, x.slug, x.holo), 0);
    const owns = (S, x) => (x.holo ? holoCount(S, x.slug) : plainCount(S, x.slug));
    function restore(S, x) {
      S.owned[x.slug] = (S.owned[x.slug] || 0) + 1;
      if (x.holo) S.holo[x.slug] = holoCount(S, x.slug) + 1;
    }
    // Proposer jusqu'à 3 de ses cartes contre une carte voulue. Les cartes données sont séquestrées.
    function proposeTrade(S, donne, veut, now) {
      if (!veut || !bySlug[veut.slug]) return { error: "Carte voulue inconnue." };
      if (!donne.length) return { error: "Choisissez au moins une carte à donner." };
      if (donne.length > EX.cartesMax) return { error: `${EX.cartesMax} cartes au maximum.` };
      if (S.echanges.filter((t) => t.statut === "active").length >= EX.max) return { error: `Maximum ${EX.max} propositions en cours.` };
      if (!veut.holo && plainCount(S, veut.slug) >= config.maxExemplaires) return { error: `Vous avez déjà ${config.maxExemplaires} exemplaires de cette carte.` };
      donne = donne.map((x) => ({ slug: x.slug, holo: !!x.holo }));
      veut = { slug: veut.slug, holo: !!veut.holo };
      if (donne.some((x) => x.slug === veut.slug && x.holo === veut.holo)) return { error: "Vous ne pouvez pas échanger une carte contre elle-même." };
      const need = {};
      donne.forEach((x) => { const k = x.slug + (x.holo ? "*" : ""); need[k] = (need[k] || 0) + 1; });
      if (donne.some((x) => owns(S, x) < need[x.slug + (x.holo ? "*" : "")])) return { error: "Vous ne possédez pas toutes ces cartes." };
      donne.forEach((x) => take(S, x.slug, 1, x.holo));
      const t = { id: "e" + S.nextId++, donne, veut, cree: now, fin: now + EX.dureeH * H, statut: "active" };
      S.echanges.unshift(t);
      if (S.echanges.length > 30) S.echanges.length = 30;
      return { echange: t };
    }
    function cancelTrade(S, id, now) {
      const t = S.echanges.find((x) => x.id === id && x.statut === "active");
      if (!t) return { error: "Proposition introuvable." };
      t.statut = "annulee"; t.closed = now;
      t.donne.forEach((x) => restore(S, x));
      return { echange: t };
    }
    // Accepter un échange proposé par un autre joueur : on donne sa carte, on reçoit les siennes.
    function acceptTrade(S, id, now, rng = Math.random) {
      const r = S.echangesRecus.find((x) => x.id === id);
      if (!r || r.fin <= now) return { error: "Cette proposition n'est plus valable." };
      if (owns(S, r.veut) < 1) return { error: "Vous n'avez plus cette carte." };
      take(S, r.veut.slug, 1, r.veut.holo);
      S.vitrine = S.vitrine.filter((s) => S.owned[s]);
      S.echangesRecus = S.echangesRecus.filter((x) => x !== r);
      const g = give(S, r.donne.map((x) => ({ c: bySlug[x.slug], isNew: !S.owned[x.slug], holo: x.holo })), false, rng);
      bump(S, "echanges");
      log(S, "echange", 0, `Échange avec ${r.joueur} : ${bySlug[r.veut.slug].nom} contre ${r.donne.map((x) => bySlug[x.slug].nom).join(", ")}`, now);
      return { recues: r.donne.map((x) => bySlug[x.slug]), eclats: g.eclats, completed: g.completed };
    }
    function declineTrade(S, id) {
      S.echangesRecus = S.echangesRecus.filter((x) => x.id !== id);
      return {};
    }
    // Un joueur simulé veut une de vos cartes et propose 1 ou 2 cartes de valeur proche (souvent des cartes qui vous manquent).
    function fakeTradeOffer(S, now, rng) {
      const mine = Object.keys(S.owned);
      if (!mine.length) return null;
      const slug = mine[Math.floor(rng() * mine.length)], holo = holoCount(S, slug) > 0 && rng() < 0.3;
      const c = bySlug[slug], v = marketValue(S, slug, holo), i = ORDER.indexOf(c.rarete);
      for (let essai = 0; essai < 30; essai++) {
        const n = rng() < 0.4 ? 2 : 1, donne = [];
        for (let k = 0; k < n; k++) {
          const r = ORDER[Math.max(0, Math.min(ORDER.length - 2, i - k - (rng() < 0.3 ? 1 : 0)))];
          let pool = byRarity[r];
          const missing = pool.filter((x) => !S.owned[x.slug]);
          if (missing.length && rng() < 0.6) pool = missing;
          const x = pool[Math.floor(rng() * pool.length)];
          if (x.slug !== slug && !donne.some((d) => d.slug === x.slug)) donne.push({ slug: x.slug, holo: false });
        }
        const ratio = donne.length ? tradeValue(S, donne) / v : 0;
        if (ratio >= 0.85 && ratio <= 1.5)
          return { id: "x" + S.nextId++, veut: { slug, holo }, donne, joueur: bidder(rng), cree: now, fin: now + EX.dureeRecuH * H };
      }
      return null;
    }
    function tickTrades(S, now, dt, rng) {
      const events = [];
      S.echanges.filter((t) => t.statut === "active").forEach((t) => {
        if (t.fin <= now) {
          t.statut = "expiree"; t.closed = now;
          t.donne.forEach((x) => restore(S, x));
          events.push({ type: "echange-expire", t });
          return;
        }
        const ratio = tradeValue(S, t.donne) / marketValue(S, t.veut.slug, t.veut.holo);
        if (ratio < EX.ratioMin) return;
        const tau = EX.delaiS * 1000 * Math.max(0.3, 1 / ratio) ** 3;
        if (rng() >= 1 - Math.exp(-dt / tau)) return;
        t.statut = "acceptee"; t.closed = now; t.joueur = bidder(rng);
        const c = bySlug[t.veut.slug], g = give(S, [{ c, isNew: !S.owned[c.slug], holo: t.veut.holo }], false, rng);
        bump(S, "echanges");
        log(S, "echange", 0, `Échange avec ${t.joueur} : ${t.donne.map((x) => bySlug[x.slug].nom).join(", ")} contre ${c.nom}`, now);
        events.push({ type: "echange-accepte", t, eclats: g.eclats });
      });
      S.echangesRecus = S.echangesRecus.filter((r) => r.fin > now && owns(S, r.veut) > 0);
      if (S.echangesRecus.length < EX.recus && rng() < 1 - Math.exp(-dt / (3 * 60e3))) {
        const r = fakeTradeOffer(S, now, rng);
        if (r) { S.echangesRecus.push(r); events.push({ type: "echange-recu", r }); }
      }
      return events;
    }

    /* ---------- liste de souhaits, vitrine, valeur de la collection ---------- */
    const toggleWish = (S, slug) => { if (S.souhaits[slug]) delete S.souhaits[slug]; else S.souhaits[slug] = true; return !!S.souhaits[slug]; };
    function toggleShowcase(S, slug) {
      const i = S.vitrine.indexOf(slug);
      if (i >= 0) { S.vitrine.splice(i, 1); return { on: false }; }
      if (!S.owned[slug]) return { error: "Il faut posséder la carte." };
      if (S.vitrine.length >= config.vitrine) return { error: `La vitrine contient ${config.vitrine} cartes au maximum.` };
      S.vitrine.push(slug);
      return { on: true };
    }
    function collectionValue(S) {
      return Object.keys(S.owned).reduce((a, slug) => a + plainCount(S, slug) * marketValue(S, slug) + holoCount(S, slug) * marketValue(S, slug, true), 0);
    }

    // Prototype : enchères et offres des autres joueurs (simulées)
    function tickTrading(S, now, dt, rng) {
      const events = [];
      // mes enchères : des acheteurs simulés enchérissent ; à la fin, vente ou retour de la carte
      S.encheres.filter((a) => a.statut === "active").forEach((a) => {
        if (a.fin > now && simulatedBid(S, a, dt, rng)) { a.meneur = bidder(rng); events.push({ type: "enchere-recue", a }); }
        if (a.fin <= now) {
          if (a.offre) {
            a.statut = "vendue"; a.net = netOf(a.offre);
            S.coins += a.net;
            record(S, a.slug, a.offre, a.holo, now);
            bump(S, "ventes");
            log(S, "vente", a.net, `Enchère remportée par ${a.meneur} : ${bySlug[a.slug].nom} (${a.offre})`, now);
          } else {
            a.statut = "invendue";
            S.owned[a.slug] = (S.owned[a.slug] || 0) + 1;
            if (a.holo) S.holo[a.slug] = holoCount(S, a.slug) + 1;
          }
          events.push({ type: "enchere-finie", a });
        }
      });
      // enchères des autres : on peut s'y faire dépasser, ou les gagner
      S.encheresMarche = S.encheresMarche.filter((a) => {
        if (a.fin > now) {
          const leader = a.meneur, before = a.offre;
          if (simulatedBid(S, a, dt, rng)) {
            if (leader === "moi") { S.coins += before; log(S, "enchere", before, `Enchère dépassée : ${bySlug[a.slug].nom} (coins rendus)`, now); events.push({ type: "depasse", a }); }
            a.meneur = bidder(rng);
          }
          return true;
        }
        if (a.offre) record(S, a.slug, a.offre, a.holo, now);
        if (a.meneur === "moi") {
          const c = bySlug[a.slug], g = give(S, [{ c, isNew: !S.owned[c.slug], holo: a.holo }], false, rng);
          bump(S, "achats");
          events.push({ type: "gagnee", a, eclats: g.eclats });
        }
        return false;
      });
      while (S.encheresMarche.length < EN.fictives) {
        const x = fakeAuction(S, now, rng);
        S.encheresMarche.push(x);
        if (S.souhaits[x.slug]) events.push({ type: "souhait", slug: x.slug, prix: x.depart, ou: "enchère" });
      }
      // mes offres d'achat : un vendeur accepte si le prix est assez bon
      S.offres.filter((o) => o.statut === "active").forEach((o) => {
        if (o.fin <= now) {
          o.statut = "expiree"; o.closed = now; S.coins += o.prix;
          log(S, "offre", o.prix, `Offre expirée : ${bySlug[o.slug].nom} (coins rendus)`, now);
          events.push({ type: "offre-expiree", o });
          return;
        }
        const tau = M.acheteurDelaiS * 1000 * Math.max(0.2, marketValue(S, o.slug, o.holo) / o.prix) ** 3;
        if (rng() < 1 - Math.exp(-dt / tau)) {
          o.statut = "acceptee"; o.closed = now;
          const c = bySlug[o.slug], g = give(S, [{ c, isNew: !S.owned[c.slug], holo: o.holo }], false, rng);
          record(S, o.slug, o.prix, o.holo, now);
          bump(S, "achats");
          events.push({ type: "offre-acceptee", o, eclats: g.eclats });
        }
      });
      // offres reçues : d'autres joueurs veulent vos cartes
      S.offresRecues = S.offresRecues.filter((o) => o.fin > now && (o.holo ? holoCount(S, o.slug) : plainCount(S, o.slug)) > 0);
      const mine = Object.keys(S.owned);
      if (mine.length && S.offresRecues.length < OF.recues && rng() < 1 - Math.exp(-dt / (2 * 60e3))) {
        const slug = mine[Math.floor(rng() * mine.length)], holo = holoCount(S, slug) > 0 && rng() < 0.5;
        const o = { id: "r" + S.nextId++, slug, holo, prix: Math.max(M.prixMin, Math.round(marketValue(S, slug, holo) * (0.8 + rng() * 0.8))),
          acheteur: bidder(rng), cree: now, fin: now + OF.dureeRecueH * H };
        S.offresRecues.push(o);
        events.push({ type: "offre-recue", o });
      }
      return events.concat(tickTrades(S, now, dt, rng));
    }

    return {
      ORDER, RAR, rank, chars, bySlug, franchises, packs, packById, rankIndex, rankLock,
      total, isValidTable, drawFrom, problems, eligible, emptyRarities, drawPack,
      newState, rankOf, rankInfo, seasonInfo, checkSeason, openPack, viewSheet, claimDaily, dailyDone,
      dayKey, weekKey, packDuJour, freeStatus, freeOffers,
      statValue, defisList, claimable, claimDefi, craft, holoCount, plainCount, give,
      refPrice, quickSellValue, quickSell, duplicatesValue, quickSellDuplicates,
      netOf, activeListings, canSell, listCard, cancelListing, buyListing, tickMarket, marketValue,
      minBid, createAuction, bid, postOffer, cancelOffer, acceptOffer, toggleWish, toggleShowcase, collectionValue,
      tradeValue, proposeTrade, cancelTrade, acceptTrade, declineTrade,
    };
  }

  const Engine = { create, H };
  if (typeof module !== "undefined") module.exports = Engine;
  else root.Engine = Engine;
})(this);
