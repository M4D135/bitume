from pathlib import Path
import json, shutil
p=Path('src/jeu.js')
s=p.read_text()
def change(old,new):
 global s
 assert s.count(old)==1, (s.count(old),old[:100])
 s=s.replace(old,new)
change("    EL.R = null; EL.role = null;\n    if (R) R.fermer();", "    annulerConfirmation(); EL.course = null; EL.pneusDe.clear();\n    EL.R = null; EL.role = null;\n    if (R) R.fermer();")
change("    annoncerCourse();\n    EL.confirmation = { prets: new Set() }; EL.pretIci = false;", "    annulerConfirmation();\n    annoncerCourse();\n    EL.confirmation = { prets: new Set() }; EL.pretIci = false;")
change("      if (x.id !== R.id && !R.pretAvec(x.id)) continue;\n      const pret = C.prets.has(x.id);", "      const pret = C.prets.has(x.id) && (x.id === R.id || R.pretAvec(x.id));")
change("    texte($('pr-etat'), m && n === m ? 'Tout le monde est prêt : départ !'", "    texte($('pr-etat'), tousPrets(R, C) ? 'Tout le monde est prêt : départ !'")
start=s.index('  // hôte : la liste des machines prêtes à tous ; toutes prêtes, la course part')
end=s.index('  function quitterPrets()',start)
s=s[:start]+'''  function annulerConfirmation() {
    if (EL.confirmation) clearTimeout(EL.confirmation.minuteur);
    EL.confirmation = null; EL.pretIci = false;
  }
  function retirerPret() {
    if (EL.confirmation && EL.pretIci) basculerPret();
  }
  function tousPrets(R, C) {
    return !!(R && C && R.etat === 'connecte' && R.membres.length >= 2 &&
      pilotesSalle(R).length <= 4 && R.membres.every(m =>
        C.prets.has(m.id) && (m.id === R.id || R.pretAvec(m.id))));
  }
  // Le délai reste annulable : retour au salon, déconnexion ou nouveau membre ne lancent jamais une ancienne course.
  function diffuserPrets() {
    const R = EL.R, C = EL.confirmation;
    if (!R || !C || EL.role !== 'hote') return;
    for (const id of C.prets) if (!R.membres.some(m => m.id === id)) C.prets.delete(id);
    R.envoyer({ t: 'prets', liste: [...C.prets] });
    majPrets();
    if (!tousPrets(R, C)) { clearTimeout(C.minuteur); C.minuteur = null; return; }
    if (C.minuteur != null) return;
    C.minuteur = setTimeout(() => {
      C.minuteur = null;
      if (EL.R !== R || EL.confirmation !== C || !tousPrets(R, C)) return;
      annulerConfirmation();
      departEnLigne();
    }, 700);
  }
''' +s[end:]
change("    if (EL.role === 'hote') { EL.confirmation = null; if (EL.R) EL.R.envoyer({ t: 'annuler' }); }", "    if (EL.role === 'hote') { annulerConfirmation(); if (EL.R) EL.R.envoyer({ t: 'annuler' }); }")
change("    if (!m || !CATALOGUE[m.i]) return;", "    if (!m || !Number.isInteger(m.i) || !CATALOGUE[m.i]) return false;")
change("    if (ecran === 'prets') majPrets();\n  }\n  function envoyerPneus()", "    if (ecran === 'prets') majPrets();\n    return true;\n  }\n  function envoyerPneus()")
change("  function nouvelleLiaison() {\n    if (EL.R) EL.R.fermer();", "  function nouvelleLiaison() {\n    annulerConfirmation();\n    if (EL.R) EL.R.fermer();")
change("    }).on('salle', () => { if (R === EL.R) majSalon(); })", "    }).on('salle', () => { if (R === EL.R) { majSalon(); if (EL.confirmation) { diffuserPrets(); majPrets(); } } })")
change("R.envoyer({ t: 'prets', liste: [...EL.confirmation.prets] }, id); majPrets();", "R.envoyer({ t: 'prets', liste: [...EL.confirmation.prets] }, id); diffuserPrets();")
change("    setTimeout(() => { lancer('course', cfg.i, cfg); $('chargement').classList.add('fini'); aller('course'); }, 30);", "    const R = EL.R;\n    setTimeout(() => {\n      $('chargement').classList.add('fini');\n      if (EL.R !== R || !R || R.etat !== 'connecte') return;\n      lancer('course', cfg.i, cfg); aller('course');\n    }, 30);")
change("  function surMessageEnLigne(m, de) {\n    const S = session;", "  function surMessageEnLigne(m, de) {\n    if (!m || typeof m !== 'object' || !EL.R) return;\n    const S = session;")
change("      EL.confirmation = null; EL.pretIci = false;\n      if (!locaux.length)", "      annulerConfirmation();\n      if (!locaux.length)")
change("      recevoirCourse(m.course);\n      EL.confirmation = { prets: new Set() }; EL.pretIci = false;", "      if (!recevoirCourse(m.course)) return;\n      annulerConfirmation();\n      EL.confirmation = { prets: new Set() }; EL.pretIci = false;")
change("else if (m.t === 'annuler' && de === 0) {\n      EL.confirmation = null; EL.pretIci = false;\n      if (ecran === 'prets')", "else if (m.t === 'annuler' && de === 0 && EL.role === 'invite') {\n      annulerConfirmation();\n      if (retourReglages === 'prets') retourReglages = 'enligne';\n      if (ecran === 'prets')")
change("} else if (m.t === 'pret' && EL.role === 'hote' && EL.confirmation) {", "} else if (m.t === 'pret' && EL.role === 'hote' && EL.confirmation && EL.R.membres.some(x => x.id === de) && EL.R.pretAvec(de)) {")
change("} else if (m.t === 'pneus' && EL.role === 'hote') {", "} else if (m.t === 'pneus' && EL.role === 'hote' && EL.R.membres.some(x => x.id === de)) {")
change("  function surDepart(id) {\n    majSalon();", "  function surDepart(id) {\n    EL.pneusDe.delete(id);\n    majSalon();")
change("  function surFermeture(raison) {\n    const S = session;", "  function surFermeture(raison) {\n    annulerConfirmation(); EL.course = null; EL.pneusDe.clear();\n    if (retourReglages === 'prets') retourReglages = 'enligne';\n    if (ecran === 'prets') aller('enligne');\n    const S = session;")
change("$('l-reglages').addEventListener('click', () => { retourReglages = 'enligne';", "$('l-reglages').addEventListener('click', () => { retirerPret(); retourReglages = 'enligne';")
change("$('pr-reglages').addEventListener('click', () => { retourReglages = 'prets';", "$('pr-reglages').addEventListener('click', () => { retirerPret(); retourReglages = 'prets';")
change("  // retour de halo en [0,1] : 0 = éteint, 1 = plein (qualité élevée ou palier suffisant)\n  const avecReflets = (q, m) => !gpuModeste && (q === 'high' || (q === 'auto' && palier.n === 0)) && !!m && (m.mouille > .2 || m.pluie > .2);", "  const avecHalo = q => q === 'high' || (q === 'auto' && palier.n < 3);")
change("  // Auto au premier palier, hors processeur graphique modeste.\n\n", "  // Auto au premier palier, hors processeur graphique modeste.\n  const avecReflets = (q, m) => !gpuModeste && (q === 'high' || (q === 'auto' && palier.n === 0)) && !!m && (m.mouille > .2 || m.pluie > .2);\n\n")
change("    // Les lumières sont ALLUMÉES EN PERMANENCE (puissance 12, portée 18) ; l'adaptation S.lumiere gère le passage lumière/caverne.\n", "    // Les lampes gardent leur puissance ; seule l'adaptation de l'œil change à l'entrée et à la sortie.\n")
change("    // LAMPES TUNNEL : toujours allumées plein pot, pas de progression progressive pour éviter le \"clipping\"\n    // L'adaptation oculaire S.lumiere (0,8 s entrée / 0,3 s sortie) gère le passage lumière/caverne\n", "")
change("    if ((t.name === 'pneusIci' || t.name === 'pneusPret')", "    if (['pneusIci', 'pneusPret', 'boitePret', 'vuePret', 'boite', 'vue'].includes(t.name)) retirerPret();\n    if ((t.name === 'pneusIci' || t.name === 'pneusPret')")
change("      if (EL.pretIci && EL.role === 'invite' && EL.R) EL.R.envoyer({ t: 'pret', oui: true, pneus: reglages.pneus }, 0);\n", "")
p.write_text(s)
for name in ['prets-enligne.test.mjs', 'rendu-halo.test.mjs']:
 shutil.copyfile(Path('.github/reconciliation')/name, Path('verifications')/name)
v=Path('VERSION.json');d=json.loads(v.read_text());d['version']='0.2.19';v.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
p=Path('docs/REPRISE4-2026-11-17.md');s=p.read_text();s=s.replace('# BITUME : reprise 4 du 17 novembre 2026\n', '# BITUME : reprise 4 du 17 novembre 2026\n\n> État historique de ce lot. Une archive distincte a ensuite été récupérée et réconciliée : voir `RECONCILIATION-ARCHIVE-2026-11-17.md`. Le client unifié porte la version 0.2.19 ; la série locale `e074b55` reste manquante.\n',1);p.write_text(s)
