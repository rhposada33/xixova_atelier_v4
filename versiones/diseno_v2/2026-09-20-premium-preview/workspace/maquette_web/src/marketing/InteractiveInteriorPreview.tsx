import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

type InteriorProject='garden_house_18'|'terraza_luz';
const modelPaths:Record<InteriorProject,string>={
  garden_house_18:'/projects/garden_house_18/data/assets-mobile.glb',
  terraza_luz:'/projects/terraza_luz/data/assets-mobile.glb',
};

export default function InteractiveInteriorPreview({project,image,alt}:{project:InteriorProject;image:string;alt:string}){
  const host=useRef<HTMLDivElement>(null);
  const [status,setStatus]=useState<'waiting'|'loading'|'ready'|'fallback'>('waiting');

  useEffect(()=>{
    const element=host.current;if(!element)return;
    let cancelled=false,dispose=()=>{cancelled=true};
    const observer=new IntersectionObserver(entries=>{
      if(!entries[0]?.isIntersecting)return;
      observer.disconnect();
      setStatus('loading');
      void (async()=>{
        let renderer:THREE.WebGLRenderer|undefined;
        let model:THREE.Object3D|undefined;
        try{
          renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
          if(cancelled){renderer.dispose();renderer.forceContextLoss();return}
          renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
          renderer.outputColorSpace=THREE.SRGBColorSpace;
          renderer.toneMapping=THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure=1.1;
          renderer.setClearColor('#e9e5dd');
          const scene=new THREE.Scene();
          const camera=new THREE.PerspectiveCamera(36,1,.1,200);
          scene.add(new THREE.HemisphereLight('#fff8ed','#aaa9a2',2.4));
          const key=new THREE.DirectionalLight('#fff4e4',2.5);key.position.set(-8,14,12);scene.add(key);
          const fill=new THREE.DirectionalLight('#edf5ed',.8);fill.position.set(10,8,-7);scene.add(fill);
          model=(await new GLTFLoader().loadAsync(modelPaths[project])).scene;
          if(cancelled){disposeModel(model);renderer.dispose();renderer.forceContextLoss();return}
          scene.add(model);
          // Os GLB incluem um plano de fundo muito maior que a residência.
          // O preview mantém a maquete real, mas enquadra só a arquitetura.
          const box=new THREE.Box3();
          model.traverse(object=>{if(!(object instanceof THREE.Mesh))return;object.geometry.computeBoundingBox();const dimensions=object.geometry.boundingBox!.getSize(new THREE.Vector3()).toArray().sort((a:number,b:number)=>b-a);if(dimensions[0]>25&&dimensions[1]>25&&dimensions[2]<.2){object.visible=false;return}box.union(new THREE.Box3().setFromObject(object))});
          const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
          const radius=Math.max(size.x,size.y,size.z)*.5;
          const distance=radius/Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*1.25;
          camera.position.copy(center).add(new THREE.Vector3(.75,1.05,1.25).normalize().multiplyScalar(distance));
          const controls=new OrbitControls(camera,renderer.domElement);
          controls.target.copy(center);controls.enableDamping=true;controls.enablePan=false;
          controls.minDistance=distance*.55;controls.maxDistance=distance*1.8;
          controls.minPolarAngle=.22;controls.maxPolarAngle=1.48;
          controls.update();
          const canvas=renderer.domElement;canvas.setAttribute('aria-label',`Maquete 3D de ${project==='garden_house_18'?'Garden House':'Terraza Luz'}. Arraste para girar.`);
          element.append(canvas);
          let frame=0,visible=true;
          const render=()=>{if(cancelled)return;frame=requestAnimationFrame(render);if(visible&&!document.hidden){controls.update();renderer!.render(scene,camera)}};
          const resize=()=>{const width=element.clientWidth,height=element.clientHeight;renderer!.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();renderer!.render(scene,camera)};
          const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(element);
          const viewObserver=new IntersectionObserver(entries=>{visible=Boolean(entries[0]?.isIntersecting)});viewObserver.observe(element);
          controls.addEventListener('change',()=>{element.dataset.camera=camera.position.toArray().map(value=>value.toFixed(3)).join(',')});
          resize();frame=requestAnimationFrame(render);setStatus('ready');
          dispose=()=>{cancelled=true;cancelAnimationFrame(frame);resizeObserver.disconnect();viewObserver.disconnect();controls.dispose();if(model)disposeModel(model);renderer!.dispose();renderer!.forceContextLoss();canvas.remove()};
        }catch{
          if(renderer){renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove()}
          if(!cancelled)setStatus('fallback');
        }
      })();
    },{rootMargin:'180px'});
    observer.observe(element);
    return()=>{observer.disconnect();dispose()};
  },[project]);

  return <div ref={host} className={`interior-preview ${status}`} data-project={project} data-status={status} aria-label={`Prévia de ${project==='garden_house_18'?'Garden House':'Terraza Luz'}`}>
    <img src={image} alt={alt}/>
    {status==='loading'&&<span className="interior-preview-status" role="status">Preparando maquete 3D…</span>}
    {status==='ready'&&<span className="interior-preview-hint">Arraste para girar · role para aproximar</span>}
    {status==='fallback'&&<span className="interior-preview-status">Visualização 3D indisponível neste dispositivo.</span>}
  </div>;
}

function disposeModel(model:THREE.Object3D){
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  model.traverse(object=>{if(!(object instanceof THREE.Mesh))return;geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value)}});
  textures.forEach(texture=>texture.dispose());materials.forEach(material=>material.dispose());geometries.forEach(geometry=>geometry.dispose());
}
