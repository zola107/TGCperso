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
  const today = () => new Date().toDateString();

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
      if (s) return { ...G.newState(now()), ...s };
    } catch {}
    return G.newState(now());
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const hue = (str) => [...str].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 7);
  const num = (n) => n.toLocaleString("fr-FR");
  const coin = (n) => `<span class="coin" aria-hidden="true"></span>${num(n)}`;
  const pct = (n) => num(n) + " %";
  const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;
  const timeLeft = (ms) => {
    if (ms <= 0) return "expire";
    const h = Math.floor(ms / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
  };

  /* ============================================================
     CARTES
     ============================================================ */
  function cardHTML(c, o = {}) {
    const locked = o.locked, qty = S.owned[c.slug] || 0;
    const name = locked ? c.nom[0] + "•••••" : c.nom;
    const sub = locked ? "Carte à découvrir" : c.franchise;
    const art = !locked && c.image ? `<img src="${c.image}" alt="" loading="lazy">` : "";
    const initial = locked ? "?" : c.nom[0];
    const badge = o.isNew ? `<span class="badge">NOUVEAU</span>` : o.dup ? `<span class="badge dup">DOUBLON</span>` : "";
    const q = !o.noQty && qty > 1 ? `<span class="qty">×${qty}</span>` : "";
    return `<div class="card-wrap"><div class="card${locked ? " locked" : ""}" data-r="${c.rarete}" ${locked ? "" : `data-slug="${c.slug}" tabindex="0"`}>
      <div class="card-in">
        <div class="card-top"><small>${c.id}</small><b>${RAR[c.rarete].nom}</b></div>${badge}${q}
        <div class="art" style="--h:${hue(c.franchise)}">${art}<span>${initial}</span></div>
        <div class="card-info"><div class="card-name">${name}</div><div class="card-sub">${sub}</div></div>
      </div></div></div>`;
  }

  // inclinaison 3D + reflet qui suit le curseur
  document.addEventListener("mousemove", (e) => {
    const card = e.target.closest(".card:not(.locked)");
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.style.setProperty("--ry", (x - 0.5) * 18 + "deg");
    card.style.setProperty("--rx", (0.5 - y) * 18 + "deg");
    card.style.setProperty("--mx", x * 100 + "%");
    card.style.setProperty("--my", y * 100 + "%");
  });
  document.addEventListener("mouseout", (e) => {
    const card = e.target.closest(".card");
    if (card && !card.contains(e.relatedTarget)) { card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); }
  });

  /* ============================================================
     BARRE DU HAUT
     ============================================================ */
  const emblem = (r) => `<span class="emblem" style="--rk:${r.c}" aria-hidden="true"></span>`;
  function renderHud() {
    const i = G.rankOf(S.xp), cur = CONFIG.ranks[i], next = CONFIG.ranks[i + 1];
    const p = next ? ((S.xp - cur.xp) / (next.xp - cur.xp)) * 100 : 100;
    $("#hud").innerHTML = `
      <span class="chip" title="Coins">${coin(S.coins)}</span>
      <span class="chip" title="${num(S.xp)} XP${next ? ` · ${next.nom} à ${num(next.xp)} XP` : ""}">${emblem(cur)}<span class="rank-name">${cur.nom}</span><span class="xpbar"><i style="width:${p}%"></i></span></span>`;
  }
  function toast(msg) {
    const t = $("#toast"); t.innerHTML = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2800);
  }
  const persist = () => { save(); renderHud(); };

  /* ============================================================
     APPARENCE : style + mode clair/sombre (préférence de ce navigateur)
     Les couleurs de chaque style sont dans style.css ; ajouter un style,
     c'est une ligne ici + deux blocs de jetons là-bas.
     ============================================================ */
  const STYLES = [
    { id: "neon",   nom: "Néon",   desc: "Cyan et violet électriques", sw: ["#090a12", "#3ee6ff", "#a77bff"] },
    { id: "holo",   nom: "Holo",   desc: "Nacré, irisé, pastel",       sw: ["#f8f4ff", "#ff9ad9", "#8de9ff"] },
    { id: "arcade", nom: "Arcade", desc: "Rétro, pixel, cathodique",   sw: ["#06090a", "#39ff6a", "#ffcc00"] },
    { id: "royal",  nom: "Royal",  desc: "Noir et or",                 sw: ["#0c0a07", "#e3b75f", "#a3264d"] },
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
    $("#mode-btn").innerHTML = dark ? ICON.sun : ICON.moon;
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
  const VIEWS = ["accueil", "explorer", "packs", "collection", "marche"];
  const current = () => VIEWS.find((x) => !$("#" + x).hidden);
  const RENDER = () => ({ accueil: renderHome, explorer: renderExplorer, packs: renderPacks, collection: renderCollection, marche: renderMarket });
  function route() {
    const id = (location.hash || "#accueil").slice(1);
    const v = VIEWS.includes(id) ? id : "accueil";
    VIEWS.forEach((x) => ($("#" + x).hidden = x !== v));
    $$("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.v === v));
    closeModal();
    RENDER()[v]();
    window.scrollTo(0, 0);
  }
  const refresh = () => RENDER()[current()]();

  /* ============================================================
     ACCUEIL
     ============================================================ */
  function renderHome() {
    const day = Math.floor(Date.now() / 864e5), list = G.chars;
    const daily = list[day % list.length];
    const picks = [1, 2, 3, 4, 5].map((k) => list[(day + k * 7) % list.length]);
    $("#accueil").innerHTML = `
      <div class="hero">
        <div>
          <h1>Chaque personnage a une histoire. Chaque histoire a sa carte.</h1>
          <p>Lisez les fiches, ouvrez des packs, échangez au marché, complétez votre collection. Gratuit : une seule monnaie, les coins, sans argent réel.</p>
          <div class="hero-actions">
            <a class="btn" href="#packs">Ouvrir un pack</a>
            <a class="btn ghost" href="#explorer">Explorer le catalogue</a>
          </div>
          <ul class="facts">
            <li><b>${num(CONFIG.economy.depart)}</b> coins pour commencer</li>
            <li><b>+${num(CONFIG.economy.quotidien)}</b> coins chaque jour</li>
            <li><b>${ORDER.length}</b> raretés, de Commun à Spectaculaire</li>
          </ul>
        </div>
        <div class="hero-stage">${cardHTML(daily, { noQty: true })}<p class="hero-note">Personnage du jour : ${daily.nom}</p></div>
      </div>
      <div class="section-title"><h2>À découvrir</h2><a href="#explorer">Tout voir</a></div>
      <div class="grid">${picks.map((c) => cardHTML(c, { noQty: true })).join("")}</div>`;
  }

  /* ============================================================
     EXPLORER (recherche, filtres, tri)
     ============================================================ */
  function fillSelect(sel, first, items) {
    sel.innerHTML = `<option value="">${first}</option>` + items.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  }
  function renderExplorer() {
    if (!$("#f-franchise").options.length) {
      fillSelect($("#f-franchise"), "Toutes les franchises", G.franchises.map((f) => [f, f]));
      fillSelect($("#f-theme"), "Tous les thèmes", CONFIG.themePacks.list.map((t) => [t.tag, t.nom]));
      fillSelect($("#f-rarete"), "Toutes les raretés", ORDER.map((r) => [r, RAR[r].nom]));
      ["#q", "#f-franchise", "#f-theme", "#f-rarete", "#f-tri"].forEach((s) => $(s).addEventListener("input", renderExplorer));
    }
    const q = $("#q").value.trim().toLowerCase(), f = $("#f-franchise").value, th = $("#f-theme").value;
    const r = $("#f-rarete").value, t = $("#f-tri").value;
    const list = G.chars.filter((c) =>
      (!f || c.franchise === f) && (!th || c.tags.includes(th)) && (!r || c.rarete === r) &&
      (!q || [c.nom, c.franchise, c.jeu, ...c.alias].join(" ").toLowerCase().includes(q)));
    list.sort((a, b) =>
      t === "rarete" ? G.rank(b.rarete) - G.rank(a.rarete) || a.nom.localeCompare(b.nom)
      : t === "annee" ? a.annee - b.annee : a.nom.localeCompare(b.nom));
    $("#count").textContent = plural(list.length, "personnage");
    $("#grid-explorer").innerHTML = list.length
      ? list.map((c) => cardHTML(c, { noQty: true })).join("")
      : `<p class="lead">Aucun résultat. Essayez un autre nom ou retirez un filtre.</p>`;
  }

  /* ============================================================
     FENÊTRE (fiche, probabilités, mise en vente)
     ============================================================ */
  function showModal(html, cls = "") {
    $("#modal").hidden = false;
    $("#modal").innerHTML = `<article class="sheet ${cls}" role="dialog" aria-modal="true"><button class="close" aria-label="Fermer">✕</button>${html}</article>`;
  }
  function closeModal() { $("#modal").hidden = true; $("#modal").innerHTML = ""; }

  function openSheet(slug) {
    const c = G.bySlug[slug]; if (!c) return;
    if (G.viewSheet(S, slug)) persist();
    const same = G.chars.filter((x) => x.franchise === c.franchise && x !== c);
    const qty = S.owned[c.slug] || 0;
    const tags = c.tags.map((t) => CONFIG.themePacks.list.find((x) => x.tag === t)).filter(Boolean);
    showModal(`
      <div>${cardHTML(c, { noQty: true })}</div>
      <div>
        <h2>${c.nom}</h2>
        <p class="meta">${c.franchise} · ${c.jeu} (${c.annee})</p>
        <span class="tag" style="--c:var(--${c.rarete})">${RAR[c.rarete].nom}</span>
        ${tags.map((t) => `<span class="tag" style="--c:${t.c}">${t.nom}</span>`).join(" ")}
        <p style="margin-top:14px">${c.resume}</p>
        <dl>
          <dt>Rôle</dt><dd>${c.role}</dd>
          <dt>Alias</dt><dd>${c.alias.length ? c.alias.join(", ") : "—"}</dd>
          <dt>Première apparition</dt><dd>${c.jeu}, ${c.annee}</dd>
          <dt>Carte</dt><dd>${c.id} · ${qty ? `possédée (×${qty})` : "pas encore obtenue"}</dd>
          <dt>Prix de référence</dt><dd>${coin(RAR[c.rarete].prix)}</dd>
        </dl>
        ${qty ? `<div class="sheet-actions">
          <button class="btn ghost" data-quick="${c.slug}">Vente rapide · +${coin(G.quickSellValue(c.rarete))}</button>
          <button class="btn" data-sell="${c.slug}">Mettre en vente</button></div>` : ""}
        ${same.length ? `<strong>Autres personnages de ${c.franchise}</strong><div class="mini-list">${same.map((x) => `<button data-open="${x.slug}">${x.nom}</button>`).join("")}</div>` : ""}
      </div>`);
  }

  /* ============================================================
     PACKS
     ============================================================ */
  function oddsBars(table) {
    const max = Math.max(...Object.values(table));
    return ORDER.filter((r) => table[r]).map((r) => `
      <div class="odds-row" style="--c:var(--${r})"><span>${RAR[r].nom}</span><span class="odds-bar"><i style="width:${Math.max((table[r] / max) * 100, 1.5)}%"></i></span><span>${pct(table[r])}</span></div>`).join("");
  }
  const pityText = () => Object.entries(CONFIG.pity).map(([r, n]) => `après ${n} packs sans ${RAR[r].nom} ou mieux, la carte garantie passe ${RAR[r].nom}`).join(" ; ");
  function packDesc(p) {
    if (p.kind === "rarete") return `4 cartes au tirage standard + ${p.label.charAt(0).toLowerCase() + p.label.slice(1)}.`;
    const n = G.chars.filter(p.filter).length;
    return `${plural(n, "personnage")} · au moins 1 ${RAR[p.minRarity].nom} ou mieux.${G.emptyRarities(p).length ? " Raretés absentes du thème tirées dans tout le catalogue." : ""}`;
  }
  function packTile(p) {
    return `<div class="pack" style="--a:${p.c}">
      <div class="pack-art"><span>${p.kind === "rarete" ? p.nom.replace("Pack ", "") : p.theme}</span></div>
      <h3>${p.nom}</h3><p>${packDesc(p)}</p>
      <div class="pack-foot"><span class="price">${coin(p.prix)}</span>
        <span class="pack-btns"><button class="btn ghost sm" data-odds="${p.id}">Probabilités</button>
        <button class="btn sm" data-pack="${p.id}" ${S.coins < p.prix ? "disabled" : ""}>Ouvrir</button></span></div>
    </div>`;
  }
  function renderPacks() {
    const done = S.daily === today();
    const pity = Object.entries(CONFIG.pity).map(([r, n]) => `
      <div class="pity-row"><span>${RAR[r].nom} ou mieux</span><span class="odds-bar" style="--c:var(--${r})"><i style="width:${Math.min(100, ((S.pity[r] || 0) / n) * 100)}%"></i></span><span>${S.pity[r] || 0} / ${n}</span></div>`).join("");
    $("#packs").innerHTML = `
      <h1>Packs</h1>
      <p class="lead">Chaque pack contient ${CONFIG.packSize} cartes de personnages. Les cartes que vous n'avez pas encore sortent deux fois plus souvent, et les probabilités de chaque pack sont affichées.</p>
      <div class="packs">
        <div class="pack" style="--a:#1d6b4d">
          <div class="pack-art"><span>+${num(CONFIG.economy.quotidien)}</span></div>
          <h3>Récompense quotidienne</h3>
          <p>${num(CONFIG.economy.quotidien)} coins gratuits chaque jour.</p>
          <div class="pack-foot"><span></span><button class="btn sm" id="daily" ${done ? "disabled" : ""}>${done ? "Déjà récupéré" : "Récupérer"}</button></div>
        </div>
        <div class="pack pity">
          <h3>Compteur de chance</h3>
          <p>Packs ouverts d'affilée sans cette rareté. Au maximum, la prochaine carte garantie est relevée.</p>
          ${pity}
        </div>
      </div>
      <div class="section-title"><h2>Packs de rareté</h2></div>
      <div class="packs">${G.packs.filter((p) => p.kind === "rarete").map(packTile).join("")}</div>
      <div class="section-title"><h2>Packs thématiques</h2><span class="muted">${coin(CONFIG.themePacks.prix)} chacun</span></div>
      <div class="packs">${G.packs.filter((p) => p.kind === "theme").map(packTile).join("")}</div>`;
  }

  function showOdds(id) {
    const p = G.packById(id); if (!p) return;
    let body;
    if (p.kind === "rarete") {
      body = `<h3>Cartes 1 à 4 · tirage standard</h3>${oddsBars(CONFIG.standardOdds)}
        <h3>Carte 5 · garantie</h3>${oddsBars(p.garantie)}
        <p class="note"><b>${p.label}.</b></p>`;
    } else {
      const empty = G.emptyRarities(p);
      body = `<h3>Chaque carte · tirage standard</h3>${oddsBars(CONFIG.standardOdds)}
        <p class="note">Si aucune des ${CONFIG.packSize} cartes n'est ${RAR[p.minRarity].nom} ou mieux, la dernière est retirée parmi les raretés ${RAR[p.minRarity].nom} et plus (mêmes proportions).</p>
        <h3>Personnages du thème</h3>
        <div class="by-r">${ORDER.map((r) => `<span><b class="rt" style="--c:var(--${r})">${RAR[r].nom}</b> ${G.eligible(p, r).length}</span>`).join("")}</div>
        ${empty.length ? `<p class="note">Aucun personnage ${empty.map((r) => RAR[r].nom).join(", ")} dans ce thème : pour ces raretés, la carte est tirée dans tout le catalogue.</p>` : ""}`;
    }
    showModal(`<div class="odds-sheet">
      <h2>${p.nom}</h2><p class="meta">${coin(p.prix)} · ${CONFIG.packSize} cartes</p>
      ${body}
      <p class="note">Compteur de chance : ${pityText()}.</p>
      <div class="sheet-actions"><button class="btn" data-pack="${p.id}" ${S.coins < p.prix ? "disabled" : ""}>Ouvrir · ${coin(p.prix)}</button></div>
    </div>`, "narrow");
  }

  /* ============================================================
     OUVERTURE
     ============================================================ */
  let opening = null;
  function openPack(id) {
    const rankBefore = G.rankOf(S.xp);
    const res = G.openPack(S, id, now(), rand); // en vrai : appel au serveur
    if (res.error) return toast(res.error);
    res.rankUp = G.rankOf(S.xp) > rankBefore ? CONFIG.ranks[G.rankOf(S.xp)] : null;
    persist();
    closeModal();
    opening = res;

    const st = $("#stage"); st.hidden = false; st.className = "stage";
    st.innerHTML = `<div class="stage-in" style="--a:${res.pack.c}">
      <div class="pack-burst" aria-hidden="true"><span>${res.pack.nom}</span></div>
      <div class="stage-body">
        <h2>${res.pack.nom}</h2><p>Touchez une carte pour la retourner.</p>
        <div class="reveal">${res.cards.map((x, i) => `
          <div class="flip" data-r="${x.c.rarete}" style="--c:var(--${x.c.rarete})" role="button" tabindex="0" aria-label="Retourner la carte ${i + 1}">
            <div class="flip-in">
              <div class="face back"></div>
              <div class="face front">${cardHTML(x.c, { isNew: x.isNew, dup: !x.isNew, noQty: true })}</div>
            </div></div>`).join("")}</div>
        <div class="recap" id="recap" hidden></div>
        <div class="stage-actions" id="stage-actions"><button class="btn ghost" id="reveal-all">Tout retourner</button></div>
      </div></div>`;
  }

  function flip(el) {
    if (el.classList.contains("peek")) return;
    el.classList.add("peek"); // le dos trahit la rareté juste avant le retournement
    setTimeout(() => {
      el.classList.add("on");
      if (el.dataset.r === "spectaculaire") {
        const st = $("#stage"); st.classList.remove("spectacle"); void st.offsetWidth; st.classList.add("spectacle");
      }
      if ($$(".flip").every((f) => f.classList.contains("on"))) showRecap();
    }, 450);
  }
  function revealAll() {
    $$(".flip:not(.peek)").forEach((f, i) => setTimeout(() => flip(f), i * 280));
  }
  function showRecap() {
    const res = opening; if (!res || !$("#recap").hidden) return;
    const nb = res.cards.filter((x) => x.isNew).length;
    $("#recap").hidden = false;
    $("#recap").innerHTML = `
      <div class="recap-stats">
        <span><b>+${res.xp}</b> XP</span>
        <span><b>${nb}</b> nouvelle${nb > 1 ? "s" : ""} carte${nb > 1 ? "s" : ""}</span>
        <span><b>${res.cards.length - nb}</b> doublon${res.cards.length - nb > 1 ? "s" : ""}</span>
      </div>
      ${res.completed.map((f) => `<p class="recap-note">Franchise complétée : ${f} (+${CONFIG.xp.franchise} XP)</p>`).join("")}
      ${res.pityHit ? `<p class="recap-note">Compteur de chance : carte ${RAR[res.pityHit].nom} garantie.</p>` : ""}
      ${res.rankUp ? `<p class="recap-note">${emblem(res.rankUp)} Nouveau rang : ${res.rankUp.nom}</p>` : ""}`;
    $("#stage-actions").innerHTML = `
      <button class="btn" data-pack="${res.pack.id}" ${S.coins < res.pack.prix ? "disabled" : ""}>Ouvrir un autre · ${coin(res.pack.prix)}</button>
      <button class="btn ghost" id="close-stage">Terminer</button>`;
  }

  /* ============================================================
     COLLECTION
     ============================================================ */
  function renderCollection() {
    if (!$("#c-rarete").options.length) {
      fillSelect($("#c-rarete"), "Toutes les raretés", ORDER.map((r) => [r, RAR[r].nom]));
      ["#c-rarete", "#c-statut"].forEach((s) => $(s).addEventListener("input", renderCollection));
    }
    const total = G.chars.length, have = G.chars.filter((c) => S.owned[c.slug]).length;
    const p = Math.round((have / total) * 100);
    const big = G.franchises.filter((f) => G.chars.filter((c) => c.franchise === f).length >= CONFIG.xp.franchiseMin);
    const done = big.filter((f) => S.franchises[f]).length;
    $("#progress").innerHTML = `<strong>${have} / ${total} cartes · ${p} %</strong>
      <div class="xpbar"><i style="width:${p}%"></i></div>
      <div class="by-r">${ORDER.map((r) => {
        const all = G.chars.filter((c) => c.rarete === r), got = all.filter((c) => S.owned[c.slug]).length;
        return `<span><b class="rt" style="--c:var(--${r})">${RAR[r].nom}</b> ${got}/${all.length}</span>`;
      }).join("")}<span><b>Franchises complétées</b> ${done}/${big.length}</span></div>`;

    const dupValue = G.duplicatesValue(S);
    $("#sell-dups").disabled = !dupValue;
    $("#sell-dups").innerHTML = `Vente rapide des doublons${dupValue ? ` · +${coin(dupValue)}` : ""}`;

    const r = $("#c-rarete").value, s = $("#c-statut").value;
    const list = G.chars.filter((c) => {
      const q = S.owned[c.slug] || 0;
      return (!r || c.rarete === r) && (s === "tous" || (s === "possedees" && q) || (s === "manquantes" && !q) || (s === "doublons" && q > 1));
    }).sort((a, b) => G.rank(b.rarete) - G.rank(a.rarete) || a.nom.localeCompare(b.nom));
    $("#grid-collection").innerHTML = list.length
      ? list.map((c) => cardHTML(c, { locked: !S.owned[c.slug] })).join("")
      : `<p class="lead">Rien ici pour l'instant. Ouvrez un pack pour commencer votre collection.</p>`;
  }

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
     MARCHÉ
     ============================================================ */
  const M = CONFIG.market;
  let mTab = "acheter";
  function renderMarket() {
    const tabs = [["acheter", "Acheter"], ["ventes", "Mes ventes"], ["prix", "Prix de référence"]];
    $("#marche").innerHTML = `
      <h1>Marché</h1>
      <p class="lead">Achetez et vendez des cartes entre joueurs. Le vendeur reçoit le prix moins ${pct(M.commission * 100)} de commission.
        <span class="muted">Prototype : les autres vendeurs et acheteurs sont simulés.</span></p>
      <div class="tabs" role="tablist">${tabs.map(([id, l]) => `<button role="tab" aria-selected="${mTab === id}" class="${mTab === id ? "on" : ""}" data-tab="${id}">${l}</button>`).join("")}</div>
      <div id="m-body"></div>`;
    ({ acheter: renderBuy, ventes: renderMySales, prix: renderRefPrices })[mTab]();
  }

  function renderBuy() {
    $("#m-body").innerHTML = `
      <div class="filters">
        <select id="m-r" aria-label="Rareté"></select>
        <select id="m-f" aria-label="Franchise"></select>
        <input id="m-max" type="number" min="0" placeholder="Prix max" aria-label="Prix maximum">
        <label class="check"><input id="m-miss" type="checkbox"> Cartes manquantes uniquement</label>
        <select id="m-tri" aria-label="Tri">
          <option value="prix">Prix croissant</option>
          <option value="prix-desc">Prix décroissant</option>
          <option value="recent">Plus récentes</option>
        </select>
      </div>
      <p class="count" id="m-count"></p>
      <div class="grid market" id="m-list"></div>`;
    fillSelect($("#m-r"), "Toutes les raretés", ORDER.map((r) => [r, RAR[r].nom]));
    fillSelect($("#m-f"), "Toutes les franchises", G.franchises.map((f) => [f, f]));
    ["#m-r", "#m-f", "#m-max", "#m-miss", "#m-tri"].forEach((s) => $(s).addEventListener("input", renderBuyList));
    renderBuyList();
  }
  function renderBuyList() {
    if (!$("#m-list")) return;
    const r = $("#m-r").value, f = $("#m-f").value, max = Number($("#m-max").value) || Infinity;
    const miss = $("#m-miss").checked, t = $("#m-tri").value, n = now();
    const list = S.marche.filter((a) => {
      const c = G.bySlug[a.slug];
      return (!r || c.rarete === r) && (!f || c.franchise === f) && a.prix <= max && (!miss || !S.owned[c.slug]);
    }).sort((a, b) => t === "recent" ? b.cree - a.cree : t === "prix-desc" ? b.prix - a.prix : a.prix - b.prix);
    $("#m-count").textContent = plural(list.length, "annonce");
    $("#m-list").innerHTML = list.length ? list.map((a) => {
      const c = G.bySlug[a.slug], ref = RAR[c.rarete].prix;
      return `<div class="listing">
        ${cardHTML(c, { noQty: true })}
        <div class="listing-info">
          <div class="listing-price">${coin(a.prix)} <small class="${a.prix > ref ? "up" : "down"}">${Math.round((a.prix / ref) * 100)} % du réf.</small></div>
          <div class="muted small">${a.vendeur} · ${timeLeft(a.cree + M.dureeH * Engine.H - n)}</div>
          ${S.owned[c.slug] ? `<div class="muted small">Déjà possédée (×${S.owned[c.slug]})</div>` : `<div class="small new">Manquante</div>`}
          <button class="btn sm" data-buy="${a.id}" ${S.coins < a.prix ? "disabled" : ""}>Acheter</button>
        </div></div>`;
    }).join("") : `<p class="lead">Aucune annonce ne correspond à ces filtres.</p>`;
  }

  const STATUT = { vendue: "Vendue", expiree: "Expirée", annulee: "Annulée" };
  function renderMySales() {
    const err = G.canSell(S), n = now(), active = G.activeListings(S);
    const past = S.annonces.filter((a) => a.statut !== "active").slice(0, 20);
    $("#m-body").innerHTML = `
      <div class="sales-head">
        <p>${active.length} / ${M.maxAnnonces} annonces actives · durée ${M.dureeH} h</p>
        <button class="btn" id="new-listing" ${err ? "disabled" : ""}>Mettre une carte en vente</button>
      </div>
      ${err ? `<p class="note">${err}</p>` : ""}
      <h3>En vente</h3>
      ${active.length ? `<div class="grid market">${active.map((a) => {
        const c = G.bySlug[a.slug];
        return `<div class="listing">${cardHTML(c, { noQty: true })}
          <div class="listing-info">
            <div class="listing-price">${coin(a.prix)}</div>
            <div class="muted small">Vous recevrez ${num(G.netOf(a.prix))} · ${timeLeft(a.cree + M.dureeH * Engine.H - n)}</div>
            <button class="btn ghost sm" data-cancel="${a.id}">Annuler</button>
          </div></div>`;
      }).join("")}</div>` : `<p class="muted">Aucune annonce active.</p>`}
      <h3>Historique</h3>
      ${past.length ? `<table class="table"><thead><tr><th>Carte</th><th>Prix</th><th>Statut</th><th>Reçu</th></tr></thead><tbody>${past.map((a) => `
        <tr><td>${G.bySlug[a.slug].nom}</td><td>${num(a.prix)}</td><td>${STATUT[a.statut]}</td><td>${a.statut === "vendue" ? "+" + num(a.net) : "—"}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">Rien pour l'instant.</p>`}
      <h3>Journal des coins</h3>
      ${S.log.length ? `<table class="table"><tbody>${S.log.slice(0, 15).map((l) => `
        <tr><td>${new Date(l.t).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td><td>${l.label}</td><td class="${l.montant >= 0 ? "pos" : "neg"}">${l.montant >= 0 ? "+" : ""}${num(l.montant)}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">Aucune transaction.</p>`}`;
  }

  function renderRefPrices() {
    $("#m-body").innerHTML = `
      <table class="table"><thead><tr><th>Rareté</th><th>Prix de référence</th><th>Vente rapide</th><th>Prix de vente autorisé</th></tr></thead>
      <tbody>${ORDER.map((r) => { const [lo, hi] = G.priceBounds(r); return `
        <tr><td><b class="rt" style="--c:var(--${r})">${RAR[r].nom}</b></td><td>${num(RAR[r].prix)}</td><td>${num(G.quickSellValue(r))}</td><td>${num(lo)} à ${num(hi)}</td></tr>`; }).join("")}</tbody></table>
      <p class="note">Vente rapide : ${pct(CONFIG.economy.venteRapide * 100)} du prix de référence, payée tout de suite par le site. Marché : de ${pct(M.prixMin * 100)} à ${pct(M.prixMax * 100)} du prix de référence, moins ${pct(M.commission * 100)} de commission.</p>`;
  }

  function pickToSell() {
    const err = G.canSell(S); if (err) return toast(err);
    const mine = G.chars.filter((c) => S.owned[c.slug])
      .sort((a, b) => (S.owned[b.slug] > 1) - (S.owned[a.slug] > 1) || G.rank(b.rarete) - G.rank(a.rarete));
    if (!mine.length) return toast("Votre collection est vide.");
    showModal(`<div><h2>Choisir une carte</h2><p class="meta">Conseil : vendez plutôt vos doublons.</p>
      <div class="grid picker">${mine.map((c) => `<div class="pick" data-sell="${c.slug}">${cardHTML(c)}</div>`).join("")}</div></div>`, "wide");
  }

  function sellForm(slug) {
    const err = G.canSell(S); if (err) return toast(err);
    const c = G.bySlug[slug], ref = RAR[c.rarete].prix, [lo, hi] = G.priceBounds(c.rarete), q = S.owned[slug] || 0;
    showModal(`
      <div>${cardHTML(c, { noQty: true })}</div>
      <form id="sell-form" data-slug="${slug}">
        <h2>Mettre en vente</h2>
        <p class="meta">${c.nom} · vous en avez ×${q}${q === 1 ? " : c'est votre seul exemplaire" : ""}</p>
        <label class="field">Prix en coins
          <input id="sell-price" type="number" min="${lo}" max="${hi}" step="1" value="${ref}" required>
        </label>
        <p class="muted small">Entre ${num(lo)} et ${num(hi)} (référence ${num(ref)}).</p>
        <p class="net">Vous recevrez <b id="sell-net">${num(G.netOf(ref))}</b> coins après ${pct(M.commission * 100)} de commission.</p>
        <p class="note">La carte quitte votre collection pendant la vente (${M.dureeH} h max). Si elle ne se vend pas ou si vous annulez, elle revient.</p>
        <div class="sheet-actions"><button type="button" class="btn ghost" data-close>Annuler</button><button class="btn" type="submit">Mettre en vente</button></div>
      </form>`);
    $("#sell-price").addEventListener("input", (e) => { $("#sell-net").textContent = num(G.netOf(Math.round(Number(e.target.value) || 0))); });
  }

  // Prototype : le marché « vit » tout seul (acheteurs et vendeurs simulés).
  function tick() {
    const events = G.tickMarket(S, now(), rand);
    save();
    if (!events.length) return;
    renderHud();
    events.forEach((e) => toast(e.type === "vendue"
      ? `Vendu : ${G.bySlug[e.a.slug].nom} · +${coin(e.a.net)}`
      : `Annonce expirée : ${G.bySlug[e.a.slug].nom} revient dans votre collection`));
    if (current() === "marche" && mTab === "ventes") renderMySales();
    if (current() === "collection") renderCollection();
  }

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
    if (at("[data-pack]")) return openPack(at("[data-pack]").dataset.pack);
    if (at(".flip")) return flip(at(".flip"));
    if (at("#reveal-all")) return revealAll();
    if (at("#close-stage")) { $("#stage").hidden = true; opening = null; return refresh(); }
    if (at("[data-quick]")) return quickSellOne(at("[data-quick]").dataset.quick);
    if (at("[data-sell]")) return sellForm(at("[data-sell]").dataset.sell);
    if (at("#new-listing")) return pickToSell();
    if (at("#sell-dups")) return sellDuplicates();
    if (at("[data-tab]")) { mTab = at("[data-tab]").dataset.tab; return renderMarket(); }
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
      const res = G.claimDaily(S, today(), now());
      if (res.error) return toast(res.error);
      persist(); renderPacks(); return toast(`+${coin(res.gain)}`);
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
      else if (e.target.matches(".card[data-slug]")) openSheet(e.target.dataset.slug);
    }
  });
  window.addEventListener("hashchange", route);

  tick();
  setInterval(tick, 4000);
  renderHud();
  route();
})();
