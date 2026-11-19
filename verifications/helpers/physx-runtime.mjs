// Vrai WASM embarqué, dans un contexte navigateur sans process ni accès réseau.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export async function chargerPhysX() {
  const c = { console, URL, TextEncoder, TextDecoder, performance, setTimeout, clearTimeout, atob, btoa, queueMicrotask };
  c.window = c; c.self = c; c.globalThis = c; vm.createContext(c);
  const runtime = new URL('../../src/ferro/physx-runtime.js', import.meta.url);
  // Uniquement pour une qualification de développement du canon avant installation du verrou.
  const adapter = process.env.BITUME_PHYSX_ADAPTER || fileURLToPath(new URL('../../src/ferro/physx.js', import.meta.url));
  vm.runInContext(readFileSync(runtime, 'utf8'), c, { filename: 'physx-runtime.js' });
  vm.runInContext(readFileSync(adapter, 'utf8'), c, { filename: 'physx.js' });
  await c.FPhysX.init(); return c.FPhysX;
}
