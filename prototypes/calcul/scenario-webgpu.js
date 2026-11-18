// Lot 28 « calcul » — sonde WebGPU de la machine et banc court : mise à jour de particules (position, vitesse,
// gravité, rebond au sol, vent) en compute WebGPU face à la même boucle en JavaScript sur Float32Array.
(async () => {
  const r = { navigatorGpu: !!navigator.gpu, userAgent: navigator.userAgent };
  if (!navigator.gpu) return r;
  const a = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!a) return Object.assign(r, { adaptateur: null });
  const info = a.info || {};
  r.adaptateur = { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description, isFallbackAdapter: info.isFallbackAdapter, subgroupMinSize: info.subgroupMinSize, subgroupMaxSize: info.subgroupMaxSize };
  r.fonctions = [...a.features].sort();
  r.limites = {}; for (const k in a.limits) if (typeof a.limits[k] === 'number') r.limites[k] = a.limits[k];
  r.formatPrefere = navigator.gpu.getPreferredCanvasFormat();
  try { const c = await navigator.gpu.requestAdapter({ featureLevel: 'compatibility' }); r.modeCompatibilite = !!c; } catch (e) { r.modeCompatibilite = String(e).slice(0, 80); }
  const dev = await a.requestDevice({ requiredFeatures: a.features.has('timestamp-query') ? ['timestamp-query'] : [] });
  const WGSL = `struct P { p: vec4f, v: vec4f };
    @group(0) @binding(0) var<storage, read_write> parts: array<P>;
    @group(0) @binding(1) var<uniform> u: vec4f; // dt, gravité, vent x, n
    @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {
      let i = id.x; if (i >= u32(u.w)) { return; }
      var q = parts[i];
      q.v.y = q.v.y - u.y * u.x; q.v.x = q.v.x + (u.z - q.v.x) * 0.02;
      q.p = vec4f(q.p.xyz + q.v.xyz * u.x, q.p.w - u.x);
      if (q.p.y < 0.0) { q.p.y = -q.p.y * 0.4; q.v.y = -q.v.y * 0.4; }
      if (q.p.w < 0.0) { q.p = vec4f(0.0, 1.0, 0.0, 3.0); q.v = vec4f(1.0, 4.0, 0.5, 0.0); }
      parts[i] = q; }`;
  const module = dev.createShaderModule({ code: WGSL });
  let t0 = performance.now();
  const pipeline = await dev.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } });
  r.creationPipelineMs = +(performance.now() - t0).toFixed(1);
  const bancs = [];
  for (const N of [4096, 65536, 1048576]) {
    const init = new Float32Array(N * 8); for (let i = 0; i < N; i++) { init[8 * i + 1] = 1; init[8 * i + 3] = 3 * (i / N); init[8 * i + 4] = 1; init[8 * i + 5] = 4; init[8 * i + 6] = .5; }
    // processeur : même calcul
    const P = init.slice(), dt = 1 / 120, g = 9.81, vent = 2;
    const pasCPU = () => { for (let i = 0, o = 0; i < N; i++, o += 8) {
      P[o + 5] -= g * dt; P[o + 4] += (vent - P[o + 4]) * .02;
      P[o] += P[o + 4] * dt; P[o + 1] += P[o + 5] * dt; P[o + 2] += P[o + 6] * dt; P[o + 3] -= dt;
      if (P[o + 1] < 0) { P[o + 1] = -P[o + 1] * .4; P[o + 5] = -P[o + 5] * .4; }
      if (P[o + 3] < 0) { P[o] = 0; P[o + 1] = 1; P[o + 2] = 0; P[o + 3] = 3; P[o + 4] = 1; P[o + 5] = 4; P[o + 6] = .5; } } };
    for (let k = 0; k < 20; k++) pasCPU();
    const pas = N >= 1048576 ? 20 : 200;
    t0 = performance.now(); for (let k = 0; k < pas; k++) pasCPU(); const cpuParPas = (performance.now() - t0) / pas;
    // carte graphique
    const tampon = dev.createBuffer({ size: init.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    dev.queue.writeBuffer(tampon, 0, init);
    const uni = dev.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    dev.queue.writeBuffer(uni, 0, new Float32Array([dt, g, vent, N]));
    const groupe = dev.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: tampon } }, { binding: 1, resource: { buffer: uni } }] });
    const lancer = n => { const enc = dev.createCommandEncoder(); for (let k = 0; k < n; k++) { const p = enc.beginComputePass(); p.setPipeline(pipeline); p.setBindGroup(0, groupe); p.dispatchWorkgroups(Math.ceil(N / 64)); p.end(); } dev.queue.submit([enc.finish()]); };
    lancer(20); await dev.queue.onSubmittedWorkDone();
    // coût processeur d'un pas (encodage et envoi, une passe par image comme dans un jeu)
    t0 = performance.now(); for (let k = 0; k < pas; k++) lancer(1); const envoiParPas = (performance.now() - t0) / pas;
    await dev.queue.onSubmittedWorkDone();
    // temps de la carte graphique : lot de pas dans un seul envoi, attente de la fin
    t0 = performance.now(); lancer(pas); await dev.queue.onSubmittedWorkDone(); const gpuParPas = (performance.now() - t0) / pas;
    // relecture (contrôle : même ordre de grandeur que la version processeur)
    const lecture = dev.createBuffer({ size: 32, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const enc = dev.createCommandEncoder(); enc.copyBufferToBuffer(tampon, 0, lecture, 0, 32); dev.queue.submit([enc.finish()]);
    await lecture.mapAsync(GPUMapMode.READ); const v = Array.from(new Float32Array(lecture.getMappedRange()).slice(0, 4)).map(x => +x.toFixed(3)); lecture.unmap();
    bancs.push({ particules: N, pas, cpuJsParPasMs: +cpuParPas.toFixed(4), gpuEnvoiProcesseurParPasMs: +envoiParPas.toFixed(4), gpuExecutionParPasMs: +gpuParPas.toFixed(4), echantillonGPU: v, echantillonCPU: Array.from(P.slice(0, 4)).map(x => +x.toFixed(3)) });
    tampon.destroy(); uni.destroy(); lecture.destroy();
  }
  r.bancParticules = bancs;
  dev.destroy();
  return r;
})()
