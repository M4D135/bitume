/* BITUME — passes WebGPU des spectateurs. Le moteur fournit les caméras, l’atlas d’ombres et les lumières. */
(function (B) {
  'use strict';
  const caches = new WeakMap();
  function creer(gpu, pub, maillage, pas, largeur, capacite) {
    const { device } = gpu;
    function tampon(label, usage, donnees) {
      const size = typeof donnees === 'number' ? donnees : donnees.byteLength;
      const buffer = device.createBuffer({ label, size: Math.max(4, Math.ceil(size / 4) * 4), usage: usage | GPUBufferUsage.COPY_DST });
      if (typeof donnees !== 'number' && size) device.queue.writeBuffer(buffer, 0, donnees);
      return buffer;
    }
    function creerProgramme(source, ombre) {
      const etages = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
      const entrees = [{ binding: 0, visibility: etages, buffer: { type: 'uniform' } }];
      for (const t of source.textures) {
        entrees.push({ binding: t.binding, visibility: etages, texture: { sampleType: t.sampleType } });
        entrees.push({ binding: t.samplerBinding, visibility: etages, sampler: { type: 'non-filtering' } });
      }
      const layout = device.createBindGroupLayout({ entries: entrees });
      const description = {
        label: ombre ? 'Ombres du public' : 'Spectateurs',
        layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
        vertex: { module: device.createShaderModule({ code: source.vertex }), entryPoint: 'main', buffers: [
          { arrayStride: pas, attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' },
            { shaderLocation: 2, offset: 24, format: 'float32x2' }, { shaderLocation: 3, offset: 32, format: 'uint8x4' }] },
          { arrayStride: 4, stepMode: 'instance', attributes: [{ shaderLocation: 4, offset: 0, format: 'uint32' }] }] },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: gpu.depthFormat, depthWriteEnabled: true, depthCompare: 'less-equal' }
      };
      if (!ombre) description.fragment = { module: device.createShaderModule({ code: source.fragment }), entryPoint: 'main', targets: [{ format: gpu.format }] };
      return { source, layout, description, pipelines: new Map() };
    }
    let commun = caches.get(device);
    if (!commun) {
      commun = {
        vues: 0, sommets: tampon('Corps du public', GPUBufferUsage.VERTEX, maillage.sommets),
        indices: tampon('Indices du public', GPUBufferUsage.INDEX, maillage.indices),
        couleur: creerProgramme(B.shadersPublic.couleur, false), ombre: creerProgramme(B.shadersPublic.ombre, true),
        sampler: device.createSampler()
      };
      caches.set(device, commun);
    }
    commun.vues++;
    function texture(format, data) {
      const size = [largeur, Math.max(1, pub.lignes)];
      const t = device.createTexture({ label: 'Attributs du public', size, format, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
      if (data.byteLength) device.queue.writeTexture({ texture: t }, data, { bytesPerRow: largeur * 16 }, size);
      return t;
    }
    const texF = texture('rgba32float', pub.flottants), texU = texture('rgba32uint', pub.entiers);
    const vues = { uPublicF: texF.createView(), uPublicU: texU.createView() };
    const passes = new Map();
    let libre = false;
    function preparer(pass, vp, v, ombre, temps, etat, liste) {
      const prog = ombre ? commun.ombre : commun.couleur;
      // Les tuiles d’ombre figurent dans le même command buffer. Leurs matrices et listes doivent rester distinctes.
      const cle = ombre ? 'ombre-' + v.viewport.join('-') : 'couleur';
      let r = passes.get(cle);
      if (!r) {
        const taille = prog.source.uniforms.byteLength;
        r = { data: new ArrayBuffer(taille), uniform: tampon('Pose et éclairage du public', GPUBufferUsage.UNIFORM, taille),
          instances: tampon('Spectateurs visibles', GPUBufferUsage.VERTEX, capacite), groupe: null, atlas: null };
        passes.set(cle, r);
      }
      const u = { uVP: vp, uTemps: temps, uSections: etat.s1, uSections2: etat.s2 };
      if (!ombre) {
        const o = v.ombre, l = v.lumieres;
        Object.assign(u, { uPdrMatriceOmbre: o.matrice, uPdrOmbreReglages: [Number(o.active), o.texel, Number(o.plein), 0],
          uPdrOeil: v.oeil, uPdrSoleil: v.soleil, uPdrCouleurSoleil: v.couleurSoleil, uPdrAmbiance: v.ambiance,
          uPdrBrouillard: v.brouillard, uPdrCielHaut: v.cielHaut, uPdrCielBas: v.cielBas, uPdrResolution: [v.largeur, v.hauteur],
          uPdrEnvironnement: [1, v.densiteBrouillard, v.temps, 0], uPdrLumierePosition: l.positions, uPdrLumiereCouleur: l.couleurs,
          uPdrLumiereDirection: l.directions, uPdrLumiereCone: l.cones, uPdrLumierePortee: l.portees, uPdrLumieres: l.nombre });
      }
      FRenderWebGPU.writeUniforms(r.data, prog.source.uniforms.fields, u);
      device.queue.writeBuffer(r.uniform, 0, r.data);
      device.queue.writeBuffer(r.instances, 0, liste.liste, 0, liste.total);
      const atlas = ombre ? null : v.ombre.textureView;
      if (!r.groupe || r.atlas !== atlas) {
        const entries = [{ binding: 0, resource: { buffer: r.uniform } }];
        for (const t of prog.source.textures) {
          entries.push({ binding: t.binding, resource: vues[t.name] || atlas }, { binding: t.samplerBinding, resource: commun.sampler });
        }
        r.groupe = device.createBindGroup({ layout: prog.layout, entries }); r.atlas = atlas;
      }
      const count = ombre ? 1 : gpu.samples || 1;
      if (!prog.pipelines.has(count)) prog.pipelines.set(count, device.createRenderPipeline({ ...prog.description, multisample: { count } }));
      pass.setPipeline(prog.pipelines.get(count)); pass.setBindGroup(0, r.groupe);
      pass.setVertexBuffer(0, commun.sommets); pass.setVertexBuffer(1, r.instances); pass.setIndexBuffer(commun.indices, 'uint32');
    }
    function liberer() {
      if (libre) return;
      libre = true;
      for (const r of passes.values()) { r.uniform.destroy(); r.instances.destroy(); }
      texU.destroy(); texF.destroy(); passes.clear();
      if (--commun.vues === 0) { commun.indices.destroy(); commun.sommets.destroy(); caches.delete(device); }
    }
    return { preparer, liberer };
  }
  B.publicGPU = { creer };
})(globalThis.BITUME = globalThis.BITUME || {});
