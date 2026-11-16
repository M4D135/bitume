(function (B) {
  'use strict';
  // BITUME : tout le son est synthétisé par Web Audio, sans aucun fichier audio.
  // Premier jet : Spark (KBZA, 12/11/2026). Repris par Claude : moteurs audibles (le mélangeur
  // était à gain nul), saturation à courbe fixe et attaque variable, modulation d'allumage,
  // voix des rivaux attribuées de façon stable avec fondu, vibreur à modulation bornée,
  // coupures sans minuterie, clic et bips correctement programmés, volumes à zéro exact.
  // Aucun AudioContext avant demarrer() ; dans Node, seules les fonctions pures servent.

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  const frequenceAllumage = regime => regime / 60 * 4; // V8 quatre temps : 4 allumages par tour (ancienne voix)
  // Douze-cylindres à plat, quatre temps : un cycle moteur dure deux tours ; douze allumages par cycle.
  const frequenceCycle = regime => Math.max(0, regime) / 120;
  // Spectre d'un cycle moteur (amplitudes des harmoniques de la fréquence de cycle, 1 à n) : ordres d'allumage
  // (12, 24…) forts, demi-ordres d'un banc à l'autre (6, 18…), ordres de vilebrequin pairs pour le corps, quelques
  // impairs pour la rugosité d'un cylindre à l'autre ; une petite inégalité fixe casse la perfection.
  function spectreMoteur(n = 64) {
    const a = new Float32Array(n + 1);
    for (let k = 1; k <= n; k++) {
      const v = k % 12 === 0 ? .6 / Math.pow(k / 12, .9) : k % 6 === 0 ? .8 / Math.pow(k / 6, .85)
        : k % 4 === 0 ? .42 / Math.pow(k / 4, .6) : k % 2 === 0 ? .36 / Math.pow(k / 2, .5) : .09 / Math.pow(k, .35);
      a[k] = v * (1 + .22 * Math.sin(k * 2.3));
    }
    return a;
  }
  const coupure = (gaz, regime) => clamp(700 + 2600 * gaz + 0.22 * regime, 600, 6500);
  const gainDistance = d => clamp(1 / Math.pow(1 + Math.max(0, d) / 14, 2), 0, 1);
  const doppler = vRel => 343 / (343 - clamp(vRel, -120, 120));
  const panoramique = angle => clamp(Math.sin(angle), -1, 1);

  function courbeTanh(k) {
    const n = 2048, c = new Float32Array(n), kh = Math.tanh(k);
    for (let i = 0; i < n; i++) c[i] = Math.tanh((i / (n - 1) * 2 - 1) * k) / kh;
    return c;
  }

  // ---------------------------------------------------------------- thème de l'écran titre
  // Seule musique du jeu (David, 12/11/2026 : « pas de musique sauf à l'écran titre »). Thème original en la mineur,
  // 126 battements par minute, seize mesures en boucle : basse en octaves, arpège en écho, batterie de bruit, nappe,
  // et mélodie sur les huit dernières mesures. Accords : racine MIDI et intervalles, une mesure chacun.
  const THEME = {
    tempo: 126,
    accords: [[33, 0, 3, 7], [33, 0, 3, 7], [29, 0, 4, 7], [29, 0, 4, 7], [36, 0, 4, 7], [36, 0, 4, 7], [31, 0, 4, 7], [31, 0, 4, 7]],
    // [note MIDI (0 : silence), durée en doubles croches] ; seize doubles croches par mesure, huit mesures
    melodie: [[76, 4], [74, 2], [72, 2], [74, 4], [76, 4], [69, 8], [0, 4], [72, 2], [74, 2], [77, 4], [76, 2], [74, 2], [72, 4], [69, 4],
      [72, 6], [74, 2], [72, 4], [0, 4], [79, 4], [76, 2], [74, 2], [76, 4], [79, 4], [76, 8], [0, 4], [74, 2], [76, 2],
      [74, 4], [71, 2], [67, 2], [71, 4], [74, 4], [76, 12], [0, 4]],
    basse: [0, 0, 12, 0, 0, 12, 7, 12],          // décalage de la basse à chaque croche
    arpege: [0, 1, 2, 3, 2, 1, 2, 3]              // degré de l'accord (3 : octave) à chaque double croche
  };
  const MELODIE_PAS = (() => { const t = new Array(128).fill(null); let k = 0; for (const [n, d] of THEME.melodie) { if (n) t[k] = [n, d]; k += d; } return t; })();
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);

  function creer() {
    let ctx = null, pret = false, enPause = false, coupFin = 0;
    let musiqueOn = false, minuteur = null, pas = 0, prochain = 0, busMus = null, echo = null;
    const vols = { general: 1, moteur: 1, effets: 1 };
    let maitre = null, busMot = null, busEff = null, bruit = null, m = null, pneus = null, vib = null, herbe = null;
    const voix = [];

    // rampe linéaire courte vers une valeur exacte (un 0 coupe vraiment)
    function rampe(p, v, t, d) { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, t + d); }
    function vise(p, v, t, tc) { p.setTargetAtTime(v, t, tc); }
    function bruitEnBoucle() { const s = ctx.createBufferSource(); s.buffer = bruit; s.loop = true; return s; }
    function filtre(type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
    function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
    function osc(type, f, detune) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune || 0; return o; }

    // Onde d'un cycle moteur (voir spectreMoteur), phases tirées une fois pour toutes : pas de pointe trop aiguë.
    let onde = null;
    function ondeMoteur() {
      if (onde) return onde;
      const a = spectreMoteur(64), re = new Float32Array(a.length), im = new Float32Array(a.length);
      let x = 0x2545F491;
      for (let k = 1; k < a.length; k++) { x = Math.imul(x ^ x >>> 15, 0x2C1B3C6D) >>> 0; const ph = x / 4294967296 * 2 * Math.PI; re[k] = a[k] * Math.cos(ph); im[k] = a[k] * Math.sin(ph); }
      return (onde = ctx.createPeriodicWave(re, im));
    }
    function crete(f, gainDb, q) { const b = filtre('peaking', f, q); b.gain.value = gainDb; return b; }

    // Moteur du joueur (David, 16/11 : « gros point, là on dirait un moustique ») : un douze-cylindres à plat de 1980.
    // Deux bancs (onde d'un cycle complet, fondamentale = régime/120) légèrement désaccordés qui battent, vibrato
    // lent ; grondement du vilebrequin au ralenti ; saturation qui suit la charge ; résonances FIXES d'échappement et
    // d'admission (les harmoniques les traversent quand le régime monte) ; râpe de combustion : bruit modulé à la
    // fréquence d'allumage. Vue cockpit : plus d'admission et de râpe ; dehors : plus d'échappement.
    function moteur() {
      const t = ctx.currentTime, w = ondeMoteur();
      const oA = ctx.createOscillator(), oB = ctx.createOscillator();
      oA.setPeriodicWave(w); oB.setPeriodicWave(w); oA.frequency.value = oB.frequency.value = 33; oB.detune.value = 9;
      const vib = osc('sine', 5.7), vibG = gain(5), vib2 = osc('sine', .83), vib2G = gain(7);
      vib.connect(vibG); vib2.connect(vib2G);
      for (const o of [oA, oB]) { vibG.connect(o.detune); vib2G.connect(o.detune); }
      const gA = gain(.55), gB = gain(.45), oSub = osc('sine', 67), gSub = gain(.2);
      const attaque = gain(1.2);
      oA.connect(gA).connect(attaque); oB.connect(gB).connect(attaque); oSub.connect(gSub).connect(attaque);
      const sat = ctx.createWaveShaper(); sat.curve = courbeTanh(2.2); sat.oversample = '2x';
      const ph = filtre('highpass', 32, .7), echap = crete(210, 8, .9), basse = crete(520, 3, 1.2), adm = crete(1400, 2, 2);
      const doux = filtre('highshelf', 4200, .7); doux.gain.value = -4;
      const pb = filtre('lowpass', 3000, .7), sortie = gain(0);
      // râpe : bruit en bande large, porte ouverte et fermée à chaque allumage
      const ns = bruitEnBoucle(), rapeF = filtre('bandpass', 2600, .9), rape = gain(0), am = osc('square', 400), amG = gain(.5);
      am.connect(amG).connect(rape.gain);
      ns.connect(rapeF).connect(rape).connect(pb);
      attaque.connect(sat).connect(ph).connect(echap).connect(basse).connect(adm).connect(doux).connect(pb).connect(sortie).connect(busMot);
      for (const o of [oA, oB, vib, vib2, oSub, ns, am]) o.start(t);
      return { oA, oB, oSub, gSub, am, attaque, echap, adm, pb, rape, sortie };
    }

    // Voix d'un rival : la même onde de cycle, filtrée plus fermée, panoramique.
    function voixRival() {
      const t = ctx.currentTime, o1 = ctx.createOscillator();
      o1.setPeriodicWave(ondeMoteur()); o1.frequency.value = 50;
      const g1 = gain(.9), pb = filtre('lowpass', 1600, .8), corps = crete(170, 5, 1.1), pan = ctx.createStereoPanner(), sortie = gain(0);
      o1.connect(g1).connect(corps).connect(pb).connect(pan).connect(sortie).connect(busMot);
      o1.start(t);
      return { o1, pb, pan, sortie, id: -1, libereA: 0 };
    }

    function init() {
      const t = ctx.currentTime;
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.12;
      maitre = gain(vols.general * 0.8); maitre.connect(lim).connect(ctx.destination);
      busMot = gain(vols.moteur); busMot.connect(maitre);
      busEff = gain(vols.effets); busEff.connect(maitre);
      const n = Math.floor(ctx.sampleRate * 2);
      bruit = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = bruit.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      m = moteur();
      for (let i = 0; i < 3; i++) voix.push(voixRival());
      { // pneus : deux bandes de bruit
        const s = bruitEnBoucle(), b1 = filtre('bandpass', 1800, 5), b2 = filtre('bandpass', 2600, 5), g1 = gain(0), g2 = gain(0);
        s.connect(b1).connect(g1).connect(busEff); s.connect(b2).connect(g2).connect(busEff); s.start(t);
        pneus = { g1, g2 };
      }
      { // vibreur : scie à 34 Hz modulée à 18 Hz (profondeur bornée), puis porte de niveau
        const o = osc('sawtooth', 34), am = gain(0.5), lfo = osc('sine', 18), lfoG = gain(0.5), g = gain(0);
        lfo.connect(lfoG).connect(am.gain); o.connect(am).connect(g).connect(busEff); o.start(t); lfo.start(t);
        vib = { g };
      }
      { // herbe : bruit sourd
        const s = bruitEnBoucle(), pb = filtre('lowpass', 400, 0.7), g = gain(0);
        s.connect(pb).connect(g).connect(busEff); s.start(t);
        herbe = { g };
      }
    }

    function demarrer() {
      if (pret) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return;
      try { ctx = new AC(); if (ctx.state === 'suspended') ctx.resume(); init(); pret = true; }
      catch (e) { ctx = null; pret = false; }
    }

    function regler(o) {
      if (!o) return;
      for (const k of ['general', 'moteur', 'effets']) if (o[k] != null) vols[k] = clamp(+o[k] || 0, 0, 1);
      if (!pret) return;
      const t = ctx.currentTime;
      rampe(maitre.gain, vols.general * 0.8, t, 0.05); rampe(busMot.gain, vols.moteur * (musiqueOn ? SOUS_MUSIQUE : 1), t, 0.05); rampe(busEff.gain, vols.effets, t, 0.05);
    }

    // etat = { pause, joueur: { regime, gaz, rapport, v, glisse, surface, turbo, vue, muet },
    //          rivaux: [{ id, distance, angle, regime, gaz, vRel }] }
    function mettreAJour(etat) {
      if (!pret || !etat) return;
      const t = ctx.currentTime, tc = 0.015, j = etat.joueur || {};
      const silence = enPause || !!etat.pause;
      const muet = silence || !!j.muet; // vue extérieure : la voiture du joueur passe par une voix de rival
      const gaz = clamp(+j.gaz || 0, 0, 1), regime = Math.max(0, +j.regime || 0), fc = frequenceCycle(regime), r = clamp(regime / 13000, 0, 1);
      const bord = j.vue !== 'poursuite';
      vise(m.oA.frequency, fc, t, tc); vise(m.oB.frequency, fc, t, tc); vise(m.oSub.frequency, 2 * fc, t, tc); vise(m.am.frequency, 12 * fc, t, tc);
      vise(m.gSub.gain, .07 + .26 * (1 - r), t, .05);
      vise(m.attaque.gain, lerp(1.0, 2.9, gaz) * (.8 + .4 * r) + (j.turbo ? .4 : 0), t, .03);
      vise(m.pb.frequency, clamp(1300 + 3400 * gaz + .3 * regime, 900, 8500) * (bord ? .92 : 1), t, tc);
      vise(m.rape.gain, (.02 + .12 * gaz + (j.turbo ? .04 : 0)) * (.35 + .65 * r) * (bord ? 1.25 : .8), t, .03);
      vise(m.echap.gain, bord ? 6.5 : 9, t, .1); vise(m.adm.gain, bord ? 3.5 : 1, t, .1);
      // le gain de sortie est réduit car la saturation remonte le niveau
      const vol = muet ? 0 : lerp(0.5, 0.9, gaz) * 0.34;
      if (t >= coupFin) vise(m.sortie.gain, vol, t, muet ? 0.03 : tc);

      // rivaux : les trois plus proches, attribution stable, fondu de 0,1 s
      const proches = (etat.rivaux || []).slice().sort((a, b) => a.distance - b.distance).slice(0, voix.length);
      const ids = proches.map(r => r.id);
      for (const vx of voix) if (vx.id >= 0 && !ids.includes(vx.id)) { vise(vx.sortie.gain, 0, t, 0.03); vx.id = -1; vx.libereA = t + 0.12; }
      for (const r of proches) {
        let vx = voix.find(x => x.id === r.id);
        if (!vx) {
          vx = voix.find(x => x.id < 0 && t >= x.libereA);
          if (!vx) continue;
          vx.id = r.id;
          vx.o1.frequency.setValueAtTime(frequenceCycle(+r.regime || 0) * doppler(+r.vRel || 0), t);
        }
        vise(vx.o1.frequency, frequenceCycle(+r.regime || 0) * doppler(+r.vRel || 0), t, tc);
        vise(vx.pb.frequency, coupure(clamp(+r.gaz || 0, 0, 1), +r.regime || 0) * 0.75, t, tc);
        vise(vx.pan.pan, panoramique(+r.angle || 0), t, 0.05);
        vise(vx.sortie.gain, silence ? 0 : gainDistance(+r.distance || 0) * 0.5 * 0.42, t, 0.1 / 3);
      }

      const gl = clamp(+j.glisse || 0, 0, 1), np = muet ? 0 : gl * gl * 0.5;
      vise(pneus.g1.gain, np * 0.6, t, 0.03); vise(pneus.g2.gain, np * 0.4, t, 0.03);
      vise(vib.g.gain, !muet && j.surface === 'vibreur' ? 0.22 : 0, t, 0.02);
      vise(herbe.g.gain, !muet && j.surface === 'herbe' ? clamp((+j.v || 0) / 60, 0, 1) * 0.25 : 0, t, 0.03);
    }

    // coupure brève du moteur du joueur (passage de rapport, rupteur)
    function coupureMoteur(t) {
      const p = m.sortie.gain;
      p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(0, t + 0.004);
      coupFin = t + 0.04;
    }
    function ponctuelle(source, noeuds, t, duree) {
      source.start(t); source.stop(t + duree + 0.02);
      source.onended = () => { for (const x of [source, ...noeuds]) { try { x.disconnect(); } catch (e) { /* déjà débranché */ } } };
    }
    function detonation(t, force) {
      const s = ctx.createBufferSource(); s.buffer = bruit;
      const pb = filtre('lowpass', 520, 0.8), g = gain(0);
      g.gain.setValueAtTime(0.45 * force, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      s.connect(pb).connect(g).connect(busEff);
      ponctuelle(s, [pb, g], t + Math.random() * 0.01, 0.07);
    }
    function ton(t, freq, duree, amp, type) {
      const o = osc(type || 'sine', freq), g = gain(0);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + Math.min(0.01, duree / 4));
      g.gain.setValueAtTime(amp, t + duree * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
      o.connect(g).connect(busEff);
      ponctuelle(o, [g], t, duree);
    }
    // Clameur des tribunes au drapeau : bruit large qui monte puis s'éteint, sans hauteur.
    function clameur(t) {
      const s = ctx.createBufferSource(); s.buffer = bruit; s.loop = true;
      const bp = filtre('bandpass', 900, 0.5), g = gain(0);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.45);
      g.gain.setValueAtTime(0.22, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      s.connect(bp).connect(g).connect(busEff);
      ponctuelle(s, [bp, g], t, 2.6);
    }
    function clic(t) {
      const o = osc('square', 1800), g = gain(0);
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.003);
      o.connect(g).connect(busEff);
      ponctuelle(o, [g], t, 0.004);
    }
    function choc(t, force) {
      const duree = lerp(0.08, 0.22, force);
      const s = ctx.createBufferSource(); s.buffer = bruit;
      const pb = filtre('lowpass', 900, 0.7), g = gain(0);
      g.gain.setValueAtTime(0.55 * force + 0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + duree);
      s.connect(pb).connect(g).connect(busEff);
      ponctuelle(s, [pb, g], t, duree);
      const o = osc('sine', 70), og = gain(0);
      o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(40, t + duree);
      og.gain.setValueAtTime(0.6 * force + 0.05, t); og.gain.exponentialRampToValueAtTime(0.001, t + duree);
      o.connect(og).connect(busEff);
      ponctuelle(o, [og], t, duree);
    }
    function souffle(t, niveau, parfait) {
      const s = ctx.createBufferSource(); s.buffer = bruit;
      const ph = filtre('highpass', 400, 0.7), g = gain(0);
      ph.frequency.setValueAtTime(400, t); ph.frequency.exponentialRampToValueAtTime(parfait ? 3200 : 2200, t + 0.4);
      const amp = (parfait ? 0.4 : 0.26) * (0.6 + 0.4 * clamp((niveau || 1) / 3, 0, 1));
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      s.connect(ph).connect(g).connect(busEff);
      ponctuelle(s, [ph, g], t, 0.45);
    }

    function evenement(nom, p) {
      if (!pret) return;
      p = p || {};
      const t = ctx.currentTime;
      switch (nom) {
        case 'rapport': coupureMoteur(t); detonation(t, p.haut ? 0.7 : 0.5); break;
        case 'rupteur': coupureMoteur(t); detonation(t, 0.8); break;
        case 'choc': choc(t, clamp((p.force ?? 8) / 12, 0.2, 1)); break;           // vitesse perdue, m/s
        case 'contact': choc(t, clamp((p.force ?? 3) / 8, 0.15, 1) * 0.8); break;    // vitesse de rapprochement, m/s
        case 'reception': choc(t, clamp(0.3 + (p.force ?? 1) / 8, 0.2, 0.7)); break;  // la caisse retombe de son saut
        case 'roue': choc(t, 0.8); ton(t, 170, 0.32, 0.3, 'sawtooth'); break;         // une roue se détache
        case 'casse': choc(t, 1); detonation(t, 0.9); break;                           // la caisse casse, rentre au stand
        case 'tonneau': choc(t, 1); detonation(t, 1); break;                           // tonneau à la réception
        case 'reparation': choc(t, 0.5); for (let i = 0; i < 3; i++) ton(t + i * 0.12, 300 + i * 90, 0.05, 0.18, 'square'); break; // clics d'outillage à l'arrêt
        case 'repare': ton(t, 720, 0.1, 0.24); ton(t + 0.12, 1080, 0.12, 0.26); break;  // roue remise, on repart
        case 'feu': ton(t, 620, 0.22, 0.3); break;
        case 'vert': ton(t, 1240, 0.22, 0.35); break;
        case 'niveau': { const n = clamp(p.niveau || 1, 1, 3); for (let i = 0; i < n; i++) ton(t + i * 0.07, 1500, 0.03, 0.2, 'square'); break; } // tics comptés
        case 'fenetre': ton(t, 2000, 0.025, 0.2); break;
        case 'turbo': souffle(t, p.niveau, !!p.parfait); break;
        case 'tour': ton(t, 880, 0.12, 0.24); if (p.meilleur) ton(t + 0.18, 880, 0.12, 0.24); break; // bip, double au meilleur tour
        case 'arrivee': clameur(t); break;
        case 'clic': clic(t); break;
        default: break; // 'derive', 'deriveAnnulee' : le crissement suit etat.joueur.glisse
      }
    }

    // ---------------------------------------------------------------- musique de l'écran titre
    const DOUBLE = 60 / THEME.tempo / 4;      // durée d'une double croche
    const SOUS_MUSIQUE = 0.4;                 // les moteurs de la vitrine passent derrière le thème
    function initMusique() {
      busMus = gain(0); busMus.connect(maitre);
      echo = ctx.createDelay(1); echo.delayTime.value = DOUBLE * 3;  // écho de l'arpège à trois doubles croches
      const retour = gain(0.32), pb = filtre('lowpass', 2400, 0.7), sortieEcho = gain(0.5);
      echo.connect(pb).connect(retour).connect(echo); echo.connect(sortieEcho).connect(busMus);
    }
    function note(t, type, f, duree, amp, passeBas, attaque, versEcho, detune) {
      const o = osc(type, f, detune), pb = filtre('lowpass', passeBas, 0.8), g = gain(0);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + (attaque || 0.008));
      g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
      o.connect(pb).connect(g).connect(busMus); if (versEcho) g.connect(echo);
      ponctuelle(o, [pb, g], t, duree);
    }
    function frappe(t, sorte) {
      if (sorte === 'g') { // grosse caisse : sinus qui plonge
        const o = osc('sine', 150), g = gain(0);
        o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.connect(g).connect(busMus); ponctuelle(o, [g], t, 0.3);
        return;
      }
      const s = ctx.createBufferSource(); s.buffer = bruit;
      const caisse = sorte === 'c', f = filtre('highpass', caisse ? 1200 : 7000, 0.7), g = gain(0);
      const a = caisse ? 0.4 : sorte === 'o' ? 0.11 : 0.08, d = caisse ? 0.16 : sorte === 'o' ? 0.2 : 0.045;
      g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      s.connect(f).connect(g).connect(busMus);
      s.start(t, Math.random() * 1.5); s.stop(t + d + 0.02);
      s.onended = () => { for (const x of [s, f, g]) { try { x.disconnect(); } catch (e) { /* déjà débranché */ } } };
    }
    function jouerPas(i, t) {
      const mesure = Math.floor(i / 16), k = i % 16, [racine, ...iv] = THEME.accords[mesure % 8];
      if (k === 0 || k === 6 || k === 8 || (k === 14 && mesure % 2)) frappe(t, 'g');
      if (k === 4 || k === 12) frappe(t, 'c');
      if (k % 2 === 0) frappe(t, k === 14 ? 'o' : 'h');
      if (k % 2 === 0) note(t, 'sawtooth', hz(racine + THEME.basse[k / 2]), DOUBLE * 1.7, 0.3, 650);
      const d = THEME.arpege[k % 8];
      note(t, 'square', hz(racine + 24 + (d === 3 ? 12 : iv[d])), DOUBLE * 0.9, 0.05, 2600, 0.005, true);
      if (k === 0 && mesure % 2 === 0) for (const v of iv) note(t, 'sawtooth', hz(racine + 12 + v), DOUBLE * 31, 0.03, 1100, 0.35, false, v ? 6 : -6);
      const m = mesure >= 8 ? MELODIE_PAS[(mesure - 8) * 16 + k] : null;
      if (m) note(t, 'triangle', hz(m[0]), DOUBLE * m[1] * 0.95, 0.16, 3200, 0.012, true);
    }
    function tic() {
      if (!musiqueOn || !pret) return;
      const maintenant = ctx.currentTime;
      if (prochain < maintenant - 0.2) prochain = maintenant + 0.05;   // onglet ralenti : on reprend sans rafale
      while (prochain < maintenant + 0.15) { jouerPas(pas, prochain); pas = (pas + 1) % 256; prochain += DOUBLE; }
    }
    // Lance (true) ou coupe (false) le thème, en fondu. Sans effet avant le premier geste (demarrer).
    function musique(active) {
      if (!pret) return;
      const t = ctx.currentTime;
      if (active && !musiqueOn) {
        if (!busMus) initMusique();
        musiqueOn = true; pas = 0; prochain = t + 0.06;
        rampe(busMus.gain, 0.9, t, 0.6); rampe(busMot.gain, vols.moteur * SOUS_MUSIQUE, t, 0.6);
        minuteur = setInterval(tic, 25); tic();
      } else if (!active && musiqueOn) {
        musiqueOn = false; clearInterval(minuteur); minuteur = null;
        rampe(busMus.gain, 0, t, 0.5); rampe(busMot.gain, vols.moteur, t, 0.5);
      }
    }

    function suspendre() {
      enPause = true;
      if (!pret) return;
      const t = ctx.currentTime;
      for (const g of [m.sortie.gain, pneus.g1.gain, pneus.g2.gain, vib.g.gain, herbe.g.gain, ...voix.map(v => v.sortie.gain)]) vise(g, 0, t, 0.03);
    }
    function reprendre() { enPause = false; }
    function stats() { return { actif: pret, voix: pret ? 1 + voix.filter(v => v.id >= 0).length : 0, musique: musiqueOn }; }

    return { demarrer, regler, mettreAJour, evenement, musique, suspendre, reprendre, stats };
  }

  B.son = { creer, frequenceAllumage, frequenceCycle, spectreMoteur, coupure, gainDistance, doppler, panoramique, THEME };
})(globalThis.BITUME = globalThis.BITUME || {});
