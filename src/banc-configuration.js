/* BITUME — épreuve de classement sur le périphérique WebGPU de la scène. */
(function (B) {
  'use strict';
  // Une passe plein écran et des quads instanciés sollicitent le remplissage et les sommets.
  // Le calcul côté navigateur représente douze véhicules. Les durées sont en millisecondes.
  const charges = [
    { profil: 'low', instances: 1500, iterations: 2, echelle: .028, cpu: 500 },
    { profil: 'medium', instances: 7000, iterations: 5, echelle: .026, cpu: 1800 },
    { profil: 'high', instances: 18000, iterations: 9, echelle: .024, cpu: 4500 },
    { profil: 'extreme', instances: 40000, iterations: 16, echelle: .022, cpu: 9000 }
  ];
  const budget = 1000 / 60, delai = 2000;
  const WGSL = `
struct Uniforms {
  params: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexIn {
  @location(0) pos: vec2<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOut {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) inst: f32,
};

@vertex
fn vertex_main(vi: VertexIn, @builtin(instance_index) inst_index: u32) -> VertexOut {
  let t = uniforms.params.x;
  let i = f32(inst_index);
  let cover = uniforms.params.w;

  var vo: VertexOut;
  vo.uv = vi.uv;
  vo.inst = i;

  if (cover > 0.5 && inst_index == 0u) {
    vo.clip_position = vec4<f32>(vi.pos.x * 2.0, vi.pos.y * 2.0, 0.5, 1.0);
    return vo;
  }

  let angle = i * 0.017453292519943295 + t * 0.5;
  let cs = cos(angle);
  let sn = sin(angle);
  let scale = uniforms.params.z * (0.7 + 0.3 * sin(i * 0.13 + t));
  let px = (cs * vi.pos.x - sn * vi.pos.y) * scale;
  let py = (sn * vi.pos.x + cs * vi.pos.y) * scale;
  let ox = sin(i * 0.37 + t) * 0.7;
  let oy = cos(i * 0.29 + t) * 0.5;
  let f = 1.2 / (1.0 + 0.2 * sin(i * 0.21 + t));

  vo.clip_position = vec4<f32>((px + ox) * f, (py + oy) * f, 0.5, 1.0);
  return vo;
}

@fragment
fn fragment_main(frag: VertexOut) -> @location(0) vec4<f32> {
  let uv = frag.uv;
  let inst = frag.inst;
  var col = vec3<f32>(
    0.5 + 0.5 * sin(uv.x * 6.28318530718 + inst),
    0.5 + 0.5 * sin(uv.y * 6.28318530718 + inst * 0.7),
    0.5 + 0.5 * cos(uv.x * 3.14159265359 + uv.y * 2.0 + inst * 0.3)
  );

  let quality = u32(uniforms.params.y);
  for (var k: u32 = 0u; k < quality; k = k + 1u) {
    let a = sin(col.x * 1.7 + f32(k) * 0.11);
    let b = cos(col.y * 2.3 + f32(k) * 0.17);
    let c = sin(col.z * 1.1 + f32(k) * 0.23);
    col = vec3<f32>(col.x + 0.02 * a, col.y + 0.02 * b, col.z + 0.02 * c);
    col = clamp(col, vec3<f32>(0.0), vec3<f32>(1.0));
  }

  return vec4<f32>(col, 1.0);
}
`;

  function creerVertexBuffer(device) {
    // Quad en triangle-list : 6 sommets, position + uv.
    const quad = new Float32Array([
      -0.5, -0.5, 0, 0,
       0.5, -0.5, 1, 0,
       0.5,  0.5, 1, 1,
      -0.5, -0.5, 0, 0,
       0.5,  0.5, 1, 1,
      -0.5,  0.5, 0, 1,
    ]);
    const buffer = device.createBuffer({
      size: quad.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, quad);
    return buffer;
  }

  function calculVoitures(iterations) {
    let somme = 0;
    for (let i = 0; i < iterations; i++) {
      let x = i * .123456789 % 100, y = i * .987654321 % 100;
      for (let voiture = 0; voiture < 12; voiture++) {
        x += .01 * Math.sin(x * .1 + voiture);
        y += .01 * Math.cos(y * .1 + voiture);
        somme += Math.sqrt(x * x + y * y + 1);
      }
    }
    return somme;
  }

  async function mesurer({ device, largeur, hauteur, annule = () => false, progression = () => {} }) {
    const debut = performance.now(), mesures = [];
    let selection = 'low', texture, sommets, parametres, timer;
    function verifier() {
      if (annule()) throw Object.assign(new Error('Test interrompu'), { motif: 'annule' });
      if (performance.now() - debut >= delai) throw Object.assign(new Error('Temps de mesure écoulé'), { motif: 'delai' });
    }
    const interruption = new Promise((_, rejeter) => {
      timer = setInterval(() => { try { verifier(); } catch (e) { rejeter(e); } }, 25);
    });
    const attendre = tache => Promise.race([tache, interruption]);
    const rapport = partiel => ({ selection, mesures, partiel, duree: Math.round(performance.now() - debut) });
    try {
      verifier();
      const reduction = Math.min(1, Math.sqrt(640 * 360 / Math.max(1, largeur * hauteur)));
      const w = Math.max(1, Math.min(device.limits.maxTextureDimension2D, Math.round(largeur * reduction)));
      const h = Math.max(1, Math.min(device.limits.maxTextureDimension2D, Math.round(hauteur * reduction)));
      const facteurPixels = Math.max(1, Math.min(12, largeur * hauteur / (w * h)));
      const format = 'rgba8unorm';
      const module = device.createShaderModule({ label: 'BITUME · test graphique', code: WGSL });
      const pipeline = await attendre(device.createRenderPipelineAsync({
        layout: 'auto', vertex: { module, entryPoint: 'vertex_main', buffers: [{ arrayStride: 16, attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x2' }, { shaderLocation: 1, offset: 8, format: 'float32x2' }
        ] }] }, fragment: { module, entryPoint: 'fragment_main', targets: [{format}] }
      }));
      verifier();
      texture = device.createTexture({ size: [w, h], format, usage: GPUTextureUsage.RENDER_ATTACHMENT });
      const vue = texture.createView();
      sommets = creerVertexBuffer(device);
      parametres = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const groupe = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: parametres } }
      ] });
      const epreuve = async (charge, images) => {
        verifier();
        const t = performance.now(), enc = device.createCommandEncoder();
        for (let i = 0; i < images; i++) {
          const passe = enc.beginRenderPass({ colorAttachments: [{ view: vue,
            clearValue: {r: 0, g: 0, b: 0, a: 1}, loadOp: 'clear', storeOp: 'store' }] });
          passe.setPipeline(pipeline); passe.setBindGroup(0, groupe); passe.setVertexBuffer(0, sommets);
          passe.draw(6, charge.instances); passe.end();
        }
        device.queue.submit([enc.finish()]);
        await attendre(device.queue.onSubmittedWorkDone());
        verifier();
        return (performance.now() - t) / images;
      };

      // Une file déjà chargée et la première activation du pipeline restent hors mesure.
      await attendre(device.queue.onSubmittedWorkDone());
      calculVoitures(500);
      for (const [i, charge] of charges.entries()) {
        progression('Mesure de la configuration ' + B.autoconfig.profils[charge.profil].nom.toLowerCase() + '…', (i + .2) / charges.length);
        device.queue.writeBuffer(parametres, 0, new Float32Array([.8, charge.iterations, charge.echelle, 1]));
        const chauffe = await epreuve(charge, 1);
        const images = Math.min(6, Math.max(1, Math.floor(12 / Math.max(.25, chauffe))));
        const temps = [];
        for (let serie = 0; serie < 3; serie++) temps.push(await epreuve(charge, images));
        const gpu = temps.sort((a,b) => a-b)[1];
        const processeur = [];
        let somme = 0;
        for (let serie = 0; serie < 3; serie++) {
          const t = performance.now(); somme += calculVoitures(charge.cpu);
          processeur.push(performance.now() - t);
        }
        const cpu = processeur.sort((a,b) => a-b)[1];
        // Le proxy a un coût fixe de soumission et de géométrie. Seule sa part de
        // remplissage est extrapolée à la résolution de jeu.
        const estime = gpu * (.45 + .55 * facteurPixels);
        const acceptable = Number.isFinite(somme) && estime <= budget * .8 && cpu <= budget * .5;
        mesures.push({ profil: charge.profil, cpu, gpu, estime, acceptable, largeur: w, hauteur: h, facteurPixels });
        if (!acceptable) break;
        selection = charge.profil;
      }
      progression('Mesure terminée', 1);
      return rapport(false);
    } catch (e) {
      if (e.motif === 'delai' && mesures.length) return rapport(true);
      throw e;
    } finally {
      clearInterval(timer);
      texture?.destroy(); sommets?.destroy(); parametres?.destroy();
    }
  }

  B.bancConfiguration = { mesurer };
})(globalThis.BITUME = globalThis.BITUME || {});
