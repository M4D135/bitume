// Traits de précipitation sur la surface transparente de chaque vue. FERRO reste
// propriétaire du GPUDevice. Aucun échantillonnage ni transfert de l'image de la course.
(function () {
  'use strict';
  const B = globalThis.BITUME || (globalThis.BITUME = {});
  const pipelines = new WeakMap();
  const shader = `
struct Vue { pixels: vec2f, dpr: f32, reserve: f32 };
@group(0) @binding(0) var<uniform> vue: Vue;
struct V {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) @interpolate(flat) longueur: f32,
  @location(2) @interpolate(flat) rayon: f32,
  @location(3) @interpolate(flat) alpha: f32,
};
@vertex fn vs(@builtin(vertex_index) coin: u32, @location(0) extremites: vec4f, @location(1) style: vec2f) -> V {
  let debut = extremites.xy * vue.dpr;
  let delta = (extremites.zw - extremites.xy) * vue.dpr;
  let longueur = length(delta);
  let u = select(vec2f(1,0), delta / max(longueur, 0.00001), longueur > 0.00001);
  let v = vec2f(-u.y, u.x);
  let rayon = style.x * 0.5 * vue.dpr;
  let marge = rayon + 1.0;
  let local = vec2f(select(-marge, longueur + marge, (coin & 1u) != 0u),
                    select(-marge, marge, coin >= 2u));
  let p = (debut + u * local.x + v * local.y) / vue.pixels;
  var out: V;
  out.position = vec4f(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0, 1);
  out.local = local; out.longueur = longueur; out.rayon = rayon; out.alpha = style.y;
  return out;
}
@fragment fn fs(i: V) -> @location(0) vec4f {
  let distance = length(vec2f(i.local.x - clamp(i.local.x, 0.0, i.longueur), i.local.y));
  // Frange analytique d'un pixel, bornée par la largeur réelle pour les traits fins.
  let couverture = clamp(i.rayon + 0.5 - distance, 0.0, min(1.0, i.rayon * 2.0));
  let alpha = i.alpha * couverture;
  return vec4f(vec3f(190, 210, 225) * (alpha / 255.0), alpha);
}`;

  function pipelinePour(device, format) {
    let formats = pipelines.get(device);
    if (!formats) { formats = new Map(); pipelines.set(device, formats); }
    if (!formats.has(format)) {
      const module = device.createShaderModule({ label: 'BITUME · traits de pluie', code: shader });
      const blend = { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' };
      formats.set(format, device.createRenderPipeline({ label: 'BITUME · traits de pluie', layout: 'auto',
        vertex: { module, entryPoint: 'vs', buffers: [{ arrayStride: 24, stepMode: 'instance',
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }, { shaderLocation: 1, offset: 16, format: 'float32x2' }] }] },
        fragment: { module, entryPoint: 'fs', targets: [{ format, blend: { color: blend, alpha: blend } }] },
        primitive: { topology: 'triangle-strip' } }));
    }
    return formats.get(format);
  }

  function creer(canvas, gpu, maximum) {
    if (!canvas || !gpu) return null;
    const instances = new Float32Array(maximum * 6), vue = new Float32Array(4), debut = new Uint32Array(3);
    const attache = { view: null, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } };
    const passe = { label: 'BITUME · pluie projetée', colorAttachments: [attache] };
    let contexte, device, pipeline, tampon, uniforme, groupe, format;
    function detruire() {
      tampon?.destroy(); uniforme?.destroy();
      contexte?.unconfigure(); tampon = uniforme = groupe = pipeline = device = null;
      vue.fill(0);
    }
    function preparer() {
      const source = gpu(), suivant = source?.device;
      if (!suivant) { if (device) detruire(); return false; }
      const cible = source.canvasFormat || navigator.gpu.getPreferredCanvasFormat();
      if (device === suivant && format === cible) return true;
      if (device) detruire();
      contexte ||= canvas.getContext('webgpu');
      if (!contexte) return false;
      device = suivant; format = cible;
      contexte.configure({ device, format, alphaMode: 'premultiplied' });
      pipeline = pipelinePour(device, format);
      tampon = device.createBuffer({ label: 'BITUME · gouttes projetées', size: instances.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      uniforme = device.createBuffer({ size: vue.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      groupe = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniforme } }] });
      return true;
    }
    function soumettre(n) {
      attache.view = contexte.getCurrentTexture().createView();
      const enc = device.createCommandEncoder(), p = enc.beginRenderPass(passe);
      if (n) { p.setPipeline(pipeline); p.setBindGroup(0, groupe); p.setVertexBuffer(0, tampon); p.draw(4, n); }
      p.end(); device.queue.submit([enc.finish()]); attache.view = null;
    }
    function tracer(segments, lots, n, comptes, largeurs, opacites, dpr, ancienneImage, transparences) {
      if (!preparer()) return false;
      if (vue[0] !== canvas.width || vue[1] !== canvas.height || vue[2] !== Math.fround(dpr)) {
        vue[0] = canvas.width; vue[1] = canvas.height; vue[2] = dpr;
        device.queue.writeBuffer(uniforme, 0, vue);
      }
      // Stable par distance comme les trois tracés historiques, une seule soumission pour toute la vue.
      debut[2] = 0; debut[1] = comptes[2]; debut[0] = comptes[2] + comptes[1];
      for (let i = 0; i < n; i++) {
        const c = lots[i], j = 6 * debut[c]++, k = 4 * i;
        instances[j] = segments[k]; instances[j + 1] = segments[k + 1];
        instances[j + 2] = segments[k + 2]; instances[j + 3] = segments[k + 3];
        instances[j + 4] = largeurs[c]; instances[j + 5] = opacites[c] * (transparences ? transparences[i] / 63 : 1);
      }
      device.queue.writeBuffer(tampon, 0, instances, 0, 6 * n);
      soumettre(n); return true;
    }
    function effacer() { if (device && gpu()?.device === device) soumettre(0); }
    return { tracer, effacer, detruire };
  }
  B.pluieWebGPU = { creer };
})();
