// Navigation des écrans DOM. Le jeu fournit les fronts des boutons et reste seul responsable de Start/pause.
(function (B) {
  'use strict';
  const ETATS = new WeakMap(), INTERACTIONS = new WeakMap(), SAISIES = new WeakMap(), DELAI = 360, REPETITION = 95;
  const COMMANDES = 'button,input,select,textarea,a[href],[role="button"],[role="radio"],[role="checkbox"],[tabindex]';
  const TAB = '[data-menu-tab]', MASQUE = '[hidden],[inert],[aria-hidden="true"],[data-page-inactive]';
  const PAGINATIONS = new WeakMap();
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
    const pagination = PAGINATIONS.get(panneau);
    if (pagination) actualiserPages(pagination);
    const actif = zone.ownerDocument.activeElement;
    if ((focus || panneaux.some(p => p.hidden && p.contains(actif))) && visible(cible)) focaliser(cible);
    if (changement && zone.dispatchEvent) {
      const Evenement = zone.ownerDocument.defaultView.Event;
      zone.dispatchEvent(new Evenement('menuongletchange', { bubbles: false }));
    }
    return true;
  }

  function pagesDuPanneau(panneau) {
    const pages = [];
    if (panneau.id === 'r-commandes-panel') {
      const vibrations = panneau.querySelector(':scope > fieldset');
      if (vibrations) pages.push({ cle: 'vibrations', elements: [vibrations] });
      const actions = panneau.querySelector('#r-commandes > .actions-commandes');
      const annuler = actions?.querySelector('#r-pad-annuler:not([hidden])');
      for (const [i, joueur] of Array.from(panneau.querySelectorAll('.joueur-commandes')).entries()) {
        const lignes = Array.from(joueur.querySelectorAll('tbody tr'));
        for (let j = 0; j < lignes.length; j += 3) {
          const tranche = lignes.slice(j,j+3), elements = [joueur, ...tranche];
          // Un joueur tactile doit pouvoir quitter la capture depuis l'action qu'il règle.
          if (annuler && tranche.some(ligne => ligne.querySelector('.touche.attente'))) elements.push(actions,annuler);
          pages.push({ cle: 'joueur-' + i + '-' + j, elements });
        }
      }
      const aide = Array.from(panneau.querySelectorAll('#r-commandes > :not(.joueur-commandes)'));
      if (actions) aide.push(...actions.children);
      if (aide.length) pages.push({ cle: 'affectations', elements: aide });
      return pages;
    }
    // Les champs J2 et les conditions réelles ont leur propre [hidden], détenu par le jeu.
    // Le panneau peut lui-même être fermé lorsque les modes de préparation sont mis à jour.
    for (const champ of panneau.querySelectorAll('fieldset')) {
      const masque = champ.closest('[hidden],[inert],[aria-hidden="true"]');
      if (masque && masque !== panneau && panneau.contains(masque)) continue;
      const cle = champ.id || champ.querySelector('legend')?.textContent || String(pages.length);
      const course = panneau.id === 'p-conditions' && (cle === 'o-tours' || cle === 'o-difficulte');
      const paire = course ? 'course' : panneau.id === 'p-pilotes' ? cle.replace(/-[012]$/, '') : null;
      const derniere = pages[pages.length-1];
      if (derniere && derniere.elements.length === 1 &&
          (paire ? paire === derniere.cle : panneau.id !== 'p-conditions')) derniere.elements.push(champ);
      else pages.push({ cle: paire || cle, titre: course ? 'Course' : '', elements: [champ] });
    }
    return pages;
  }

  function afficherPage(etat, index, entrer) {
    const { panneau, pages, nav, compteur } = etat, page = pages[index];
    etat.index = index; etat.cle = page?.cle;
    nav.hidden = pages.length < 2;
    const retenus = new Set(page?.elements || []);
    for (const el of etat.elements) el.toggleAttribute('data-page-inactive', !retenus.has(el));
    const indication = (page?.titre ? page.titre + ' · ' : '') + (index + 1) + ' / ' + pages.length;
    if (compteur.textContent !== indication) compteur.textContent = indication;
    if (entrer && visible(panneau)) {
      const doc = panneau.ownerDocument, ancien = etat.memoire.get(page?.cle);
      if (panneau.contains(ancien) && restaurerFocus(doc, ancien)) return;
      const champs = groupes(panneau).filter(g => !nav.contains(g.elements[0]) &&
        page?.elements.some(el => g.elements.some(cible => el.contains(cible))));
      if (champs.some(g => restaurerFocus(doc, selection(g)))) return;
      restaurerNavigation(etat.zone, panneau);
    }
  }
  function actualiserPages(etat) {
    const pages = pagesDuPanneau(etat.panneau), actif = etat.panneau.ownerDocument.activeElement;
    for (const [cle, el] of etat.memoire) if (!etat.panneau.contains(el)) etat.memoire.delete(cle);
    // Une affectation peut reconstruire la table entière. Reprendre la même page et le
    // bouton que le jeu vient de restaurer, même lorsque ses nœuds ont changé.
    const index = pages.findIndex(p => p.cle === etat.cle);
    const choisie = index < 0 ? Math.max(0, Math.min(etat.index, pages.length - 1)) : index;
    const elements = new Set(pages.flatMap(p => p.elements));
    for (const el of etat.elements) if (!elements.has(el)) el.removeAttribute('data-page-inactive');
    const focusMasque = etat.panneau.contains(actif) && !etat.nav.contains(actif) &&
      actif.closest('fieldset, .joueur-commandes, #r-commandes') &&
      (!pages[choisie]?.elements.some(el => el.contains(actif)) || !!actif.closest('[hidden]'));
    // Masquer J2 ou reconstruire un bouton capturé peut rendre le focus au body
    // avant la notification DOM. Le restaurer seulement s'il appartenait à cette page.
    const dernier = etat.dernierFocus;
    const focusPerdu = focusMasque || (actif === etat.panneau.ownerDocument.body && dernier &&
      (!dernier.isConnected || dernier.closest('[hidden]')));
    etat.pages = pages; etat.elements = elements;
    const focusPaginationPerdu = pages.length < 2 && (etat.nav.contains(actif) ||
      (actif === etat.panneau.ownerDocument.body && etat.nav.contains(dernier)));
    afficherPage(etat, choisie, focusPerdu || focusPaginationPerdu);
  }
  function decalerPages(zone, sens) {
    if (!zone || !sens) return false;
    for (const p of zone.querySelectorAll('[data-menu-panel]')) {
      const e = PAGINATIONS.get(p);
      if (!e || p.closest('[hidden],[inert]') || e.pages.length < 2) continue;
      afficherPage(e, (e.index + (sens < 0 ? -1 : 1) + e.pages.length) % e.pages.length,
        !e.nav.contains(zone.ownerDocument.activeElement));
      return true;
    }
    return false;
  }
  function installerPages(zone) {
    if (zone.id !== 'preparation' && zone.id !== 'reglages') return;
    const doc = zone.ownerDocument;
    for (const panneau of zone.querySelectorAll('[data-menu-panel]')) {
      if (!['p-conditions','p-pilotes','r-image','r-pilotage','r-commandes-panel'].includes(panneau.id)) continue;
      let ancre = panneau.querySelector('fieldset');
      if (!ancre) continue;
      while (ancre.parentElement !== panneau) ancre = ancre.parentElement;
      const nav = doc.createElement('nav'), compteur = doc.createElement('span');
      nav.className = 'pages-reglages'; nav.setAttribute('aria-label','Pages de réglages');
      compteur.setAttribute('aria-live','polite'); compteur.setAttribute('aria-atomic','true');
      function bouton(sens, texte, etiquette) {
        const b = doc.createElement('button'); b.type = 'button'; b.textContent = texte;
        b.setAttribute('aria-label',etiquette); b.setAttribute('aria-controls',panneau.id);
        b.addEventListener('click', () => decalerPages(zone,sens)); return b;
      }
      nav.append(bouton(-1,'‹ LT','Page précédente'), compteur, bouton(1,'RT ›','Page suivante'));
      panneau.insertBefore(nav,ancre); panneau.setAttribute('data-pages-reglages','');
      const e = { zone, panneau, nav, compteur, pages: [], elements: new Set(), memoire: new Map(), index: 0 };
      PAGINATIONS.set(panneau,e); actualiserPages(e);
      panneau.addEventListener('focusin', evt => {
        e.dernierFocus = evt.target;
        if (!nav.contains(evt.target) && e.pages[e.index]?.elements.some(el => el.contains(evt.target))) e.memoire.set(e.cle,evt.target);
      });
      panneau.addEventListener('focusout', evt => {
        if (evt.relatedTarget && !panneau.contains(evt.relatedTarget)) e.dernierFocus = null;
      });
      const Observer = doc.defaultView.MutationObserver;
      if (Observer) new Observer(changements => {
        if (changements.some(m => m.type === 'childList' ? m.target.id === 'r-commandes' :
          m.target.matches('fieldset, .options-pilotes, .conditions-grille'))) actualiserPages(e);
      }).observe(panneau,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
    }
  }

  function initialiser(zone) {
    if (!zone || !zone.addEventListener) return false;
    const saisie = SAISIES.get(zone.ownerDocument);
    if (saisie && zone !== saisie.dialogue && !zone.contains(saisie.cible)) {
      fermerSaisie(zone.ownerDocument, zone === saisie.zone && !zone.ownerDocument.hidden);
    }
    // À chaque entrée d'écran, attendre le retour au neutre d'un manche tenu pendant la conduite.
    if (ETATS.has(zone)) { ETATS.get(zone).pads.clear(); return true; }
    ETATS.set(zone, { pads: new Map() });
    installerPages(zone);
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
      const dansPages = e.target.closest('.pages-reglages'), sensPage =
        e.key === 'PageDown' || (dansPages && e.key === 'ArrowRight') ? 1 :
        e.key === 'PageUp' || (dansPages && e.key === 'ArrowLeft') ? -1 : 0;
      if (sensPage && !e.target.matches('input[type="range"], select, textarea') && decalerPages(zone,sensPage)) {
        e.preventDefault(); return;
      }
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
      else if (el.closest('.pages-reglages')) { type = 'pages'; cle = el.closest('.pages-reglages'); }
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

  function restaurable(doc, el) {
    return el && el.isConnected && el.ownerDocument === doc && visible(el);
  }

  function restaurerFocus(doc, el) {
    if (!restaurable(doc, el)) return false;
    try { focaliser(el); } catch (_) { /* Vérifier le focus avant de poursuivre le repli. */ }
    return doc.activeElement === el && restaurable(doc, el);
  }

  function restaurerNavigation(zone, panneau, exclu) {
    const doc = zone.ownerDocument;
    if (!restaurable(doc, zone)) return;
    const tabs = onglets(zone).filter(el => el !== exclu);
    const selectionne = tabs.find(el => el.getAttribute('aria-selected') === 'true' && visible(el));
    if (restaurerFocus(doc, selectionne) ||
        tabs.some(el => el !== selectionne && restaurerFocus(doc, el))) return;

    const conteneurs = panneau && panneau !== zone && zone.contains(panneau) ? [panneau, zone] : [zone];
    for (const conteneur of conteneurs) {
      if (conteneur === doc.body || !restaurable(doc, conteneur)) continue;
      if (restaurerFocus(doc, conteneur)) return;
      if (conteneur.hasAttribute('tabindex')) continue;
      conteneur.setAttribute('tabindex', '-1');
      const retirerTabindex = () => {
        if (conteneur.getAttribute('tabindex') === '-1') conteneur.removeAttribute('tabindex');
      };
      if (restaurerFocus(doc, conteneur)) {
        conteneur.addEventListener('blur', retirerTabindex, { once: true });
        return;
      }
      retirerTabindex();
    }
  }

  // Nom et code du salon restent des champs natifs au clavier/tactile. A ouvre ici un brouillon
  // local, pour que la manette seule puisse aussi les remplir sans dépendre du clavier du système.
  function fermerSaisie(doc, rendreFocus = true) {
    const s = SAISIES.get(doc);
    if (!s) return false;
    SAISIES.delete(doc);
    if (s.dialogue.open) s.dialogue.close();
    if (rendreFocus) {
      const cible = s.cible;
      const cibleValide = cible && cible.isConnected && s.zone.contains(cible) && visible(cible);
      if (!cibleValide || !restaurerFocus(doc, cible)) {
        restaurerNavigation(s.zone, s.panneau, cible);
        const actif = doc.activeElement;
        if (restaurable(doc, s.zone) &&
            (actif === doc.body || actif === cible || !s.zone.contains(actif) || !restaurable(doc, actif))) {
          for (const el of s.zone.querySelectorAll(COMMANDES)) {
            if (el !== cible && el.tabIndex >= 0 && restaurerFocus(doc, el)) break;
          }
        }
      }
    }
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
    const s = { cible, zone, dialogue, panneau: cible.closest('[data-menu-panel]'),
      code: cible.dataset.menuSaisie === 'code',
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
    if (g.type === 'pages') return decalerPages(zone, sens);
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
      const doc = zone.ownerDocument;
      if (doc.hidden) fermerSaisie(doc, false);
      else if (saisie.zone !== zone) {
        fermerSaisie(doc, false);
        const actif = doc.activeElement;
        if (actif === doc.body || !zone.contains(actif) || !restaurable(doc, actif)) {
          restaurerNavigation(zone);
        }
      } else if (!zone.contains(saisie.cible) || !restaurable(doc, saisie.cible)) {
        const retourSaisie = typeof nouveau === 'function' && nouveau(8);
        fermerSaisie(doc);
        if (retourSaisie) return true;
      } else zone = saisie.dialogue;
    }
    if (!zone || zone.hidden || zone.closest(MASQUE) || zone.ownerDocument.hidden) return false;
    if (!ETATS.has(zone)) initialiser(zone);
    const etat = ETATS.get(zone), front = typeof nouveau === 'function' ? nouveau : () => false;
    const pad = options.pad, temps = Number.isFinite(options.temps) ? options.temps : performance.now();
    const d = deplacement(etat, pad, front, temps);
    const retour = front(8), gauche = front(4), droite = front(5), valider = front(0);
    const page = zone.id === 'preparation' || zone.id === 'reglages' ? (front(7) ? 1 : front(6) ? -1 : 0) : 0;
    const demarrer = typeof options.demarrer === 'function' && front(9);
    if (!retour && !gauche && !droite && !valider && !demarrer && !d && !page) return false; // Aucun parcours DOM sur une image au repos.
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
    if (page && decalerPages(zone,page)) return true;
    if (page && !gauche && !droite && !valider && !d) return false;
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
    const grille = gs[i].type === 'choix' && gs[i].cle ? Number.parseInt(gs[i].cle.dataset.menuCols || '0', 10) : 0;
    if (grille > 1) {
      const idx = gs[i].elements.indexOf(el), n = gs[i].elements.length;
      if (d === 14 || d === 15) {
        const cible = gs[i].elements[(idx + (d === 15 ? 1 : -1) + n) % n];
        focaliser(cible); if (cible !== el) cible.click(); return true;
      }
      if (d === 12 || d === 13) {
        const next = idx + (d === 13 ? grille : -grille);
        if (next >= 0 && next < n) {
          const cible = gs[i].elements[next];
          focaliser(cible); if (cible !== el) cible.click(); return true;
        }
      }
    }
    const vertical = gs[i].type === 'choix' && gs[i].cle && gs[i].cle.dataset.menuAxis === 'vertical';
    if ((vertical ? d === 12 || d === 13 : d === 14 || d === 15) && ajuster(zone, el, gs[i], sens)) { focaliser(zone.ownerDocument.activeElement); return true; }
    focaliser(selection(gs[(i + sens + gs.length) % gs.length]));
    return true;
  }

  B.navigationMenu = Object.freeze({ initialiser, ouvrirOnglet, naviguer, decalerPages, fermerSaisie });
})(globalThis.BITUME = globalThis.BITUME || {});
