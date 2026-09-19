import type * as Three from 'three';
import {ACTIVITY_SLOT_SECONDS,ACTIVITY_TRANSITION_SECONDS,nightPresence,roomSeed,staticActivityTime} from './nightPattern';

type Assignment={mesh:Three.Mesh;originalMaterial:Three.Material|Three.Material[];clones:Three.Material[];originalGeometry:Three.BufferGeometry;geometry:Three.BufferGeometry;panelCount:number};

// The GLB batches 120 disconnected interior quads in one draw call. Clone only
// this preview geometry and give every quad a deterministic seed attribute.
const addPanelSeeds=(THREE:typeof Three,mesh:Three.Mesh)=>{
  const original=mesh.geometry as Three.BufferGeometry,geometry=original.clone(),position=geometry.getAttribute('position');
  const seeds=new Float32Array(position.count),index=geometry.getIndex();let panelCount=0;
  if(index){for(let offset=0;offset+5<index.count;offset+=6){const seed=roomSeed(panelCount++);for(let vertex=0;vertex<6;vertex++)seeds[index.getX(offset+vertex)]=seed}}
  else for(let offset=0;offset+3<position.count;offset+=4){const seed=roomSeed(panelCount++);for(let vertex=0;vertex<4;vertex++)seeds[offset+vertex]=seed}
  geometry.setAttribute('aRoomSeed',new THREE.Float32BufferAttribute(seeds,1));mesh.geometry=geometry;
  return {original,geometry,panelCount};
};

export function createNightAtmosphere(THREE:typeof Three,model:Three.Object3D,scene:Three.Scene,scale:number){
  const night={value:0},activity={value:0},assignments:Assignment[]=[];
  model.traverse(object=>{
    if(!(object as Three.Mesh).isMesh)return;
    const mesh=object as Three.Mesh,originalMaterial=mesh.material;
    const candidates=Array.isArray(originalMaterial)?originalMaterial:[originalMaterial];
    if(!candidates.some(material=>/(furnished|room|interior)/i.test(material.name)&&'emissive' in material))return;
    const seeded=addPanelSeeds(THREE,mesh),clones:Three.Material[]=[];
    const materials=candidates.map(material=>{
      if(!/(furnished|room|interior)/i.test(material.name)||!('emissive' in material))return material;
      const clone=material.clone() as Three.MeshStandardMaterial;
      clone.emissive.set('#ffffff');clone.emissiveIntensity=1;clone.emissiveMap=clone.emissiveMap||clone.map;
      clone.onBeforeCompile=shader=>{
        shader.uniforms.uNight=night;shader.uniforms.uActivity=activity;
        shader.vertexShader='attribute float aRoomSeed;\nvarying float vRoomSeed;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRoomSeed = aRoomSeed;');
        shader.fragmentShader=`uniform float uNight;
uniform float uActivity;
varying float vRoomSeed;
float roomHash(float value){return fract(sin(value*91.173+19.19)*43758.5453);}
`+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
float seed=vRoomSeed;
float occupied=step(.6,seed);
float arrivalStart=.03+.46*roomHash(seed*41.0+7.0);
float arrival=smoothstep(arrivalStart,arrivalStart+.38,uNight);
float strength=mix(3.6,7.2,roomHash(seed*13.0+3.0));
float television=step(.985,roomHash(seed*29.0+17.0));
vec3 warmth=mix(vec3(1.0,.40,.14),vec3(1.0,.68,.31),roomHash(seed*7.0+2.0));
warmth=mix(warmth,vec3(.48,.62,.96),television);
// Seven or fewer rooms receive a new target together every 2.2 seconds. The
// target itself is blended over 1.9 seconds, avoiding a billboard-like flicker.
float slot=floor(uActivity/${ACTIVITY_SLOT_SECONDS.toFixed(1)});
float slotMix=smoothstep(0.0,${(ACTIVITY_TRANSITION_SECONDS/ACTIVITY_SLOT_SECONDS).toFixed(3)},fract(uActivity/${ACTIVITY_SLOT_SECONDS.toFixed(1)}));
float activeRoom=step(.87,roomHash(seed*53.0+5.0));
float previousTarget=step(.5,roomHash(seed*67.0+slot-1.0));
float nextTarget=step(.5,roomHash(seed*67.0+slot));
float life=1.0-activeRoom*.32*mix(previousTarget,nextTarget,slotMix);
life*=1.0-television*.09*(.5+.5*sin(uActivity*.23+seed*31.0));
totalEmissiveRadiance *= warmth * occupied * arrival * strength * life;
`);
      };
      clone.customProgramCacheKey=()=> 'promoven-inhabited-night-v4';clones.push(clone);return clone;
    });
    mesh.material=Array.isArray(originalMaterial)?materials:materials[0];assignments.push({mesh,originalMaterial,clones,originalGeometry:seeded.original,geometry:seeded.geometry,panelCount:seeded.panelCount});
  });
  // Three unshadowed fixtures give entrance and planting depth at fixed cost.
  const lights=[{x:0,y:3.8,z:8.4,power:1.05,reach:6.2},{x:-9.3,y:3.2,z:3,power:2.4,reach:3},{x:9.2,y:3.2,z:2.2,power:2.4,reach:3}].map(({x,y,z,power,reach})=>{
    const light=new THREE.PointLight('#ffc078',0,reach,2);light.position.set(x*2.25*scale+model.position.x,y*scale+model.position.y,z*1.08*scale+model.position.z);scene.add(light);return {light,power};
  });
  return {
    panelCount:assignments.reduce((count,assignment)=>count+assignment.panelCount,0),
    update(roomEmission:number,elapsedSeconds:number,animate:boolean,reducedMotion=false){
      night.value=nightPresence(roomEmission);activity.value=staticActivityTime(reducedMotion,activity.value+(animate&&night.value>0?elapsedSeconds:0));
      const fixturePresence=THREE.MathUtils.smoothstep(night.value,.12,.88);for(const {light,power} of lights)light.intensity=power*fixturePresence;
      return night.value;
    },
    dispose(){
      for(const {mesh,originalMaterial,clones,originalGeometry,geometry} of assignments){mesh.material=originalMaterial;mesh.geometry=originalGeometry;clones.forEach(material=>material.dispose());geometry.dispose()}
      for(const {light} of lights){scene.remove(light);light.dispose()}
    },
  };
}
