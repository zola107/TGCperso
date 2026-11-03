// Emblèmes dessinés pour le projet (originaux, aucun logo de jeu existant).
// Raretés : une gemme qui se complique de Commun à Spectaculaire (viewBox 24).
// Rangs : un écusson qui gagne ailes, lauriers et couronne de Bronze à Champion (viewBox 64).
// Les couleurs viennent de CSS : --gem pour les raretés, --rk pour les rangs.
const EMBLEMS = (() => {
  const L = 'fill="#fff" opacity=".28"';         // reflet
  const D = 'fill="#000" opacity=".28"';         // ombre
  const S = 'fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1" stroke-linejoin="round"';
  const G = 'style="fill:var(--gem)"';
  const R = 'style="fill:var(--rk)"';
  const RD = 'style="fill:var(--rk-dark)"';
  const shield = "M32 8 L50 14 V30 C50 43 42 51 32 56 C22 51 14 43 14 30 V14 Z";
  const shieldIn = "M32 14 L44 18 V30 C44 39 39 45 32 49 C25 45 20 39 20 30 V18 Z";
  const leaves = (side) => [[9, 22, -25], [7, 31, -8], [8, 40, 10], [12, 48, 30]]
    .map(([x, y, a]) => side < 0
      ? `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="5.4" transform="rotate(${a} ${x} ${y})" ${R}/>`
      : `<ellipse cx="${64 - x}" cy="${y}" rx="2.6" ry="5.4" transform="rotate(${-a} ${64 - x} ${y})" ${R}/>`).join("");
  const wing = (big) => {
    const l = big
      ? "M18 20 C10 22 3 18 1 8 C6 13 10 14 14 13 C9 17 12 19 18 17 Z M18 28 C9 31 3 28 1 22 C6 25 10 25 15 24 Z"
      : "M17 22 C10 22 5 18 3 11 C8 15 12 16 17 15 Z";
    return `<path d="${l}" ${R}/><path d="${l}" ${R} transform="matrix(-1 0 0 1 64 0)"/>`;
  };

  const RARITY = {
    commun: `<circle cx="12" cy="12" r="8" ${G}/><path d="M12 4a8 8 0 0 0 0 16z" ${L}/><circle cx="12" cy="12" r="4.6" ${S}/>`,
    peucommun: `<path d="M12 2.5 20.5 12 12 21.5 3.5 12Z" ${G}/><path d="M12 2.5 3.5 12H20.5Z" ${L}/><path d="M3.5 12H20.5" ${S}/>`,
    rare: `<path d="M12 2 20.7 7v10L12 22 3.3 17V7Z" ${G}/><path d="M12 2 3.3 7 12 12 20.7 7Z" ${L}/><path d="M12 12 20.7 17 12 22Z" ${D}/><path d="M3.3 7 12 12 20.7 7M12 12v10" ${S}/>`,
    epique: `<path d="M8 2.5h8l5.5 5.5v8L16 21.5H8L2.5 16V8Z" ${G}/><path d="M12 6l6 6-6 6-6-6Z" ${L}/><path d="M8 2.5 12 6M16 2.5 12 6M21.5 8 18 12M21.5 16 18 12M16 21.5 12 18M8 21.5 12 18M2.5 16 6 12M2.5 8 6 12" ${S}/><path d="M12 12 18 12 12 18 6 12Z" ${D}/>`,
    legendaire: `<path d="M3 8.5 7.5 12.5 12 4.5 16.5 12.5 21 8.5 19 18H5Z" ${G}/><path d="M12 4.5 7.5 12.5 3 8.5 5 18H12Z" ${L}/><rect x="5" y="19" width="14" height="2.6" rx=".6" ${G}/><circle cx="12" cy="14" r="1.9" fill="#fff" opacity=".85"/><circle cx="7.5" cy="12.5" r=".9" fill="#fff" opacity=".7"/><circle cx="16.5" cy="12.5" r=".9" fill="#fff" opacity=".7"/>`,
    mythique: `<path d="M8.5 10.5C5 11 2 9 1 4.5c2.5 2 5 2.6 8.3 2.4ZM8.8 13.6C5.6 15 2.6 14 1.2 11c2.6 1.1 4.8 1.2 7.4.6Z" ${G}/><path d="M15.5 10.5C19 11 22 9 23 4.5c-2.5 2-5 2.6-8.3 2.4ZM15.2 13.6c3.2 1.4 6.2.4 7.6-2.6-2.6 1.1-4.8 1.2-7.4.6Z" ${G}/><path d="M12 3 17 10.5 12 21 7 10.5Z" ${G}/><path d="M12 3 7 10.5H17Z" ${L}/><path d="M12 21 17 10.5H12Z" ${D}/><path d="M7 10.5H17M12 3v18" ${S}/>`,
    spectaculaire: `<path d="M12 .8 14.3 8.1 21.2 4.8 16.6 10.8 23.2 12 16.6 13.2 21.2 19.2 14.3 15.9 12 23.2 9.7 15.9 2.8 19.2 7.4 13.2.8 12 7.4 10.8 2.8 4.8 9.7 8.1Z" fill="url(#em-prism)"/><path d="M12 7.5 15.6 12 12 16.5 8.4 12Z" fill="#fff" opacity=".9"/><path d="M12 7.5 8.4 12H15.6Z" fill="#fff"/>`,
  };

  const RANK = {
    bronze: `<path d="${shield}" ${R}/><path d="M32 8 14 14V30C14 43 22 51 32 56Z" ${L}/><path d="${shieldIn}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="2"/>`,
    argent: `<path d="${shield}" ${R}/><path d="M32 8 14 14V30C14 43 22 51 32 56Z" ${L}/><path d="${shieldIn}" ${RD}/><path d="M23 27 32 35 41 27M23 35 32 43 41 35" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" opacity=".9"/>`,
    or: `${leaves(-1)}${leaves(1)}<path d="${shield}" ${R}/><path d="M32 8 14 14V30C14 43 22 51 32 56Z" ${L}/><path d="${shieldIn}" ${RD}/><path d="M32 21 34.8 27.3 41.5 27.8 36.4 32.2 38 38.8 32 35.2 26 38.8 27.6 32.2 22.5 27.8 29.2 27.3Z" fill="#fff" opacity=".92"/>`,
    platine: `<path d="M12 30 2 21 7 37ZM52 30 62 21 57 37Z" ${R}/><path d="M32 4 50 12 54 30 32 60 10 30 14 12Z" ${R}/><path d="M32 4 14 12 10 30 32 60Z" ${L}/><path d="M32 13 45 18 47 30 32 50 17 30 19 18Z" ${RD}/><path d="M32 20 40 30 32 42 24 30Z" fill="#fff" opacity=".9"/><path d="M24 30H40" stroke="${"#000"}" stroke-opacity=".25"/>`,
    diamant: `${wing(false)}<path d="M32 4 54 26 32 60 10 26Z" ${R}/><path d="M32 4 10 26H54Z" ${L}/><path d="M32 60 54 26H32Z" ${D}/><path d="M10 26H54M21 26 32 4 43 26M21 26 32 60 43 26" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.4"/>`,
    elite: `${wing(true)}<path d="M32 2 38 12 47 6 47 17 54 21 49 39 32 61 15 39 10 21 17 17 17 6 26 12Z" ${R}/><path d="M32 2 26 12 17 6 17 17 10 21 15 39 32 61Z" ${L}/><path d="M32 18 44 24 42 38 32 50 22 38 20 24Z" ${RD}/><path d="M32 24 39 29 37 38 32 43 27 38 25 29Z" fill="#fff" opacity=".88"/>`,
    champion: `<circle cx="32" cy="32" r="29" fill="none" style="stroke:var(--rk)" stroke-width="1.6" stroke-dasharray="2 3" opacity=".8"/><g transform="translate(0 12)">${wing(true)}</g><path d="M18 17 21 5 27 11 32 2 37 11 43 5 46 17Z" ${R}/><path d="M18 17 21 5 27 11 32 2V17Z" ${L}/><circle cx="32" cy="9" r="1.8" fill="#fff"/><path d="M32 19 48 24V36C48 46 41 53 32 58 23 53 16 46 16 36V24Z" ${R}/><path d="M32 19 16 24V36C16 46 23 53 32 58Z" ${L}/><path d="M32 26 41 29V37C41 43 37 47 32 50 27 47 23 43 23 37V29Z" ${RD}/><path d="M32 30 34 35.5 39.5 36 35.3 39.4 36.6 45 32 42 27.4 45 28.7 39.4 24.5 36 30 35.5Z" fill="#fff"/>`,
  };

  const defs = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="em-prism" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22e5ff"/><stop offset=".35" stop-color="#7c5cff"/><stop offset=".65" stop-color="#ff2bd6"/><stop offset="1" stop-color="#ffd24a"/>
    </linearGradient></defs></svg>`;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", () => document.body.insertAdjacentHTML("afterbegin", defs));

  return {
    gem: (r, cls = "gem") => `<svg class="${cls}" data-r="${r}" viewBox="0 0 24 24" aria-hidden="true">${RARITY[r] || ""}</svg>`,
    rank: (id, cls = "rank-emblem") => `<svg class="${cls}" data-rank="${id}" viewBox="0 0 64 64" aria-hidden="true">${RANK[id] || ""}</svg>`,
  };
})();
