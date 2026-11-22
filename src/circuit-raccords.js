// Géométrie, profils et ligne de course préparés hors ligne sur les six tronçons du catalogue.
(function (B) {
  'use strict';
  if (!B.circuit && typeof require === 'function') require('./circuit.js');
  if (!B.recettesRaccords && typeof require === 'function') require('./circuit-raccords-data.js');

  const littleEndian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
  function tableau(nom, texte, n) {
    const flux = typeof Uint8Array.fromBase64 === 'function'
      ? Uint8Array.fromBase64(texte) : Uint8Array.from(atob(texte), c => c.charCodeAt(0));
    const taille = nom === 'vibreur' ? 1 : 8, plans = new Uint8Array(n*taille);
    let entree = 0, sortie = 0;
    while (entree < flux.length) {
      const bloc = flux[entree++], longueur = (bloc & 127) + 1;
      if (sortie+longueur > plans.length || (bloc < 128 && entree+longueur > flux.length)) {
        throw new Error('BITUME : bloc de raccord invalide (' + nom + ')');
      }
      if (bloc < 128) {
        plans.set(flux.subarray(entree,entree+longueur),sortie);
        entree += longueur;
      }
      sortie += longueur;
    }
    if (sortie !== plans.length) throw new Error('BITUME : recette tronquée (' + nom + ')');
    const octets = new Uint8Array(plans.length);
    for (let b=0; b<taille; b++) {
      let v = 0;
      for (let i=0; i<n; i++) { v ^= plans[b*n+i]; octets[i*taille+b] = v; }
    }
    if (nom === 'vibreur') return octets;
    if (littleEndian && octets.byteOffset % 8 === 0) return new Float64Array(octets.buffer, octets.byteOffset, n);
    const vue = new DataView(octets.buffer,octets.byteOffset,octets.byteLength);
    return Float64Array.from({length:n}, (_,i) => vue.getFloat64(8*i,true));
  }

  function creer(def) {
    const recette = B.recettesRaccords?.[def?.id], meta = recette?.meta;
    if (!meta || def.troncons?.length !== meta.sources.length ||
        !meta.sources.every(([id,theme,graine,longueur],i) => {
          const t = def.troncons[i];
          return t.id === id && t.theme === theme && t.graine === graine && t.longueur === longueur;
        })) throw new Error('BITUME : recette de raccord absente ou tronçons différents du catalogue');
    const c = {id:def.id, nom:def.nom, graine:def.graine, theme:def.theme, generation:1, raccord:true,
      type:'trace-explicite', formatTrace:1, unite:'m', pretPourCourse:true, depart:0,
      longueur:meta.longueur, n:meta.n, pas:meta.pas, limite:meta.limite, largeur:meta.largeur,
      ligneDroite:{...meta.ligneDroite}, stands:meta.stands ? {...meta.stands} : null, secteurs:meta.secteurs.slice(),
      corridors:meta.corridors.map(t => ({...t})), tronconsThemes:meta.tronconsThemes.map(t => ({...t})),
      troncons:def.troncons.map(t => ({...t}))};
    for (const [nom,donnees] of Object.entries(recette.donnees)) c[nom] = tableau(nom,donnees,c.n);
    c.largeurG = new Float64Array(c.n).fill(c.largeur / 2);
    c.largeurD = new Float64Array(c.n).fill(c.largeur / 2);
    B.circuit.preparerStands(c);
    return c;
  }
  B.raccords = {creer};
})(globalThis.BITUME ||= {});
