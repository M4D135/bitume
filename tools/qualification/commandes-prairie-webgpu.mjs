// Frontière WebGPU instrumentée pour l’oracle de soumission CPU de la prairie.
// Le vrai FERRO prépare les paquets et choisit les LOD. Le double compte les commandes encodées.
export async function mesurerCommandes(FRenderWebGPU, creation) {
  const ressources = new Set(), draws = [];
  const noop = () => {};
  function allouer(kind, descriptor) {
    const handle = { kind, ...descriptor, destroy() { ressources.delete(handle); } };
    ressources.add(handle);
    return handle;
  }
  const device = {
    features: new Set(), lost: new Promise(() => {}), destroy: noop,
    addEventListener: noop, removeEventListener: noop, pushErrorScope: noop, popErrorScope: async () => null,
    createBuffer(descriptor) { return allouer('Buffer', descriptor); },
    createTexture(descriptor) {
      const t = allouer('Texture', descriptor);
      t.createView = () => ({ texture: t }); return t;
    },
    createSampler: () => ({}), createBindGroupLayout: () => ({}), createPipelineLayout: () => ({}),
    createBindGroup: descriptor => descriptor,
    createRenderPipeline: descriptor => ({ ...descriptor, getBindGroupLayout: () => ({}) }),
    createShaderModule: () => ({ getCompilationInfo: async () => ({ messages: [] }) }),
    createCommandEncoder() {
      return { finish: noop, copyTextureToTexture: noop, beginRenderPass(descriptor) {
        const label = descriptor.label;
        const pass = label?.includes('shadow') ? 'shadow' : label === 'FERRO scene' || label === 'FERRO close weapon' ? 'color' : 'post';
        const draw = (count, instances = 1) => draws.push({ pass, count, instances });
        return { setPipeline: noop, setBindGroup: noop, setVertexBuffer: noop, setIndexBuffer: noop,
          setViewport: noop, setScissorRect: noop, drawIndexed: draw, draw, end: noop };
      } };
    },
    queue: { writeTexture: noop, writeBuffer: noop, submit: noop, onSubmittedWorkDone: async () => {} }
  };
  const ctx = { configure: noop, unconfigure: noop, getCurrentTexture: () => ({ createView: () => ({}) }) };
  const adapter = { features: device.features, requestDevice: async () => device };
  Object.defineProperty(globalThis.navigator, 'gpu', { configurable: true, value: {
    getPreferredCanvasFormat: () => 'bgra8unorm', requestAdapter: async () => adapter
  } });
  globalThis.GPUShaderStage = { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 };
  globalThis.GPUBufferUsage = { COPY_DST: 8, VERTEX: 32, INDEX: 16, UNIFORM: 64 };
  globalThis.GPUTextureUsage = { COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, RENDER_ATTACHMENT: 16 };
  const canvas = { width: 960, height: 540, clientWidth: 960, clientHeight: 540,
    getContext(type) { if (type !== 'webgpu') throw new Error('Contexte inattendu ' + type); return ctx; } };
  const renderer = await FRenderWebGPU.create(canvas, creation);
  return { renderer, canvas, draws, live: ressources, resources: kind => [...ressources].filter(r => r.kind === kind) };
}
