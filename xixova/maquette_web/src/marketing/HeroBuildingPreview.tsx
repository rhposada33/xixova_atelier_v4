import {useCallback,useEffect,useRef,useState} from 'react';
import type {Material,Mesh,Object3D,Texture,WebGLRenderer} from 'three';
import {advanceLightingCycle,clampLightingHour,cycleProgressForHour,formatLightingHour,hourForCycleProgress,lightingForCycleProgress,lightingPresets,selectedLightingPreset,type LightingState} from './lightingTimeline';
import {resolveTemporaryPause,shouldAutoplay,temporarilyPause,toggleExplicitPause,type AutoplayMode} from './lightingAutoplay';

type PreviewState='idle'|'loading'|'ready'|'fallback';
type MaterialAssignment={mesh:Mesh;original:Material|Material[];clones:Material[]};
const modelUrl='/building/promoven-building-v2.glb';
const posterUrl='/marketing/promoven-building-v2.png';

const disposeModel=(model:Object3D)=>{const geometries=new Set<import('three').BufferGeometry>(),materials=new Set<Material>(),textures=new Set<Texture>();model.traverse(object=>{if(!('isMesh' in object)||!object.isMesh)return;const mesh=object as Mesh;geometries.add(mesh.geometry);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){materials.add(material);for(const value of Object.values(material))if(value&&typeof value==='object'&&'isTexture' in value&&(value as Texture).isTexture)textures.add(value as Texture)}});textures.forEach(texture=>texture.dispose());materials.forEach(material=>material.dispose());geometries.forEach(geometry=>geometry.dispose())};
const restoreNightMaterials=(assignments:MaterialAssignment[])=>assignments.forEach(({mesh,original,clones})=>{mesh.material=original;clones.forEach(material=>material.dispose())});
const prepareNightMaterials=(model:Object3D)=>{const assignments:MaterialAssignment[]=[];model.traverse(object=>{if(!('isMesh' in object)||!object.isMesh)return;const mesh=object as Mesh;const original=mesh.material;const materials=Array.isArray(original)?original:[original];const clones:Material[]=[];const next=materials.map(material=>{const candidate=/(furnished|room|interior)/i.test(material.name)&&'emissive' in material;if(!candidate)return material;const clone=material.clone();if('emissiveMap' in clone&&'map' in clone&&!clone.emissiveMap)clone.emissiveMap=clone.map;clones.push(clone);return clone});if(clones.length){mesh.material=Array.isArray(original)?next:next[0];assignments.push({mesh,original,clones})}});return assignments};

export function HeroBuildingPreview(){
  const host=useRef<HTMLDivElement>(null),hourRef=useRef(8),cycleProgressRef=useRef(cycleProgressForHour(8)),autoplayModeRef=useRef<AutoplayMode>('running'),temporaryResumeAtRef=useRef<number|null>(null),sliderInteractionRef=useRef(false),reducedRef=useRef(false);
  const [state,setState]=useState<PreviewState>('idle'),[hour,setHour]=useState(8),[autoplayMode,setAutoplayModeState]=useState<AutoplayMode>('running'),[reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  const setAutoplayMode=useCallback((mode:AutoplayMode)=>{autoplayModeRef.current=mode;setAutoplayModeState(mode)},[]);
  const pauseTemporarily=useCallback((resume=true)=>{const next=temporarilyPause({mode:autoplayModeRef.current,resumeAt:temporaryResumeAtRef.current},performance.now(),resume);temporaryResumeAtRef.current=next.resumeAt;setAutoplayMode(next.mode)},[setAutoplayMode]);
  const scheduleResume=useCallback(()=>pauseTemporarily(true),[pauseTemporarily]);
  const setManualHour=useCallback((value:number,final=true)=>{const next=clampLightingHour(value);hourRef.current=next;cycleProgressRef.current=cycleProgressForHour(next);setHour(next);if(final)scheduleResume()},[scheduleResume]);
  const togglePause=useCallback(()=>{const next=toggleExplicitPause({mode:autoplayModeRef.current,resumeAt:temporaryResumeAtRef.current});temporaryResumeAtRef.current=next.resumeAt;setAutoplayMode(next.mode)},[setAutoplayMode]);

  useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>{reducedRef.current=query.matches;setReduced(query.matches)};update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update)},[]);
  useEffect(()=>{
    const element=host.current;if(!element)return;
    const weakDevice=!window.WebGLRenderingContext||(navigator.hardwareConcurrency||4)<3;
    if(weakDevice){setState('fallback');return}
    let cancelled=false,cleanup=()=>{cancelled=true};
    const nearViewport=new IntersectionObserver(entries=>{if(!entries[0]?.isIntersecting)return;nearViewport.disconnect();setState('loading');void(async()=>{
      let renderer:WebGLRenderer|undefined;
      try{
        const THREE=await import('three');
        const [{GLTFLoader},{OrbitControls},{HDRLoader}]=await Promise.all([import('three/addons/loaders/GLTFLoader.js'),import('three/addons/controls/OrbitControls.js'),import('three/addons/loaders/HDRLoader.js')]);
        if(cancelled)return;
        const coarse=matchMedia('(pointer: coarse)').matches;
        const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.1,150);
        renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
        let pixelRatio=Math.min(devicePixelRatio,coarse?1:1.35);
        renderer.setPixelRatio(pixelRatio);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;element.prepend(renderer.domElement);
        let environment:import('three').Texture|undefined,hdr:import('three').DataTexture|undefined;
        try{hdr=await new HDRLoader().loadAsync('/marketing/studio_small_03_1k.hdr');const pmrem=new THREE.PMREMGenerator(renderer);environment=pmrem.fromEquirectangular(hdr).texture;scene.environment=environment;scene.environmentIntensity=.2;pmrem.dispose()}catch{/* The illustration keeps working with directional lighting only. */}
        if(cancelled){environment?.dispose();hdr?.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();return}
        const hemisphere=new THREE.HemisphereLight('#fff4d6','#61776f',1.5);scene.add(hemisphere);
        const key=new THREE.DirectionalLight('#ffe1af',2.25);key.position.set(-12,16,14);key.target.position.set(0,5.5,0);key.castShadow=true;key.shadow.mapSize.set(coarse?512:1024,coarse?512:1024);key.shadow.camera.left=-8;key.shadow.camera.right=8;key.shadow.camera.top=8;key.shadow.camera.bottom=-8;key.shadow.camera.near=.5;key.shadow.camera.far=55;key.shadow.bias=-.00008;key.shadow.normalBias=.018;key.shadow.radius=1;scene.add(key,key.target);element.dataset.quality=coarse?'shadow-512':'shadow-1024';
        const fill=new THREE.DirectionalLight('#d9e8df',.62);fill.position.set(9,10,-8);scene.add(fill);
        const model=(await new GLTFLoader().loadAsync(modelUrl)).scene;
        if(cancelled){disposeModel(model);environment?.dispose();hdr?.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();return}
        const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=12/size.y;
        model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
        model.traverse(object=>{if(!('isMesh' in object)||!object.isMesh)return;const mesh=object as Mesh;const name=mesh.name.toLowerCase();const architecture=/stone|bronze/.test(name),receiver=architecture||/paving|soil|furnished/.test(name);mesh.castShadow=architecture;mesh.receiveShadow=receiver});
        const nightMaterials=prepareNightMaterials(model);scene.add(model);
        const groundMaterial=new THREE.ShadowMaterial({color:'#3d5044',opacity:.15});const ground=new THREE.Mesh(new THREE.CircleGeometry(6.5,64),groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.y=-.03;ground.receiveShadow=true;scene.add(ground);
        camera.position.set(15.5,10.1,23);
        const controls=new OrbitControls(camera,renderer.domElement);renderer.domElement.style.touchAction='pan-y';controls.target.set(0,5.6,0);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=17;controls.maxDistance=43;controls.minPolarAngle=Math.PI*.19;controls.maxPolarAngle=Math.PI*.64;controls.autoRotate=true;controls.autoRotateSpeed=.28;controls.update();
        renderer.domElement.setAttribute('aria-label','Ilustração 3D interativa de iluminação de um edifício. Arraste para girar e role para aproximar.');
        const reportCamera=()=>{element.dataset.camera=camera.position.toArray().map(value=>value.toFixed(2)).join(',')};controls.addEventListener('change',reportCamera);reportCamera();
        const applyLighting=(lighting:LightingState)=>{key.position.set(...lighting.keyPosition);key.color.set(lighting.keyColor);key.intensity=lighting.keyIntensity;hemisphere.color.set(lighting.hemisphereSky);hemisphere.groundColor.set(lighting.hemisphereGround);hemisphere.intensity=lighting.hemisphereIntensity;fill.color.set(lighting.fillColor);fill.intensity=lighting.fillIntensity;renderer!.toneMappingExposure=lighting.exposure;scene.environmentIntensity=.035+lighting.hemisphereIntensity*.065;groundMaterial.opacity=lighting.shadowOpacity;element.style.setProperty('--lighting-sky-start',lighting.skyStart);element.style.setProperty('--lighting-sky-end',lighting.skyEnd);nightMaterials.forEach(({clones})=>clones.forEach(material=>{const emissive=material as Material&{emissive?:import('three').Color;emissiveIntensity?:number};if(emissive.emissive){emissive.emissive.set('#ffd3a0');emissive.emissiveIntensity=lighting.roomEmission}}));renderer!.shadowMap.needsUpdate=true};
        applyLighting(lightingForCycleProgress(cycleProgressRef.current));
        let lastAppliedProgress=cycleProgressRef.current;
        let visibleEnough=false,active=true,frame=0,lastFrame=0,lastRenderAt=0,lastUiUpdate=0,renderCount=0,performanceWindowStart=0,performanceElapsed=0,performanceFrames=0,degradation=0;
        const resize=()=>{const width=element.clientWidth,height=element.clientHeight;renderer?.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix()};
        const degrade=()=>{if(!renderer)return;if(degradation===0){key.shadow.mapSize.set(512,512);renderer.shadowMap.needsUpdate=true;element.dataset.quality='shadow-512';degradation=1;return}if(degradation===1){renderer.shadowMap.enabled=false;element.dataset.quality='shadows-off';degradation=2;return}if(degradation===2){pixelRatio=Math.max(.8,pixelRatio-.2);renderer.setPixelRatio(pixelRatio);resize();element.dataset.quality='pixel-ratio-reduced';degradation=3}};
        const beginOrbit=()=>{controls.autoRotate=false;pauseTemporarily(false)};const endOrbit=()=>scheduleResume();controls.addEventListener('start',beginOrbit);controls.addEventListener('end',endOrbit);
        const viewport=new IntersectionObserver(entries=>{visibleEnough=Boolean(entries[0]?.isIntersecting&&entries[0].intersectionRatio>=.5);lastFrame=0;lastRenderAt=0},{threshold:[0,.5]});viewport.observe(element);
        const visibility=()=>{lastFrame=0;lastRenderAt=0};
        const render=(now:number)=>{if(!active)return;frame=requestAnimationFrame(render);if(!visibleEnough||document.hidden)return;const renderInterval=coarse?1000/30:1000/45;if(lastRenderAt&&now-lastRenderAt<renderInterval)return;const elapsed=lastFrame?Math.min(now-lastFrame,100):0;lastFrame=now;lastRenderAt=now;
          const autoplay=resolveTemporaryPause({mode:autoplayModeRef.current,resumeAt:temporaryResumeAtRef.current},now);if(autoplay.mode!==autoplayModeRef.current||autoplay.resumeAt!==temporaryResumeAtRef.current){temporaryResumeAtRef.current=autoplay.resumeAt;setAutoplayMode(autoplay.mode)}if(shouldAutoplay(autoplay,reducedRef.current)){cycleProgressRef.current=advanceLightingCycle(cycleProgressRef.current,elapsed);hourRef.current=hourForCycleProgress(cycleProgressRef.current);if(now-lastUiUpdate>100){lastUiUpdate=now;setHour(hourRef.current)}}
          // Manual changes must reach the scene even while autoplay is paused.
          if(lastAppliedProgress!==cycleProgressRef.current){applyLighting(lightingForCycleProgress(cycleProgressRef.current));lastAppliedProgress=cycleProgressRef.current}
          controls.update();renderer?.render(scene,camera);element.dataset.renderCount=String(++renderCount);if(!performanceWindowStart)performanceWindowStart=now;performanceElapsed+=elapsed;performanceFrames++;if(now-performanceWindowStart>=2_000){const average=performanceElapsed/Math.max(1,performanceFrames);element.dataset.fps=String(Math.round(1_000/Math.max(1,average)));if(average>34)degrade();performanceWindowStart=now;performanceElapsed=0;performanceFrames=0}}
        addEventListener('resize',resize);document.addEventListener('visibilitychange',visibility);resize();frame=requestAnimationFrame(render);setState('ready');
        cleanup=()=>{cancelled=true;active=false;cancelAnimationFrame(frame);viewport.disconnect();removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);controls.removeEventListener('start',beginOrbit);controls.removeEventListener('end',endOrbit);controls.removeEventListener('change',reportCamera);controls.dispose();restoreNightMaterials(nightMaterials);disposeModel(model);ground.geometry.dispose();groundMaterial.dispose();environment?.dispose();hdr?.dispose();renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove()};
      }catch{renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove();if(!cancelled)setState('fallback')}
    })()},{rootMargin:'300px'});nearViewport.observe(element);return()=>{nearViewport.disconnect();cleanup()}
  },[pauseTemporarily,reduced,scheduleResume,setAutoplayMode]);

  const paused=autoplayMode==='explicit';const pauseLabel=paused?'Retomar animação de iluminação':'Pausar animação de iluminação';
  return <div className="lighting-preview"><div ref={host} className={`hero-building ${state}`} data-status={state} aria-label="Prévia 3D interativa de um edifício ilustrativo"><img src={posterUrl} alt="Edifício residencial ilustrativo Promoven, visto em perspectiva" loading="lazy" />{state==='loading'&&<span className="hero-preview-loading">Preparando visualização 3D…</span>}<small className="hero-preview-note">{state==='fallback'?'Visualização ilustrativa':'Visualização ilustrativa · Arraste para explorar'}</small></div>{state==='ready'&&<div className="lighting-controls" aria-label="Controles da ilustração de iluminação"><div className="lighting-presets" role="group" aria-label="Momentos de iluminação">{lightingPresets.map(preset=><button key={preset.id} type="button" aria-pressed={selectedLightingPreset(hour)===preset.id} onClick={()=>setManualHour(preset.hour)}>{preset.label}</button>)}</div><label className="lighting-slider"><span>Horário: <output>{formatLightingHour(hour)}</output></span><div><small>08:00</small><input type="range" min="480" max="1200" step="1" value={Math.round(hour*60)} aria-label="Horário da ilustração de iluminação" aria-valuetext={formatLightingHour(hour)} onPointerDown={()=>{sliderInteractionRef.current=true;pauseTemporarily(false)}} onPointerUp={()=>{sliderInteractionRef.current=false;scheduleResume()}} onPointerCancel={()=>{sliderInteractionRef.current=false;scheduleResume()}} onInput={event=>setManualHour(Number(event.currentTarget.value)/60,!sliderInteractionRef.current)} /><small>20:00</small></div></label><button className="lighting-pause" type="button" aria-label={pauseLabel} onClick={togglePause}>{paused?'▶':'Ⅱ'}<span className="sr-only">{pauseLabel}</span></button><small className="lighting-drag-hint">Arraste para explorar</small></div>}</div>
}
