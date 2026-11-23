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
    // Versant continu dans Les Lacets (x 1150..1610, z -2370..-2130) : élimine la falaise
    // verticale artificielle en escalier entre les branches empilées séparées de 68 m.
    if (x > 1130 && x < 1640 && z > -2390 && z < -2115 && (q.i < 0 || q.d > 13)) {
      const wx = doux(1130, 1210, x) * (1 - doux(1555, 1640, x));
      const wz = doux(-2390, -2345, z) * (1 - doux(-2155, -2115, z));
      const wl = wx * wz * (q.i < 0 ? 1 : doux(13, 28, q.d));
      if (wl > 0) {
        const recul = -(z + 2142.5);
        const demiRaccord = 8;
        // Raccord tangent au replat et à la rampe de part et d’autre du seuil.
        const t = borner((recul + demiRaccord) / (2 * demiRaccord));
        const rampe = demiRaccord * t * t + Math.max(0, recul - demiRaccord);
        const hVersant = 179.5 + rampe * .275 + (x - 1350) * .012
          + 1.9 * Math.sin(x / 31) * Math.cos(z / 27);
        h += (hVersant - h) * wl * .88;
      }
    }
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
    // Cascade de la Gorge : chute d'eau organique asymétrique + bassin naturel.
    {
      const cf = p.centre, co = Math.cos(cf.cap), si = Math.sin(cf.cap);
      const cascX = cf.x - si * 42 + co * 22, cascZ = cf.z + co * 42 + si * 22;
      const yHaut = cf.y - 4, yBas = cf.y - 54, hCasc = yHaut - yBas;
      const cascForme = B.lieux ? 'bitume-lieu-cascade' : 'bevel';
      const lacForme = B.lieux ? 'bitume-lieu-lac-organique' : 'cylinder';
      const casc = [
        { shape: cascForme, p: [cascX, (yHaut + yBas) / 2, cascZ], s: [6.8, hCasc, 3.2], r: [.14, -cf.cap + .15, 0], mat: 12, color: [.78, .90, .96], emissive: .22, lieuCimes: 'Cascade de la Gorge' },
        { shape: lacForme, p: [cascX - si * 3, yBas + .6, cascZ + co * 3], s: [25, .8, 19], r: [0, -cf.cap + .35, 0], mat: 12, color: [.10, .34, .44], lieuCimes: 'Cascade de la Gorge' },
        { shape: lacForme, p: [cascX - si * 1.5, yBas + 1.0, cascZ + co * 1.5], s: [9.5, 1.1, 7.2], r: [0, -cf.cap - .4, 0], mat: 3, color: [.90, .95, .98], emissive: .15, lieuCimes: 'Cascade de la Gorge' }
      ];
      ajouter(casc, [casc[0], casc[1]], cascX, cascZ);
    }
    // Refuge visible au col + Lac de l'Aiglière à proximité, sur le sol dessiné et à l'écart de toute chaussée.
    let refuge = null;
    if (B.batiments) {
      const f = B.circuit.echantillon(c, p.refugeS), d = -43;
      const co = Math.cos(f.cap), si = Math.sin(f.cap);
      const x = f.x - si * d, z = f.z + co * d;
      const l = 15.5, w = 9.5, longueurSocle = l + 1, largeurSocle = w + 1;
      const solsCoins = [];
      for (const dx of [-longueurSocle / 2, longueurSocle / 2]) {
        for (const dz of [-largeurSocle / 2, largeurSocle / 2]) {
          solsCoins.push(terrain.sol(x + co * dx - si * dz, z + si * dx + co * dz));
        }
      }
      const sol = Math.max(...solsCoins), solBas = Math.min(...solsCoins);
      const hauteurSocle = 1.8 + (sol - solBas);
      // Lac de l'Aiglière : miroir d'eau alpin asymétrique bordé de rochers texturés.
      const lacX = f.x - Math.sin(f.cap) * (-118), lacZ = f.z + Math.cos(f.cap) * (-118);
      const lacY = terrain.sol(lacX, lacZ) + .25;
      const lacForme = B.lieux ? 'bitume-lieu-lac-organique' : 'cylinder';
      const lacObj = [
        { shape: lacForme, p: [lacX, lacY, lacZ], s: [78, .6, 56], r: [0, -f.cap + .3, 0], mat: 12, color: [.07, .24, .34], lieuCimes: "Lac de l'Aiglière" }
      ];
      const rocheForme = B.lieux ? 'bitume-lieu-rocher-alpin' : 'octa';
      for (let k = 0; k < 10; k++) {
        const a = k * Math.PI / 5 + Math.sin(k * 2.9) * 0.28;
        const rRad = 0.84 + Math.sin(k * 3.7) * 0.18;
        const rx = lacX + Math.cos(a) * 36 * rRad, rz = lacZ + Math.sin(a) * 25 * rRad;
        lacObj.push({ shape: rocheForme, p: [rx, lacY + .7, rz], s: [4.2 + (k % 3) * 1.4, 2.1 + (k % 2), 3.6 + (k % 3)], r: [Math.sin(k) * .12, a + k * .6, Math.cos(k) * .09], mat: 23, color: [.46, .45, .42], lieuCimes: "Lac de l'Aiglière" });
      }
      ajouter(lacObj, [lacObj[0]], lacX, lacZ);
      const site = { x, z, sol, bas: solBas - 1.4, a: f.cap, l, w, h: 5.2, theme: 'montagne', graine: c.graine,
        enduit: [.62, .59, .50] };
      const maison = B.batiments.maison(site, { detail: qualite !== 'low', neige: !!outils.saison?.neige });
      const point = (dx, dy, dz) => [x + co * dx - si * dz, sol + dy, z + si * dx + co * dz];
      const enveloppe = [
        { shape: 'bevel', p: point(0, .15 - hauteurSocle / 2, 0), s: [longueurSocle, hauteurSocle, largeurSocle], r: [0, -f.cap, 0], mat: 9, color: pierre, partie: 'socle-refuge' }
      ];
      for (const cote of [-1,1]) {
        enveloppe.push({ shape: 'bevel', p: point(0,site.h/2,cote*(site.w/2-.17)), s: [site.l,site.h,.34], r:[0,-f.cap,0], mat:13.2,color:site.enduit,partie:'mur-refuge' });
        enveloppe.push({ shape: 'bevel', p: point(cote*(site.l/2-.17),site.h/2,0), s: [.34,site.h,site.w], r:[0,-f.cap,0],mat:13.2,color:site.enduit,partie:'mur-refuge' });
        enveloppe.push({ shape: 'box', p: point(0,site.h+site.w*.14,cote*site.w*.25), s:[site.l+.65,.22,site.w*.6],
          r:[cote*.5,-f.cap,0],mat:1,color:outils.saison?.neige?[.87,.90,.93]:[.27,.22,.18],partie:'toiture-refuge' });
      }
      for (const o of enveloppe) D.marquerSolide(o,'refuge-cimes',2);
      maison.objets.unshift(...enveloppe); maison.loin.unshift(...enveloppe);
      for (const o of maison.objets) o.lieuCimes = 'Refuge de l’Aiglière';
      ajouter(maison.objets, maison.loin, x, z); refuge = { x, z, y: sol, objets: maison.objets.length };
    }
    return Object.freeze({ pont: { nom: pont.nom, debut: pont.debut, fin: pont.fin, voussoirs: N,
      objets: objets.length, hauteurArche: 40, gorgeProfondeur: 55 }, refuge,
      corniches: p.corniches.map(v => ({ nom: v.nom, debut: v.debut, fin: v.fin })) });
  }
  B.cimesDecor = { planifier, relief, couperAccotement, poser };
})(globalThis.BITUME = globalThis.BITUME || {});
