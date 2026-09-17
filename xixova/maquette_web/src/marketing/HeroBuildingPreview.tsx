import { useEffect, useRef, useState } from 'react';
import type { Material, Mesh } from 'three';

type PreviewState = 'idle' | 'loading' | 'ready' | 'fallback';
const modelUrl = '/building/promoven-building-v2.glb';
const posterUrl = '/marketing/promoven-building-v2.png';

export function HeroBuildingPreview() {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PreviewState>('idle');

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const weakDevice = !window.WebGLRenderingContext || (navigator.hardwareConcurrency || 4) < 3;
    if (reducedMotion || weakDevice) {
      setState('fallback');
      return;
    }

    let cancelled = false;
    let cleanup = () => { cancelled = true; };
    const nearViewport = new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting) return;
      nearViewport.disconnect();
      setState('loading');
      void (async () => {
        let renderer: import('three').WebGLRenderer | undefined;
        try {
          const THREE = await import('three');
          const [{ GLTFLoader }, { OrbitControls }, { HDRLoader }] = await Promise.all([
            import('three/addons/loaders/GLTFLoader.js'),
            import('three/addons/controls/OrbitControls.js'),
            import('three/addons/loaders/HDRLoader.js'),
          ]);
          if (cancelled) return;

          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 150);
          renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
          renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.08;
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = THREE.PCFShadowMap;
          element.prepend(renderer.domElement);

          let environment: import('three').Texture | undefined;
          let hdr: import('three').DataTexture | undefined;
          try {
            hdr = await new HDRLoader().loadAsync('/marketing/studio_small_03_1k.hdr');
            const pmrem = new THREE.PMREMGenerator(renderer);
            environment = pmrem.fromEquirectangular(hdr).texture;
            scene.environment = environment;
            scene.environmentIntensity = 0.2;
            pmrem.dispose();
          } catch {
            // The directional lights remain sufficient when the HDRI is unavailable.
          }
          if (cancelled) {
            environment?.dispose();
            hdr?.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
            renderer.domElement.remove();
            return;
          }

          scene.add(new THREE.HemisphereLight('#fff9ec', '#667b6e', 1.8));
          const key = new THREE.DirectionalLight('#ffeed1', 2.75);
          key.position.set(-12, 23, 14);
          key.castShadow = true;
          key.shadow.mapSize.set(1024, 1024);
          key.shadow.camera.left = -11;
          key.shadow.camera.right = 11;
          key.shadow.camera.top = 15;
          key.shadow.camera.bottom = -11;
          key.shadow.radius = 3;
          scene.add(key);
          const fill = new THREE.DirectionalLight('#d8e7e2', 0.8);
          fill.position.set(9, 10, -8);
          scene.add(fill);

          const model = (await new GLTFLoader().loadAsync(modelUrl)).scene;
          if (cancelled) {
            model.traverse(object => {
              if (!('isMesh' in object)) return;
              const mesh = object as Mesh;
              mesh.geometry.dispose();
              (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => {
                (material as Material & { map?: import('three').Texture }).map?.dispose();
                material.dispose();
              });
            });
            environment?.dispose();
            hdr?.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
            renderer.domElement.remove();
            return;
          }
          const bounds = new THREE.Box3().setFromObject(model);
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          const scale = 12 / size.y;
          model.scale.setScalar(scale);
          model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
          model.traverse(object => {
            if ('isMesh' in object) {
              const mesh = object as Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });
          scene.add(model);

          const ground = new THREE.Mesh(
            new THREE.CircleGeometry(6.5, 64),
            new THREE.ShadowMaterial({ color: '#3d5044', opacity: 0.09 }),
          );
          ground.rotation.x = -Math.PI / 2;
          ground.position.y = -0.03;
          ground.receiveShadow = true;
          scene.add(ground);

          camera.position.set(15.5, 10.1, 23);
          const controls = new OrbitControls(camera, renderer.domElement);
          controls.target.set(0, 5.6, 0);
          controls.enablePan = false;
          controls.enableDamping = true;
          controls.dampingFactor = 0.08;
          controls.minDistance = 17;
          controls.maxDistance = 43;
          controls.minPolarAngle = Math.PI * 0.19;
          controls.maxPolarAngle = Math.PI * 0.64;
          controls.autoRotate = true;
          controls.autoRotateSpeed = 0.28;
          controls.update();
          const reportCamera = () => {
            element.dataset.camera = camera.position.toArray().map(value => value.toFixed(2)).join(',');
          };
          controls.addEventListener('change', reportCamera);

          let inView = true;
          let active = true;
          let frame = 0;
          let lastFrame = 0;
          let renderCount = 0;
          const resize = () => {
            const width = element.clientWidth;
            const height = element.clientHeight;
            renderer?.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
          };
          const start = () => { controls.autoRotate = false; };
          const visibility = () => { lastFrame = 0; };
          const viewport = new IntersectionObserver(entries => {
            inView = Boolean(entries[0]?.isIntersecting);
            lastFrame = 0;
          });
          const render = (now: number) => {
            if (!active) return;
            if (inView && !document.hidden && (!lastFrame || now - lastFrame > 25)) {
              controls.update();
              renderer?.render(scene, camera);
              element.dataset.renderCount = String(++renderCount);
              lastFrame = now;
            }
            frame = requestAnimationFrame(render);
          };
          controls.addEventListener('start', start);
          viewport.observe(element);
          addEventListener('resize', resize);
          document.addEventListener('visibilitychange', visibility);
          resize();
          frame = requestAnimationFrame(render);
          setState('ready');
          cleanup = () => {
            cancelled = true;
            active = false;
            cancelAnimationFrame(frame);
            viewport.disconnect();
            removeEventListener('resize', resize);
            document.removeEventListener('visibilitychange', visibility);
            controls.removeEventListener('start', start);
            controls.removeEventListener('change', reportCamera);
            controls.dispose();
            scene.traverse(object => {
              if (!('isMesh' in object)) return;
              const mesh = object as Mesh;
              mesh.geometry.dispose();
              (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(item => {
                const material = item as Material & { map?: import('three').Texture };
                material.map?.dispose();
                material.dispose();
              });
            });
            environment?.dispose();
            hdr?.dispose();
            renderer?.dispose();
            renderer?.forceContextLoss();
            renderer?.domElement.remove();
          };
        } catch {
          renderer?.dispose();
          renderer?.forceContextLoss();
          renderer?.domElement.remove();
          if (!cancelled) setState('fallback');
        }
      })();
    }, { rootMargin: '300px' });
    nearViewport.observe(element);
    return () => { nearViewport.disconnect(); cleanup(); };
  }, []);

  return <div ref={host} className={`hero-building ${state}`} data-status={state} aria-label="Prévia 3D interativa de um edifício ilustrativo">
    <img src={posterUrl} alt="Edifício residencial ilustrativo Promoven, visto em perspectiva" loading="lazy" />
    {state === 'loading' && <span className="hero-preview-loading">Preparando visualização 3D…</span>}
    <small className="hero-preview-note">{state === 'fallback' ? 'Visualização ilustrativa' : 'Visualização ilustrativa · Arraste para explorar'}</small>
  </div>;
}
