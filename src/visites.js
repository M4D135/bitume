/* BITUME — compteur global du titre. Aucun appel dans le rendu ; activité regroupée hors de la boucle. */
(function (B) {
  'use strict';
  const SESSION = 30 * 60 * 1000, RAPPEL = 5 * 60 * 1000;
  const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const CLE_VISITEUR = 'bitume.visiteur.v2', CLE_SESSION = 'bitume.visite.v2', COOKIE_VISITEUR = 'bitume_vid';
  function lireCookie(doc) {
    try {
      const m = String(doc?.cookie || '').match(/(?:^|;\s*)bitume_vid=([0-9a-f-]{36})/i);
      return m && ID.test(m[1]) ? m[1] : null;
    } catch { return null; }
  }
  function ecrireCookie(doc, id, https) {
    try {
      if (doc && typeof doc.cookie === 'string')
        doc.cookie = COOKIE_VISITEUR + '=' + id + '; Max-Age=31536000; Path=/; SameSite=Lax' + (https ? '; Secure' : '');
    } catch {}
  }
  function creer(env = globalThis) {
    const document = env.document, racine = document?.getElementById('compteur-visites');
    const visites = document?.getElementById('compteur-total'), uniques = document?.getElementById('compteur-uniques');
    const horloge = () => env.Date?.now?.() ?? Date.now();
    let commence = false, titreVisible = false, occupe = false, minuterie = null, detruit = false;
    let signal = -Infinity, derniereActivite = 0, dernierPost = -Infinity, dernierGet = -Infinity, prochainEssai = 0, dernierId = null;
    let derniersTotaux = null;
    const afficher = valeurs => {
      derniersTotaux = valeurs;
      if (!racine || !visites || !uniques) return;
      visites.textContent = valeurs ? valeurs.visites.toLocaleString('fr-FR') : '—';
      const nbVisiteurs = valeurs ? (Number.isSafeInteger(valeurs.visiteurs) ? valeurs.visiteurs : valeurs.visiteursUniques) : null;
      uniques.textContent = nbVisiteurs !== null ? nbVisiteurs.toLocaleString('fr-FR') : '—';
      racine.dataset.etat = valeurs ? 'disponible' : 'indisponible';
      racine.title = valeurs ? 'Visites (sessions de 30 min) et visiteurs distincts.' : 'Compteur indisponible pour le moment.';
    };
    function programmer(delai = 120) {
      if (detruit || minuterie !== null) return;
      minuterie = env.setTimeout(() => { minuterie = null; void actualiser(); }, delai);
    }
    function identifiants(t) {
      if (env.navigator?.webdriver === true) return null;   // automates / sondes headless : lecture seule, aucun comptage
      try {
        const stock = env.localStorage, https = env.location?.protocol === 'https:';
        let visitorId = stock.getItem(CLE_VISITEUR) || lireCookie(document), cree = false;
        if (!ID.test(visitorId || '')) {
          visitorId = env.crypto.randomUUID();
          if (!ID.test(visitorId)) return null;
          cree = true;
        }
        stock.setItem(CLE_VISITEUR, visitorId);
        ecrireCookie(document, visitorId, https);
        // Relire la valeur commune : deux premiers onglets ne conservent pas deux identités concurrentes.
        visitorId = stock.getItem(CLE_VISITEUR);
        if (!ID.test(visitorId || '')) return null;
        let session; try { session = JSON.parse(stock.getItem(CLE_SESSION)); } catch {}
        if (!session || session.visitorId !== visitorId || !ID.test(session.id || '') || !Number.isFinite(session.activite) ||
            session.activite < 0 || session.activite > horloge() + SESSION || t - session.activite >= SESSION)
          session = { visitorId, id: env.crypto.randomUUID(), activite: t };
        if (!ID.test(session.id)) return null;
        session.activite = Math.max(session.activite, t);
        stock.setItem(CLE_SESSION, JSON.stringify(session));
        return { visitorId, visitId: session.id, cree };
      } catch { return null; } // Stockage bloqué : lecture des vrais totaux, sans inventer un nouvel utilisateur à chaque page.
    }
    async function partager(t) {
      if (env.navigator?.locks?.request) {
        try { return await env.navigator.locks.request('bitume-compteur-visites', () => identifiants(t)); } catch {}
      }
      const ids = identifiants(t);
      if (!ids?.cree) return ids;
      await new Promise(r => env.setTimeout(r, 40));
      return identifiants(t);
    }
    async function actualiser() {
      if (detruit || occupe || !commence) return;
      const t = horloge();
      if (t < prochainEssai) { if (titreVisible) programmer(prochainEssai - t); return; }
      if (!['http:', 'https:'].includes(env.location?.protocol) || typeof env.fetch !== 'function') { afficher(null); return; }
      occupe = true;
      try {
        const ids = await partager(derniereActivite || t);
        const post = ids && (dernierId !== ids.visitId || derniereActivite > dernierPost && t - dernierPost >= RAPPEL);
        if (!post && (!titreVisible || derniersTotaux && t - dernierGet < 60000)) return;
        const controle = typeof env.AbortController === 'function' ? new env.AbortController() : null;
        const delai = controle ? env.setTimeout(() => controle.abort(), 6000) : null;
        let reponse;
        try {
          reponse = await env.fetch('/salon/visites', { method: post ? 'POST' : 'GET', cache: 'no-store', credentials: 'omit',
            headers: post ? { 'Content-Type': 'application/json' } : {},
            ...(post ? { body: JSON.stringify({ visitorId: ids.visitorId, visitId: ids.visitId }) } : {}),
            ...(controle ? { signal: controle.signal } : {}) });
          if (!reponse.ok) throw new Error('Compteur indisponible');
          const d = await reponse.json();
          if (!d || !Number.isSafeInteger(d.visites) || !Number.isSafeInteger(d.visiteursUniques) || d.visiteursUniques < 0 || d.visites < d.visiteursUniques)
            throw new Error('Réponse de compteur invalide');
          const nbVis = Number.isSafeInteger(d.reseauxUniques) && d.reseauxUniques > 0 ? Math.min(d.visiteursUniques, d.reseauxUniques) : d.visiteursUniques;
          afficher({ visites: d.visites, visiteursUniques: d.visiteursUniques, visiteurs: nbVis });
          dernierGet = horloge();
          if (post) { dernierPost = derniereActivite; dernierId = ids.visitId; }
          prochainEssai = 0;
        } finally { if (delai !== null) env.clearTimeout(delai); }
      } catch { afficher(null); prochainEssai = horloge() + 30000; }
      finally { occupe = false; if (titreVisible) programmer(prochainEssai ? Math.max(120, prochainEssai - horloge()) : 60000); }
    }
    function activite(force = false) {
      if (!commence || detruit || document?.hidden) return;
      const t = horloge();
      if (!force && t - signal < 15000) return;
      signal = derniereActivite = t;
      // Le minuteur du rafraîchissement ne doit pas retarder la première vraie activité après une pause.
      if (minuterie !== null) { env.clearTimeout(minuterie); minuterie = null; }
      programmer();
    }
    function titre(visible) {
      titreVisible = !!visible;
      if (!titreVisible) return;
      commence = true; activite(true);
    }
    const surActivite = e => { if (e?.isTrusted !== false) activite(); };
    for (const nom of ['pointerdown', 'pointermove', 'keydown', 'wheel']) document?.addEventListener(nom, surActivite, { passive: true });
    function detruire() {
      detruit = true; if (minuterie !== null) env.clearTimeout(minuterie);
      for (const nom of ['pointerdown', 'pointermove', 'keydown', 'wheel']) document?.removeEventListener(nom, surActivite);
    }
    afficher(null);
    return { titre, activite, detruire, actualiser };
  }
  B.visites = { creer, SESSION };
})(globalThis.BITUME = globalThis.BITUME || {});
