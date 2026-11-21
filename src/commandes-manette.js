// BITUME : affectations propres à chaque joueur. La lecture réutilise sa sortie ;
// les objets de configuration et de capture ne sont préparés que dans les menus.
(function (B) {
  'use strict';
  const ACTIONS = Object.freeze(['gaz', 'frein', 'gauche', 'droite', 'derive', 'haut', 'bas', 'vue', 'troll']);
  const DEFAUT = {
    gaz: [{ type: 'bouton', index: 7 }], frein: [{ type: 'bouton', index: 6 }],
    gauche: [{ type: 'axe', index: 0, sens: -1, origine: 0 }],
    droite: [{ type: 'axe', index: 0, sens: 1, origine: 0 }],
    derive: [{ type: 'bouton', index: 0 }, { type: 'bouton', index: 2 }],
    haut: [{ type: 'bouton', index: 5 }], bas: [{ type: 'bouton', index: 4 }],
    vue: [{ type: 'bouton', index: 3 }], troll: [{ type: 'bouton', index: 10 }]
  };
  for (const a of ACTIONS) { for (const l of DEFAUT[a]) Object.freeze(l); Object.freeze(DEFAUT[a]); }
  Object.freeze(DEFAUT);
  const limite = x => Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
  const reserve = i => i === 1 || i === 9 || i === 16; // B : retour ; Menu : pause ; Xbox : système.

  function liaison(v) {
    if (!v || !Number.isInteger(v.index) || v.index < 0) return null;
    if (v.type === 'bouton' && v.index < 64 && !reserve(v.index)) return { type: 'bouton', index: v.index };
    if (v.type !== 'axe' || v.index >= 16 || (v.sens !== -1 && v.sens !== 1)) return null;
    const origine = v.origine == null ? 0 : v.origine;
    if (![0, -1, 1].includes(origine) || origine === v.sens) return null;
    return { type: 'axe', index: v.index, sens: v.sens, origine };
  }
  const identique = (a, b) => a.type === b.type && a.index === b.index &&
    (a.type === 'bouton' || a.sens === b.sens && a.origine === b.origine);

  function normaliser(source) {
    const m = {};
    for (const a of ACTIONS) {
      const v = source && Object.prototype.hasOwnProperty.call(source, a) ? source[a] : null;
      const liste = Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : DEFAUT[a];
      const sorties = [];
      for (let i = 0; i < Math.min(2, liste.length); i++) {
        const l = liaison(liste[i]);
        if (l && !sorties.some(p => identique(l, p))) sorties.push(l);
      }
      // Une liste vide est une désaffectation volontaire ; une donnée invalide garde le défaut.
      m[a] = sorties.length || !liste.length ? sorties : DEFAUT[a].map(l => ({ ...l }));
    }
    return m;
  }

  function affecter(source, action, entree) {
    const m = normaliser(source), l = liaison(entree);
    if (!ACTIONS.includes(action) || !l) return m;
    for (const a of ACTIONS) m[a] = m[a].filter(p => !identique(p, l));
    m[action] = [l];
    return m;
  }

  function bouton(p, i) {
    const b = p && p.buttons && p.buttons[i];
    if (typeof b === 'number') return limite(b);
    if (!b) return 0;
    if (Number.isFinite(b.value) && b.value > 0) return limite(b.value);
    return b.pressed ? 1 : 0;
  }
  function valeur(p, l) {
    if (l.type === 'bouton') return bouton(p, l.index);
    const v = p && p.axes && p.axes[l.index];
    if (!Number.isFinite(v)) return 0;
    const brut = limite((v - l.origine) * l.sens / (1 - l.origine * l.sens));
    return brut <= .06 ? 0 : (brut - .06) / .94;
  }
  function lire(p, m, sortie) {
    m = m || DEFAUT; sortie = sortie || {};
    for (let i = 0; i < ACTIONS.length; i++) {
      const a = ACTIONS[i], ls = m[a] || DEFAUT[a];
      let v = 0;
      if (p && p.connected !== false) for (let k = 0; k < ls.length; k++) v = Math.max(v, valeur(p, ls[k]));
      sortie[a] = v;
    }
    const volant = sortie.droite - sortie.gauche;
    sortie.volant = Math.sign(volant) * Math.pow(Math.abs(volant), 1.22);
    return sortie;
  }

  function nom(l) {
    if (!l) return '—';
    if (Array.isArray(l)) return l.length ? l.map(nom).join(' / ') : '—';
    if (l.type === 'axe') return 'Axe ' + (l.index + 1) + (l.sens < 0 ? ' −' : ' +');
    return ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', 'Croix ↑', 'Croix ↓', 'Croix ←', 'Croix →', 'Xbox'][l.index] || 'Bouton ' + (l.index + 1);
  }

  function preparerCapture(c, p) {
    c.index = p.index; c.id = p.id || ''; c.pret = false; c._neutres = 0; c._presente = true;
    c.origines = [];
    for (let i = 0; i < Math.min(16, (p.axes || []).length); i++) {
      const v = p.axes[i];
      // Les axes standard sont centrés. Hors mapping standard, les gâchettes
      // séparées peuvent reposer à -1 ou +1 ; le centre observé fixe leur sens.
      c.origines[i] = p.mapping !== 'standard' && i >= 2 && Number.isFinite(v) && Math.abs(v) > .85 ? Math.sign(v) : 0;
    }
  }
  function creerCapture(p) {
    const c = { pret: false, annule: false, liaison: null, raison: '', index: -1, id: '', origines: [], _presente: false, _neutres: 0 };
    if (p && p.connected !== false) preparerCapture(c, p);
    return c;
  }
  function avancerCapture(c, p) {
    if (!c || c.annule) return null;
    if (c.liaison) return c.liaison;
    if (!p || p.connected === false) { c.pret = false; c._presente = false; c.raison = 'deconnectee'; return null; }
    if (!c._presente || c.index !== p.index || c.id !== (p.id || '')) preparerCapture(c, p);
    c.raison = '';
    if (!c.pret) {
      let neutre = true;
      for (let i = 0; i < Math.min(64, (p.buttons || []).length); i++) if (bouton(p, i) > .25) neutre = false;
      for (let i = 0; i < c.origines.length; i++) if (Number.isFinite(p.axes[i]) && Math.abs(p.axes[i] - c.origines[i]) > .25) neutre = false;
      c._neutres = neutre ? c._neutres + 1 : 0;
      c.pret = c._neutres >= 2;
      return null;
    }
    if (bouton(p, 1) > .5 || bouton(p, 9) > .5) { c.annule = true; c.raison = 'annulee'; return null; }
    for (let i = 0; i < Math.min(64, (p.buttons || []).length); i++) {
      if (!reserve(i) && bouton(p, i) > .55) { c.liaison = { type: 'bouton', index: i }; return c.liaison; }
    }
    for (let i = 0; i < c.origines.length; i++) {
      const v = p.axes[i], origine = c.origines[i], delta = v - origine;
      if (!Number.isFinite(v) || Math.abs(delta) < .6) continue;
      const sens = Math.sign(delta);
      if (origine !== sens) { c.liaison = { type: 'axe', index: i, sens, origine }; return c.liaison; }
    }
    return null;
  }

  B.commandesManette = Object.freeze({ ACTIONS, DEFAUT, normaliser, affecter, lire, nom, creerCapture, avancerCapture });
})(globalThis.BITUME = globalThis.BITUME || {});
