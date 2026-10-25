import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {formatBRL,statusLabel,type BuildingUnit} from './inventory';
import {buildingModelUrl,type BuildingConfig} from './buildingRegistry';
import {bindUnitsToScene} from './bindUnitsToScene';
import './refinement.css';
import './visual-v2.css';
import {visualV2} from './visualV2';
import {createProceduralEnvironment} from './proceduralEnvironment';
import {activeVisualExperience} from '../visual-experience/resolveVisualExperience';
import {selectVisualQuality} from '../visual-experience/quality';
import type {VisualExperienceController,VisualQualityTier} from '../visual-experience/types';

function disposeSceneResources(root:THREE.Object3D){
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.LineSegments){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);}}});
  textures.forEach(texture=>texture.dispose());materials.forEach(material=>material.dispose());geometries.forEach(geometry=>geometry.dispose());
}

type Props={building:BuildingConfig;units:BuildingUnit[];selected:BuildingUnit;matches:string[];filtered:boolean;mode:'neutral_day'|'warm_dusk';onSelect:(u:BuildingUnit)=>void;command:{type:string;nonce:number};};
export function BuildingScene(props:Props){
  const host=useRef<HTMLDivElement>(null),live=useRef(props),engine=useRef<{command:(type:string)=>void;select:(code:string)=>void;refresh:()=>void}|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[hover,setHover]=useState<{unit:BuildingUnit;x:number;y:number}|null>(null);
  const label=useRef<HTMLDivElement>(null);
  live.current=props;
  useEffect(()=>{
    const el=host.current!;
    const building=props.building;
    const coastal=building.visualExperience==='coastal';
    const useVisualExperienceV2=visualV2&&building.visualExperience==='v2';
    const requestedQuality=new URLSearchParams(location.search).get('visualQuality');
    const quality=selectVisualQuality(el.clientWidth||window.innerWidth,devicePixelRatio,requestedQuality==='premium'?'premium':undefined as VisualQualityTier|undefined);
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{setError('Seu navegador não conseguiu iniciar o 3D. Você pode selecionar todas as unidades pela matriz.');setLoading(false);return;}
    renderer.info.autoReset=false;renderer.setPixelRatio(useVisualExperienceV2?quality.maxPixelRatio:Math.min(devicePixelRatio,coastal?(el.clientWidth<700?1.25:1.5):2));renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
    renderer.domElement.setAttribute('aria-label','Maquete 3D do edifício. Arraste para girar e use a roda para aproximar. Você também pode selecionar unidades pela matriz.');renderer.domElement.tabIndex=0;
    el.appendChild(renderer.domElement);
    el.dataset.visualExperience=activeVisualExperience;
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,500);
    const composer=coastal?new EffectComposer(renderer,new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4})):null;
    const occlusion=coastal?new SSAOPass(scene,camera,1,1,12):null;
    if(composer&&occlusion){
      occlusion.kernelRadius=1.2;occlusion.minDistance=.0005;occlusion.maxDistance=.02;
      const renderOcclusion=occlusion.render.bind(occlusion);
      occlusion.render=(...args)=>{const hidden:THREE.Object3D[]=[];scene.traverse(o=>{if(o.visible&&o instanceof THREE.Mesh&&(o.name.startsWith('UNIT_')||(o.name.includes('palm_frond')||o.name.includes('plant_cluster'))||(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.transparent))){hidden.push(o);o.visible=false;}});try{renderOcclusion(...args);}finally{hidden.forEach(o=>{o.visible=true;});}};
      composer.addPass(new RenderPass(scene,camera));composer.addPass(occlusion);composer.addPass(new UnrealBloomPass(new THREE.Vector2(1,1),.08,.35,1.8));composer.addPass(new OutputPass());
    }
    const proceduralEnvironment=!coastal&&!useVisualExperienceV2&&visualV2?createProceduralEnvironment(scene,{water:false}):null;
    if(useVisualExperienceV2){scene.background=new THREE.Color('#d5dfdd');scene.fog=new THREE.Fog('#d5dfdd',118,390);el.dataset.visualProfile=quality.tier;el.dataset.visualEnvironment='loading';}
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=30;controls.maxDistance=180;controls.maxPolarAngle=coastal?Math.PI*.54:visualV2?Math.PI*.49:Math.PI*.53;controls.minPolarAngle=.45;controls.enablePan=true;
    const pmrem=new THREE.PMREMGenerator(renderer),environment=new RoomEnvironment();const env=pmrem.fromScene(environment,.06);scene.environment=env.texture;scene.environmentIntensity=.5;environment.dispose();
    const ambient=new THREE.HemisphereLight('#d9e7fa','#746e55',.85);scene.add(ambient);
    const sun=new THREE.DirectionalLight('#fff1d9',3.4);sun.position.set(-35,70,55);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-45,right:45,top:70,bottom:-40,near:.5,far:180});sun.shadow.bias=-.0005;scene.add(sun);
    if(coastal){for(const x of [-13,0,13]){const light=new THREE.PointLight('#ffc078',55,20,2);light.position.set(x,7.5,12);scene.add(light);}}
    let visualEnvironment:VisualExperienceController|undefined;
    if(useVisualExperienceV2)void import('../visual-experience/v2Environment').then(({createVisualExperienceV2})=>{
      if(disposed)return;
      visualEnvironment=createVisualExperienceV2(scene,{sun,quality,invalidate:requestRender});el.dataset.visualEnvironment='ready';renderer.shadowMap.needsUpdate=true;requestRender();
    }).catch(()=>{if(!disposed)el.dataset.visualEnvironment='fallback';});
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.ShadowMaterial({color:'#6d746b',opacity:.18}));ground.rotation.x=-Math.PI/2;ground.position.y=-.62;ground.receiveShadow=true;if(!visualV2)scene.add(ground);else{ground.geometry.dispose();ground.material.dispose();}
    const proxies:THREE.Mesh[]=[],outlines=new Map<string,THREE.LineSegments>(),centers=new Map<string,THREE.Vector3>();let disposed=false,frame=0,modeBefore='',appearanceBefore='';
    let targetCamera:THREE.Vector3|null=null,targetLook:THREE.Vector3|null=null;
    let paletteUntil=0,interacting=false;
    const requestRender=()=>{if(!disposed&&document.visibilityState==='visible'&&!frame)frame=requestAnimationFrame(draw);};
    const home=()=>{const aspect=el.clientWidth/el.clientHeight,framing=visualV2?building.camera.premium:building.camera.original;const distance=Math.max(framing.distance,76/Math.max(.5,aspect));targetLook=new THREE.Vector3(0,framing.targetY,0);targetCamera=new THREE.Vector3(coastal?68:visualV2?72:110,0,visualV2?125:92).normalize().multiplyScalar(distance).add(targetLook);targetCamera.y=framing.height;};
    home();camera.position.copy(targetCamera!);controls.target.copy(targetLook!);targetCamera=null;targetLook=null;
    const cameraKey=`xixova-building-${building.id}-camera${visualV2?'-v2':''}`;
    try{const saved=visualV2?null:JSON.parse(sessionStorage.getItem(cameraKey)||'null');if(saved?.position?.length===3&&saved?.target?.length===3){camera.position.fromArray(saved.position);controls.target.fromArray(saved.target);}}catch{/* A missing camera snapshot uses the full-building framing. */}controls.update();
    const resize=()=>{renderer.setSize(el.clientWidth,el.clientHeight);composer?.setSize(el.clientWidth,el.clientHeight);if(occlusion){occlusion.enabled=el.clientWidth>=900;occlusion.setSize(Math.round(el.clientWidth*.6),Math.round(el.clientHeight*.6));}camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();requestRender();};const observer=new ResizeObserver(resize);observer.observe(el);resize();
    let coastalSky:THREE.Texture|undefined,coastalBackdrop:THREE.Texture|undefined;
    if(coastal&&building.environment)new THREE.TextureLoader().load(new URL(building.environment.url,document.baseURI).href,texture=>{if(disposed){texture.dispose();return;}texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;coastalSky=texture;coastalBackdrop=texture.clone();coastalBackdrop.mapping=THREE.UVMapping;coastalBackdrop.repeat.set(1,.88);coastalBackdrop.offset.y=.088;scene.background=coastalBackdrop;scene.environment=texture;scene.environmentRotation.y=2.1;requestRender();});
    const modelUrl=buildingModelUrl(building,visualV2);
    const draco=new DRACOLoader().setWorkerLimit(2);const loader=new GLTFLoader().setDRACOLoader(draco);loader.load(new URL(modelUrl,document.baseURI).href,gltf=>{
      if(disposed){disposeSceneResources(gltf.scene);return;}
      const model=gltf.scene;model.updateMatrixWorld(true);const bindings=bindUnitsToScene(live.current.units,model);
      model.traverse(o=>{
        if(!(o instanceof THREE.Mesh))return;
        if(o.name.startsWith('UNIT_')){
          const unit=bindings.bound.get(o.uuid);if(!unit)return;
          o.visible=true;o.userData.unit=unit;o.material=new THREE.MeshBasicMaterial({color:'#85ad93',transparent:true,opacity:.035,depthWrite:false,side:THREE.DoubleSide});o.renderOrder=3;proxies.push(o);
          const box=new THREE.Box3().setFromObject(o),center=box.getCenter(new THREE.Vector3());center.z=Number(unit.code.slice(-2))>=3?box.max.z:box.min.z;centers.set(unit.code,center);
          const edge=new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry),new THREE.LineBasicMaterial({color:'#7b9f86',transparent:true,opacity:.4}));edge.renderOrder=4;o.add(edge);outlines.set(unit.code,edge);
        }else{
          o.castShadow=!o.name.includes('glass')&&!o.name.includes('balustrade')&&!o.name.includes('window');o.receiveShadow=true;
          for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial){m.envMapIntensity=coastal?1.15:.8;if(coastal&&(m.name.includes('palm_frond')||m.name.includes('plant_cluster'))){m.transparent=false;m.alphaTest=.4;m.color.setRGB(.8,1,.75);m.emissive.setRGB(.025,.05,.012);m.emissiveIntensity=.4;m.alphaToCoverage=true;m.side=THREE.DoubleSide;m.depthWrite=true;}if(coastal&&m.transparent)m.depthWrite=false;if(coastal&&m.name.includes('window_image')){m.color.setRGB(.24,.24,.24);m.emissive.multiply(new THREE.Color(1,.72,.45));m.emissiveIntensity*=1.8;}if(o.name.includes('foliage'))m.side=THREE.DoubleSide;if(o.name.includes('leaf'))m.side=THREE.DoubleSide;if(o.name.endsWith('_glass')){m.transparent=true;m.opacity=.48;m.depthWrite=false;m.color.set('#a0b6bc');}if(o.name.endsWith('_light'))m.emissiveIntensity=3.8;}
        }
      });
      if(visualV2&&!coastal)model.traverse(o=>{if(!(o instanceof THREE.Mesh)||o.name.startsWith('UNIT_'))return;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!(m instanceof THREE.MeshStandardMaterial))continue;m.envMapIntensity=1.15;if(m.name.includes('ivory')||m.name.includes('slab')){m.roughness=.72;}if(m.name.includes('bronze')){m.metalness=.65;m.roughness=.3;}if(m.name.includes('window')){m.metalness=.48;m.roughness=.19;}if(m.name.includes('glass')){m.opacity=.33;m.color.set('#90acaf');}if(m.name.includes('leaf'))m.color.set(m.name.includes('light')?'#536b29':'#263f20');if(m.name.endsWith('_light'))m.emissiveIntensity=1.8;}});
      scene.add(model);renderer.shadowMap.needsUpdate=true;appearanceBefore='';requestRender();setLoading(false);
    },undefined,()=>{setError('Não foi possível carregar a maquete. Recarregue a página ou explore a matriz de unidades.');setLoading(false);});
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down={x:0,y:0},hoveredCode:string|undefined;
    const hit=(event:PointerEvent)=>{const rect=el.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(proxies,false)[0]?.object.userData.unit as BuildingUnit|undefined;};
    const onMove=(event:PointerEvent)=>{if(event.buttons)return;const candidate=hit(event),unit=candidate&&(!live.current.filtered||live.current.matches.includes(candidate.code))?candidate:undefined,rect=el.getBoundingClientRect();const nextCode=unit?.code;if(hoveredCode!==nextCode){hoveredCode=nextCode;appearanceBefore='';requestRender();}el.style.cursor=unit?'pointer':'grab';setHover(unit?{unit,x:Math.min(event.clientX-rect.left+14,rect.width-205),y:Math.max(10,event.clientY-rect.top-95)}:null);};
    const onDown=(event:PointerEvent)=>{down={x:event.clientX,y:event.clientY};};
    const onUp=(event:PointerEvent)=>{if(Math.hypot(event.clientX-down.x,event.clientY-down.y)>5)return;const unit=hit(event);if(unit&&(!live.current.filtered||live.current.matches.includes(unit.code)))live.current.onSelect(unit);};
    const leave=()=>{hoveredCode=undefined;appearanceBefore='';requestRender();setHover(null);};
    el.addEventListener('pointermove',onMove);el.addEventListener('pointerdown',onDown);el.addEventListener('pointerup',onUp);el.addEventListener('pointerleave',leave);
    const select=(code:string)=>{const center=centers.get(code);if(!center)return;const dir=new THREE.Vector3(center.x*.85,.02,center.z*1.5).normalize();targetLook=new THREE.Vector3(center.x*.3,Math.min(40,Math.max(22,center.y)),center.z*.3);targetCamera=targetLook.clone().add(dir.multiplyScalar(Math.max(91,camera.position.distanceTo(controls.target)*.94)));requestRender();};
    engine.current={select,command:type=>{if(type==='reset')home();if(type==='unit')select(live.current.selected.code);if(type==='rotate')controls.autoRotate=!controls.autoRotate&&!reducedMotion.matches;if(type==='in'||type==='out'){const direction=camera.position.clone().sub(controls.target);direction.setLength(THREE.MathUtils.clamp(direction.length()*(type==='in'?.82:1.22),controls.minDistance,controls.maxDistance));targetCamera=controls.target.clone().add(direction);}requestRender();},refresh:()=>{appearanceBefore='';requestRender();}};
    function draw(){frame=0;if(disposed||document.visibilityState!=='visible')return;const p=live.current,now=performance.now();
      if(modeBefore!==p.mode){modeBefore=p.mode;paletteUntil=now+1500;renderer.shadowMap.needsUpdate=true;const dusk=p.mode==='warm_dusk';ambient.intensity=dusk?.48:.85;ambient.color.set(dusk?'#aebbd0':'#d9e7fa');sun.color.set(dusk?'#ffc08b':'#fff0d7');sun.intensity=dusk?2.1:2.65;sun.position.set(dusk?-45:-35,dusk?28:60,55);renderer.toneMappingExposure=dusk?.88:.94;scene.environmentIntensity=dusk?.2:.3;}
      if(visualV2){const dusk=p.mode==='warm_dusk';ambient.intensity=dusk?.52:.8;ambient.color.set(dusk?'#9bacc9':'#dceafa');sun.color.set(dusk?'#ffb078':'#fff0d7');sun.intensity=dusk?2.9:3.5;sun.position.set(-48,dusk?25:62,48);renderer.toneMappingExposure=dusk?.87:1.02;scene.environmentIntensity=dusk?.32:.48;}
      if(coastal){const dusk=p.mode==='warm_dusk';ambient.intensity=dusk?.30:.32;sun.color.set(dusk?'#ffbc80':'#ffe2b9');sun.intensity=dusk?1.8:2.0;sun.position.set(-65,43,48);renderer.toneMappingExposure=dusk?.90:.96;scene.backgroundIntensity=dusk?.72:1;scene.environmentIntensity=dusk?.30:.42;}
      if(targetCamera){camera.position.lerp(targetCamera,.055);if(camera.position.distanceTo(targetCamera)<.05)targetCamera=null;}if(targetLook){controls.target.lerp(targetLook,.055);if(controls.target.distanceTo(targetLook)<.05)targetLook=null;}
      const appearanceKey=[p.selected.code,p.filtered,p.matches.join(','),hoveredCode].join('|');
      if(appearanceBefore!==appearanceKey){appearanceBefore=appearanceKey;const matches=new Set(p.matches);for(const proxy of proxies){const u=proxy.userData.unit as BuildingUnit,selected=u.code===p.selected.code,match=matches.has(u.code),m=proxy.material as THREE.MeshBasicMaterial,edge=outlines.get(u.code)!.material as THREE.LineBasicMaterial;
        const c=selected?'#216f63':u.status==='available'?'#86b29a':u.status==='reserved'?'#c19752':'#9b9b96';m.color.set(c);edge.color.set(selected?'#d4ffe1':c);m.opacity=selected?.23:!match?.009:p.filtered?.13:.026;edge.opacity=selected?1:!match?.035:p.filtered?.7:.24;
        if(visualV2){const hovered=u.code===hoveredCode&&(!p.filtered||match);m.opacity=selected?.16:hovered?.10:0;edge.opacity=selected?1:hovered?.65:0;if(coastal){proxy.visible=selected||hovered;outlines.get(u.code)!.visible=selected||hovered;}}
      }}
      const center=centers.get(p.selected.code);if(label.current&&center){const point=center.clone().project(camera);label.current.style.left=`${(point.x*.5+.5)*el.clientWidth}px`;label.current.style.top=`${(-point.y*.5+.5)*el.clientHeight}px`;label.current.style.display=point.z<1?'block':'none';}
      const controlsChanged=controls.update();proceduralEnvironment?.update(now*.001,p.mode==='warm_dusk',camera);visualEnvironment?.update(now*.001,p.mode,camera);if(occlusion)occlusion.enabled=el.clientWidth>=900&&!interacting&&!targetCamera&&!targetLook&&!controlsChanged&&!controls.autoRotate;renderer.info.reset();if(composer)composer.render();else renderer.render(scene,camera);if(import.meta.env.DEV){el.dataset.renderCount=String(Number(el.dataset.renderCount||0)+1);el.dataset.drawCalls=String(renderer.info.render.calls);}
      if(targetCamera||targetLook||controls.autoRotate||controlsChanged||now<paletteUntil)requestRender();
    }requestRender();
    const cancel=()=>{targetCamera=null;targetLook=null;interacting=true;requestRender();};const endInteraction=()=>{interacting=false;requestRender();};controls.addEventListener('start',cancel);controls.addEventListener('end',endInteraction);
    const onControlsChange=()=>requestRender();const onVisibility=()=>{if(document.visibilityState==='visible')requestRender();else{cancelAnimationFrame(frame);frame=0;}};controls.addEventListener('change',onControlsChange);document.addEventListener('visibilitychange',onVisibility);const onReducedMotion=()=>{if(reducedMotion.matches)controls.autoRotate=false;};reducedMotion.addEventListener('change',onReducedMotion);
    return()=>{try{sessionStorage.setItem(cameraKey,JSON.stringify({position:camera.position.toArray(),target:controls.target.toArray()}));}catch{}disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.removeEventListener('change',onControlsChange);controls.removeEventListener('start',cancel);controls.removeEventListener('end',endInteraction);document.removeEventListener('visibilitychange',onVisibility);reducedMotion.removeEventListener('change',onReducedMotion);controls.dispose();el.removeEventListener('pointermove',onMove);el.removeEventListener('pointerdown',onDown);el.removeEventListener('pointerup',onUp);el.removeEventListener('pointerleave',leave);visualEnvironment?.dispose();coastalSky?.dispose();coastalBackdrop?.dispose();disposeSceneResources(scene);draco.dispose();env.dispose();pmrem.dispose();if(composer){composer.passes.forEach(pass=>pass.dispose());composer.dispose();}renderer.dispose();renderer.domElement.remove();engine.current=null;};
  },[]);
  const matchesKey=props.matches.join(',');
  useEffect(()=>{engine.current?.refresh();},[props.selected.code,props.filtered,matchesKey,props.mode,loading]);
  useEffect(()=>{engine.current?.command(props.command.type);},[props.command]);
  useEffect(()=>{engine.current?.select(props.selected.code);},[props.selected.code]);
  return <div className={`building-stage ${props.mode}`} ref={host}>
    {loading&&<div className="building-loading"><span className="building-spinner"/>Preparando seu novo lar…</div>}
    {error&&<div className="building-error" role="alert">{error}</div>}
    {!loading&&!error&&<div ref={label} className="building-unit-label">{props.selected.code}<span/></div>}
    {hover&&<div className="building-tooltip" style={{left:hover.x,top:hover.y}}><strong>Unidade {hover.unit.code}</strong><span>{hover.unit.floor}º andar · {hover.unit.privateAreaM2} m²</span>{hover.unit.priceBRL!==undefined&&<span>{formatBRL(hover.unit.priceBRL)}</span>}<small>{statusLabel[hover.unit.status]}</small></div>}
  </div>;
}
