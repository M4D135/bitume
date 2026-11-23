// Exécutée dans la page par les bancs CDP. Interroger l'adaptateur effectivement utilisé.
export function environnementWebGPU(rendu) {
  const gpu = rendu?.gpu, info = gpu?.adapter?.info;
  if (!gpu?.device || !gpu.context || rendu.stats.backend !== 'webgpu') throw new Error('FERRO WebGPU requis');
  if (rendu.stats.deviceLost || rendu.stats.errorEvents.length) throw new Error('Périphérique WebGPU en erreur : ' + rendu.stats.errorEvents.join(' / '));
  return { navigateur: navigator.userAgent, gpu: [info?.vendor, info?.architecture, info?.device, info?.description].filter(Boolean).join(' ') || 'Adaptateur non identifié',
    backend: rendu.stats.backend, webgpu: true, logiciel: !!(info?.isFallbackAdapter ?? gpu.adapter.isFallbackAdapter), chronoGpu: gpu.device.features.has('timestamp-query') };
}

export function argumentsWebGPU(pilote) {
  if (pilote === 'native') return ['--enable-gpu'];
  if (pilote !== 'swiftshader') throw new Error('Pilote WebGPU attendu : native ou swiftshader');
  return ['--enable-gpu', '--enable-unsafe-webgpu', '--enable-unsafe-swiftshader', '--use-webgpu-adapter=swiftshader',
    '--use-vulkan=swiftshader', '--use-angle=swiftshader'];
}
