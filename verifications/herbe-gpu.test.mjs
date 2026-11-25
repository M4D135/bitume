import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/herbe-gpu.js';

test('clipmap : ancrage sur la surface masquée, bandes sans doublons et cut de caméra', () => {
  const cellules = new Map(), echantillons = new Map();
  const decor = {
    surfaceHerbe(x,z,s) {
      const a=Math.floor(x/.45), b=Math.floor(z/.45);
      const cle=a+','+b, y=x*.3+z*.05;
      const valide=(a+b)%5!==0;
      echantillons.set(cle,valide?y:null);
      return valide ? Object.assign(s,{y, normal:[0,1,0], color:[.2,.4,.3]}) : null;
    }, ecologie:{echantillonner(x,z,h){h.herbe=.75;return h;}}
  };
  const clip=BITUME.herbeGPU.clipmap(decor,(px,pz,w,h,data)=>{
    assert.ok(px>=0 && pz>=0 && px+w<=256 && pz+h<=256);
    for(let j=0;j<h;j++) for(let i=0;i<w;i++){
      const n=8*(j*w+i);
      cellules.set((pz+j)*256+px+i,data[n+7]===0?null:data[n]);
    }
  });
  function comparer(r) {
    for(let b=r[1];b<r[3];b++) for(let a=r[0];a<r[2];a++){
      const y=echantillons.get(a+','+b), valeur=cellules.get((b&255)*256+(a&255));
      if(y===null) assert.equal(valeur,null); else assert.ok(Math.abs(valeur-y)<.001);
    }
  }
  let r;
  for(let k=0;k<35;k++) r=clip.maj(-.125,-.125);
  assert.equal(clip.echantillons,0); assert.deepEqual([...r],[-129,-129,127,127]); comparer(r);
  r=clip.maj(.9,.45); assert.equal(clip.echantillons,256*5-3*2); comparer(r);
  r=clip.maj(-3000,9000); assert.equal(clip.echantillons,1024); comparer(r);
});
