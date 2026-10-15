import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {VisualExperienceController,VisualQualityProfile} from './types';

type Options = { sun: THREE.DirectionalLight; quality: VisualQualityProfile; invalidate?: () => void };

const disposeObject = (root:THREE.Object3D) => {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  root.traverse(object => {
  if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points)) return;
  geometries.add(object.geometry);
  for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
};

type PlantKind='tree'|'palm'|'shrub';
type PlantPlacement={position:THREE.Vector3;rotation:number;scale:number};
const plantRoots:Record<PlantKind,string>={tree:'V2_TREE_ORNAMENTAL',palm:'V2_PALM_DISCREET',shrub:'V2_SHRUB_LOW'};
const plantCounts:Record<VisualQualityProfile['tier'],Record<PlantKind,number>>={
  mobile:{tree:24,palm:5,shrub:10},standard:{tree:48,palm:10,shrub:18},premium:{tree:64,palm:14,shrub:24},
};

/** Fixed clusters leave the entrance, facade and 1203's presentation marker clear. */
const landscapePlacements:Record<PlantKind,PlantPlacement[]>={
  tree:[
    {position:new THREE.Vector3(-38,-.67,30),rotation:.35,scale:1.42},
    {position:new THREE.Vector3(-48,-.67,43),rotation:-.28,scale:1.16},
    {position:new THREE.Vector3(37,-.67,32),rotation:-.48,scale:1.38},
    {position:new THREE.Vector3(49,-.67,45),rotation:.22,scale:1.12},
    {position:new THREE.Vector3(7,-.67,61),rotation:.55,scale:1.02},
    {position:new THREE.Vector3(-18,-.67,65),rotation:-.65,scale:.94},
    {position:new THREE.Vector3(62,-.67,66),rotation:.18,scale:.72},
    {position:new THREE.Vector3(-63,-.67,65),rotation:-.38,scale:.70},
    {position:new THREE.Vector3(81,-.67,82),rotation:.67,scale:.60},
  ],
  // The palm belongs to the rear canopy; it never occupies the foreground.
  palm:[
    {position:new THREE.Vector3(23,-.67,58),rotation:-.32,scale:.78},
    {position:new THREE.Vector3(-34,-.67,60),rotation:.37,scale:.68},
    {position:new THREE.Vector3(64,-.67,67),rotation:-.54,scale:.56},
  ],
  shrub:[
    {position:new THREE.Vector3(-30,-.67,20),rotation:.22,scale:1.35},
    {position:new THREE.Vector3(-36,-.67,25),rotation:-.36,scale:1.16},
    {position:new THREE.Vector3(-41,-.67,31),rotation:.68,scale:1.26},
    {position:new THREE.Vector3(30,-.67,20),rotation:-.18,scale:1.30},
    {position:new THREE.Vector3(37,-.67,25),rotation:.44,scale:1.18},
    {position:new THREE.Vector3(42,-.67,31),rotation:-.61,scale:1.24},
    {position:new THREE.Vector3(-15,-.67,48),rotation:.31,scale:1.05},
    {position:new THREE.Vector3(15,-.67,48),rotation:-.42,scale:1.08},
    {position:new THREE.Vector3(50,-.67,42),rotation:.16,scale:.88},
    {position:new THREE.Vector3(-50,-.67,42),rotation:-.26,scale:.86},
    {position:new THREE.Vector3(61,-.67,60),rotation:.53,scale:.72},
    {position:new THREE.Vector3(-61,-.67,60),rotation:-.49,scale:.70},
  ],
};
function plantPositions(kind:PlantKind,count:number){
  const placements=[...landscapePlacements[kind]];
  // Reuse authored meshes for a generic coastal park, outside the selection footprint.
  while(placements.length<count){const i=placements.length,angle=i*2.399;placements.push({position:new THREE.Vector3(Math.sin(angle)*(42+i*1.9),-.67,-35-Math.abs(Math.cos(angle))*65),rotation:angle,scale:kind==='tree'?1.3+(i%4)*.26:.85+(i%3)*.15});}
  return placements.slice(0,count);
}

function addInstancedPlants(root:THREE.Group,template:THREE.Object3D,positions:PlantPlacement[]){
  template.updateWorldMatrix(true,true);
  const inverseTemplate=new THREE.Matrix4().copy(template.matrixWorld).invert();
  let meshes=0;
  template.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const relative=new THREE.Matrix4().multiplyMatrices(inverseTemplate,object.matrixWorld);
    const instances=new THREE.InstancedMesh(object.geometry,object.material,positions.length);
    const placement=new THREE.Matrix4(),matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();
    positions.forEach((item,index)=>{
      quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),item.rotation);scale.setScalar(item.scale);
      placement.compose(item.position,quaternion,scale);matrix.multiplyMatrices(placement,relative);instances.setMatrixAt(index,matrix);
    });
    // The building remains the only near-field shadow caster. This avoids a clipped shadow frustum at the horizon.
    instances.instanceMatrix.needsUpdate=true;instances.castShadow=false;instances.receiveShadow=false;instances.name=`visual-v2-${object.name}`;instances.userData.visualExperience='v2-landscape';root.add(instances);meshes++;
  });
  return meshes;
}

/**
 * An abstract context only: it never represents a surveyed neighbourhood or a photographic backdrop.
 * Assets can replace the low-poly horizon in checkpoint C without changing this controller contract.
 */
export function createVisualExperienceV2(scene:THREE.Scene, {sun,quality,invalidate}:Options):VisualExperienceController {
  const root = new THREE.Group();
  root.name = 'visual-experience-v2';
  scene.add(root);
  const previousFog = scene.fog, previousBackground = scene.background;
  // The sky sphere intentionally fades at the lower edge. Keep an opaque haze behind it so the renderer never clears black.
  const background=new THREE.Color('#d8e1da');
  scene.background = background;
  const fog = new THREE.Fog('#c8dce0',155,440);
  scene.fog = fog;
  const skyUniforms = {
    top: {value:new THREE.Color('#559fc9')},
    horizon: {value:new THREE.Color('#f6e2bf')},
    haze: {value:new THREE.Color('#d8e1da')},
    glow: {value:new THREE.Color('#ffe4ad')},
    sunDirection: {value:new THREE.Vector3(-.55,.38,.62)},
    time: {value:0},
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 18), new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,toneMapped:false,uniforms:skyUniforms,
    vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction;uniform vec3 top,horizon,haze,glow,sunDirection;uniform float time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(41.13,289.71)))*143758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
      void main(){vec3 d=normalize(direction);float high=smoothstep(-.05,.48,d.y);vec3 c=mix(haze,top,high);c=mix(c,horizon,(1.-smoothstep(-.05,.05,d.y))*.28);float s=pow(max(dot(d,normalize(sunDirection)),0.),20.);float halo=pow(max(dot(d,normalize(sunDirection)),0.),3.);c=mix(c,glow,s*.84+halo*.10);vec2 uv=d.xz/max(.17,d.y+.23);float n=noise(uv*2.2)*.57+noise(uv*5.5)*.28+noise(uv*12.)*.15;float cloud=smoothstep(.48,.66,n)*smoothstep(-.015,.12,d.y)*(1.-smoothstep(.55,.85,d.y));c=mix(c,mix(haze,vec3(.98,.975,.94),.8),cloud*.88);gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>}`,
  }));
  sky.renderOrder = -10;
  root.add(sky);
  // This matte plane sits below the existing site and extends beyond the camera's useful range, so it has no visible hard edge.
  const groundMaterial = new THREE.MeshBasicMaterial({color:'#c3cbb9',fog:true});
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),groundMaterial);
  ground.rotation.x=-Math.PI/2;ground.position.y=-.70;
  root.add(ground);
  const forecourtMaterial = new THREE.MeshStandardMaterial({color:'#d1c8b8',roughness:.93});
  const forecourt = new THREE.Mesh(new THREE.BoxGeometry(72,.12,68),forecourtMaterial);
  forecourt.position.set(0,-.62,0);forecourt.receiveShadow=true;root.add(forecourt);
  // Low planted islands keep the exterior court legible without entering the building footprint or access route.
  const gardenMasses=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.12,1),groundMaterial,3);
  const gardenTransform=new THREE.Object3D();
  [[-35,23,13,8],[35,23,13,8],[0,51,20,7]].forEach(([x,z,width,depth],index)=>{gardenTransform.position.set(x,-.56,z);gardenTransform.scale.set(width,1,depth);gardenTransform.rotation.set(0,0,0);gardenTransform.updateMatrix();gardenMasses.setMatrixAt(index,gardenTransform.matrix);});
  gardenMasses.instanceMatrix.needsUpdate=true;root.add(gardenMasses);
  // Generic atmospheric city, not a surveyed neighbourhood. Instance both shells
  // and facade bands so the contextual detail stays inexpensive on mobile.
  const count=quality.tier==='mobile'?30:54;
  const city=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#e1ddd1',roughness:.85}),count);
  const windows=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#7b969b',roughness:.42,metalness:.22}),count*7*6);
  const roofs=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#b8b8aa',roughness:.9}),count);
  const transform=new THREE.Object3D();let windowIndex=0;
  for(let i=0;i<count;i++){
    const row=Math.floor(i/18),col=i%18;
    const x=(col-8.5)*16+(row%2)*7,z=-72-row*48-(i%3)*8;
    const width=7+(i%4)*2,height=8+((i*7)%24),depth=9+(i%3)*3;
    transform.position.set(x,height/2-.7,z);transform.rotation.set(0,0,0);transform.scale.set(width,height,depth);transform.updateMatrix();city.setMatrixAt(i,transform.matrix);
    city.setColorAt(i,new THREE.Color(['#dedbd1','#c6d2ce','#e8e1d4','#afc1bf'][i%4]));
    transform.position.set(x,height+.1,z);transform.scale.set(width*1.04,.22,depth*1.04);transform.updateMatrix();roofs.setMatrixAt(i,transform.matrix);
    for(let level=0;level<Math.min(7,Math.floor(height/3));level++){
      for(let bay=0;bay<3;bay++){
        transform.position.set(x+(bay-1)*width*.29,2+level*3,z+depth/2+.025);transform.scale.set(width*.22,1.55,.06);transform.updateMatrix();windows.setMatrixAt(windowIndex++,transform.matrix);
        transform.position.set(x+width/2+.025,2+level*3,z+(bay-1)*depth*.29);transform.scale.set(.06,1.55,depth*.22);transform.updateMatrix();windows.setMatrixAt(windowIndex++,transform.matrix);
      }
    }
  }
  windows.count=windowIndex;city.instanceMatrix.needsUpdate=true;windows.instanceMatrix.needsUpdate=true;root.add(city,windows,roofs);
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(1500,640),new THREE.MeshStandardMaterial({color:'#7bafb5',roughness:.4,metalness:.16}));sea.rotation.x=-Math.PI/2;sea.position.set(0,-.65,-510);root.add(sea);
  const road=new THREE.Mesh(new THREE.PlaneGeometry(530,10),new THREE.MeshStandardMaterial({color:'#a8aaa0',roughness:.98}));road.rotation.x=-Math.PI/2;road.position.set(0,-.55,-46);root.add(road);
  const day={top:new THREE.Color('#62a8d0'),horizon:new THREE.Color('#e9e5d5'),haze:new THREE.Color('#c8dce0'),glow:new THREE.Color('#ffe5ad'),ground:new THREE.Color('#8b9e7e'),paving:new THREE.Color('#d1c8b8')};
  const dusk={top:new THREE.Color('#607797'),horizon:new THREE.Color('#e2bd9a'),haze:new THREE.Color('#b8b2ac'),glow:new THREE.Color('#ffb978'),ground:new THREE.Color('#9aa18f'),paving:new THREE.Color('#bcae9d')};
  const diagnostics={profile:quality.tier,resources:0};let previousTime:number|undefined,disposed=false;
  const landscape=new THREE.Group();landscape.name='visual-v2-landscape-instances';
  new GLTFLoader().load(new URL('environments/visual-v2/visual-v2-landscape.glb',document.baseURI).href,gltf=>{
    if(disposed){disposeObject(gltf.scene);return;}
    let resources=0;
    (Object.keys(plantRoots) as PlantKind[]).forEach(kind=>{
      const template=gltf.scene.getObjectByName(plantRoots[kind]);
      if(template)resources+=addInstancedPlants(landscape,template,plantPositions(kind,plantCounts[quality.tier][kind]));
    });
    diagnostics.resources=resources;if(resources>0)root.add(landscape);invalidate?.();
  },undefined,()=>{diagnostics.resources=0;});
  return {
    diagnostics,
    update(timeSeconds,mode,camera){
      sky.position.copy(camera.position);ground.position.set(camera.position.x,-.70,camera.position.z);skyUniforms.time.value=timeSeconds;
      skyUniforms.sunDirection.value.copy(sun.position).normalize();
      const palette=mode==='warm_dusk'?dusk:day;
      const factor=previousTime===undefined?1:1-Math.exp(-Math.min(timeSeconds-previousTime,.1)*4);previousTime=timeSeconds;
      skyUniforms.top.value.lerp(palette.top,factor);skyUniforms.horizon.value.lerp(palette.horizon,factor);skyUniforms.haze.value.lerp(palette.haze,factor);skyUniforms.glow.value.lerp(palette.glow,factor);
      fog.color.copy(skyUniforms.haze.value);background.lerp(palette.haze,factor);groundMaterial.color.lerp(palette.ground,factor);forecourtMaterial.color.lerp(palette.paving,factor);
    },
    dispose(){disposed=true;scene.remove(root);disposeObject(root);if(scene.fog===fog)scene.fog=previousFog;if(scene.background===background)scene.background=previousBackground;},
  };
}
