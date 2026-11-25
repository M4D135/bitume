// Grille du terrain ordinaire avant les ouvrages : une même coupe de route, de
// lagon ou de pont se réapplique aux mêmes flottants, au premier chargement comme au suivant.
(function(B){
  'use strict';
  const MAGIC=0x31475242, ENTETE=40;
  function ouvrir(cle){
    const c={cle,bloc:null,choisi:false,rapport:{source:'calcul',ms:0,octets:0,ecriture:null}};
    // Aucune attente du stockage sur le chemin de la course.
    B.cache.lire(cle).then(bloc=>{if(!c.choisi)c.bloc=bloc;},()=>{});
    return c;
  }
  function grille(c,nx,nz,x,z,pas,plans,calculer){
    if(!c){calculer();return;}
    c.choisi=true;
    const t=performance.now(), n=nx*nz;
    let taille=ENTETE, masque=0;
    for(let i=0;i<plans.length;i++) if(plans[i]){taille+=plans[i].byteLength;masque|=1<<i;}
    const a=c.bloc; c.bloc=null;
    const v=a instanceof ArrayBuffer && a.byteLength===taille && new DataView(a);
    if(v && v.getUint32(0,true)===MAGIC && v.getUint32(4,true)===nx && v.getUint32(8,true)===nz &&
      v.getUint32(12,true)===masque && v.getFloat64(16,true)===x && v.getFloat64(24,true)===z && v.getFloat64(32,true)===pas){
      let k=ENTETE;
      for(const p of plans) if(p){p.set(new p.constructor(a,k,n));k+=p.byteLength;}
      Object.assign(c.rapport,{source:'indexeddb',ms:performance.now()-t,octets:taille,ecriture:false});return;
    }
    calculer();
    // Instantané pris avant tout creusement. Ne jamais garder les tableaux du décor
    // dans une écriture asynchrone, ni les réécrire lors d'un hit.
    const bloc=new ArrayBuffer(taille), entete=new DataView(bloc);
    entete.setUint32(0,MAGIC,true);entete.setUint32(4,nx,true);entete.setUint32(8,nz,true);entete.setUint32(12,masque,true);
    entete.setFloat64(16,x,true);entete.setFloat64(24,z,true);entete.setFloat64(32,pas,true);
    let k=ENTETE;
    for(const p of plans) if(p){new Uint8Array(bloc,k,p.byteLength).set(new Uint8Array(p.buffer,p.byteOffset,p.byteLength));k+=p.byteLength;}
    c.bloc=bloc; Object.assign(c.rapport,{ms:performance.now()-t,octets:taille});
  }
  function conserver(c){
    if(!c?.choisi||!c.bloc)return;
    const bloc=c.bloc;c.bloc=null;
    const sauver=async()=>{try{c.rapport.ecriture=await B.cache.ecrire(c.cle,bloc);}catch{c.rapport.ecriture=false;}};
    if(typeof requestIdleCallback==='function')requestIdleCallback(sauver);else setTimeout(sauver,0);
  }
  B.cacheRelief={ouvrir,grille,conserver};
})(globalThis.BITUME=globalThis.BITUME||{});
