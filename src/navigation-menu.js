// Navigation des écrans DOM. Le jeu fournit les fronts des boutons et reste seul responsable de Start/pause.
(function (B) {
  'use strict';
  const ETATS = new WeakMap(), INTERACTIONS = new WeakMap(), SAISIES = new WeakMap(), DELAI = 360, REPETITION = 95;
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
    const changement = cible.getAttribute('aria-selected') !== 'true';
    // Inclure aussi les onglets désactivés pour ne jamais conserver deux panneaux sélectionnés.
    for (const t of nav.querySelectorAll(TAB)) {
      const actif = t === cible;
      t.setAttribute('aria-selected', String(actif)); t.tabIndex = actif ? 0 : -1;
      const p = panneaux.find(p => p.id === t.dataset.menuTab || p.dataset.menuPanel === t.dataset.menuTab);
      if (p) { p.hidden = !actif; if (t.id) p.setAttribute('aria-labelledby', t.id); }
    }
    if (!pairs.length) return false;
    // Un appel programmatique peut fermer le panneau qui contient le focus, sans clic sur l'onglet.
    // Ne pas conserver les commandes du clavier dans ce panneau devenu invisible.
    const actif = zone.ownerDocument.activeElement;
    if ((focus || panneaux.some(p => p.hidden && p.contains(actif))) && visible(cible)) focaliser(cible);
    if (changement && zone.dispatchEvent) {
      const Evenement = zone.ownerDocument.defaultView.Event;
      zone.dispatchEvent(new Evenement('menuongletchange', { bubbles: false }));
    }
    return true;
  }

  function initialiser(zone) {
    if (!zone || !zone.addEventListener) return false;
    const saisie = SAISIES.get(zone.ownerDocument);
    if (saisie && zone !== saisie.dialogue && !zone.contains(saisie.cible)) fermerSaisie(zone.ownerDocument, false);
    // À chaque entrée d'écran, attendre le retour au neutre d'un manche tenu pendant la conduite.
    if (ETATS.has(zone)) { ETATS.get(zone).pads.clear(); return true; }
    ETATS.set(zone, { pads: new Map() });
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

  // Nom et code du salon restent des champs natifs au clavier/tactile. A ouvre ici un brouillon
  // local, pour que la manette seule puisse aussi les remplir sans dépendre du clavier du système.
  function fermerSaisie(doc, rendreFocus = true) {
    const s = SAISIES.get(doc);
    if (!s) return false;
    SAISIES.delete(doc);
    if (s.dialogue.open) s.dialogue.close();
    if (rendreFocus && visible(s.cible)) focaliser(s.cible);
    return true;
  }

  function actualiserSaisie(s) {
    s.contenu.textContent = s.valeur || '…';
    s.limite.textContent = s.valeur.length + ' / ' + s.maximum + (s.code ? ' lettres' : ' caractères');
    for (const b of s.lettres) b.textContent = s.majuscules ? b.dataset.saisieLettre.toUpperCase() : b.dataset.saisieLettre.toLowerCase();
    s.maj.setAttribute('aria-pressed', String(s.majuscules));
  }

  function ecrireSaisie(s, texte) {
    if (s.code) texte = texte.toUpperCase().replace(/[^A-Z]/g, '');
    else texte = texte.replace(/[\u0000-\u001f\u007f]/g, '');
    s.valeur = (s.valeur + texte).slice(0, s.maximum); actualiserSaisie(s);
  }

  function deplacerSaisie(s, direction) {
    const actif = s.dialogue.ownerDocument.activeElement;
    let ligne = s.lignes.findIndex(l => l.includes(actif));
    if (ligne < 0) { focaliser(s.lignes[0][0]); return; }
    const colonne = s.lignes[ligne].indexOf(actif), sens = direction === 12 || direction === 14 ? -1 : 1;
    if (direction === 12 || direction === 13) {
      ligne = (ligne + sens + s.lignes.length) % s.lignes.length;
      focaliser(s.lignes[ligne][Math.min(colonne, s.lignes[ligne].length - 1)]);
    } else focaliser(s.lignes[ligne][(colonne + sens + s.lignes[ligne].length) % s.lignes[ligne].length]);
  }

  function ouvrirSaisie(cible, zone) {
    if (!['nom', 'code'].includes(cible.dataset.menuSaisie) || cible.readOnly) return false;
    const doc = cible.ownerDocument, $ = id => doc.getElementById(id), dialogue = $('saisie-manette');
    if (!dialogue || typeof dialogue.showModal !== 'function') return false;
    const s = { cible, zone, dialogue, code: cible.dataset.menuSaisie === 'code',
      contenu: $('sm-contenu'), limite: $('sm-limite'), maj: $('sm-maj'), lettres: [], lignes: [] };
    const maximum = Number.parseInt(cible.getAttribute('maxlength'), 10);
    s.maximum = Number.isFinite(maximum) && maximum > 0 ? Math.min(64, maximum) : s.code ? 4 : 16;
    s.valeur = cible.value.slice(0, s.maximum); s.majuscules = s.code;
    $('sm-titre').textContent = s.code ? 'Code de la partie' : 'Votre nom';
    const touches = $('sm-touches'); touches.replaceChildren();
    const lignes = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'];
    if (!s.code) lignes.push('0123456789', 'ÉÈÀÇÙ-_.\'');
    for (const lettres of lignes) {
      const ligne = doc.createElement('div'); ligne.className = 'sm-ligne'; const boutons = [];
      for (const lettre of lettres) {
        const b = doc.createElement('button'); b.type = 'button'; b.dataset.saisieLettre = lettre;
        b.addEventListener('click', () => { if (SAISIES.get(doc) === s) ecrireSaisie(s, b.textContent); });
        ligne.append(b); boutons.push(b); s.lettres.push(b);
      }
      touches.append(ligne); s.lignes.push(boutons);
    }
    s.maj.hidden = $('sm-espace').hidden = s.code;
    const actions = [s.maj, $('sm-espace'), $('sm-effacer'), $('sm-valider'), $('sm-annuler')];
    s.lignes.push(actions.filter(b => !b.hidden));
    if (!ETATS.has(dialogue)) {
      ETATS.set(dialogue, { pads: new Map() });
      const courant = () => SAISIES.get(doc);
      $('sm-maj').addEventListener('click', () => { const s = courant(); if (s) { s.majuscules = !s.majuscules; actualiserSaisie(s); } });
      $('sm-espace').addEventListener('click', () => { const s = courant(); if (s && !s.code) ecrireSaisie(s, ' '); });
      const effacer = () => { const s = courant(); if (s) { s.valeur = Array.from(s.valeur).slice(0, -1).join(''); actualiserSaisie(s); } };
      $('sm-effacer').addEventListener('click', effacer);
      $('sm-annuler').addEventListener('click', () => fermerSaisie(doc));
      $('sm-valider').addEventListener('click', () => {
        const s = courant(); if (!s) return;
        if (visible(s.cible) && !s.cible.readOnly && s.cible.value !== s.valeur) { s.cible.value = s.valeur; notifier(s.cible); }
        fermerSaisie(doc);
      });
      dialogue.addEventListener('cancel', e => { e.preventDefault(); fermerSaisie(doc); });
      dialogue.addEventListener('close', () => { if (!dialogue.open) fermerSaisie(doc); });
      dialogue.addEventListener('keydown', e => {
        const s = courant(); if (!s || e.altKey || e.ctrlKey || e.metaKey) return;
        const directions = { ArrowUp: 12, ArrowDown: 13, ArrowLeft: 14, ArrowRight: 15 };
        if (directions[e.key]) deplacerSaisie(s, directions[e.key]);
        else if (e.key === 'Escape') fermerSaisie(doc);
        else if (e.key === 'Backspace') effacer();
        else if (e.key && e.key.length === 1) ecrireSaisie(s, e.key);
        else return; // Tab/Entrée gardent leur comportement natif dans le dialogue.
        e.preventDefault(); e.stopPropagation();
      });
    }
    ETATS.get(dialogue).pads.clear(); SAISIES.set(doc, s); actualiserSaisie(s);
    dialogue.dataset.manette = 'true'; dialogue.showModal(); focaliser(s.lignes[0][0]);
    return true;
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
    const saisie = zone && SAISIES.get(zone.ownerDocument);
    if (saisie) {
      if (saisie.zone !== zone || !visible(saisie.cible) || zone.ownerDocument.hidden) fermerSaisie(zone.ownerDocument, false);
      else zone = saisie.dialogue;
    }
    if (!zone || zone.hidden || zone.closest(MASQUE) || zone.ownerDocument.hidden) return false;
    if (!ETATS.has(zone)) initialiser(zone);
    const etat = ETATS.get(zone), front = typeof nouveau === 'function' ? nouveau : () => false;
    const pad = options.pad, temps = Number.isFinite(options.temps) ? options.temps : performance.now();
    const d = deplacement(etat, pad, front, temps);
    const retour = front(1), gauche = front(4), droite = front(5), valider = front(0);
    const demarrer = typeof options.demarrer === 'function' && front(9);
    if (!retour && !gauche && !droite && !valider && !demarrer && !d) return false; // Aucun parcours DOM sur une image au repos.
    const vue = zone.ownerDocument.defaultView, style = vue && vue.getComputedStyle(zone);
    if (!zone.getClientRects().length || style && (style.visibility === 'hidden' || style.visibility === 'collapse')) return false;
    const cle = pad && pad.index != null ? pad.index : -1, avant = INTERACTIONS.get(zone.ownerDocument);
    // Deux manettes qui valident ensemble ne doivent pas cocher puis décocher le même réglage.
    // Le garde-fou suit le document : la première validation peut ouvrir un autre écran avant la lecture de J2.
    if (avant && temps >= avant.temps && (temps === avant.temps || cle !== avant.cle && temps - avant.temps < 60)) return true;
    INTERACTIONS.set(zone.ownerDocument, { temps, cle }); zone.dataset.manette = 'true';
    if (options.activer) options.activer();
    if (saisie && SAISIES.get(zone.ownerDocument) === saisie) {
      if (retour) fermerSaisie(zone.ownerDocument);
      else if (valider) {
        const actif = zone.ownerDocument.activeElement, cible = saisie.lignes.flat().find(b => b === actif) || saisie.lignes[0][0];
        focaliser(cible); cible.click();
      } else if (d) deplacerSaisie(saisie, d);
      return true; // LB/RB ne doivent pas changer le menu derrière le dialogue.
    }
    if (retour) { if (options.retour) options.retour(); return true; }
    if (demarrer) { options.demarrer(); return true; }
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
    if (valider) {
      focaliser(el);
      if (!el.readOnly && !ouvrirSaisie(el, zone) && !(options.valider && options.valider(el))) el.click();
      return true;
    }
    const sens = d === 12 || d === 14 ? -1 : 1;
    if (i < 0) { focaliser(el); return true; }
    const vertical = gs[i].type === 'choix' && gs[i].cle && gs[i].cle.dataset.menuAxis === 'vertical';
    if ((vertical ? d === 12 || d === 13 : d === 14 || d === 15) && ajuster(zone, el, gs[i], sens)) { focaliser(zone.ownerDocument.activeElement); return true; }
    focaliser(selection(gs[(i + sens + gs.length) % gs.length]));
    return true;
  }

  B.navigationMenu = Object.freeze({ initialiser, ouvrirOnglet, naviguer, fermerSaisie });
})(globalThis.BITUME = globalThis.BITUME || {});
