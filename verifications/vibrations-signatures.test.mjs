import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/vibrations.js';
const V = globalThis.BITUME.vibrations;
const maximum = (serie, k) => Math.max(...serie.map(x => x[k]));
const moyenne = (serie, k) => serie.reduce((s, x) => s + x[k], 0) / serie.length;
function trace(entree, evenement, hz = 60) {
  const etat = V.creer(), t = [];
  for (let i = 0; i < hz * 2; i++) {
    t.push({ ...V.calculer(etat, { ...entree, evenements: i === 0 && evenement ? [evenement] : null }, 1 / hz) });
  }
  return t;
}
test('cinq signatures distinctes à la force normale, sans saturation lors de leur superposition', () => {
  const grain = trace({ v: 42 });
  const moteur = trace({ v: 0, regime: 9700, ralenti: 1000, maxUtile: 14000, gaz: .85 });
  const bord = trace({ v: 42, vibreur: true });
  const boite = trace({}, { type: 'rapport' });
  const choc = trace({}, { type: 'choc', force: 30 });
  assert.equal(maximum(grain, 'fort'), 0);
  assert.ok(maximum(grain, 'faible') < .065 && moyenne(grain, 'faible') > .02);
  assert.ok(maximum(moteur, 'fort') > .1 && maximum(moteur, 'fort') < .16);
  assert.ok(maximum(bord, 'fort') > .25 && maximum(bord, 'fort') < .30);
  assert.ok(boite[0].faible > 4 * boite[0].fort && boite[0].gachetteD > .15);
  assert.ok(boite.slice(7).every(x => x.faible === 0 && x.fort === 0));
  assert.ok(choc[0].fort > .55 && choc[0].faible === 0 && choc[7].fort > .1);
  assert.ok(trace({}, { type: 'contact', force: 5 })[0].fort < choc[0].fort * .4);
  const tout = V.calculer(V.creer(), { v: 42, regime: 13000, ralenti: 1000, maxUtile: 14000, gaz: 1,
    patinage: 1, blocage: 1, vibreur: true, evenements: [{ type: 'rapport' }, { type: 'choc', force: 30 }] }, 1/60);
  assert.deepEqual(tout, choc[0], 'la collision garde sa signature au milieu de plusieurs signaux');
});
test('le régime moteur change la cadence à vitesse constante, indépendamment du grain', () => {
  function pics(regime) {
    const t = trace({ regime, ralenti: 1000, maxUtile: 14000, v: 35, gaz: .8 }, null, 120);
    const f = t.map(x => x.fort);
    return f.filter((v, i) => i > 0 && v > f[i-1] && v >= f[i+1]).length;
  }
  const bas = pics(3500), moyen = pics(8000), haut = pics(13000);
  assert.ok(bas + 3 < moyen && moyen + 3 < haut);
});
const signal = { faible: .15, fort: .32, gachetteG: .24, gachetteD: .13 };
function manette(id, effects) {
  const appels = [];
  const vibrationActuator = { effects, playEffect(type, valeurs) { appels.push({ type, ...valeurs }); return Promise.resolve('complete'); },
    reset() { appels.push({ type: 'reset' }); return Promise.resolve('complete'); } };
  return { id, index: 0, connected: true, vibrationActuator, appels };
}
test('Xbox avec quatre canaux et DualSense / Switch en mode double annoncé par le navigateur', () => {
  const o = V.creerSortie();
  for (const [id, liste, mode] of [
    ['Xbox Wireless Controller', ['dual-rumble','trigger-rumble'], 'trigger-rumble'],
    ['DualSense Wireless Controller', ['dual-rumble'], 'dual-rumble'],
    ['Pro Controller', ['dual-rumble'], 'dual-rumble'],
    ['Xbox Wireless Controller', ['dual-rumble'], 'dual-rumble']
  ]) {
    const p = manette(id, liste); V.affecter(o, p); V.envoyer(o, signal, 3);
    const a = p.appels[0]; assert.equal(a.type, mode); assert.equal(a.strongMagnitude, .32);
    if (mode === 'trigger-rumble') assert.deepEqual([a.leftTrigger,a.rightTrigger], [.24,.13]);
    else assert.ok(!('leftTrigger' in a) && !('rightTrigger' in a));
    V.arreter(o); V.arreter(o); assert.equal(p.appels.filter(a => a.type === 'reset').length,1);
  }
});
test('ancien pilote à pulse unique ou deux actionneurs et manette sans retour', () => {
  for (const nb of [0,1,2]) {
    const o = V.creerSortie(), h = Array.from({length:nb}, () => ({ appels: [], pulse(v,ms) { this.appels.push([v,ms]); return Promise.resolve(true); } }));
    const p = {id:'Pro Controller',index:0,connected:true,hapticActuators:h}; V.affecter(o,p);
    V.envoyer(o,signal,0); V.envoyer(o,signal,10); V.arreter(o);
    for (const a of h) assert.deepEqual(a.appels, [[.32,100],[0,0]]);
    if(!nb) assert.equal(o.active,false);
  }
});
test('un refus matériel des gâchettes sélectionne le double moteur, un acquittement ancien reste sans effet', async () => {
  const p = manette('Xbox', ['trigger-rumble','dual-rumble']), o = V.creerSortie();
  let acquitter; const promesse = new Promise(f => { acquitter = f; });
  const jouer=p.vibrationActuator.playEffect;
  p.vibrationActuator.playEffect=(type,v)=>{ jouer(type,v); return type==='trigger-rumble'?promesse:Promise.resolve('complete'); };
  V.affecter(o,p); V.envoyer(o,signal,0); acquitter('not-supported'); await promesse; V.envoyer(o,signal,34);
  assert.deepEqual(p.appels.map(x=>x.type),['trigger-rumble','dual-rumble']);
  let rejeter;
  V.affecter(o,null); V.affecter(o,p); p.vibrationActuator.playEffect=()=>new Promise((_,j)=>{rejeter=j;});
  V.envoyer(o,signal,99);
  const autre=manette('DualSense',['dual-rumble']); V.affecter(o,autre);
  rejeter(new DOMException('refus ancien','NotSupportedError')); await Promise.resolve();
  V.envoyer(o,signal,101); assert.equal(autre.appels[0].type,'dual-rumble');
});
test('un rapport survenant entre deux commandes atteint chaque fréquence d’image et chaque profil', () => {
  for (const hz of [30,60,120,144]) for (const decalage of [1,2,3,4,5]) {
    const o=V.creerSortie(), v=V.creer(), p=manette('Pro Controller',['dual-rumble']);
    V.affecter(o,p);
    for(let i=0;i<hz;i++){
      const e={ v:30, evenements:i===decalage?[{type:'rapport'}]:null };
      V.envoyer(o,V.calculer(v,e,1/hz),i*1000/hz);
    }
    const pic=Math.max(...p.appels.map(a=>a.weakMagnitude||0));
    assert.ok(pic>=.31,'pic '+pic+' à '+hz+' Hz, décalage '+decalage);
  }
});
