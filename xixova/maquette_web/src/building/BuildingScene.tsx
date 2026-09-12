import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {buildingConfig,inventory,statusLabel,type BuildingUnit} from './inventory';
import './refinement.css';

type Props={selected:BuildingUnit;matches:string[];filtered:boolean;mode:'neutral_day'|'warm_dusk';onSelect:(u:BuildingUnit)=>void;command:{type:string;nonce:number};};
export function BuildingScene(props:Props){
  const host=useRef<HTMLDivElement>(null),live=useRef(props),engine=useRef<{command:(type:string)=>void;select:(code:string)=>void}|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[hover,setHover]=useState<{unit:BuildingUnit;x:number;y:number}|null>(null);
  const label=useRef<HTMLDivElement>(null);
  live.current=props;
  useEffect(()=>{
    const el=host.current!;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{setError('Tu navegador no pudo iniciar 3D. Puedes seleccionar todas las unidades desde la matriz.');setLoading(false);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
    renderer.domElement.setAttribute('aria-label','Maqueta 3D del edificio. Arrastra para rotar y usa la rueda para acercar. También puedes seleccionar unidades desde la matriz.');renderer.domElement.tabIndex=0;
    el.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,500);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=30;controls.maxDistance=180;controls.maxPolarAngle=Math.PI*.53;controls.minPolarAngle=.45;controls.enablePan=true;
    const pmrem=new THREE.PMREMGenerator(renderer),environment=new RoomEnvironment();const env=pmrem.fromScene(environment,.06);scene.environment=env.texture;scene.environmentIntensity=.5;environment.dispose();
    const ambient=new THREE.HemisphereLight('#d9e7fa','#746e55',.85);scene.add(ambient);
    const sun=new THREE.DirectionalLight('#fff1d9',3.4);sun.position.set(-35,70,55);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-45,right:45,top:70,bottom:-40,near:.5,far:180});sun.shadow.bias=-.0005;scene.add(sun);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.ShadowMaterial({color:'#6d746b',opacity:.18}));ground.rotation.x=-Math.PI/2;ground.position.y=-.62;ground.receiveShadow=true;scene.add(ground);
    const proxies:THREE.Mesh[]=[],outlines=new Map<string,THREE.LineSegments>(),centers=new Map<string,THREE.Vector3>();let disposed=false,frame=0,modeBefore='';
    let targetCamera:THREE.Vector3|null=null,targetLook:THREE.Vector3|null=null;
    const home=()=>{const aspect=el.clientWidth/el.clientHeight;const distance=Math.max(123,87/Math.max(.5,aspect));targetLook=new THREE.Vector3(0,31,0);targetCamera=new THREE.Vector3(110,0,92).normalize().multiplyScalar(distance).add(targetLook);targetCamera.y=23;};
    home();camera.position.copy(targetCamera!);controls.target.copy(targetLook!);targetCamera=null;targetLook=null;
    try{const saved=JSON.parse(sessionStorage.getItem('xixova-building-camera')||'null');if(saved?.position?.length===3&&saved?.target?.length===3){camera.position.fromArray(saved.position);controls.target.fromArray(saved.target);}}catch{/* A missing camera snapshot uses the full-building framing. */}controls.update();
    const resize=()=>{renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(el);resize();
    const loader=new GLTFLoader();loader.load(new URL(buildingConfig.modelUrl,document.baseURI).href,gltf=>{
      if(disposed){gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});return;}
      const model=gltf.scene;model.updateMatrixWorld(true);
      model.traverse(o=>{
        if(!(o instanceof THREE.Mesh))return;
        if(o.name.startsWith('UNIT_')){
          const unit=inventory.find(u=>u.modelObjectId===o.name);if(!unit)return;
          o.visible=true;o.userData.unit=unit;o.material=new THREE.MeshBasicMaterial({color:'#85ad93',transparent:true,opacity:.035,depthWrite:false,side:THREE.DoubleSide});o.renderOrder=3;proxies.push(o);
          const box=new THREE.Box3().setFromObject(o),center=box.getCenter(new THREE.Vector3());center.z=Number(unit.code.slice(-2))>=3?box.max.z:box.min.z;centers.set(unit.code,center);
          const edge=new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry),new THREE.LineBasicMaterial({color:'#7b9f86',transparent:true,opacity:.4}));edge.renderOrder=4;o.add(edge);outlines.set(unit.code,edge);
        }else{
          o.castShadow=!o.name.includes('glass');o.receiveShadow=true;
          for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial){m.envMapIntensity=.8;if(o.name.includes('leaf'))m.side=THREE.DoubleSide;if(o.name.endsWith('_glass')){m.transparent=true;m.opacity=.48;m.depthWrite=false;m.color.set('#a0b6bc');}if(o.name.endsWith('_light'))m.emissiveIntensity=3.8;}
        }
      });scene.add(model);setLoading(false);
    },undefined,()=>{setError('No se pudo cargar la maqueta. Recarga la página o explora la matriz de unidades.');setLoading(false);});
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down={x:0,y:0};
    const hit=(event:PointerEvent)=>{const rect=el.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(proxies,false)[0]?.object.userData.unit as BuildingUnit|undefined;};
    const onMove=(event:PointerEvent)=>{if(event.buttons)return;const unit=hit(event),rect=el.getBoundingClientRect();el.style.cursor=unit?'pointer':'grab';setHover(unit?{unit,x:Math.min(event.clientX-rect.left+14,rect.width-205),y:Math.max(10,event.clientY-rect.top-95)}:null);};
    const onDown=(event:PointerEvent)=>{down={x:event.clientX,y:event.clientY};};
    const onUp=(event:PointerEvent)=>{if(Math.hypot(event.clientX-down.x,event.clientY-down.y)>5)return;const unit=hit(event);if(unit)live.current.onSelect(unit);};
    const leave=()=>setHover(null);
    el.addEventListener('pointermove',onMove);el.addEventListener('pointerdown',onDown);el.addEventListener('pointerup',onUp);el.addEventListener('pointerleave',leave);
    const select=(code:string)=>{const center=centers.get(code);if(!center)return;const dir=new THREE.Vector3(center.x*.85,.02,center.z*1.5).normalize();targetLook=new THREE.Vector3(center.x*.3,Math.min(40,Math.max(22,center.y)),center.z*.3);targetCamera=targetLook.clone().add(dir.multiplyScalar(Math.max(91,camera.position.distanceTo(controls.target)*.94)));};
    engine.current={select,command:type=>{if(type==='reset')home();if(type==='rotate')controls.autoRotate=!controls.autoRotate;if(type==='in'||type==='out'){const direction=camera.position.clone().sub(controls.target);targetCamera=controls.target.clone().add(direction.multiplyScalar(type==='in'?.82:1.22));} }};
    const animate=()=>{if(disposed)return;frame=requestAnimationFrame(animate);const p=live.current;
      if(modeBefore!==p.mode){modeBefore=p.mode;const dusk=p.mode==='warm_dusk';ambient.intensity=dusk?.48:.85;ambient.color.set(dusk?'#aebbd0':'#d9e7fa');sun.color.set(dusk?'#ffc08b':'#fff0d7');sun.intensity=dusk?2.1:2.65;sun.position.set(dusk?-45:-35,dusk?28:60,55);renderer.toneMappingExposure=dusk?.88:.94;scene.environmentIntensity=dusk?.2:.3;}
      if(targetCamera){camera.position.lerp(targetCamera,.055);if(camera.position.distanceTo(targetCamera)<.05)targetCamera=null;}if(targetLook){controls.target.lerp(targetLook,.055);if(controls.target.distanceTo(targetLook)<.05)targetLook=null;}
      for(const proxy of proxies){const u=proxy.userData.unit as BuildingUnit,selected=u.code===p.selected.code,match=p.matches.includes(u.code),m=proxy.material as THREE.MeshBasicMaterial,edge=outlines.get(u.code)!.material as THREE.LineBasicMaterial;
        const c=selected?'#216f63':u.status==='available'?'#86b29a':u.status==='reserved'?'#c19752':'#9b9b96';m.color.set(c);edge.color.set(selected?'#d4ffe1':c);m.opacity=selected?.23:!match?.009:p.filtered?.13:.026;edge.opacity=selected?1:!match?.035:p.filtered?.7:.24;
      }
      const center=centers.get(p.selected.code);if(label.current&&center){const point=center.clone().project(camera);label.current.style.left=`${(point.x*.5+.5)*el.clientWidth}px`;label.current.style.top=`${(-point.y*.5+.5)*el.clientHeight}px`;label.current.style.display=point.z<1?'block':'none';}
      controls.update();renderer.render(scene,camera);
    };animate();
    const cancel=()=>{targetCamera=null;targetLook=null;};controls.addEventListener('start',cancel);
    return()=>{try{sessionStorage.setItem('xixova-building-camera',JSON.stringify({position:camera.position.toArray(),target:controls.target.toArray()}));}catch{}disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();el.removeEventListener('pointermove',onMove);el.removeEventListener('pointerdown',onDown);el.removeEventListener('pointerup',onUp);el.removeEventListener('pointerleave',leave);scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});env.dispose();pmrem.dispose();renderer.dispose();renderer.domElement.remove();engine.current=null;};
  },[]);
  useEffect(()=>{engine.current?.command(props.command.type);},[props.command]);
  useEffect(()=>{engine.current?.select(props.selected.code);},[props.selected.code]);
  return <div className={`building-stage ${props.mode}`} ref={host}>
    {loading&&<div className="building-loading"><span className="building-spinner"/>Preparando tu próximo hogar…</div>}
    {error&&<div className="building-error" role="alert">{error}</div>}
    {!loading&&!error&&<div ref={label} className="building-unit-label">{props.selected.code}<span/></div>}
    {hover&&<div className="building-tooltip" style={{left:hover.x,top:hover.y}}><strong>Unidad {hover.unit.code}</strong><span>{hover.unit.privateAreaM2} m² · {hover.unit.bedrooms} dormitorios</span><small>{statusLabel[hover.unit.status]}</small></div>}
  </div>;
}
