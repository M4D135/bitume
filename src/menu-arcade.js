// Aperçu du vrai tracé : projection perspective du relief, sans scène FERRO ni second contexte WebGL.
(function (B) {
  'use strict';
  const ETAPES = Object.freeze(['p-piste', 'p-conditions', 'p-pilotes', 'p-bilan']);
  const MAX_POINTS = 240, CACHE = new WeakMap();
  const borner = (v, a, b) => Math.max(a, Math.min(b, v));

  function preparerTrace(c, maximum = MAX_POINTS) {
    if (!c || !Number.isInteger(c.n) || c.n < 3 || !c.x || !c.z) throw new TypeError('Tracé incomplet');
    const n = Math.min(c.n, borner(Math.floor(maximum) || MAX_POINTS, 12, MAX_POINTS));
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < c.n; i++) {
      const x = c.x[i], y = c.y ? c.y[i] : 0, z = c.z[i];
      if (![x, y, z].every(Number.isFinite)) throw new TypeError('Coordonnée de tracé non finie');
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

  // La même échelle sur les trois axes conserve le relief réel. Le troisième canal est la profondeur.
  function projeterTrace(trace, rotation, largeur, hauteur, sortie = new Float64Array(trace.n * 3)) {
    if (sortie.length < trace.n * 3) throw new RangeError('Tampon de projection trop petit');
    const co = Math.cos(rotation), si = Math.sin(rotation), zoom = Math.min(largeur * .76, hauteur * 1.34) * 2.8 / (1 + trace.relief * .85);
    const centreY = hauteur * (.55 + Math.min(.14, trace.relief * .22));
    for (let i = 0; i < trace.n; i++) {
      const x = trace.points[i * 3], y = trace.points[i * 3 + 1], z = trace.points[i * 3 + 2];
      const rx = x * co - z * si, rz = x * si + z * co, profondeur = 2.8 + rz * .71 - y * .704;
      sortie[i * 3] = largeur / 2 + rx * zoom / profondeur;
      sortie[i * 3 + 1] = centreY + (rz * .704 - y * .71) * zoom / profondeur;
      sortie[i * 3 + 2] = profondeur;
    }
    return sortie;
  }

  function creerApercu(canvas) {
    const ctx = canvas.getContext('2d', { alpha: false });
    let trace = null, proj = null, ordre = [], rotation = -.7, dernier = -Infinity, largeur = 720, hauteur = 400;
    let tailleSale = true, imageSale = true, pause = false, visible = false, reduit = false, fond = null;
    const vue = canvas.ownerDocument.defaultView;
    const media = vue.matchMedia && vue.matchMedia('(prefers-reduced-motion: reduce)');
    reduit = !!(media && media.matches);
    const compte = { images: 0, points: 0, derniereMs: 0, maximumMs: 0, resolution: [720, 400] };
    const trier = (a, b) => proj[b * 3 + 2] - proj[a * 3 + 2];
    const observer = typeof vue.ResizeObserver === 'function' ? new vue.ResizeObserver(() => { tailleSale = imageSale = true; }) : null;
    if (observer) observer.observe(canvas); else vue.addEventListener('resize', () => { tailleSale = imageSale = true; });
    if (media && media.addEventListener) media.addEventListener('change', e => { reduit = e.matches; imageSale = true; });
    const sol = new Float64Array(6);
    function pointSol(x, z, offset) {
      const co = Math.cos(rotation), si = Math.sin(rotation), rx = x * co - z * si, rz = x * si + z * co;
      const y = -.035, p = 2.8 + rz * .71 - y * .704;
      const zoom = Math.min(largeur * .76, hauteur * 1.34) * 2.8 / (1 + trace.relief * .85);
      sol[offset] = largeur / 2 + rx * zoom / p;
      sol[offset + 1] = hauteur * (.55 + Math.min(.14, trace.relief * .22)) + (rz * .704 - y * .71) * zoom / p;
    }
    function dimensionner(leger) {
      const r = canvas.getBoundingClientRect(), plafond = leger ? 640 : 960;
      largeur = Math.max(1, Math.round(Math.min(plafond, r.width * Math.min(vue.devicePixelRatio || 1, leger ? 1 : 1.25))));
      hauteur = Math.max(1, Math.round(largeur * (r.height || 400) / Math.max(1, r.width || 720)));
      if (canvas.width !== largeur) canvas.width = largeur;
      if (canvas.height !== hauteur) canvas.height = hauteur;
      compte.resolution[0] = largeur; compte.resolution[1] = hauteur;
      fond = ctx.createLinearGradient(0, 0, largeur, hauteur); fond.addColorStop(0, '#18232b'); fond.addColorStop(1, '#090e14');
      tailleSale = false;
    }
    function dessiner(t, actif, leger = false) {
      const montre = !!actif && !canvas.ownerDocument.hidden;
      if (!montre || !trace || !ctx) { visible = false; dernier = -Infinity; return false; }
      if (!visible) { visible = true; tailleSale = imageSale = true; dernier = -Infinity; }
      if ((pause || reduit) && !imageSale && !tailleSale) return false;
      if (!imageSale && t - dernier < (leger ? 50 : 1000 / 30)) return false;
      const debut = vue.performance.now();
      if (!pause && !reduit && Number.isFinite(dernier)) rotation += Math.min(.1, Math.max(0, (t - dernier) / 1000)) * .19;
      if (tailleSale) dimensionner(leger);
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
      projeterTrace(trace, rotation, largeur, hauteur, proj);
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
        const j = (i + 1) % trace.n, e = largeur / 100 * 2.8 / proj[i * 3 + 2];
        ctx.beginPath(); ctx.moveTo(proj[i * 3], proj[i * 3 + 1]); ctx.lineTo(proj[j * 3], proj[j * 3 + 1]);
        ctx.strokeStyle = i % 12 < 6 ? '#d64c38' : '#e1dccb'; ctx.lineWidth = Math.max(4, e); ctx.stroke();
        ctx.strokeStyle = '#52636c'; ctx.lineWidth = Math.max(2, e * .55); ctx.stroke();
      }
      const x = proj[0], y = proj[1], r = Math.max(3, largeur / 150);
      ctx.fillStyle = '#f5bc5b'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f5bc5b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y - r - hauteur * .07); ctx.stroke();
      ctx.fillStyle = '#f5bc5b'; ctx.font = '600 ' + Math.max(9, largeur / 75) + 'px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('DÉPART', x, y - r - hauteur * .085);
      ctx.lineCap = 'butt';
      compte.images++; compte.derniereMs = vue.performance.now() - debut; compte.maximumMs = Math.max(compte.maximumMs, compte.derniereMs);
      return true;
    }
    return Object.freeze({
      choisir(c) {
        let prochain = CACHE.get(c); if (!prochain) { prochain = preparerTrace(c); CACHE.set(c, prochain); }
        if (trace === prochain) return;
        trace = prochain; proj = new Float64Array(trace.n * 3); ordre = Array.from({ length: trace.n }, (_, i) => i);
        rotation = -.7; compte.points = trace.n; imageSale = true;
      },
      dessiner,
      pause(value) { pause = !!value; imageSale = true; },
      get enPause() { return pause; },
      get mouvementReduit() { return reduit; },
      stats() { return { ...compte, resolution: [...compte.resolution], rotation, actif: visible, pause: pause || reduit }; }
    });
  }

  function installer(zone, options = {}) {
    const doc = zone.ownerDocument, $ = id => doc.getElementById(id), apercu = creerApercu($('p-trace-3d'));
    let etape = 0;
    const avancer = (sens, focus = true) => ouvrir(borner(etape + sens, 0, ETAPES.length - 1), focus);
    function actualiser() {
      const actif = zone.querySelector('[data-menu-tab][aria-selected="true"]');
      etape = Math.max(0, ETAPES.indexOf(actif && actif.dataset.menuTab));
      zone.dataset.etape = String(etape);
      $('p-etape').textContent = '0' + (etape + 1) + ' / 04';
      $('b-precedent').textContent = etape ? 'Précédent' : 'Menu';
      $('b-suivant').hidden = etape === 3; $('b-depart').hidden = etape !== 3;
      $('b-suivant').textContent = ['Conditions →', 'Pilotes →', 'Prêt à partir →'][etape] || 'Continuer';
      if (options.actualiser) options.actualiser(etape);
    }
    function focaliser() {
      const panneau = $(ETAPES[etape]);
      const cible = panneau.querySelector('[role="radio"][aria-checked="true"],input:checked,select,button') || (etape === 3 ? $('b-depart') : $('b-suivant'));
      if (cible && !cible.closest('[hidden]')) cible.focus({ preventScroll: true });
    }
    function ouvrir(index, focus = true) {
      B.navigationMenu.ouvrirOnglet(zone, ETAPES[borner(index, 0, 3)]); actualiser();
      if (focus) focaliser();
    }
    zone.addEventListener('menuongletchange', actualiser);
    $('b-suivant').addEventListener('click', () => avancer(1));
    $('b-precedent').addEventListener('click', () => options.retour && options.retour());
    $('p-retour').addEventListener('click', () => options.retour && options.retour());
    $('p-rotation').addEventListener('click', () => {
      apercu.pause(!apercu.enPause); $('p-rotation').setAttribute('aria-pressed', String(apercu.enPause));
      $('p-rotation').textContent = apercu.enPause ? 'Reprendre la rotation' : 'Figer le tracé';
    });
    $('circuits').addEventListener('keydown', e => {
      const carte = e.target.closest('[role="radio"]'); if (!carte || e.altKey || e.ctrlKey || e.metaKey) return;
      const liste = Array.from($('circuits').children), i = liste.indexOf(carte);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        e.preventDefault(); const sens = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1;
        const j = e.key === 'Home' ? 0 : e.key === 'End' ? liste.length - 1 : (i + sens + liste.length) % liste.length;
        liste[j].click(); liste[j].focus({ preventScroll: true }); liste[j].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && carte.getAttribute('aria-checked') === 'true') { e.preventDefault(); avancer(1); }
    });
    return Object.freeze({
      ouvrir, actualiser,
      retour() { if (!etape) return false; avancer(-1); return true; },
      valider(el) { if (etape === 0 && el && el.closest('#circuits') && el.getAttribute('aria-checked') === 'true') { avancer(1); return true; } return false; },
      trace(c, fiche, catalogue, index, total) {
        apercu.choisir(c); $('p-trace-3d').setAttribute('aria-label', 'Tracé en trois dimensions de ' + catalogue.nom + ', avec son relief réel');
        $('p-circuit-nom').textContent = catalogue.nom; $('p-circuit-lieu').textContent = catalogue.lieu;
        $('p-circuit-numero').textContent = String(index + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
        $('p-circuit-km').textContent = fiche.km; $('p-circuit-virages').textContent = String(fiche.virages);
        const tr = CACHE.get(c); $('p-circuit-relief').textContent = String(Math.round(tr.altitudeMax - tr.altitudeMin));
      },
      image(t, actif, leger) { return apercu.dessiner(t, actif && etape === 0, leger); },
      get etape() { return etape; },
      stats: () => ({ etape, ...apercu.stats() })
    });
  }
  B.menuArcade = Object.freeze({ ETAPES, MAX_POINTS, preparerTrace, projeterTrace, creerApercu, installer });
})(globalThis.BITUME = globalThis.BITUME || {});
