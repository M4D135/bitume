/* BITUME — lieux de Route-des-Cimes : terrain sculpté et ouvrages procéduraux.
   Le tracé, les limites et les forces p15 sont lus sans modification. Aucun asset importé. */
(function (B) {
  'use strict';
  const cache = new WeakMap();
  const borner = x => Math.max(0, Math.min(1, x));
  const doux = (a, b, x) => { const t = borner((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  function planifier(c) {
    if (c?.id !== 'route-des-cimes') return null;
    if (cache.has(c)) return cache.get(c);
    const pont = c.ponts[0], s = (pont.debut + pont.fin) / 2, f = B.circuit.echantillon(c, s);
    const plan = { pont, centre: f, demiPortee: (pont.fin - pont.debut) / 2,
      corniches: c.bords.filter(b => b.type === 'vide'), refugeS: c.lieux.find(l => l.n === 5).debut + 120 };
    cache.set(c, plan); return plan;
  }
  function relief(c, x, z, q, h) {
    const p = planifier(c); if (!p) return h;
    const f = p.centre, dx = x - f.x, dz = z - f.z, co = Math.cos(f.cap), si = Math.sin(f.cap);
    const along = dx * co + dz * si, across = -dx * si + dz * co;
    const s = q.i >= 0 ? q.i * c.pas : -1;
    // La gorge passe SOUS le tablier. Les autres branches gardent leur terrain de raccord.
    const voisinPont = s >= p.pont.debut - 50 && s <= p.pont.fin + 50;
    const protection = voisinPont || q.i < 0 ? 1 : doux(25, 65, q.d);
    const lit = Math.abs(along - 5 * Math.sin(across / 73));
    const poids = (1 - doux(25, 88, lit)) * (1 - doux(190, 420, Math.abs(across))) * protection;
    const fond = f.y - 55 - across * .025;
    h += (Math.min(h, fond) - h) * poids;
    if (q.i >= 0) for (const v of p.corniches) {
      if (s < v.debut || s > v.fin) continue;
      const a = c.cap[q.i], lateral = -(x - c.x[q.i]) * Math.sin(a) + (z - c.z[q.i]) * Math.cos(a);
      const dehors = lateral * (v.cote === 'G' ? -1 : 1);
      const bord = doux(0, 65, Math.min(s - v.debut, v.fin - s));
      h -= 58 * doux(10, 62, dehors) * bord;
    }
    return h;
  }
  function couperAccotement(c, s, type) {
    if (type !== 'herbe' && type !== 'jupe') return false;
    const p = planifier(c); if (!p) return false;
    return s > p.pont.debut + c.pas && s < p.pont.fin - c.pas;
  }
  function poser(c, outils) {
    const p = planifier(c); if (!p) return null;
    const D = B.decor, { terrain, ajouter, qualite } = outils;
    const objets = [], loin = [], pierre = [.49, .46, .40];
    const metrique = (s, d = 0, dy = 0) => {
      const f = B.circuit.echantillon(c, s);
      return [f.x - Math.sin(f.cap) * d, f.y - Math.sin(f.devers) * d + dy, f.z + Math.cos(f.cap) * d];
    };
    function poutre(a, b, epaisseur, largeur, genre, teinte, mat = 9) {
      const u = b.map((x, i) => x - a[i]), l = Math.hypot(...u);
      const o = { shape: 'bevel', p: a.map((x, i) => (x + b[i]) / 2), s: [l + .035, epaisseur, largeur],
        r: D.angles(...D.base(u, [0, 1, 0])), mat, color: teinte, lieuCimes: 'Pont de la Gorge', partie: genre };
      D.marquerSolide(o, genre, 2); objets.push(o); loin.push(o); return o;
    }
    const pont = p.pont, N = 44, portee = pont.fin - pont.debut;
    const arche = t => {
      const s = pont.debut + t * (pont.fin - pont.debut), u = 2 * t - 1;
      return metrique(s, 0, -45 + 40 * Math.sqrt(Math.max(0, 1 - u * u)));
    };
    // Voussoirs réguliers pour la structure, nuances à graine stable pour la pierre.
    // La voûte a un vrai vide ; aucun gros cube invisible ne bouche son arche.
    for (let i = 0; i < N; i++) {
      const a = arche(i / N), b = arche((i + 1) / N), t = (i + .5) / N;
      const nuance = .94 + .10 * Math.sin(i * 2.137 + c.graine);
      poutre(a, b, 3.6, 14.7, 'arche-cimes', pierre.map(v => v * nuance));
      const s = pont.debut + t * (pont.fin - pont.debut), f = B.circuit.echantillon(c, s), fond = (a[1] + b[1]) / 2 + 1.8;
      const haut = f.y - .4, hauteur = haut - fond;
      if (hauteur > .15) {
        const o = { shape: 'bevel', p: [f.x, (haut + fond) / 2, f.z], s: [(pont.fin - pont.debut) / N + .03, hauteur, 14.55],
          r: [0, -f.cap, 0], mat: 9, color: pierre.map(v => v * (nuance - .04)), lieuCimes: 'Pont de la Gorge', partie: 'tympan-cimes' };
        D.marquerSolide(o, 'tympan-cimes', 2); objets.push(o); loin.push(o);
      }
      // Corniche fine au bord du tablier : la glissière déjà présente garde le corridor de collision.
      for (const cote of [-1, 1]) poutre(metrique(pont.debut + i / N * portee, cote * 7.25, -.32),
        metrique(pont.debut + (i + 1) / N * portee, cote * 7.25, -.32), .54, .34, 'rive-pont-cimes', [.63, .60, .53]);
    }
    ajouter(objets, loin, p.centre.x, p.centre.z);
    // Refuge visible au col, sur le sol effectivement dessiné et à l'écart de toute chaussée.
    let refuge = null;
    if (B.batiments) {
      const f = B.circuit.echantillon(c, p.refugeS), d = -43;
      const x = f.x - Math.sin(f.cap) * d, z = f.z + Math.cos(f.cap) * d, sol = terrain.sol(x, z);
      const site = { x, z, sol, bas: sol - 1.4, a: f.cap, l: 15.5, w: 9.5, h: 5.2, theme: 'montagne', graine: c.graine,
        enduit: [.62, .59, .50] };
      const maison = B.batiments.maison(site, { detail: qualite !== 'low', neige: !!outils.saison?.neige });
      for (const o of maison.objets) o.lieuCimes = 'Refuge de l’Aiglière';
      ajouter(maison.objets, maison.loin, x, z); refuge = { x, z, y: sol, objets: maison.objets.length };
    }
    return Object.freeze({ pont: { nom: pont.nom, debut: pont.debut, fin: pont.fin, voussoirs: N,
      objets: objets.length, hauteurArche: 40, gorgeProfondeur: 55 }, refuge,
      corniches: p.corniches.map(v => ({ nom: v.nom, debut: v.debut, fin: v.fin })) });
  }
  B.cimesDecor = { planifier, relief, couperAccotement, poser };
})(globalThis.BITUME = globalThis.BITUME || {});
