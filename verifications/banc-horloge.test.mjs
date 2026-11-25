import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('un premier rAF datant du chargement ne contamine pas la fenêtre après chauffe', async () => {
  const jeu=readFileSync(new URL('../src/jeu.js',import.meta.url),'utf8');
  const source=jeu.slice(jeu.indexOf('  function banc(options'),jeu.indexOf('  const outilsJeu'));
  const callbacks=[],session={course:{phase:'course'},i:0,fx:{}};
  const executer=new Function('requestAnimationFrame','session',`
    let maintenant=100,ecran='course';const performance={now:()=>maintenant},rendu={},reglages={},
      cadence={},etatProfils={},palier={},innerWidth=100,innerHeight=100,canvas={},CATALOGUE=[{}];
    const reference=()=>{maintenant+=2400},noop=()=>{},aller=noop,horlogeProfils=noop,
      appliquerPalier=noop,restaurerReference=noop,$=()=>({classList:{add:noop}}),
      B={graphismes:{QUALITES:['high'],stabiliser:noop},cadence:{regler:noop},traces:{compter:noop}};
    ${source}
    return banc({duree:.05,chauffe:1});`);
  const resultat=executer(f=>callbacks.push(f),session);
  for(const t of [105,2510,3499,3510,3527,3544,3561])callbacks.shift()(t);
  const r=await resultat;
  assert.deepEqual([r.preparationMs,r.images,r.pire,r.p50,r.duree],[2400,3,17,17,.05]);
});
