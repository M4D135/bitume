import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Session} from 'node:inspector';
const require=createRequire(import.meta.url);
const repo='/workspace/scratch/ea118b42480b/bitume';
for(const f of ['carene.js','circuit.js','decor.js']) require(`${repo}/src/${f}`);
const B=globalThis.BITUME;
const c=B.circuit.creer(11,{theme:'foret',longueur:4200,nom:'Val-Brûlé'});
const profile=process.argv[2];
let session;
const post=(name,args={})=>new Promise((resolve,reject)=>session.post(name,args,(error,result)=>error?reject(error):resolve(result)));
if(profile){session=new Session();session.connect();await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:100});await post('Profiler.start');}
const usage0=process.cpuUsage();
const t0=performance.now();
const decor=B.decor.construire(c);
const elapsed=performance.now()-t0;
const usage=process.cpuUsage(usage0);
if(profile){const result=await post('Profiler.stop');writeFileSync(profile,JSON.stringify(result.profile));session.disconnect();}
const hash=createHash('sha256').update(JSON.stringify(decor)).digest('hex');
console.log(JSON.stringify({node:process.version,profilage:!!profile,scope:'Premier D.construire(c) sans options, après imports et C.creer ; protocole Val-Brûlé decor.test.mjs',parameters:{graine:11,theme:'foret',longueur:4200,nom:'Val-Brûlé'},wall_ms:elapsed,cpu_user_ms:usage.user/1000,cpu_system_ms:usage.system/1000,strict_threshold_ms:150,under_threshold:elapsed<150,circuit_samples:c.n,circuit_length:c.longueur,arbres:decor.arbres.length,lots:decor.lots.length,obstacles:decor.obstacles.length,nappes:decor.nappes.length,decor_json_sha256:hash,decor_keys:Object.keys(decor)}));
