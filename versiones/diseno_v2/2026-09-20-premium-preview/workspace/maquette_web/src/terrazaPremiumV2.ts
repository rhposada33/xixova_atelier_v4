import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** Isolated V2 presentation. All assets remain local; no source GLB is modified. */
export function installTerrazaEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const generator = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = generator.fromScene(room, .08);
  room.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = .62;
  return () => { scene.environment = null; environment.dispose(); generator.dispose(); };
}

function weaveTexture(repeat = 12) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#d9ceba'; context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) {
    context.fillStyle = i % 6 === 0 ? '#b9ad96' : '#e6ddcc';
    context.fillRect(i, 0, 1, 256);
    context.fillStyle = i % 4 === 0 ? '#c2b69f' : '#e1d7c4';
    context.fillRect(0, i, 256, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Subtle, deterministic grain for the small runtime timber furnishings only. */
function oakTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 512;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#b99362'; context.fillRect(0, 0, 128, 512);
  for (let x = 0; x < 128; x++) {
    const value = 112 + Math.sin(x * 1.7) * 12 + Math.sin(x * .31) * 18;
    context.strokeStyle = `rgba(${value},${value * .71},${value * .42},.23)`;
    context.lineWidth = .6; context.beginPath();
    for (let y = 0; y <= 512; y += 8) {
      const offset = Math.sin(y * .009 + x * .17) * 1.3;
      if (y === 0) context.moveTo(x + offset, y); else context.lineTo(x + offset, y);
    }
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Material edits are scoped to runtime clones, preserving the architectural contract. */
export function finishTerrazaMaterials(root: THREE.Object3D, renderer: THREE.WebGLRenderer) {
  const weave = weaveTexture(8);
  const linen = weaveTexture(24);
  const oak = oakTexture();
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  for (const texture of [weave, linen, oak]) texture.anisotropy = anisotropy;
  const treated = new Set<THREE.Material>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    // Transparent panes must not turn into opaque silhouettes in the shadow map.
    const surfaceMaterials = Array.isArray(object.material) ? object.material : [object.material];
    if (surfaceMaterials.every(material => material.transparent && material.opacity < .4)) object.castShadow = false;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial) || treated.has(material)) continue;
      treated.add(material);
      const name = material.name.toLowerCase();
      if (material.map) material.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (/yeso|neutro/.test(name)) { material.color.set('#eee9df'); material.roughness = .86; material.envMapIntensity = .72; }
      if (/nogal/.test(name)) {
        // Retain supplied grain and let directional light reveal the joinery.
        material.color.setRGB(1.20, 1.12, 1.00); material.roughness = .60;
        material.emissive.set('#000000'); material.emissiveIntensity = 0;
      }
      if (/roble/.test(name)) {
        material.roughness = .56; material.envMapIntensity = .42;
        if (!material.map) { material.map = oak; material.color.set('#ffffff'); }
      }
      if (/lino_marfil|cortina\/visillo/.test(name)) {
        material.color.set('#efe8d9'); material.roughness = .96;
        if (!material.normalMap && !material.bumpMap) { material.bumpMap = linen; material.bumpScale = .004; }
      }
      if (/lino_salvia/.test(name)) {
        material.color.set('#778064'); material.roughness = .96;
        if (!material.normalMap && !material.bumpMap) { material.bumpMap = linen; material.bumpScale = .005; }
      }
      if (/alfombra/.test(name)) {
        material.color.set('#ffffff'); material.map = weave; material.bumpMap = weave;
        material.bumpScale = .009; material.roughness = 1;
      }
      if (/vidrio_baranda/.test(name)) {
        material.color.set('#dde6de'); material.transparent = true;
        material.opacity = .13; material.depthWrite = false; material.roughness = .13;
        material.metalness = .12; material.envMapIntensity = .62;
      }
      if (/espejo/.test(name)) { material.metalness = .95; material.roughness = .10; material.envMapIntensity = .85; }
      if (/laton/.test(name)) { material.roughness = .36; material.envMapIntensity = .6; }
      if (/hoja|follaje/.test(name)) { material.roughness = .76; material.envMapIntensity = .22; material.color.multiplyScalar(.96); }
      material.needsUpdate = true;
    }
  });
}
