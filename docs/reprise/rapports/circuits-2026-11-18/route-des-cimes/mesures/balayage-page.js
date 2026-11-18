/* Balayage serré du budget : une pose tous les #pas m (vue cockpit, rivaux à l'autre bout), appels et triangles. */
(async () => {
  const J = window.BITUME_JEU, B = window.BITUME, h = new URLSearchParams(location.hash.slice(1));
  const pas = +(h.get('pas') || 250), q = h.get('qualite') || 'low', ids = h.get('circuits').split(',');
  const image = () => new Promise(r => requestAnimationFrame(() => r()));
  const base = { mode: 'solo', vue: 'cockpit', graine: 17017, meteo: 'sec', moment: 'jour', saison: 'ete', decor: 'enrichi', retro: 'oui', tours: 3, qualite: q };
  const sortie = [];
  for (const id of ids) {
    const i = J.CATALOGUE.findIndex(k => k.id === id), poses = [];
    J.reference({ ...base, circuit: i, depart: 0, vitesse: 0, pilote: false });
    const L = J.session.course.c.longueur;
    for (let s = 100; s < L; s += pas) {
      J.reference({ ...base, circuit: i, depart: s, vitesse: 40, pilote: true });
      const S = J.session, co = S.course, c = co.c;
      co.voitures.forEach((v, n) => {
        if (v.joueur) return;
        const et = v.etat; et.s = (s + L / 2 + n * 14) % L; et.d = n % 2 ? 3 : -3; et.v = 0;
        const e = B.circuit.echantillon(c, et.s); et.y = e.y - et.d * Math.sin(e.devers); co.sAvant[v.id] = et.s; v.roule = et.s;
      });
      for (let k = 0; k < 8; k++) await image();
      poses.push([s, J.rendu.stats.drawCalls, Math.round(J.rendu.stats.triangles)]);
    }
    const pire = poses.reduce((a, p) => p[1] > a[1] ? p : a), triMax = Math.max(...poses.map(p => p[2]));
    sortie.push({ id, qualite: q, pas, nombre: poses.length, appelsMax: pire[1], s: pire[0], triMax, poses });
  }
  return sortie;
})();
