(async () => {
  const J = BITUME_JEU, dormir = ms => new Promise(r => setTimeout(r, ms));
  const choisir = (n, v) => { const r = document.querySelector(`input[name="${n}"][value="${v}"]`); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); };
  choisir('qualite', 'low'); choisir('vegetation', 'off');
  J.demo(0); await dormir(3000);
  const sc = J.scene, avant = sc.vegetationQualite;
  choisir('vegetation', 'high');
  J.demo(0);
  const sync = { memeScene: J.scene === sc, vegetation: J.scene.vegetationQualite, avant };
  await dormir(3000);
  return { sync, apres: { vegetation: J.scene.vegetationQualite } };
})()
