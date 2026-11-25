// Appelé uniquement par le banc Chrome dans son profil jetable. Vrai stockage
// IndexedDB : transaction d'insertion, priorités LRU et purge sélective.
export async function controlerCacheLRU() {
  const C=BITUME.cache;
  const exiger=(ok,texte)=>{if(!ok)throw Error(texte);};
  const ecrire=async(c,v)=>exiger(await C.ecrire(c,v),'écriture '+c);
  await C.purger();
  for(let k=0;k<C.MAX_ENTREES;k++) await ecrire('test:'+String(k).padStart(2,'0'),k);
  await new Promise(ok=>setTimeout(ok,5));
  exiger(await C.lire('test:00')===0,'lecture de la plus ancienne');
  await ecrire('garder',new Uint8Array([23,47]).buffer);
  exiger(await C.lire('test:01')===null,'la clé froide devait sortir');
  await ecrire('test:02',200);
  exiger(await C.lire('test:03')===3,'le remplacement a évincé une autre clé');
  exiger(await C.lire('test:00')===0,'la clé chaude a été évincée');
  exiger(await C.purger('test:'),'purge préfixée');
  exiger(await C.lire('test:02')===null,'le préfixe existe encore');
  exiger(await C.purger(C.VERSION_SCHEMA),'purge par version');
  exiger(new Uint8Array(await C.lire('garder'))[1]===47,'bloc hors préfixe perdu');
  return {entrees:C.MAX_ENTREES,eviction:true,remplacement:true,prefixe:true,version:true};
}
