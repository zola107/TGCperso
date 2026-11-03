(() => {
  "use strict";

  /* ============================================================
     MOTEUR + RÉGLAGES (config.js, data.js, engine.js)
     En vrai projet, le moteur tourne sur le serveur.
     ============================================================ */
  const G = Engine.create(CONFIG, CHARACTERS, FRANCHISE_TAGS);
  const { RAR, ORDER } = G;
  const KEY = "rosterium-croquis-v2";
  const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  const now = () => Date.now();

  // couleurs de rareté : elles viennent de la config, pas du CSS
  ORDER.forEach((r) => document.documentElement.style.setProperty("--" + r, RAR[r].c));
  // l'admin refuserait d'enregistrer une table invalide ; ici on prévient au chargement
  G.problems().forEach((p) => console.warn("[réglages]", p));

  /* ============================================================
     ÉTAT (localStorage : uniquement pour ce croquis)
     ============================================================ */
  let S = load();
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s) return clean({ ...G.newState(now()), ...s });
    } catch {}
    return G.newState(now());
  }
  // une sauvegarde peut citer des cartes retirées du catalogue : on les oublie
  function clean(s) {
    s.marche = s.marche.filter((a) => G.bySlug[a.slug]);
    s.annonces = s.annonces.filter((a) => G.bySlug[a.slug]);
    s.recent = s.recent.filter((x) => G.bySlug[x]);
    Object.keys(s.owned).forEach((k) => { if (!G.bySlug[k]) delete s.owned[k]; });
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const hue = (str) => [...str].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 7);
  const num = (n) => Math.round(n).toLocaleString("fr-FR");
  const coin = (n) => `<span class="coin" aria-hidden="true"></span>${num(n)}`;
  const pct = (n) => n.toLocaleString("fr-FR") + " %";
  const plural = (n, w) => `${num(n)} ${w}${n > 1 ? "s" : ""}`;
  const gem = (r, cls) => EMBLEMS.gem(r, cls);
  const rankBadge = (r, cls) => EMBLEMS.rank(r.id, cls).replace("<svg ", `<svg style="--rk:${r.c}" `);
  const no = (c) => c.id.replace("PDX-", "#");
  const span = (ms) => {
    if (ms <= 0) return "maintenant";
    const h = Math.floor(ms / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1e3);
    return h ? `${h} h ${String(m).padStart(2, "0")}` : m ? `${m} min ${String(s).padStart(2, "0")}` : `${s} s`;
  };
  // compte à rebours qui se met à jour tout seul (voir l'horloge en bas)
  const until = (t) => `<span data-until="${t}">${span(t - now())}</span>`;

  /* ============================================================
     CARTES
     ============================================================ */
  // illustration : les artworks officiels détourés (Pokémon) sont affichés en entier ;
  // les images Wikipédia (souvent avec un fond) remplissent la carte.
  // Si l'image ne charge pas, l'initiale du personnage la remplace.
  const isCutout = (src) => src.includes("official-artwork") || /\.svg/i.test(src);
  const artImg = (c) => `<img class="${isCutout(c.image) ? "cutout" : "photo"}" src="${c.image}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.nextElementSibling.hidden=false;this.remove()">`;
  function cardHTML(c, o = {}) {
    const locked = o.locked, qty = S.owned[c.slug] || 0, img = !locked && c.image;
    const badge = o.isNew ? `<span class="badge">Nouveau</span>` : o.dup ? `<span class="badge dup">Doublon</span>` : "";
    const q = !o.noQty && qty > 1 ? `<span class="qty">×${qty}</span>` : "";
    return `<div class="card-wrap"><div class="card${locked ? " locked" : ""}" data-r="${c.rarete}" ${locked ? "" : `data-slug="${c.slug}" tabindex="0"`}>
      <div class="card-in">
        <div class="art" style="--h:${hue(c.franchise)}">${img ? artImg(c) : ""}<span class="initial" ${img ? "hidden" : ""}>${locked ? "?" : c.nom[0]}</span></div>
        <div class="card-head">${gem(c.rarete, "gem card-gem")}<span class="card-id">${no(c)}</span></div>
        ${badge}${q}
        <div class="plate">
          <div class="card-name">${locked ? "???" : c.nom}</div>
          <div class="card-sub">${locked ? RAR[c.rarete].nom : c.franchise}</div>
        </div>
        <div class="card-foot"><span>${RAR[c.rarete].nom}</span><span>${c.annee}</span></div>
      </div></div></div>`;
  }
  // vignette carrée pour les listes (Codex, Marché)
  const thumb = (c) => `<span class="thumb" data-r="${c.rarete}" style="--h:${hue(c.franchise)}">${c.image ? artImg(c) : ""}<span ${c.image ? "hidden" : ""}>${c.nom[0]}</span>${gem(c.rarete, "gem thumb-gem")}</span>`;

  // inclinaison 3D + reflet qui suit le curseur
  document.addEventListener("mousemove", (e) => {
    const card = e.target.closest(".card:not(.locked)");
    if (!card || card.closest(".face")) return; // pas d'inclinaison pendant l'ouverture
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.style.setProperty("--ry", (x - 0.5) * 16 + "deg");
    card.style.setProperty("--rx", (0.5 - y) * 16 + "deg");
    card.style.setProperty("--mx", x * 100 + "%");
    card.style.setProperty("--my", y * 100 + "%");
  });
  document.addEventListener("mouseout", (e) => {
    const card = e.target.closest(".card");
    if (card && !card.contains(e.relatedTarget)) { card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); }
  });

  /* ============================================================
     PORTEFEUILLE (barre latérale)
     ============================================================ */
  function renderWallet() {
    const k = G.rankInfo(S.xp), f = G.freeStatus(S, now()), offers = freeCount();
    $("#wallet").innerHTML = `
      <div class="w-row w-coins" title="Coins"><span class="w-label">Coins</span><b>${coin(S.coins)}</b></div>
      <a class="w-row w-rank" href="#hub" title="${num(S.xp)} XP">
        ${rankBadge(k.r, "rank-emblem w-emblem")}
        <span class="w-rank-text"><span class="w-label">Rang</span><b>${k.label}</b>
        <span class="bar"><i style="width:${k.p * 100}%"></i></span>
        <small>${k.next ? `${num(S.xp)} / ${num(k.to)} XP · ${k.next}` : `${num(S.xp)} XP · rang maximum`}</small></span>
      </a>
      <a class="w-row w-free${f.stock ? " ready" : ""}" href="#boutique">
        <span class="pips">${Array.from({ length: f.max }, (_, i) => `<i class="${i < f.stock ? "on" : ""}"></i>`).join("")}</span>
        <span><span class="w-label">Pack Aléatoire</span><b>${f.stock ? `${f.stock} à ouvrir` : `dans ${until(f.next)}`}</b></span>
      </a>`;
    $("#nav-free").hidden = !offers;
  }
  // nombre de récompenses en attente (pastille sur « Boutique »)
  function freeCount() {
    const o = G.freeOffers(S, now());
    return o.aleatoire.stock + (o.jour && o.jour.dispo ? 1 : 0) + o.bons.reduce((a, b) => a + b.n, 0) + (G.dailyDone(S, now()) ? 0 : 1);
  }
  function toast(msg) {
    const t = $("#toast"); t.innerHTML = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 3000);
  }
  const persist = () => { save(); renderWallet(); };

  /* ============================================================
     APPARENCE : style + mode clair/sombre (préférence de ce navigateur)
     Les couleurs de chaque style sont dans style.css ; ajouter un style,
     c'est une ligne ici + deux blocs de jetons là-bas.
     ============================================================ */
  const STYLES = [
    { id: "neon",   nom: "Néon",   desc: "Électrique, contrasté",  sw: ["#0b0d12", "#2ee6d6", "#ff3d81"] },
    { id: "holo",   nom: "Holo",   desc: "Nacré, irisé, pastel",   sw: ["#f6f2ea", "#ff8fc8", "#7fd8ff"] },
    { id: "arcade", nom: "Arcade", desc: "Pixel, borne, phosphore", sw: ["#0b0b10", "#ffd23f", "#ff4f4f"] },
    { id: "royal",  nom: "Royal",  desc: "Noir, or et velours",     sw: ["#0f0c09", "#d9b25f", "#7a1e32"] },
  ];
  const html = document.documentElement;
  const systemLight = matchMedia("(prefers-color-scheme: light)");
  const pref = (k, v) => { try { v === undefined ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
  const stored = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const ICON = {
    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/></svg>`,
  };
  function setStyle(id) {
    if (!STYLES.some((s) => s.id === id)) id = "neon";
    html.dataset.style = id;
    pref("rosterium-style", id);
    renderStyleMenu();
  }
  function setMode(mode) {
    html.dataset.mode = mode;
    const dark = mode === "dark";
    $("#mode-btn").innerHTML = (dark ? ICON.sun : ICON.moon) + `<span class="prefs-label">${dark ? "Clair" : "Sombre"}</span>`;
    $("#mode-btn").setAttribute("aria-label", dark ? "Passer en mode clair" : "Passer en mode sombre");
    $("#mode-btn").title = dark ? "Mode clair" : "Mode sombre";
  }
  function renderStyleMenu() {
    $("#style-menu").innerHTML = `<p>Style</p>` + STYLES.map((s) => `
      <button class="style-opt" role="menuitemradio" aria-checked="${html.dataset.style === s.id}" data-style-id="${s.id}">
        <span class="swatch">${s.sw.map((c) => `<i style="background:${c}"></i>`).join("")}</span>
        <span><b>${s.nom}</b><small>${s.desc}</small></span>
      </button>`).join("");
  }
  function toggleStyleMenu(open = $("#style-menu").hidden) {
    $("#style-menu").hidden = !open;
    $("#style-btn").setAttribute("aria-expanded", open);
  }
  // sans choix enregistré, le mode suit l'appareil (même s'il change en cours de route)
  systemLight.addEventListener("change", (e) => { if (!stored("rosterium-mode")) setMode(e.matches ? "light" : "dark"); });
  setStyle(html.dataset.style);
  setMode(html.dataset.mode);

  /* ============================================================
     ROUTEUR (navigation par #ancres)
     ============================================================ */
  const VIEWS = ["hub", "boutique", "classeur", "codex", "marche"];
  const OLD = { accueil: "hub", packs: "boutique", collection: "classeur", explorer: "codex" };
  const current = () => VIEWS.find((x) => !$("#" + x).hidden);
  const RENDER = () => ({ hub: renderHub, boutique: renderShop, classeur: renderBinder, codex: renderCodex, marche: renderMarket });
  function route() {
    const id = (location.hash || "#hub").slice(1);
    const v = VIEWS.includes(id) ? id : OLD[id] || "hub";
    VIEWS.forEach((x) => ($("#" + x).hidden = x !== v));
    $$("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.v === v));
    closeModal();
    RENDER()[v]();
    window.scrollTo(0, 0);
  }
  const refresh = () => { RENDER()[current()](); renderWallet(); };
  const head = (n, title, sub, side = "") => `
    <header class="page-head">
      <div><p class="kicker"><span>${String(n).padStart(2, "0")}</span>${title}</p><h1>${sub}</h1></div>
      ${side ? `<div class="page-side">${side}</div>` : ""}
    </header>`;

  /* ============================================================
     01 · HUB
     ============================================================ */
  function renderHub() {
    const t = now(), day = Math.floor(t / 864e5), list = G.chars;
    const spot = list[(day * 7) % list.length];
    const k = G.rankInfo(S.xp);
    const have = list.filter((c) => S.owned[c.slug]).length;
    const daily = dailyBlock();
    const recent = S.recent.map((s) => G.bySlug[s]).filter(Boolean);
    const date = new Date(t).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

    $("#hub").innerHTML = head(1, "Hub", `Session du ${date}`) + `
      <div class="hub">
        <section class="panel p-free">${freeBlock(true)}</section>
        <section class="panel p-daily">${daily}</section>

        <section class="panel p-spot">
          <div class="spot-card">${cardHTML(spot, { noQty: true })}</div>
          <div class="spot-text">
            <p class="label">Personnage du jour</p>
            <h2>${spot.nom}</h2>
            <p class="spot-meta">${spot.franchise} · ${spot.jeu} · ${spot.annee}</p>
            <p>${spot.resume}</p>
            <button class="btn ghost sm" data-open="${spot.slug}">Lire la fiche</button>
          </div>
        </section>

        <section class="panel p-rank">
          <div class="panel-head"><p class="label">Parcours classé</p><b>${k.label}</b></div>
          <ol class="ladder">${CONFIG.ranks.map((r, i) => `
            <li class="${i < k.i ? "done" : i === k.i ? "here" : ""}">
              ${rankBadge(r)}<span>${r.nom}</span><small>${num(r.xp)}</small>
            </li>`).join("")}</ol>
          <div class="bar thick"><i style="width:${k.p * 100}%"></i></div>
          <p class="muted small">${k.next ? `${num(k.to - S.xp)} XP avant ${k.next}` : "Rang maximum atteint"} · nouvelle carte +${CONFIG.xp.nouvelle} XP, doublon +${CONFIG.xp.doublon}, franchise complétée +${CONFIG.xp.franchise}</p>
        </section>

        <section class="panel p-coll">
          <div class="panel-head"><p class="label">Collection</p><a href="#classeur">Ouvrir le classeur</a></div>
          <p class="big-num">${have}<small>/ ${list.length}</small></p>
          <div class="stack">${ORDER.map((r) => {
            const got = list.filter((c) => c.rarete === r && S.owned[c.slug]).length;
            return got ? `<i style="flex:${got};background:var(--${r})" title="${RAR[r].nom} : ${got}"></i>` : "";
          }).join("")}<i class="rest" style="flex:${list.length - have}"></i></div>
          <ul class="legend">${ORDER.map((r) => {
            const all = list.filter((c) => c.rarete === r), got = all.filter((c) => S.owned[c.slug]).length;
            return `<li>${gem(r)}<span>${RAR[r].nom}</span><b>${got}/${all.length}</b></li>`;
          }).join("")}</ul>
        </section>

        <section class="panel p-pulls">
          <div class="panel-head"><p class="label">Derniers tirages</p><span class="muted small">${recent.length ? plural(recent.length, "carte") : ""}</span></div>
          ${recent.length ? `<div class="pulls">${recent.map((c) => cardHTML(c, { noQty: true })).join("")}</div>`
            : `<p class="empty-note">Rien pour l'instant. Votre premier Pack Aléatoire est offert : ouvrez-le ci-dessus.</p>`}
        </section>
      </div>
      ${tickerHTML()}`;
  }

  function freeBlock(compact) {
    const t = now(), o = G.freeOffers(S, t), a = o.aleatoire, P = G.packById("aleatoire");
    return `
      <div class="panel-head"><p class="label">Packs gratuits</p><span class="muted small">+1 toutes les ${CONFIG.gratuit.aleatoire.intervalH} h · ${a.max} max</span></div>
      <div class="free">
        <div class="free-slots">${Array.from({ length: a.max }, (_, i) => i < a.stock
          ? `<button class="mini-pack" style="--a:${P.c}" data-pack="aleatoire" data-pay="gratuit" aria-label="Ouvrir un Pack Aléatoire"><span>5</span></button>`
          : `<span class="mini-pack empty"><span>${i === a.stock ? until(a.next) : ""}</span></span>`).join("")}</div>
        <div class="free-text">
          <h3>${P.nom}</h3>
          <p>Tout le catalogue, au moins 1 Rare. Mythique ${pct(CONFIG.standardOdds.mythique)} et Spectaculaire ${pct(CONFIG.standardOdds.spectaculaire)} par carte.</p>
          <div class="row">
            <button class="btn" data-pack="aleatoire" data-pay="gratuit" ${a.stock ? "" : "disabled"}>${a.stock ? `Ouvrir (${a.stock})` : `Prochain dans ${until(a.next)}`}</button>
            <button class="btn ghost sm" data-odds="aleatoire">Probabilités</button>
          </div>
        </div>
      </div>
      ${!compact ? "" : o.jour ? `
      <div class="free-line" style="--a:${o.jour.pack.c}">
        <span class="mini-pack sm" style="--a:${o.jour.pack.c}"></span>
        <span><span class="label">Pack du jour</span><b>${o.jour.pack.nom}</b></span>
        ${o.jour.dispo ? `<button class="btn sm" data-pack="${o.jour.pack.id}" data-pay="jour">Offert</button>` : `<span class="muted small">Ouvert · nouveau thème dans ${until(nextMidnight())}</span>`}
      </div>` : ""}
      ${compact ? o.bons.map((b) => `
      <div class="free-line" style="--a:${b.pack.c}">
        <span class="mini-pack sm" style="--a:${b.pack.c}"></span>
        <span><span class="label">Bon de série ×${b.n}</span><b>${b.pack.nom}</b></span>
        <button class="btn sm" data-pack="${b.pack.id}" data-pay="bon">Utiliser</button>
      </div>`).join("") : ""}`;
  }
  const nextMidnight = () => { const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime(); };

  function dailyBlock() {
    const t = now(), done = G.dailyDone(S, t), sr = CONFIG.gratuit.serie;
    // série affichée : si on n'a pas récupéré hier ni aujourd'hui, elle repart à 0
    const yest = (() => { const d = new Date(t); d.setDate(d.getDate() - 1); return G.dayKey(d.getTime()); })();
    const alive = done || S.serie.last === yest;
    const n = alive ? S.serie.n : 0;
    const inCycle = n % sr.jours === 0 && n ? sr.jours : n % sr.jours;
    const monday = S.hebdo !== G.weekKey(t);
    return `
      <div class="panel-head"><p class="label">Connexion quotidienne</p><span class="muted small">Série : ${plural(n, "jour")}</span></div>
      <ol class="streak">${Array.from({ length: sr.jours }, (_, i) => `
        <li class="${i < inCycle ? "on" : ""}${i === sr.jours - 1 ? " gift" : ""}"><span>J${i + 1}</span>${i === sr.jours - 1 ? gem("epique") : `<b>+${CONFIG.economy.quotidien}</b>`}</li>`).join("")}</ol>
      <div class="row">
        <button class="btn" id="daily" ${done ? "disabled" : ""}>${done ? `Revenez dans ${until(nextMidnight())}` : `Récupérer +${coin(CONFIG.economy.quotidien + (monday ? CONFIG.economy.hebdo : 0))}`}</button>
        <span class="muted small">${monday && !done ? `dont +${num(CONFIG.economy.hebdo)} de bonus de la semaine` : `7 jours d'affilée : 1 ${G.packById(sr.bon).nom} offert`}</span>
      </div>`;
  }

  function tickerHTML() {
    const items = [...S.marche].sort((a, b) => b.cree - a.cree).slice(0, 14).map((a) => {
      const c = G.bySlug[a.slug], d = Math.round((a.prix / RAR[c.rarete].prix - 1) * 100);
      return `<span class="tk">${gem(c.rarete)}<b>${c.nom}</b>${num(a.prix)}<em class="${d >= 0 ? "up" : "down"}">${d >= 0 ? "▲" : "▼"} ${Math.abs(d)} %</em></span>`;
    }).join("");
    return items ? `<a class="ticker" href="#marche" aria-label="Voir le marché"><span class="tk-label">Marché</span><div class="tk-track"><div class="tk-run">${items}${items}</div></div></a>` : "";
  }

  /* ============================================================
     FENÊTRE (fiche, probabilités, mise en vente)
     ============================================================ */
  function showModal(inner, cls = "") {
    $("#modal").hidden = false;
    $("#modal").innerHTML = `<article class="sheet ${cls}" role="dialog" aria-modal="true"><button class="close" aria-label="Fermer">✕</button>${inner}</article>`;
  }
  function closeModal() { $("#modal").hidden = true; $("#modal").innerHTML = ""; }

  function openSheet(slug) {
    const c = G.bySlug[slug]; if (!c) return;
    if (G.viewSheet(S, slug)) persist();
    const same = G.chars.filter((x) => x.franchise === c.franchise && x !== c);
    const qty = S.owned[c.slug] || 0;
    const tags = c.tags.map((t) => CONFIG.themePacks.list.find((x) => x.tag === t)).filter(Boolean);
    showModal(`
      <div class="sheet-card">${cardHTML(c, { noQty: true })}</div>
      <div class="sheet-body">
        <p class="kicker"><span>${no(c)}</span>${c.franchise}</p>
        <h2>${c.nom}</h2>
        <p class="sheet-tags"><span class="tag" style="--c:var(--${c.rarete})">${gem(c.rarete)}${RAR[c.rarete].nom}</span>${tags.map((t) => `<span class="tag" style="--c:${t.c}">${t.nom}</span>`).join("")}</p>
        <p class="sheet-resume">${c.resume}</p>
        <dl>
          <dt>Rôle</dt><dd>${c.role}</dd>
          <dt>Alias</dt><dd>${c.alias.length ? c.alias.join(", ") : "—"}</dd>
          <dt>Première apparition</dt><dd>${c.jeu}, ${c.annee}</dd>
          <dt>Exemplaires</dt><dd>${qty ? `×${qty}` : "pas encore obtenue"}</dd>
          <dt>Prix de référence</dt><dd>${coin(RAR[c.rarete].prix)}</dd>
          ${c.source ? `<dt>Source</dt><dd><a class="src" href="${c.source}" target="_blank" rel="noopener">${c.source.includes("pokeapi") ? "PokéAPI" : "Wikipédia"} ↗</a></dd>` : ""}
        </dl>
        ${qty ? `<div class="row">
          <button class="btn" data-sell="${c.slug}">Mettre en vente</button>
          <button class="btn ghost" data-quick="${c.slug}">Vente rapide · +${coin(G.quickSellValue(c.rarete))}</button></div>` : ""}
        ${same.length ? `<p class="label">Même franchise</p><div class="chips">${same.map((x) => `<button data-open="${x.slug}">${gem(x.rarete)}${x.nom}</button>`).join("")}</div>` : ""}
      </div>`, "sheet-char");
  }

  /* ============================================================
     02 · BOUTIQUE
     ============================================================ */
  function oddsBars(table) {
    const max = Math.max(...Object.values(table));
    return ORDER.filter((r) => table[r]).map((r) => `
      <div class="odds-row" style="--c:var(--${r})">${gem(r)}<span>${RAR[r].nom}</span><span class="meter"><i style="width:${Math.max((table[r] / max) * 100, 1.5)}%"></i></span><b>${pct(table[r])}</b></div>`).join("");
  }
  const pityText = () => Object.entries(CONFIG.pity).map(([r, n]) => `après ${n} packs sans ${RAR[r].nom} ou mieux, la carte garantie passe ${RAR[r].nom}`).join(" ; ");
  function packDesc(p) {
    if (p.kind === "rarete") return `4 cartes au tirage standard + ${p.label.charAt(0).toLowerCase() + p.label.slice(1)}.`;
    if (p.kind === "gratuit") return `Tout le catalogue · au moins 1 ${RAR[p.minRarity].nom}.`;
    const n = G.chars.filter(p.filter).length;
    return `${plural(n, "personnage")} · au moins 1 ${RAR[p.minRarity].nom}.`;
  }
  // un pack dessiné comme un vrai sachet : bords sertis, marque, titre vertical
  const wrapper = (p, sm) => `
    <div class="wrapper${sm ? " sm" : ""}" style="--a:${p.c}" aria-hidden="true">
      <span class="wr-brand">Rosterium</span>
      <span class="wr-title">${p.kind === "theme" ? p.theme : p.nom.replace("Pack ", "")}</span>
      <span class="wr-gem">${gem(p.kind === "rarete" ? Object.keys(p.garantie)[0] : p.minRarity)}</span>
      <span class="wr-count">5 cartes</span>
    </div>`;
  function shopItem(p) {
    return `<article class="shop-item">
      ${wrapper(p)}
      <div class="si-body">
        <h3>${p.nom}</h3>
        <p>${packDesc(p)}</p>
        <div class="si-foot">
          <button class="btn sm" data-pack="${p.id}" data-pay="coins" ${S.coins < p.prix ? "disabled" : ""}>${coin(p.prix)}</button>
          <button class="link" data-odds="${p.id}">Probabilités</button>
        </div>
      </div>
    </article>`;
  }
  function renderShop() {
    const o = G.freeOffers(S, now());
    const pity = Object.entries(CONFIG.pity).map(([r, n]) => `
      <div class="odds-row" style="--c:var(--${r})">${gem(r)}<span>${RAR[r].nom}+</span><span class="meter"><i style="width:${Math.min(100, ((S.pity[r] || 0) / n) * 100)}%"></i></span><b>${S.pity[r] || 0}/${n}</b></div>`).join("");
    const jour = o.jour && G.packById(o.jour.pack.id);
    $("#boutique").innerHTML = head(2, "Boutique", "Packs", `<span class="muted">Solde</span><b class="solde">${coin(S.coins)}</b>`) + `
      <section class="shop-free">
        <div class="panel free-main">${freeBlock(false)}</div>
        ${jour ? `<div class="panel free-day">
          <div class="panel-head"><p class="label">Pack du jour</p><span class="muted small">change à minuit</span></div>
          <div class="free-day-in">${wrapper(jour, true)}
            <div><h3>${jour.nom}</h3><p class="muted small">${packDesc(jour)}</p>
            ${o.jour.dispo ? `<button class="btn sm" data-pack="${jour.id}" data-pay="jour">Ouvrir gratuitement</button>` : `<p class="muted small">Déjà ouvert · prochain dans ${until(nextMidnight())}</p>`}</div></div>
        </div>` : ""}
        <div class="panel free-side">
          <div class="panel-head"><p class="label">Compteur de chance</p></div>
          ${pity}
          <p class="muted small">Packs d'affilée sans cette rareté. Au maximum, la prochaine carte garantie monte d'un cran.</p>
          ${o.bons.length ? `<div class="panel-head"><p class="label">Bons</p></div>` + o.bons.map((b) => `
            <div class="free-line"><span class="mini-pack sm" style="--a:${b.pack.c}"></span><span><b>${b.pack.nom}</b><small class="muted"> ×${b.n}</small></span><button class="btn sm" data-pack="${b.pack.id}" data-pay="bon">Utiliser</button></div>`).join("") : ""}
        </div>
      </section>
      <section class="shelf-block">
        <div class="shelf-head"><h2>Packs de rareté</h2><p class="muted">4 cartes standard + 1 carte garantie.</p></div>
        <div class="shelf">${G.packs.filter((p) => p.kind === "rarete").map(shopItem).join("")}</div>
      </section>
      <section class="shelf-block">
        <div class="shelf-head"><h2>Packs thématiques</h2><p class="muted">${coin(CONFIG.themePacks.prix)} · 5 cartes du thème, au moins 1 Rare.</p></div>
        <div class="shelf">${G.packs.filter((p) => p.kind === "theme").map(shopItem).join("")}</div>
      </section>`;
  }

  function showOdds(id) {
    const p = G.packById(id); if (!p) return;
    let body;
    if (p.kind === "rarete") {
      body = `<h3>Cartes 1 à 4 · tirage standard</h3>${oddsBars(CONFIG.standardOdds)}
        <h3>Carte 5 · garantie</h3>${oddsBars(p.garantie)}
        <p class="note"><b>${p.label}.</b></p>`;
    } else {
      const empty = p.kind === "theme" ? G.emptyRarities(p) : [];
      body = `<h3>Chaque carte · tirage standard</h3>${oddsBars(CONFIG.standardOdds)}
        <p class="note">Si aucune des ${CONFIG.packSize} cartes n'est ${RAR[p.minRarity].nom} ou mieux, la dernière est retirée parmi les raretés ${RAR[p.minRarity].nom} et plus (mêmes proportions).</p>
        ${p.kind === "theme" ? `<h3>Personnages du thème</h3>
        <div class="legend inline">${ORDER.map((r) => `<span>${gem(r)}${RAR[r].nom} <b>${G.eligible(p, r).length}</b></span>`).join("")}</div>
        ${empty.length ? `<p class="note">Aucun personnage ${empty.map((r) => RAR[r].nom).join(", ")} dans ce thème : pour ces raretés, la carte est tirée dans tout le catalogue.</p>` : ""}` : ""}`;
    }
    const pay = p.kind === "gratuit"
      ? `<button class="btn" data-pack="${p.id}" data-pay="gratuit" ${G.freeStatus(S, now()).stock ? "" : "disabled"}>Ouvrir gratuitement</button>`
      : `<button class="btn" data-pack="${p.id}" data-pay="coins" ${S.coins < p.prix ? "disabled" : ""}>Ouvrir · ${coin(p.prix)}</button>`;
    showModal(`<div class="odds-sheet">
      <div class="odds-top">${wrapper(p, true)}<div><p class="kicker">Probabilités</p><h2>${p.nom}</h2><p class="muted">${p.prix ? coin(p.prix) + " · " : "Gratuit · "}${CONFIG.packSize} cartes</p></div></div>
      ${body}
      <p class="note">Compteur de chance : ${pityText()}.</p>
      <div class="row">${pay}</div>
    </div>`, "narrow");
  }

  /* ============================================================
     OUVERTURE
     ============================================================ */
  let opening = null;
  function openPack(id, pay = "coins") {
    const before = G.rankInfo(S.xp).label;
    const res = G.openPack(S, id, now(), rand, pay); // en vrai : appel au serveur
    if (res.error) return toast(res.error);
    const after = G.rankInfo(S.xp);
    res.rankUp = after.label !== before ? after : null;
    persist();
    closeModal();
    opening = res;

    // la ligne de déchirure : la même dentelure découpe le haut et le corps du sachet
    const N = 16, Y = Array.from({ length: N + 1 }, (_, i) => 17 + (i % 2 ? 2.4 : -1.2) + Math.sin(i * 1.7) * 0.8);
    const edge = Y.map((y, i) => `${(i / N) * 100}% ${y}%`);
    const st = $("#stage"); st.hidden = false; st.className = "stage phase-tear";
    st.innerHTML = `<div class="stage-in" style="--a:${res.pack.c}">
      <div class="tear-zone">
        <p class="kicker">${pay === "coins" ? "Acheté" : pay === "bon" ? "Bon utilisé" : "Offert"}</p>
        <h2>${res.pack.nom}</h2>
        <div class="tear" id="tear" tabindex="0" role="button" aria-label="Déchirer le pack">
          <div class="tear-body" style="clip-path:polygon(${edge.join(",")},100% 100%,0 100%)">${wrapper(res.pack)}</div>
          <div class="tear-top" style="clip-path:polygon(0 0,100% 0,${[...edge].reverse().join(",")})">${wrapper(res.pack)}</div>
          <span class="tear-guide" aria-hidden="true"><i></i></span>
          <span class="tear-flash" aria-hidden="true"></span>
        </div>
        <p class="stage-hint">Glissez le long du haut du pack pour le déchirer</p>
        <button class="btn ghost sm" id="tear-btn">Ouvrir sans glisser</button>
      </div>
      <div class="stage-body">
        <p class="stage-hint">Touchez une carte pour la retourner.</p>
        <div class="reveal">${res.cards.map((x, i) => `
          <div class="flip" data-r="${x.c.rarete}" style="--c:var(--${x.c.rarete})" role="button" tabindex="0" aria-label="Retourner la carte ${i + 1}">
            <div class="flip-in">
              <div class="face back"><span class="back-mark"><i></i><i></i></span><span class="back-name">Rosterium</span></div>
              <div class="face front">${cardHTML(x.c, { isNew: x.isNew, dup: !x.isNew, noQty: true })}</div>
            </div></div>`).join("")}</div>
        <div class="recap" id="recap" hidden></div>
        <div class="stage-actions" id="stage-actions"><button class="btn ghost" id="reveal-all">Tout retourner</button></div>
      </div></div>`;
  }

  /* --- déchirer le pack : on suit le doigt / la souris le long du haut --- */
  let tearing = null;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function setTear(t) { $("#tear").style.setProperty("--t", t.toFixed(3)); }
  document.addEventListener("pointerdown", (e) => {
    const tear = e.target.closest("#tear");
    if (!tear || $("#stage").classList.contains("torn")) return;
    tear.setPointerCapture(e.pointerId);
    tearing = { x: e.clientX, w: tear.getBoundingClientRect().width, moved: false };
    tear.classList.add("dragging");
  });
  document.addEventListener("pointermove", (e) => {
    if (!tearing) return;
    const t = Math.max(0, Math.min(1, (e.clientX - tearing.x) / (tearing.w * 0.9)));
    if (t > 0.02) tearing.moved = true;
    setTear(t);
    if (t >= 1) finishTear();
  });
  document.addEventListener("pointerup", () => {
    if (!tearing) return;
    const t = Number($("#tear").style.getPropertyValue("--t") || 0), moved = tearing.moved;
    tearing = null;
    $("#tear").classList.remove("dragging");
    if (t > 0.5 || !moved) finishTear(); // un simple appui ouvre aussi le pack
    else setTear(0);                     // pas assez tiré : le haut se remet en place
  });
  function finishTear() {
    const st = $("#stage");
    if (!st || st.classList.contains("torn")) return;
    tearing = null;
    setTear(1);
    st.classList.add("torn");
    // les cartes sortent du sachet : chacune part du centre du pack vers sa place
    const p = $("#tear").getBoundingClientRect(), px = p.left + p.width / 2, py = p.top + p.height * 0.3;
    setTimeout(() => {
      st.classList.remove("phase-tear"); st.classList.add("phase-deal");
      $$(".flip").forEach((f, i) => {
        const r = f.getBoundingClientRect();
        f.style.setProperty("--dx", `${px - (r.left + r.width / 2)}px`);
        f.style.setProperty("--dy", `${py - (r.top + r.height / 2)}px`);
        f.style.setProperty("--rot", `${(i - 2) * 7}deg`);
        f.style.animationDelay = `${i * 90}ms`;
      });
    }, reduced.matches ? 0 : 800);
  }

  /* --- retourner : la carte se soulève, pivote d'un seul geste, puis se repose --- */
  function flip(el) {
    if (!$("#stage").classList.contains("phase-deal") || el.classList.contains("lift")) return;
    const r = el.dataset.r, big = G.rank(r) >= G.rank("epique");
    el.classList.add("lift"); // le dos trahit la rareté pendant qu'elle se soulève
    setTimeout(() => {
      el.classList.add("on");
      if (r === "spectaculaire") {
        const st = $("#stage"); st.classList.remove("spectacle"); void st.offsetWidth; st.classList.add("spectacle");
      }
      setTimeout(() => {
        el.classList.add("settled");
        if ($$(".flip").every((f) => f.classList.contains("settled"))) showRecap();
      }, r === "spectaculaire" ? 950 : 720);
    }, big ? 560 : 280); // plus la rareté est haute, plus le suspense dure
  }
  function revealAll() {
    $$(".flip:not(.lift)").forEach((f, i) => setTimeout(() => flip(f), i * 360));
  }
  function nextOpenButton(p) {
    if (p.kind === "gratuit") {
      const n = G.freeStatus(S, now()).stock;
      return n ? `<button class="btn" data-pack="aleatoire" data-pay="gratuit">Ouvrir le suivant (${n})</button>` : "";
    }
    return `<button class="btn" data-pack="${p.id}" data-pay="coins" ${S.coins < p.prix ? "disabled" : ""}>Ouvrir un autre · ${coin(p.prix)}</button>`;
  }
  function showRecap() {
    const res = opening; if (!res || !$("#recap").hidden) return;
    $(".stage-body > .stage-hint").hidden = true;
    const nb = res.cards.filter((x) => x.isNew).length;
    $("#recap").hidden = false;
    $("#recap").innerHTML = `
      <div class="recap-stats">
        <span><b>+${res.xp}</b>XP</span>
        <span><b>${nb}</b>nouvelle${nb > 1 ? "s" : ""}</span>
        <span><b>${res.cards.length - nb}</b>doublon${res.cards.length - nb > 1 ? "s" : ""}</span>
      </div>
      ${res.completed.map((f) => `<p class="recap-note">Franchise complétée : ${f} · +${CONFIG.xp.franchise} XP</p>`).join("")}
      ${res.pityHit ? `<p class="recap-note">Compteur de chance : carte ${RAR[res.pityHit].nom} garantie.</p>` : ""}
      ${res.rankUp ? `<p class="recap-note rankup">${rankBadge(res.rankUp.r)} Nouveau rang : ${res.rankUp.label}</p>` : ""}`;
    $("#stage-actions").innerHTML = `${nextOpenButton(res.pack)}<button class="btn ghost" id="close-stage">Terminer</button>`;
  }

  /* ============================================================
     03 · CLASSEUR (pages de 9 pochettes, dans l'ordre des numéros)
     ============================================================ */
  const BIN = { r: "", f: "", s: "tous", page: 0 };
  const PER_PAGE = 9;
  const wide = matchMedia("(min-width: 1100px)");
  function renderBinder() {
    const list = G.chars, have = list.filter((c) => S.owned[c.slug]).length;
    const big = G.franchises.filter((f) => list.filter((c) => c.franchise === f).length >= CONFIG.xp.franchiseMin);
    const done = big.filter((f) => S.franchises[f]).length;
    const dupValue = G.duplicatesValue(S);
    $("#classeur").innerHTML = head(3, "Classeur", "Ma collection", `<button class="btn ghost sm" id="sell-dups" ${dupValue ? "" : "disabled"}>Vendre les doublons${dupValue ? ` · +${coin(dupValue)}` : ""}</button>`) + `
      <div class="binder-stats">
        <div><p class="big-num">${have}<small>/ ${list.length}</small></p><p class="muted small">cartes · ${Math.round((have / list.length) * 100)} %</p></div>
        <ul class="legend">${ORDER.map((r) => {
          const all = list.filter((c) => c.rarete === r), got = all.filter((c) => S.owned[c.slug]).length;
          return `<li>${gem(r)}<span>${RAR[r].nom}</span><b>${got}/${all.length}</b></li>`;
        }).join("")}<li class="sep"><span>Franchises complétées</span><b>${done}/${big.length}</b></li></ul>
      </div>
      <div class="toolbar">
        <select id="b-r" aria-label="Rareté"></select>
        <select id="b-f" aria-label="Franchise"></select>
        <div class="seg" role="group" aria-label="Statut">${[["tous", "Toutes"], ["possedees", "Possédées"], ["manquantes", "Manquantes"], ["doublons", "Doublons"]]
          .map(([v, l]) => `<button data-bs="${v}" class="${BIN.s === v ? "on" : ""}">${l}</button>`).join("")}</div>
      </div>
      <div id="binder"></div>`;
    fillSelect($("#b-r"), "Toutes les raretés", ORDER.map((r) => [r, RAR[r].nom]), BIN.r);
    fillSelect($("#b-f"), "Toutes les franchises", G.franchises.map((f) => [f, f]), BIN.f);
    $("#b-r").addEventListener("input", (e) => { BIN.r = e.target.value; BIN.page = 0; renderPages(); });
    $("#b-f").addEventListener("input", (e) => { BIN.f = e.target.value; BIN.page = 0; renderPages(); });
    renderPages();
  }
  function renderPages() {
    const list = G.chars.filter((c) => {
      const q = S.owned[c.slug] || 0;
      return (!BIN.r || c.rarete === BIN.r) && (!BIN.f || c.franchise === BIN.f) &&
        (BIN.s === "tous" || (BIN.s === "possedees" && q) || (BIN.s === "manquantes" && !q) || (BIN.s === "doublons" && q > 1));
    });
    const per = wide.matches ? 2 : 1, pages = Math.max(1, Math.ceil(list.length / PER_PAGE)), spreads = Math.ceil(pages / per);
    BIN.page = Math.min(BIN.page, spreads - 1);
    const first = BIN.page * per;
    const pageHTML = (pi) => {
      const items = list.slice(pi * PER_PAGE, pi * PER_PAGE + PER_PAGE);
      if (pi >= pages) return `<div class="page blank"></div>`;
      return `<div class="page"><div class="pockets">${Array.from({ length: PER_PAGE }, (_, k) => {
        const c = items[k];
        if (!c) return `<div class="pocket none"></div>`;
        return S.owned[c.slug]
          ? `<div class="pocket">${cardHTML(c)}</div>`
          : `<div class="pocket empty" data-r="${c.rarete}"><span class="pocket-no">${no(c)}</span>${gem(c.rarete)}<span class="pocket-r">${RAR[c.rarete].nom}</span></div>`;
      }).join("")}</div><span class="page-no">${pi + 1}</span></div>`;
    };
    $("#binder").innerHTML = list.length ? `
      <div class="spread${per > 1 ? " two" : ""}">${Array.from({ length: per }, (_, k) => pageHTML(first + k)).join("")}</div>
      <div class="pager">
        <button class="btn ghost sm" data-bp="-1" ${BIN.page ? "" : "disabled"} aria-label="Pages précédentes">‹</button>
        <label class="page-jump">Page${per > 1 ? "s" : ""}
          <select id="b-page" aria-label="Aller à la page">${Array.from({ length: spreads }, (_, k) => {
            const a = k * per + 1, b = Math.min(pages, a + per - 1), c0 = list[(a - 1) * PER_PAGE];
            return `<option value="${k}" ${k === BIN.page ? "selected" : ""}>${a}${b > a ? `–${b}` : ""} · ${no(c0)} ${c0.franchise}</option>`;
          }).join("")}</select>
          sur ${pages}</label>
        <button class="btn ghost sm" data-bp="1" ${BIN.page < spreads - 1 ? "" : "disabled"} aria-label="Pages suivantes">›</button>
      </div>` : `<p class="empty-note">Aucune carte ne correspond. Changez de filtre ou ouvrez un pack.</p>`;
    $("#b-page")?.addEventListener("input", (e) => { BIN.page = Number(e.target.value); renderPages(); });
  }
  wide.addEventListener("change", () => { if (current() === "classeur") renderPages(); });

  function sellDuplicates() {
    const gain = G.duplicatesValue(S);
    if (!gain) return toast("Vous n'avez aucun doublon.");
    if (!confirm(`Vendre tous vos doublons au site pour ${num(gain)} coins (${pct(CONFIG.economy.venteRapide * 100)} du prix de référence) ? Une copie de chaque carte est conservée.`)) return;
    G.quickSellDuplicates(S, now()); persist(); refresh();
    toast(`+${coin(gain)}`);
  }
  function quickSellOne(slug) {
    const c = G.bySlug[slug], v = G.quickSellValue(c.rarete);
    const last = (S.owned[slug] || 0) === 1 ? " C'est votre seul exemplaire." : "";
    if (!confirm(`Vendre 1 ${c.nom} au site pour ${v} coins ?${last}`)) return;
    const res = G.quickSell(S, slug, 1, now());
    if (res.error) return toast(res.error);
    persist(); refresh();
    S.owned[slug] ? openSheet(slug) : closeModal();
    toast(`+${coin(res.gain)}`);
  }

  /* ============================================================
     04 · CODEX (encyclopédie : liste par lettre ou grille)
     ============================================================ */
  const CX = { q: "", f: "", th: "", r: "", tri: "az", vue: "liste", limit: 120 };
  function fillSelect(sel, first, items, val = "") {
    sel.innerHTML = `<option value="">${first}</option>` + items.map(([v, l]) => `<option value="${v}" ${v === val ? "selected" : ""}>${l}</option>`).join("");
  }
  function renderCodex() {
    $("#codex").innerHTML = head(4, "Codex", "Personnages", `<div class="seg" role="group" aria-label="Affichage">
        <button data-cv="liste" class="${CX.vue === "liste" ? "on" : ""}">Liste</button><button data-cv="cartes" class="${CX.vue === "cartes" ? "on" : ""}">Cartes</button></div>`) + `
      <div class="toolbar">
        <input id="q" type="search" placeholder="Nom, alias, franchise…" aria-label="Rechercher" value="${CX.q}">
        <select id="c-f" aria-label="Franchise"></select>
        <select id="c-th" aria-label="Thème"></select>
        <select id="c-r" aria-label="Rareté"></select>
        <select id="c-tri" aria-label="Tri">
          <option value="az">A → Z</option><option value="num">Numéro</option><option value="rarete">Rareté</option><option value="annee">Année</option>
        </select>
      </div>
      <p class="count" id="count"></p>
      <div id="codex-list"></div>`;
    fillSelect($("#c-f"), "Toutes les franchises", G.franchises.map((f) => [f, f]), CX.f);
    fillSelect($("#c-th"), "Tous les thèmes", CONFIG.themePacks.list.map((t) => [t.tag, t.nom]), CX.th);
    fillSelect($("#c-r"), "Toutes les raretés", ORDER.map((r) => [r, RAR[r].nom]), CX.r);
    $("#c-tri").value = CX.tri;
    [["#q", "q"], ["#c-f", "f"], ["#c-th", "th"], ["#c-r", "r"], ["#c-tri", "tri"]].forEach(([s, k]) =>
      $(s).addEventListener("input", (e) => { CX[k] = e.target.value; CX.limit = CX_STEP; renderCodexList(); }));
    renderCodexList();
  }
  function renderCodexList() {
    const q = CX.q.trim().toLowerCase();
    const list = G.chars.filter((c) =>
      (!CX.f || c.franchise === CX.f) && (!CX.th || c.tags.includes(CX.th)) && (!CX.r || c.rarete === CX.r) &&
      (!q || [c.nom, c.franchise, c.jeu, ...c.alias].join(" ").toLowerCase().includes(q)));
    list.sort((a, b) =>
      CX.tri === "rarete" ? G.rank(b.rarete) - G.rank(a.rarete) || a.nom.localeCompare(b.nom)
      : CX.tri === "annee" ? a.annee - b.annee
      : CX.tri === "num" ? a.id.localeCompare(b.id) : a.nom.localeCompare(b.nom));
    $("#count").textContent = plural(list.length, "personnage");
    if (!list.length) { $("#codex-list").innerHTML = `<p class="empty-note">Aucun résultat. Essayez un autre nom ou retirez un filtre.</p>`; return; }
    // 1000 fiches : on affiche par tranches, la suite arrive quand on descend
    const shown = list.slice(0, CX.limit), rest = list.length - shown.length;
    const more = rest ? `<button class="btn ghost more" id="cx-more">Afficher ${Math.min(rest, CX_STEP)} de plus · reste ${num(rest)}</button>` : "";
    if (CX.vue === "cartes") { $("#codex-list").innerHTML = `<div class="grid">${shown.map((c) => cardHTML(c, { noQty: true })).join("")}</div>${more}`; return watchMore(); }
    // liste : groupée par lettre (tri A→Z) ou en une seule table
    const key = (c) => CX.tri === "az" ? c.nom[0].toUpperCase() : "";
    let last = null, out = "";
    shown.forEach((c) => {
      const k = key(c);
      if (k !== last) { out += `${last !== null ? "</div>" : ""}${k ? `<h3 class="letter">${k}</h3>` : ""}<div class="rows">`; last = k; }
      const q = S.owned[c.slug] || 0;
      out += `<button class="row-c" data-open="${c.slug}">
        <span class="mono">${no(c)}</span>${thumb(c)}
        <span class="rc-name"><b>${c.nom}</b><small>${c.alias.length ? c.alias.join(" · ") : c.role}</small></span>
        <span class="rc-fr"><b>${c.franchise}</b><small>${c.jeu}</small></span>
        <span class="mono rc-year">${c.annee}</span>
        <span class="rc-r rt" style="--c:var(--${c.rarete})">${gem(c.rarete)}${RAR[c.rarete].nom}</span>
        <span class="rc-own ${q ? "yes" : ""}">${q ? `×${q}` : "—"}</span>
      </button>`;
    });
    $("#codex-list").innerHTML = out + "</div>" + more;
    watchMore();
  }
  const CX_STEP = 120;
  const moreObserver = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) $("#cx-more")?.click(); }, { rootMargin: "600px" });
  function watchMore() { moreObserver.disconnect(); if ($("#cx-more")) moreObserver.observe($("#cx-more")); }

  /* ============================================================
     05 · MARCHÉ
     ============================================================ */
  const M = CONFIG.market;
  let mTab = "acheter";
  const MF = { r: "", f: "", max: "", miss: false, tri: "prix" };
  function renderMarket() {
    const tabs = [["acheter", "Acheter"], ["ventes", "Mes ventes"], ["prix", "Prix de référence"]];
    $("#marche").innerHTML = head(5, "Marché", "Échanges", `<span class="muted small">Commission ${pct(M.commission * 100)} · annonces ${M.dureeH} h · <em>vendeurs simulés (prototype)</em></span>`) + `
      <div class="tabs" role="tablist">${tabs.map(([id, l]) => `<button role="tab" aria-selected="${mTab === id}" class="${mTab === id ? "on" : ""}" data-tab="${id}">${l}</button>`).join("")}</div>
      <div id="m-body"></div>`;
    ({ acheter: renderBuy, ventes: renderMySales, prix: renderRefPrices })[mTab]();
  }
  function renderBuy() {
    $("#m-body").innerHTML = `
      <div class="toolbar">
        <select id="m-r" aria-label="Rareté"></select>
        <select id="m-f" aria-label="Franchise"></select>
        <input id="m-max" type="number" min="0" placeholder="Prix max" aria-label="Prix maximum" value="${MF.max}">
        <label class="check"><input id="m-miss" type="checkbox" ${MF.miss ? "checked" : ""}> Manquantes uniquement</label>
        <select id="m-tri" aria-label="Tri"><option value="prix">Prix ↑</option><option value="prix-desc">Prix ↓</option><option value="recent">Récentes</option><option value="ecart">Bonnes affaires</option></select>
      </div>
      <div class="book" id="m-list"></div>`;
    fillSelect($("#m-r"), "Toutes les raretés", ORDER.map((r) => [r, RAR[r].nom]), MF.r);
    fillSelect($("#m-f"), "Toutes les franchises", G.franchises.map((f) => [f, f]), MF.f);
    $("#m-tri").value = MF.tri;
    [["#m-r", "r"], ["#m-f", "f"], ["#m-max", "max"], ["#m-tri", "tri"]].forEach(([s, k]) => $(s).addEventListener("input", (e) => { MF[k] = e.target.value; renderBuyList(); }));
    $("#m-miss").addEventListener("input", (e) => { MF.miss = e.target.checked; renderBuyList(); });
    renderBuyList();
  }
  const ratio = (a) => a.prix / RAR[G.bySlug[a.slug].rarete].prix;
  function renderBuyList() {
    if (!$("#m-list")) return;
    const max = Number(MF.max) || Infinity, n = now();
    const list = S.marche.filter((a) => {
      const c = G.bySlug[a.slug];
      return (!MF.r || c.rarete === MF.r) && (!MF.f || c.franchise === MF.f) && a.prix <= max && (!MF.miss || !S.owned[c.slug]);
    }).sort((a, b) => MF.tri === "recent" ? b.cree - a.cree : MF.tri === "prix-desc" ? b.prix - a.prix : MF.tri === "ecart" ? ratio(a) - ratio(b) : a.prix - b.prix);
    $("#m-list").innerHTML = `<div class="book-head"><span>Carte</span><span>Rareté</span><span>Prix</span><span>vs réf.</span><span>Vendeur</span><span>Fin</span><span></span></div>` +
      (list.length ? list.map((a) => {
        const c = G.bySlug[a.slug], d = Math.round((ratio(a) - 1) * 100);
        return `<div class="book-row">
          <button class="br-card" data-open="${c.slug}">${thumb(c)}<span><b>${c.nom}</b><small>${c.franchise}${S.owned[c.slug] ? ` · ×${S.owned[c.slug]}` : ` · <em class="new">manquante</em>`}</small></span></button>
          <span class="rt" style="--c:var(--${c.rarete})">${gem(c.rarete)}${RAR[c.rarete].nom}</span>
          <b class="mono">${coin(a.prix)}</b>
          <span class="mono ${d > 0 ? "up" : "down"}">${d > 0 ? "▲" : d < 0 ? "▼" : "="} ${Math.abs(d)} %</span>
          <span class="muted">${a.vendeur}</span>
          <span class="mono muted">${span(a.cree + M.dureeH * Engine.H - n)}</span>
          <button class="btn sm" data-buy="${a.id}" ${S.coins < a.prix ? "disabled" : ""}>Acheter</button>
        </div>`;
      }).join("") : `<p class="empty-note">Aucune annonce ne correspond à ces filtres.</p>`);
  }

  const STATUT = { vendue: "Vendue", expiree: "Expirée", annulee: "Annulée" };
  function renderMySales() {
    const err = G.canSell(S), n = now(), active = G.activeListings(S);
    const past = S.annonces.filter((a) => a.statut !== "active").slice(0, 20);
    $("#m-body").innerHTML = `
      <div class="sales-head">
        <p><b>${active.length}</b> / ${M.maxAnnonces} annonces actives</p>
        <button class="btn" id="new-listing" ${err ? "disabled" : ""}>Mettre une carte en vente</button>
      </div>
      ${err ? `<p class="note">${err}</p>` : ""}
      <h3 class="sub">En vente</h3>
      ${active.length ? `<div class="book">${active.map((a) => {
        const c = G.bySlug[a.slug];
        return `<div class="book-row mine">
          <button class="br-card" data-open="${c.slug}">${thumb(c)}<span><b>${c.nom}</b><small>${c.franchise}</small></span></button>
          <b class="mono">${coin(a.prix)}</b>
          <span class="muted small">vous recevrez ${num(G.netOf(a.prix))}</span>
          <span class="mono muted">${span(a.cree + M.dureeH * Engine.H - n)}</span>
          <button class="btn ghost sm" data-cancel="${a.id}">Annuler</button>
        </div>`;
      }).join("")}</div>` : `<p class="empty-note">Aucune annonce active.</p>`}
      <h3 class="sub">Historique</h3>
      ${past.length ? `<table class="table"><thead><tr><th>Carte</th><th>Prix</th><th>Statut</th><th>Reçu</th></tr></thead><tbody>${past.map((a) => `
        <tr><td>${G.bySlug[a.slug].nom}</td><td class="mono">${num(a.prix)}</td><td>${STATUT[a.statut]}</td><td class="mono">${a.statut === "vendue" ? "+" + num(a.net) : "—"}</td></tr>`).join("")}</tbody></table>` : `<p class="empty-note">Rien pour l'instant.</p>`}
      <h3 class="sub">Journal des coins</h3>
      ${S.log.length ? `<table class="table"><tbody>${S.log.slice(0, 15).map((l) => `
        <tr><td class="mono muted">${new Date(l.t).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td><td>${l.label}</td><td class="mono ${l.montant >= 0 ? "pos" : "neg"}">${l.montant >= 0 ? "+" : ""}${num(l.montant)}</td></tr>`).join("")}</tbody></table>` : `<p class="empty-note">Aucune transaction.</p>`}`;
  }

  function renderRefPrices() {
    $("#m-body").innerHTML = `
      <table class="table"><thead><tr><th>Rareté</th><th>Référence</th><th>Vente rapide</th><th>Prix autorisé</th></tr></thead>
      <tbody>${ORDER.map((r) => { const [lo, hi] = G.priceBounds(r); return `
        <tr><td class="rt" style="--c:var(--${r})">${gem(r)}${RAR[r].nom}</td><td class="mono">${num(RAR[r].prix)}</td><td class="mono">${num(G.quickSellValue(r))}</td><td class="mono">${num(lo)} – ${num(hi)}</td></tr>`; }).join("")}</tbody></table>
      <p class="note">Vente rapide : ${pct(CONFIG.economy.venteRapide * 100)} du prix de référence, payée tout de suite par le site. Marché : de ${pct(M.prixMin * 100)} à ${pct(M.prixMax * 100)} du prix de référence, moins ${pct(M.commission * 100)} de commission.</p>`;
  }

  function pickToSell() {
    const err = G.canSell(S); if (err) return toast(err);
    const mine = G.chars.filter((c) => S.owned[c.slug])
      .sort((a, b) => (S.owned[b.slug] > 1) - (S.owned[a.slug] > 1) || G.rank(b.rarete) - G.rank(a.rarete));
    if (!mine.length) return toast("Votre collection est vide.");
    showModal(`<div><p class="kicker">Marché</p><h2>Choisir une carte</h2><p class="muted">Conseil : vendez plutôt vos doublons.</p>
      <div class="grid picker">${mine.map((c) => `<div class="pick" data-sell="${c.slug}">${cardHTML(c)}</div>`).join("")}</div></div>`, "wide");
  }

  function sellForm(slug) {
    const err = G.canSell(S); if (err) return toast(err);
    const c = G.bySlug[slug], ref = RAR[c.rarete].prix, [lo, hi] = G.priceBounds(c.rarete), q = S.owned[slug] || 0;
    showModal(`
      <div class="sheet-card">${cardHTML(c, { noQty: true })}</div>
      <form id="sell-form" class="sheet-body" data-slug="${slug}">
        <p class="kicker">Mise en vente</p>
        <h2>${c.nom}</h2>
        <p class="muted">Vous en avez ×${q}${q === 1 ? " : c'est votre seul exemplaire" : ""}</p>
        <label class="field">Prix en coins
          <input id="sell-price" type="number" min="${lo}" max="${hi}" step="1" value="${ref}" required>
        </label>
        <p class="muted small">Entre ${num(lo)} et ${num(hi)} (référence ${num(ref)}).</p>
        <p class="net">Vous recevrez <b id="sell-net">${num(G.netOf(ref))}</b> coins après ${pct(M.commission * 100)} de commission.</p>
        <p class="note">La carte quitte votre collection pendant la vente (${M.dureeH} h max). Si elle ne se vend pas ou si vous annulez, elle revient.</p>
        <div class="row"><button class="btn" type="submit">Mettre en vente</button><button type="button" class="btn ghost" data-close>Annuler</button></div>
      </form>`, "sheet-char");
    $("#sell-price").addEventListener("input", (e) => { $("#sell-net").textContent = num(G.netOf(Math.round(Number(e.target.value) || 0))); });
  }

  /* ============================================================
     HORLOGES
     ============================================================ */
  // Prototype : le marché « vit » tout seul (acheteurs et vendeurs simulés),
  // et les packs gratuits se rechargent.
  let lastStock = G.freeStatus(S, now()).stock;
  function tick() {
    const events = G.tickMarket(S, now(), rand);
    const stock = G.freeStatus(S, now()).stock;
    save();
    if (stock !== lastStock) {
      if (stock > lastStock) toast(`Pack Aléatoire rechargé · ${stock} disponible${stock > 1 ? "s" : ""}`);
      lastStock = stock;
      if (["hub", "boutique"].includes(current()) && $("#stage").hidden) refresh(); else renderWallet();
    }
    if (!events.length) return;
    renderWallet();
    events.forEach((e) => toast(e.type === "vendue"
      ? `Vendu : ${G.bySlug[e.a.slug].nom} · +${coin(e.a.net)}`
      : `Annonce expirée : ${G.bySlug[e.a.slug].nom} revient dans votre collection`));
    if (current() === "marche" && mTab === "ventes") renderMySales();
    if (current() === "classeur") renderPages();
  }
  // comptes à rebours affichés
  setInterval(() => $$("[data-until]").forEach((el) => { el.textContent = span(Number(el.dataset.until) - now()); }), 1000);

  /* ============================================================
     ÉVÉNEMENTS
     ============================================================ */
  document.addEventListener("click", (e) => {
    const t = e.target, at = (s) => t.closest(s);
    if (at("#style-btn")) return toggleStyleMenu();
    if (at("[data-style-id]")) { setStyle(at("[data-style-id]").dataset.styleId); return toggleStyleMenu(false); }
    if (!at("#style-menu")) toggleStyleMenu(false);
    if (at("#mode-btn")) {
      const mode = html.dataset.mode === "dark" ? "light" : "dark";
      pref("rosterium-mode", mode);
      return setMode(mode);
    }
    if (at(".close") || at("[data-close]") || t === $("#modal")) return closeModal();
    if (at("[data-open]")) return openSheet(at("[data-open]").dataset.open);
    if (at("[data-odds]")) return showOdds(at("[data-odds]").dataset.odds);
    if (at("[data-pack]")) { const b = at("[data-pack]"); return openPack(b.dataset.pack, b.dataset.pay || "coins"); }
    if (at("#tear-btn")) return finishTear();
    if (at(".flip")) return flip(at(".flip"));
    if (at("#reveal-all")) return revealAll();
    if (at("#close-stage")) { $("#stage").hidden = true; opening = null; return refresh(); }
    if (at("[data-quick]")) return quickSellOne(at("[data-quick]").dataset.quick);
    if (at("[data-sell]")) return sellForm(at("[data-sell]").dataset.sell);
    if (at("#new-listing")) return pickToSell();
    if (at("#sell-dups")) return sellDuplicates();
    if (at("[data-tab]")) { mTab = at("[data-tab]").dataset.tab; return renderMarket(); }
    if (at("[data-bs]")) { BIN.s = at("[data-bs]").dataset.bs; BIN.page = 0; $$("[data-bs]").forEach((b) => b.classList.toggle("on", b === at("[data-bs]"))); return renderPages(); }
    if (at("[data-bp]")) { BIN.page += Number(at("[data-bp]").dataset.bp); return renderPages(); }
    if (at("#cx-more")) { CX.limit += CX_STEP; const y = scrollY; renderCodexList(); return scrollTo(0, y); }
    if (at("[data-cv]")) { CX.vue = at("[data-cv]").dataset.cv; CX.limit = CX_STEP; $$("[data-cv]").forEach((b) => b.classList.toggle("on", b === at("[data-cv]"))); return renderCodexList(); }
    if (at("[data-cancel]")) {
      const res = G.cancelListing(S, at("[data-cancel]").dataset.cancel, now());
      if (res.error) return toast(res.error);
      persist(); renderMySales(); return toast("Annonce annulée : la carte revient dans votre collection.");
    }
    if (at("[data-buy]")) {
      const a = S.marche.find((x) => x.id === at("[data-buy]").dataset.buy);
      if (!a || !confirm(`Acheter ${G.bySlug[a.slug].nom} à ${a.vendeur} pour ${num(a.prix)} coins ?`)) return;
      const res = G.buyListing(S, a.id, now());
      if (res.error) return toast(res.error);
      persist(); renderBuyList();
      return toast(`${res.c.nom} ajouté${res.isNew ? " (nouvelle carte)" : ""}${res.completed.length ? ` · franchise complétée : +${res.xp} XP` : ""}`);
    }
    if (at("#daily")) {
      const res = G.claimDaily(S, now());
      if (res.error) return toast(res.error);
      persist(); refresh();
      return toast(`+${coin(res.gain)}${res.hebdo ? " · bonus de la semaine inclus" : ""}${res.bon ? ` · ${res.bon.nom} offert (série de ${res.serie} jours)` : ` · série : ${res.serie} j`}`);
    }
    const card = at(".card[data-slug]"); if (card) openSheet(card.dataset.slug);
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id !== "sell-form") return;
    e.preventDefault();
    const slug = e.target.dataset.slug;
    const res = G.listCard(S, slug, Number($("#sell-price").value), now());
    if (res.error) return toast(res.error);
    persist(); closeModal(); refresh();
    toast(`${G.bySlug[slug].nom} mis en vente pour ${coin(res.annonce.prix)}`);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeModal(); toggleStyleMenu(false); }
    if (e.key === "Enter" || e.key === " ") {
      if (e.target.matches(".flip")) { e.preventDefault(); flip(e.target); }
      else if (e.target.matches("#tear")) { e.preventDefault(); finishTear(); }
      else if (e.target.matches(".card[data-slug]")) openSheet(e.target.dataset.slug);
    }
  });
  window.addEventListener("hashchange", route);

  tick();
  setInterval(tick, 4000);
  renderWallet();
  route();
})();
