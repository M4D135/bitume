// Node : les équations partagées de FERRO se chargent comme dans conduite.js ; dans la page, construire.py les place
// avant ce module.
if(typeof module!=='undefined'&&module.exports&&!globalThis.FVehicleDynamics)require('./ferro/vehicle-dynamics.js');
(function (B) {
  'use strict';
  // BITUME : loi de pneu du lot 17 (Claude, 18/11/2026), docs/reprise/17-CONDUITE.md § 3.2 à 3.4.
  // Demande de David : « la sensation de conduite doit être la plus fidèle et la plus logique et cohérente niveau
  // physique », « réaliste et surtout ultra fun et arcade à la fois ». FERRO reste verrouillé : la loi p10 vit ici,
  // dans un module BITUME chargé avant conduite.js.
  //
  // Deux lois :
  // - p9, celle du jeu jusqu'au lot 17 : les fonctions de FERRO (adherence, forme, retombee, pneu) rendues telles
  //   quelles, si bien que conduite.js peut passer par ce module sans changer un bit ;
  // - p10 : adhérence en puissance de la charge, normée sur la charge statique de l'essieu ; angle du pic qui croît
  //   avec la charge ; montée en sinus, plateau qui retombe vers 1 − c ; glissement combiné de Beckman ; relaxation ;
  //   mémoire du pic (la chute après le pic n'est atteinte qu'avec un retard, l'adhérence revient tout de suite).
  //
  // Toutes les fonctions sont pures et ne créent aucun objet : elles rendent un nombre, ou écrivent dans le tableau
  // que l'appelant a préparé (glissement combiné). Température et usure (lots 12D et 12E) entreront par le facteur
  // d'adhérence de chaque roue, qui multiplie mu ; il vaut 1 tant qu'elles n'existent pas.

  const DEMI_PI = Math.PI / 2;

  // ---------------------------------------------------------------- loi p9 (FERRO), à l'identique
  // `F` : une instance de FVehicleDynamics.create(P) ; rend ses fonctions de pneu, les mêmes objets.
  function p9(F) {
    if (!F || typeof F.adherence !== 'function') throw TypeError('pneu.p9 : instance FVehicleDynamics attendue');
    return Object.freeze({ adherence: F.adherence, forme: F.forme, retombee: F.retombee, pneu: F.pneu });
  }

  // ---------------------------------------------------------------- loi p10, glissement pur
  // Charge relative d'une roue : Fz / Fz0, Fz0 étant la charge statique d'une roue de son essieu. Plancher de 1e-3
  // (une roue presque délestée, en haut d'une crête par exemple) : la force y tend vers 0 sans division par zéro.
  const PLANCHER = 1e-3;
  function relative(fz, fz0) { const r = fz / fz0; return r > PLANCHER ? r : PLANCHER; }
  // Adhérence au pic d'une roue : mu · (Fz/Fz0)^−q. mu porte déjà la surface, les pneus et l'eau, l'essieu et le
  // facteur de la roue. À la charge statique, mu tout court, quel que soit q.
  function mu(muRoue, fz, fz0, q) { return muRoue * Math.pow(relative(fz, fz0), -q); }
  // Force latérale maximale d'une roue (N) : mu(Fz)·Fz, nulle sans charge.
  function forceMax(muRoue, fz, fz0, q) { return fz > 0 ? mu(muRoue, fz, fz0, q) * fz : 0; }
  // Dérive au pic d'une roue (rad) : alpha0 · (Fz/Fz0)^p.
  function alphaPic(alpha0, fz, fz0, p) { return alpha0 * Math.pow(relative(fz, fz0), p); }
  // Chute après le pic, x = dérive / dérive au pic : nulle jusqu'au pic, puis c·(|x| − 1)² / ((|x| − 1)² + l²).
  // Au loin, la force tend vers 1 − c : le plateau (85 % du pic à l'avant pour c = 0,15).
  function chute(x, c, l) {
    const ax = x < 0 ? -x : x;
    if (ax <= 1) return 0;
    const q = (ax - 1) * (ax - 1);
    return c * q / (q + l * l);
  }
  // Courbe normalisée avec une chute donnée (celle du moment, ou celle que la mémoire du pic retient) :
  // sin(πx/2) jusqu'au pic, ±(1 − chute) au-delà. Impaire, continue au pic (sin(π/2) = 1, chute(1) = 0).
  function courbeAvec(x, ch) {
    if (x >= 1) return 1 - ch;
    if (x <= -1) return ch - 1;
    return Math.sin(x * DEMI_PI);
  }
  function courbe(x, c, l) { return courbeAvec(x, chute(x, c, l)); }

  // Mémoire du pic, par roue : la chute visée (chute(x)) n'est atteinte qu'avec un retard quand elle croît,
  // `k` = 1 − e^(−dt/τ_pic) ; elle retombe aussitôt quand elle décroît : l'adhérence revient tout de suite, sa perte
  // laisse au pilote le temps de rattraper. Rend la nouvelle chute retenue.
  function suivreChute(retenue, visee, k) { return visee <= retenue ? visee : retenue + (visee - retenue) * k; }

  // ---------------------------------------------------------------- loi p10, glissement combiné (Beckman)
  // sa = alpha / alpha_pic, sk = kappa / kappa_pic ; rho = √(sa² + sk²) ; F = Fmax·f(rho) partagée selon la direction
  // du glissement : Fy = F·sa/rho, Fx = ex·F·sk/rho. En glissement pur (sk = 0), Fy = Fmax·f(sa) : la loi pure.
  // Une roue bloquée (sk ≫ sa) n'a presque plus de force latérale, sans règle ajoutée. Écrit [Fx, Fy] dans `sortie`
  // (Float64Array(2) ou tableau préparé), à partir de l'indice `i` ; rend `sortie`.
  function combine(sa, sk, fmax, c, l, ex, sortie, i = 0) {
    const r = Math.sqrt(sa * sa + sk * sk);
    // f(rho)/rho, prolongé par π/2 en 0 (limite de sin(πrho/2)/rho)
    const g = r > 1e-12 ? courbe(r, c, l) / r : DEMI_PI;
    sortie[i] = ex * fmax * g * sk;
    sortie[i + 1] = fmax * g * sa;
    return sortie;
  }

  // ---------------------------------------------------------------- relaxation
  // La dérive vue par le pneu suit la dérive géométrique avec une longueur de relaxation sigma (m) :
  // alphaEff ← alphaEff + (alpha − alphaEff)·(1 − e^(−max(|u|, ur)·dt/sigma)). τ = sigma/u : 60 ms au pas
  // (ur = 5 m/s, sigma = 0,3 m), 5 ms à 200 km/h. sigma ≤ 0 : sans relaxation.
  function relaxer(alphaEff, alpha, u, dt, sigma, ur) {
    if (!(sigma > 0)) return alpha;
    const au = u < 0 ? -u : u, w = au > ur ? au : ur;
    return alphaEff + (alpha - alphaEff) * (1 - Math.exp(-w * dt / sigma));
  }

  const API = Object.freeze({ p9, relative, mu, forceMax, alphaPic, chute, courbe, courbeAvec, suivreChute, combine, relaxer, PLANCHER });
  B.pneu = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(globalThis.BITUME = globalThis.BITUME || {});
