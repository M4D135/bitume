// Exécutée dans le navigateur par les outils de qualification. Les copies sont soumises avant
// le premier await : elles lisent la texture indiquée, même si le navigateur présente l’image ensuite.
export async function lireRegionsPresentation(gpu, texture, regions) {
  const format = texture.format;
  if (!['rgba8unorm', 'bgra8unorm'].includes(format) || !(texture.usage & GPUTextureUsage.COPY_SRC))
    throw new Error('Texture de présentation non lisible en RGBA8/BGRA8');
  let taille = 0;
  const plans = regions.map(({ x, y, w, h }) => {
    if (![x, y, w, h].every(Number.isInteger) || x < 0 || y < 0 || w < 1 || h < 1 || x + w > texture.width || y + h > texture.height)
      throw new Error('Région de lecture hors de la présentation');
    const pas = Math.ceil(w * 4 / 256) * 256, offset = taille;
    taille += pas * h;
    return { x, y, w, h, pas, offset };
  });
  const buffer = gpu.device.createBuffer({ size: taille, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  let mappe = false;
  try {
    const encoder = gpu.device.createCommandEncoder();
    for (const p of plans) {
      encoder.copyTextureToBuffer({ texture, origin: [p.x, p.y] }, { buffer, offset: p.offset, bytesPerRow: p.pas }, [p.w, p.h]);
    }
    gpu.device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(GPUMapMode.READ); mappe = true;
    const source = new Uint8Array(buffer.getMappedRange());
    return plans.map(p => {
      const rgba = new Uint8Array(p.w * p.h * 4);
      for (let y = 0; y < p.h; y++) {
        const debut = p.offset + y * p.pas;
        rgba.set(source.subarray(debut, debut + p.w * 4), y * p.w * 4);
      }
      if (format === 'bgra8unorm') for (let i = 0; i < rgba.length; i += 4) {
        const b = rgba[i]; rgba[i] = rgba[i + 2]; rgba[i + 2] = b;
      }
      return rgba;
    });
  } finally { if (mappe) buffer.unmap(); buffer.destroy(); }
}
