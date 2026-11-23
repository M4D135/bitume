import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/banc-configuration.js', import.meta.url), 'utf8');
const profils = ['low', 'medium', 'high', 'extreme'];

function bancSimule(dernier) {
  let temps = 0, niveau = -1, detruites = 0;
  const contexte = vm.createContext({ performance: { now: () => (temps += .01) }, setInterval, clearInterval,
    GPUTextureUsage: { RENDER_ATTACHMENT: 1 }, GPUBufferUsage: { UNIFORM: 1, COPY_DST: 2, VERTEX: 4 },
    BITUME: { autoconfig: { profils: Object.fromEntries(profils.map(nom => [nom, { nom }])) } } });
  vm.runInContext(source, contexte);
  const destroy = () => detruites++;
  const device = {
    limits: { maxTextureDimension2D: 8192 }, createShaderModule: () => ({}),
    createRenderPipelineAsync: async () => ({ getBindGroupLayout() {} }),
    createTexture: () => ({ createView() {}, destroy }), createBuffer: () => ({ destroy }), createBindGroup() {},
    createCommandEncoder() {
      let passes = 0;
      return { beginRenderPass() { passes++; return { setPipeline() {}, setVertexBuffer() {}, setBindGroup() {}, draw() {}, end() {} }; },
        finish: () => passes };
    },
    queue: { writeBuffer(_buffer, _offset, donnees) { if (donnees.length === 4) niveau++; },
      submit([images]) { temps += images * (niveau <= dernier ? 3 : 25); }, async onSubmittedWorkDone() {} }
  };
  return { mesurer: options => contexte.BITUME.bancConfiguration.mesurer({ device, largeur: 640, hauteur: 360, ...options }),
    detruites: () => detruites };
}

for (const [i, profil] of profils.entries()) {
  test('attribue la configuration ' + profil + ' selon les rafales réellement terminées', async () => {
    const b = bancSimule(i), r = await b.mesurer();
    assert.equal(r.selection, profil);
    assert.deepEqual(Array.from(r.mesures.filter(m => m.acceptable), m => m.profil), profils.slice(0, i + 1));
    assert.equal(r.mesures.length, Math.min(i + 2, profils.length));
    assert.equal(b.detruites(), 3);
  });
}

test('un passage explicite libère toutes les ressources de mesure', async () => {
  const b = bancSimule(3);
  let stop = false;
  await assert.rejects(b.mesurer({ progression: () => { stop = true; }, annule: () => stop }), e => e.motif === 'annule');
  assert.equal(b.detruites(), 3);
});
