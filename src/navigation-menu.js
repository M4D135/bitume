// Navigation des écrans DOM. Le jeu fournit les fronts des boutons et reste seul responsable de Start/pause.
(function (B) {
  'use strict';
  const ETATS = new WeakMap(), DELAI = 360, REPETITION = 95;
  const COMMANDES = 'button,input,select,textarea,a[href],[role="button"],[role="radio"],[role="checkbox"],[tabindex]';
  const TAB = '[data-menu-tab]', MASQUE = '[hidden],[inert],[aria-hidden="true"]';
  const role = el => el && el.getAttribute('role');
  const bloque = el => !el || el.disabled || el.matches(':disabled') || !!el.closest('[aria-disabled="true"]');

  function visible(el) {
    if (bloque(el) || el.type === 'hidden' || el.closest(MASQUE)) return false;
    // Les radios du jeu sont transparents ; leur étiquette représente le contrôle visible.
    const cible = (el.type === 'radio' || el.type === 'checkbox') ? el.closest('label') || el : el;
    const vue = el.ownerDocument.defaultView, style = vue && vue.getComputedStyle(cible);
    return !!cible.getClientRects().length && (!style || (style.visibility !== 'hidden' && style.visibility !== 'collapse'));
  }

  function focaliser(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true, focusVisible: true }); } catch (_) { el.focus(); }
    const cible = (el.type === 'radio' || el.type === 'checkbox') ? el.closest('label') || el : el;
    if (cible.scrollIntoView) cible.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  }

  function onglets(zone, nav) {
    return Array.from(zone.querySelectorAll(TAB)).filter(t => !bloque(t) &&
      t.closest('[data-menu-tabs]') && (!nav || t.closest('[data-menu-tabs]') === nav));
  }

  function ouvrirOnglet(zone, id, focus = false) {
    if (!zone) return false;
    const liste = onglets(zone), cible = liste.find(t => t.dataset.menuTab === id);
    const panneaux = Array.from(zone.querySelectorAll('[data-menu-panel]'));
    const panneau = panneaux.find(p => p.id === id || p.dataset.menuPanel === id);
    if (!cible || !panneau) return false;
    const nav = cible.closest('[data-menu-tabs]'), pairs = liste.filter(t => t.closest('[data-menu-tabs]') === nav);
    // Inclure aussi les onglets désactivés pour ne jamais conserver deux panneaux sélectionnés.
    for (const t of nav.querySelectorAll(TAB)) {
      const actif = t === cible;
      t.setAttribute('aria-selected', String(actif)); t.tabIndex = actif ? 0 : -1;
      const p = panneaux.find(p => p.id === t.dataset.menuTab || p.dataset.menuPanel === t.dataset.menuTab);
      if (p) { p.hidden = !actif; if (t.id) p.setAttribute('aria-labelledby', t.id); }
    }
    if (!pairs.length) return false;
    if (focus) focaliser(cible);
    return true;
  }

  function initialiser(zone) {
    if (!zone || !zone.addEventListener) return false;
    // À chaque entrée d'écran, attendre le retour au neutre d'un manche tenu pendant la conduite.
    if (ETATS.has(zone)) { ETATS.get(zone).pads.clear(); ETATS.get(zone).dernier = null; return true; }
    ETATS.set(zone, { pads: new Map(), dernier: null });
    const listes = new Set(onglets(zone).map(t => t.closest('[data-menu-tabs]')));
    for (const nav of listes) {
      const ts = onglets(zone, nav), actif = ts.find(t => t.getAttribute('aria-selected') === 'true') || ts[0];
      if (actif) ouvrirOnglet(zone, actif.dataset.menuTab);
    }
    zone.addEventListener('pointerdown', () => { delete zone.dataset.manette; });
    zone.addEventListener('click', e => {
      const t = e.target.closest(TAB);
      if (t && zone.contains(t) && !bloque(t)) ouvrirOnglet(zone, t.dataset.menuTab);
    });
    zone.addEventListener('keydown', e => {
      delete zone.dataset.manette;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target.closest(TAB);
      if (!t || !zone.contains(t) || !visible(t)) return;
      const nav = t.closest('[data-menu-tabs]'), ts = onglets(zone, nav).filter(visible), i = ts.indexOf(t);
      const vertical = nav && nav.getAttribute('aria-orientation') === 'vertical';
      const avant = vertical ? 'ArrowUp' : 'ArrowLeft', apres = vertical ? 'ArrowDown' : 'ArrowRight';
      let suivant;
      if (e.key === avant) suivant = (i + ts.length - 1) % ts.length;
      else if (e.key === apres) suivant = (i + 1) % ts.length;
      else if (e.key === 'Home') suivant = 0;
      else if (e.key === 'End') suivant = ts.length - 1;
      else return; // Entrée/Espace gardent le clic natif ; aucune seconde activation.
      e.preventDefault();
      if (ts[suivant]) ouvrirOnglet(zone, ts[suivant].dataset.menuTab, true);
    });
    return true;
  }

  function groupes(zone) {
    const gs = [];
    for (const el of zone.querySelectorAll(COMMANDES)) {
      if (!visible(el)) continue;
      let type = '', cle = null;
      if (el.type === 'radio' && el.name) { type = 'radio'; cle = el.name; }
      else if (role(el) === 'radio') { type = 'choix'; cle = el.closest('[role="radiogroup"]'); }
      else if (el.matches(TAB)) { type = 'onglets'; cle = el.closest('[data-menu-tabs]'); }
      // Un tabindex négatif ordinaire retire un élément du parcours ; les groupes ont leur propre sélection.
      if (!type && el.hasAttribute('tabindex') && el.tabIndex < 0) continue;
      let g = cle && gs.find(g => g.type === type && g.cle === cle && (type !== 'radio' || g.form === el.form));
      if (!g) { g = { type, cle, form: el.form, elements: [] }; gs.push(g); }
      g.elements.push(el);
    }
    return gs;
  }

  function selection(g) {
    return g && (g.elements.find(el => el.checked || el.getAttribute('aria-checked') === 'true' ||
      el.getAttribute('aria-selected') === 'true') || g.elements[0]);
  }

  function notifier(el) {
    const Evenement = el.ownerDocument.defaultView.Event;
    el.dispatchEvent(new Evenement('input', { bubbles: true }));
    el.dispatchEvent(new Evenement('change', { bubbles: true }));
  }

  function ajuster(zone, el, g, sens) {
    if (el.readOnly) return true;
    if (el.type === 'range') {
      const min = el.min !== '' && Number.isFinite(+el.min) ? +el.min : 0;
      const max = el.max !== '' && Number.isFinite(+el.max) ? +el.max : 100;
      const pas = +el.step > 0 ? +el.step : el.step === 'any' ? (max - min) / 100 || 1 : 1;
      const ancien = Number.isFinite(+el.value) ? +el.value : min;
      const valeur = +Math.max(min, Math.min(max, min + (Math.round((ancien - min) / pas) + sens) * pas)).toFixed(10);
      if (valeur !== ancien) { el.value = String(valeur); notifier(el); }
      return true;
    }
    if (el.tagName === 'SELECT') {
      const opts = Array.from(el.options).filter(o => !o.disabled && !o.hidden && !(o.parentElement.tagName === 'OPTGROUP' && o.parentElement.disabled));
      const i = opts.indexOf(el.options[el.selectedIndex]);
      const option = opts[Math.max(0, Math.min(opts.length - 1, i < 0 ? 0 : i + sens))];
      if (option && el.options[el.selectedIndex] !== option) {
        el.selectedIndex = Array.from(el.options).indexOf(option); notifier(el);
      }
      return true;
    }
    if (g.type === 'onglets') {
      const i = g.elements.indexOf(el), cible = g.elements[(i + sens + g.elements.length) % g.elements.length];
      ouvrirOnglet(zone, cible.dataset.menuTab, true); return true;
    }
    if (g.type === 'radio' || g.type === 'choix') {
      const i = g.elements.indexOf(el), cible = g.elements[(i + sens + g.elements.length) % g.elements.length];
      focaliser(cible);
      if (cible !== el) cible.click(); // Le contrôle natif émet lui-même input/change, une seule fois.
      return true;
    }
    if (el.type === 'checkbox' || role(el) === 'checkbox') {
      const coche = el.type === 'checkbox' ? el.checked : el.getAttribute('aria-checked') === 'true';
      if (coche !== (sens > 0)) el.click();
      return true;
    }
    return false;
  }

  function direction(pad, precedente) {
    const tenu = i => !!(pad && pad.buttons && pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > .5));
    const x = +tenu(15) - +tenu(14), y = +tenu(13) - +tenu(12);
    if (x || y || [12, 13, 14, 15].some(tenu)) return y ? y < 0 ? 12 : 13 : x ? x < 0 ? 14 : 15 : 0;
    const ax = pad && pad.axes || [], a = Number.isFinite(ax[0]) ? ax[0] : 0, b = Number.isFinite(ax[1]) ? ax[1] : 0;
    if (Math.max(Math.abs(a), Math.abs(b)) >= .55) return Math.abs(b) >= Math.abs(a) ? b < 0 ? 12 : 13 : a < 0 ? 14 : 15;
    // Hystérésis : une petite oscillation au seuil ne recrée pas une succession de premiers appuis.
    if (precedente === 12 && b < -.35 || precedente === 13 && b > .35 ||
        precedente === 14 && a < -.35 || precedente === 15 && a > .35) return precedente;
    return 0;
  }

  function deplacement(etat, pad, nouveau, temps) {
    const cle = pad && pad.index != null ? pad.index : -1, id = pad && pad.id || '';
    let p = etat.pads.get(cle);
    const precedent = p && p.id === id ? p.direction : 0;
    const front = [12, 13, 14, 15].find(i => nouveau(i)) || 0, d = front || direction(pad, precedent);
    const neuf = !p || p.id !== id || temps < p.temps || temps - p.temps > 800;
    if (neuf) { p = { id, direction: 0, prochain: Infinity, bloque: !!d && !front, temps }; etat.pads.set(cle, p); }
    p.temps = temps;
    if (!d) { p.direction = 0; p.prochain = 0; p.bloque = false; return 0; }
    if (p.bloque && !front) { p.direction = d; return 0; }
    if (front || d !== p.direction) {
      p.direction = d; p.prochain = temps + DELAI; p.bloque = false; return d;
    }
    if (temps >= p.prochain) { p.prochain = temps + REPETITION; return d; }
    return 0;
  }

  function naviguer(zone, nouveau, options = {}) {
    if (!zone || zone.hidden || zone.closest(MASQUE) || zone.ownerDocument.hidden) return false;
    if (!ETATS.has(zone)) initialiser(zone);
    const etat = ETATS.get(zone), front = typeof nouveau === 'function' ? nouveau : () => false;
    const pad = options.pad, temps = Number.isFinite(options.temps) ? options.temps : performance.now();
    const d = deplacement(etat, pad, front, temps);
    const retour = front(1), gauche = front(4), droite = front(5), valider = front(0);
    if (!retour && !gauche && !droite && !valider && !d) return false; // Aucun parcours DOM sur une image au repos.
    const vue = zone.ownerDocument.defaultView, style = vue && vue.getComputedStyle(zone);
    if (!zone.getClientRects().length || style && (style.visibility === 'hidden' || style.visibility === 'collapse')) return false;
    const cle = pad && pad.index != null ? pad.index : -1, avant = etat.dernier;
    // Deux manettes qui valident ensemble ne doivent pas cocher puis décocher le même réglage.
    if (avant && temps >= avant.temps && (temps === avant.temps || cle !== avant.cle && temps - avant.temps < 60)) return true;
    etat.dernier = { temps, cle }; zone.dataset.manette = 'true';
    if (options.activer) options.activer();
    if (retour) { if (options.retour) options.retour(); return true; }
    if (gauche || droite) {
      const ts = onglets(zone).filter(visible), actif = ts.find(t => t.getAttribute('aria-selected') === 'true') || ts[0];
      if (actif) {
        const pairs = ts.filter(t => t.closest('[data-menu-tabs]') === actif.closest('[data-menu-tabs]'));
        const i = pairs.indexOf(actif), cible = pairs[(i + (droite ? 1 : -1) + pairs.length) % pairs.length];
        ouvrirOnglet(zone, cible.dataset.menuTab, true);
      }
      return true;
    }
    const gs = groupes(zone), actif = zone.ownerDocument.activeElement, i = gs.findIndex(g => g.elements.includes(actif));
    const el = i >= 0 ? actif : selection(gs[0]);
    if (!el) return true;
    if (valider) { focaliser(el); if (!el.readOnly) el.click(); return true; }
    const sens = d === 12 || d === 14 ? -1 : 1;
    if (i < 0) { focaliser(el); return true; }
    if ((d === 14 || d === 15) && ajuster(zone, el, gs[i], sens)) { focaliser(zone.ownerDocument.activeElement); return true; }
    focaliser(selection(gs[(i + sens + gs.length) % gs.length]));
    return true;
  }

  B.navigationMenu = Object.freeze({ initialiser, ouvrirOnglet, naviguer });
})(globalThis.BITUME = globalThis.BITUME || {});
