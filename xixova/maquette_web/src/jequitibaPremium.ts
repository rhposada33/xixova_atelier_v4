import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** Jequitibá owns its environment resources, including late asynchronous loads. */
export function installJequitibaEnvironment(
  renderer: THREE.WebGLRenderer, scene: THREE.Scene, invalidate: () => void,
) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  let target = pmrem.fromScene(room, .06);
  room.dispose();
  scene.environment = target.texture;
  scene.environmentIntensity = .42;
  let disposed = false;
  let source: THREE.DataTexture | undefined;
  new RGBELoader().load('/interior/jequitiba/forest-slope-1k.hdr', texture => {
    if (disposed) { texture.dispose(); return; }
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const next = pmrem.fromEquirectangular(texture);
    target.dispose();
    target = next;
    source = texture;
    scene.environment = next.texture;
    // The highly blurred forest supplies a quiet tropical backdrop and natural reflections.
    scene.background = texture;
    scene.backgroundBlurriness = 1;
    scene.backgroundIntensity = .22;
    scene.environmentRotation.set(Math.PI / 2, 0, -.65);
    scene.backgroundRotation.copy(scene.environmentRotation);
    invalidate();
  }, undefined, () => {
    // Offline / failed asset requests retain the studio environment and solid backdrop.
    invalidate();
  });
  return () => {
    disposed = true;
    scene.environment = null;
    if (scene.background === source) scene.background = null;
    source?.dispose();
    target.dispose();
    pmrem.dispose();
  };
}

export interface LicensedFurnitureAsset {
  url: string;
  attribution: string;
  license: string;
  licenseUrl: string;
  widthMetres?: number;
}

/** One reusable decoder per interior; caller owns loaded geometry and materials. */
export function createJequitibaFurnitureLoader(decoderPath: string) {
  const draco = new DRACOLoader();
  draco.setDecoderPath(decoderPath);
  draco.setWorkerLimit(2);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  return {
    async load(asset: LicensedFurnitureAsset) {
      if (!asset.license || !asset.licenseUrl || !asset.attribution)
        throw new Error('Furniture assets require documented licensing and attribution.');
      const gltf = await loader.loadAsync(asset.url);
      const furniture = gltf.scene;
      furniture.traverse(node => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      // glTF is Y-up; the architectural plan uses Z-up.
      furniture.rotation.x = Math.PI / 2;
      furniture.updateMatrixWorld(true);
      let bounds = new THREE.Box3().setFromObject(furniture);
      if (asset.widthMetres) {
        const width = bounds.max.x - bounds.min.x;
        if (width > 0) furniture.scale.multiplyScalar(asset.widthMetres / width);
        furniture.updateMatrixWorld(true);
        bounds = new THREE.Box3().setFromObject(furniture);
      }
      const center = bounds.getCenter(new THREE.Vector3());
      furniture.position.set(-center.x, -center.y, -bounds.min.z);
      furniture.userData.assetLicense = { ...asset };
      return furniture;
    },
    dispose: () => draco.dispose(),
  };
}
