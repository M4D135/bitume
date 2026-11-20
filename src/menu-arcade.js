// Aperçu du vrai tracé : projection perspective du relief, sans scène FERRO ni second contexte WebGL.
(function (B) {
  'use strict';
  const ETAPES = Object.freeze(['p-piste', 'p-conditions', 'p-pilotes', 'p-bilan']);
  const MAX_POINTS = 240, CACHE = new WeakMap(), INSTALLATIONS = new WeakMap();
  const GESTES = Object.freeze(['majeur', 'poing', 'salut']), KLAXONS = Object.freeze(['classique', 'ancien', 'mariage']);
  const borner = (v, a, b) => Math.max(a, Math.min(b, v));

  function normaliserTroll(source) {
    const choix = source && Array.isArray(source.trollPilotes) ? source.trollPilotes : [];
    return [0, 1].map(i => ({
      geste: choix[i] && GESTES.includes(choix[i].geste) ? choix[i].geste : 'majeur',
      klaxon: choix[i] && KLAXONS.includes(choix[i].klaxon) ? choix[i].klaxon : 'classique'
    }));
  }

  function preparerTrace(c, maximum = MAX_POINTS) {
    if (!c || !Number.isInteger(c.n) || c.n < 3 || !c.x || !c.z) throw new TypeError('Tracé incomplet');
    const n = Math.min(c.n, borner(Math.floor(maximum) || MAX_POINTS, 12, MAX_POINTS));
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < c.n; i++) {
      const x = c.x[i], y = c.y ? c.y[i] : 0, z = c.z[i];
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) throw new TypeError('Coordonnée de tracé non finie');
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    let rayon = 1;
    for (let i = 0; i < c.n; i++) rayon = Math.max(rayon, Math.hypot(c.x[i] - cx, c.z[i] - cz));
    const diametre = rayon * 2, points = new Float64Array(n * 3), indices = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      const j = Math.floor(i * c.n / n); indices[i] = j;
      points[i * 3] = (c.x[j] - cx) / diametre;
      points[i * 3 + 1] = ((c.y ? c.y[j] : 0) - y0) / diametre;
      points[i * 3 + 2] = (c.z[j] - cz) / diametre;
    }
    return Object.freeze({ n, points, indices, diametre, centre: Object.freeze([cx, y0, cz]), relief: (y1 - y0) / diametre,
      altitudeMin: y0, altitudeMax: y1, longueur: c.longueur || 0 });
  }

  // Enveloppe valable pour toute rotation : ni tracé coupé, ni zoom qui respire à chaque image.
  function cadrer(trace, largeur, hauteur, cadre) {
    if (!(Number.isFinite(largeur) && largeur > 0 && Number.isFinite(hauteur) && hauteur > 0)) throw new RangeError('Taille de projection invalide');
    const distance = 2.8 + trace.relief * .704, proche = distance - .355 - trace.relief * .704;
    const haut = (-.352 - trace.relief * .71) / proche, bas = .352 / (distance + .355);
    const zoom = Math.min(largeur * .84 * proche, hauteur * .77 / (bas - haut));
    cadre[0] = zoom; cadre[1] = hauteur * .535 - (haut + bas) * zoom / 2; cadre[2] = distance;
    return cadre;
  }

  // La même échelle sur les trois axes conserve le relief réel. Le troisième canal est la profondeur.
  function projeter(trace, rotation, largeur, sortie, cadre) {
    if (!Number.isFinite(rotation)) throw new RangeError('Rotation de projection invalide');
    if (sortie.length < trace.n * 3) throw new RangeError('Tampon de projection trop petit');
    const co = Math.cos(rotation), si = Math.sin(rotation), zoom = cadre[0], centreY = cadre[1], distance = cadre[2];
    for (let i = 0; i < trace.n; i++) {
      const x = trace.points[i * 3], y = trace.points[i * 3 + 1], z = trace.points[i * 3 + 2];
      const rx = x * co - z * si, rz = x * si + z * co, profondeur = distance + rz * .71 - y * .704;
      sortie[i * 3] = largeur / 2 + rx * zoom / profondeur;
      sortie[i * 3 + 1] = centreY + (rz * .704 - y * .71) * zoom / profondeur;
      sortie[i * 3 + 2] = profondeur;
    }
    return sortie;
  }

  function projeterTrace(trace, rotation, largeur, hauteur, sortie = new Float64Array(trace.n * 3)) {
    return projeter(trace, rotation, largeur, sortie, cadrer(trace, largeur, hauteur, new Float64Array(3)));
  }

  function creerApercu(canvas) {
    const doc = canvas.ownerDocument, vue = doc.defaultView;
    let ctx = null, source = null, affiche = null, trace = null, proj = null, ordre = [], rotation = -.7, dernier = -Infinity, largeur = 720, hauteur = 400;
    let tailleSale = true, imageSale = true, pause = false, visible = false, reduit = false, fond = null, detruit = false, sansContexte = false, ancienLeger = null;
    const media = vue.matchMedia && vue.matchMedia('(prefers-reduced-motion: reduce)');
    reduit = !!(media && media.matches);
    const compte = { images: 0, points: 0, preparations: 0, derniereMs: 0, maximumMs: 0, resolution: [720, 400] };
    const trier = (a, b) => proj[b * 3 + 2] - proj[a * 3 + 2];
    const redimensionner = () => { tailleSale = imageSale = true; };
    const suspendre = () => { visible = false; dernier = -Infinity; };
    const visibilite = () => { suspendre(); imageSale = true; };
    const mouvement = e => { reduit = !!e.matches; imageSale = true; dernier = -Infinity; };
    const observer = typeof vue.ResizeObserver === 'function' ? new vue.ResizeObserver(redimensionner) : null;
    if (observer) observer.observe(canvas);
    vue.addEventListener('resize', redimensionner); doc.addEventListener('visibilitychange', visibilite);
    if (media && media.addEventListener) media.addEventListener('change', mouvement);
    else if (media && media.addListener) media.addListener(mouvement);
    const sol = new Float64Array(6), cadre = new Float64Array(3);
    let co = 1, si = 0;
    function pointSol(x, z, offset) {
      const rx = x * co - z * si, rz = x * si + z * co, y = -.035, p = cadre[2] + rz * .71 - y * .704;
      sol[offset] = largeur / 2 + rx * cadre[0] / p;
      sol[offset + 1] = cadre[1] + (rz * .704 - y * .71) * cadre[0] / p;
    }
    function dimensionner(leger, r) {
      const facteur = Math.min(vue.devicePixelRatio || 1, leger ? 1 : 1.25, (leger ? 640 : 960) / r.width, (leger ? 360 : 540) / r.height);
      largeur = Math.max(1, Math.round(r.width * facteur)); hauteur = Math.max(1, Math.round(r.height * facteur));
      if (canvas.width !== largeur) canvas.width = largeur;
      if (canvas.height !== hauteur) canvas.height = hauteur;
      compte.resolution[0] = largeur; compte.resolution[1] = hauteur;
      fond = ctx.createLinearGradient(0, 0, largeur, hauteur); fond.addColorStop(0, '#18232b'); fond.addColorStop(1, '#090e14');
      cadrer(trace, largeur, hauteur, cadre); tailleSale = false;
    }
    function dessiner(t, actif, leger = false) {
      if (detruit || !actif || doc.hidden || !source || sansContexte || canvas.closest('[hidden],[inert],[aria-hidden="true"]')) { suspendre(); return false; }
      t = Number.isFinite(t) ? t : vue.performance.now();
      if (t < dernier) dernier = -Infinity;
      // Les demandes rapprochées (défilement du catalogue compris) sont réunies en une seule image.
      if (t - dernier + .000001 < (leger ? 50 : 1000 / 30)) return false;
      if (visible && source === affiche && (pause || reduit) && !imageSale && !tailleSale && ancienLeger === !!leger) return false;
      const rectangle = canvas.getBoundingClientRect();
      const style = vue.getComputedStyle && vue.getComputedStyle(canvas);
      if (!(rectangle.width > 0 && rectangle.height > 0) || style && (style.visibility === 'hidden' || style.visibility === 'collapse') ||
          rectangle.bottom <= 0 || rectangle.right <= 0 || rectangle.top >= vue.innerHeight || rectangle.left >= vue.innerWidth) { suspendre(); return false; }
      if (!ctx) { ctx = canvas.getContext('2d', { alpha: false }); if (!ctx) { sansContexte = true; suspendre(); return false; } }
      const debut = vue.performance.now();
      if (source !== affiche) {
        let prochain = CACHE.get(source);
        if (!prochain) { prochain = preparerTrace(source); CACHE.set(source, prochain); compte.preparations++; }
        trace = prochain; affiche = source;
        proj = new Float64Array(trace.n * 3); ordre = Array.from({ length: trace.n }, (_, i) => i);
        rotation = -.7; compte.points = trace.n; tailleSale = imageSale = true; dernier = -Infinity;
      }
      if (!visible) { visible = true; tailleSale = imageSale = true; dernier = -Infinity; }
      if (ancienLeger !== !!leger) { ancienLeger = !!leger; tailleSale = imageSale = true; }
      if ((pause || reduit) && !imageSale && !tailleSale) return false;
      if (!pause && !reduit && Number.isFinite(dernier)) rotation = (rotation + Math.min(.1, Math.max(0, (t - dernier) / 1000)) * .19) % (Math.PI * 2);
      if (tailleSale) dimensionner(leger, rectangle);
      co = Math.cos(rotation); si = Math.sin(rotation);
      dernier = t; imageSale = false;
      ctx.fillStyle = fond; ctx.fillRect(0, 0, largeur, hauteur);
      ctx.strokeStyle = 'rgba(133,176,191,.11)'; ctx.lineWidth = Math.max(.7, largeur / 1000); ctx.beginPath();
      for (let k = -5; k <= 5; k++) {
        pointSol(k * .12, -.64, 0); pointSol(k * .12, .64, 3);
        ctx.moveTo(sol[0], sol[1]); ctx.lineTo(sol[3], sol[4]);
        pointSol(-.64, k * .12, 0); pointSol(.64, k * .12, 3);
        ctx.moveTo(sol[0], sol[1]); ctx.lineTo(sol[3], sol[4]);
      }
      ctx.stroke();
      projeter(trace, rotation, largeur, proj, cadre);
      // Ombre et supports donnent une lecture du relief sans terrain ni végétation supplémentaires.
      ctx.strokeStyle = 'rgba(0,0,0,.38)'; ctx.lineWidth = Math.max(5, largeur / 65); ctx.lineJoin = 'round'; ctx.beginPath();
      for (let i = 0; i <= trace.n; i++) {
        const j = i % trace.n; pointSol(trace.points[j * 3], trace.points[j * 3 + 2], 0);
        if (i) ctx.lineTo(sol[0], sol[1]); else ctx.moveTo(sol[0], sol[1]);
      }
      ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = 'rgba(143,184,196,.24)'; ctx.lineWidth = Math.max(1, largeur / 720); ctx.beginPath();
      for (let i = 0; i < trace.n; i += Math.max(1, Math.floor(trace.n / 18))) {
        pointSol(trace.points[i * 3], trace.points[i * 3 + 2], 0);
        ctx.moveTo(proj[i * 3], proj[i * 3 + 1]); ctx.lineTo(sol[0], sol[1]);
      }
      ctx.stroke(); ordre.sort(trier); ctx.lineCap = 'round';
      for (const i of ordre) {
        const j = (i + 1) % trace.n, e = Math.min(largeur, hauteur * 2) / 100 * cadre[2] / proj[i * 3 + 2];
        ctx.beginPath(); ctx.moveTo(proj[i * 3], proj[i * 3 + 1]); ctx.lineTo(proj[j * 3], proj[j * 3 + 1]);
        ctx.strokeStyle = i % 12 < 6 ? '#d64c38' : '#e1dccb'; ctx.lineWidth = Math.max(4, e); ctx.stroke();
        ctx.strokeStyle = '#52636c'; ctx.lineWidth = Math.max(2, e * .55); ctx.stroke();
      }
      const x = proj[0], y = proj[1], r = Math.max(3, largeur / 150);
      ctx.fillStyle = '#f5bc5b'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f5bc5b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y - r - hauteur * .07); ctx.stroke();
      ctx.fillStyle = '#f5bc5b'; ctx.font = '600 ' + Math.max(9, largeur / 75) + 'px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('DÉPART', x, Math.max(12, y - r - hauteur * .085));
      ctx.lineCap = 'butt';
      compte.images++; compte.derniereMs = vue.performance.now() - debut; compte.maximumMs = Math.max(compte.maximumMs, compte.derniereMs);
      return true;
    }
    return Object.freeze({
      choisir(c) {
        if (detruit || source === c) return;
        if (!c || typeof c !== 'object') throw new TypeError('Tracé incomplet');
        source = c; imageSale = true; // Aucune lecture des coordonnées ni allocation avant une image visible.
      },
      dessiner,
      suspendre,
      pause(value) { if (pause !== !!value) { pause = !!value; imageSale = true; dernier = -Infinity; } },
      detruire() {
        if (detruit) return;
        detruit = true; suspendre();
        if (observer) observer.disconnect();
        vue.removeEventListener('resize', redimensionner); doc.removeEventListener('visibilitychange', visibilite);
        if (media && media.removeEventListener) media.removeEventListener('change', mouvement);
        else if (media && media.removeListener) media.removeListener(mouvement);
        source = affiche = trace = proj = fond = ctx = null; ordre.length = 0;
      },
      get enPause() { return pause; },
      get mouvementReduit() { return reduit; },
      stats() { return { ...compte, resolution: [...compte.resolution], rotation, actif: visible, pause: pause || reduit,
        altitudeMin: trace ? trace.altitudeMin : null, altitudeMax: trace ? trace.altitudeMax : null, detruit }; }
    });
  }

  function installer(zone, options = {}) {
    if (INSTALLATIONS.has(zone)) return INSTALLATIONS.get(zone);
    const doc = zone.ownerDocument, $ = id => doc.getElementById(id), apercu = creerApercu($('p-trace-3d'));
    let etape = 0, version = 0, reliefSale = false, detruit = false, mouvementAffiche = null;
    const retirer = [], ecouter = (el, type, f) => { el.addEventListener(type, f); retirer.push(() => el.removeEventListener(type, f)); };
    const avancer = (sens, focus = true) => ouvrir(borner(etape + sens, 0, ETAPES.length - 1), focus);
    function actualiser() {
      if (detruit) return;
      version++;
      const actif = zone.querySelector('[data-menu-tab][aria-selected="true"]');
      const precedente = etape;
      etape = Math.max(0, ETAPES.indexOf(actif && actif.dataset.menuTab));
      if (etape !== precedente) {
        const contenu = zone.querySelector('.panneaux-menu');
        if (contenu) contenu.scrollTop = 0; // Une nouvelle étape s'ouvre au début, sans déplacer les réglages en cours.
      }
      zone.dataset.etape = String(etape);
      $('p-etape').textContent = '0' + (etape + 1) + ' / 04';
      $('b-precedent').textContent = etape ? 'Précédent' : 'Menu';
      $('b-suivant').hidden = etape === 3; $('b-depart').hidden = etape !== 3;
      $('b-suivant').textContent = ['Conditions →', 'Pilotes →', 'Prêt à partir →'][etape] || 'Continuer';
      if (etape !== 0) apercu.suspendre();
      if (options.actualiser) options.actualiser(etape);
    }
    function disponible(el) {
      if (!el || el.disabled || el.matches(':disabled') || el.closest('[hidden],[inert],[aria-hidden="true"],[aria-disabled="true"]') || !el.getClientRects().length) return false;
      const style = doc.defaultView.getComputedStyle(el);
      return style.visibility !== 'hidden' && style.visibility !== 'collapse';
    }
    function focaliser() {
      const panneau = $(ETAPES[etape]);
      const selection = Array.from(panneau.querySelectorAll('[role="radio"][aria-checked="true"],input:checked')).find(disponible);
      const cible = selection || Array.from(panneau.querySelectorAll('select,button,input')).find(disponible) || (etape === 3 ? $('b-depart') : $('b-suivant'));
      if (disponible(cible)) {
        cible.focus({ preventScroll: true });
        const voyant = cible.type === 'radio' || cible.type === 'checkbox' ? cible.closest('label') || cible : cible;
        voyant.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      }
    }
    function ouvrir(index, focus = true) {
      if (detruit) return false;
      const avant = version, cible = ETAPES[borner(Number.isFinite(index) ? Math.trunc(index) : 0, 0, ETAPES.length - 1)];
      if (!B.navigationMenu.ouvrirOnglet(zone, cible)) return false;
      if (version === avant) actualiser(); // Un changement d'onglet a déjà notifié le bilan une seule fois.
      if (focus) focaliser();
      return true;
    }
    ecouter(zone, 'menuongletchange', actualiser);
    ecouter($('b-suivant'), 'click', () => avancer(1));
    ecouter($('b-precedent'), 'click', () => options.retour && options.retour());
    ecouter($('p-retour'), 'click', () => options.retour && options.retour());
    function rotation() {
      const bouton = $('p-rotation'), reduit = apercu.mouvementReduit;
      mouvementAffiche = reduit; bouton.disabled = reduit;
      bouton.setAttribute('aria-pressed', String(apercu.enPause || reduit));
      bouton.textContent = reduit ? 'Rotation désactivée' : apercu.enPause ? 'Reprendre la rotation' : 'Figer le tracé';
      bouton.title = reduit ? 'Mouvement réduit demandé dans le système' : '';
    }
    rotation();
    ecouter($('p-rotation'), 'click', () => {
      apercu.pause(!apercu.enPause); rotation();
    });
    ecouter($('circuits'), 'keydown', e => {
      const carte = e.target.closest('[role="radio"]'); if (!carte || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !disponible(carte)) return;
      const liste = Array.from($('circuits').querySelectorAll('[role="radio"]')).filter(disponible), i = liste.indexOf(carte);
      if (i < 0) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        e.preventDefault(); const sens = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1;
        const j = e.key === 'Home' ? 0 : e.key === 'End' ? liste.length - 1 : (i + sens + liste.length) % liste.length;
        liste[j].click(); liste[j].focus({ preventScroll: true }); liste[j].scrollIntoView({ block: 'nearest', behavior: 'auto' });
      } else if (e.key === 'Enter' && carte.getAttribute('aria-checked') === 'true') { e.preventDefault(); if (!e.repeat) avancer(1); }
    });
    const api = Object.freeze({
      ouvrir, actualiser,
      retour() { if (detruit || !etape) return false; avancer(-1); return true; },
      valider(el) { if (!detruit && etape === 0 && disponible(el) && zone.contains(el) && el.closest('#circuits') && el.getAttribute('aria-checked') === 'true') { avancer(1); return true; } return false; },
      trace(c, fiche, catalogue, index, total) {
        if (detruit) return;
        apercu.choisir(c); $('p-trace-3d').setAttribute('aria-label', 'Tracé en trois dimensions de ' + catalogue.nom + ', avec son relief réel');
        $('p-circuit-nom').textContent = catalogue.nom; $('p-circuit-lieu').textContent = catalogue.lieu;
        $('p-circuit-numero').textContent = String(index + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
        $('p-circuit-km').textContent = fiche.km; $('p-circuit-virages').textContent = String(fiche.virages);
        const tr = CACHE.get(c); reliefSale = !tr;
        $('p-circuit-relief').textContent = tr ? String(Math.round(tr.altitudeMax - tr.altitudeMin)) : '…';
      },
      image(t, actif, leger) {
        if (detruit) return false;
        if (mouvementAffiche !== apercu.mouvementReduit) rotation();
        const dessine = apercu.dessiner(t, actif && etape === 0, leger);
        if (dessine && reliefSale) { const s = apercu.stats(); $('p-circuit-relief').textContent = String(Math.round(s.altitudeMax - s.altitudeMin)); reliefSale = false; }
        return dessine;
      },
      suspendre: apercu.suspendre,
      detruire() { if (!detruit) { detruit = true; retirer.forEach(f => f()); apercu.detruire(); INSTALLATIONS.delete(zone); } },
      get etape() { return etape; },
      stats: () => ({ etape, ...apercu.stats() })
    });
    INSTALLATIONS.set(zone, api);
    return api;
  }
  B.menuArcade = Object.freeze({ ETAPES, MAX_POINTS, preparerTrace, projeterTrace, creerApercu, installer, normaliserTroll });
})(globalThis.BITUME = globalThis.BITUME || {});
