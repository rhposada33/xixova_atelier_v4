/** Check exported unit names/world bounds without loading browser-only textures. */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Box3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const root=new URL('../',import.meta.url);
function geometryOnly(path){
  const bytes=fs.readFileSync(new URL(path,root));
  const length=bytes.readUInt32LE(12);
  const document=JSON.parse(bytes.subarray(20,20+length).toString());
  delete document.images;delete document.textures;delete document.samplers;delete document.materials;
  for(const mesh of document.meshes)for(const primitive of mesh.primitives)delete primitive.material;
  const json=Buffer.from(JSON.stringify(document));
  const padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const binary=bytes.subarray(20+length),header=Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);
  header.writeUInt32LE(20+padded.length+binary.length,8);
  header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const all=Buffer.concat([header,padded,binary]);
  return all.buffer.slice(all.byteOffset,all.byteOffset+all.byteLength);
}
async function inspect(path){
  const {scene}=await new GLTFLoader().parseAsync(geometryOnly(path),'');
  scene.updateMatrixWorld(true);
  const proxies={};let triangles=0;
  scene.traverse(object=>{
    if(!object.isMesh)return;
    triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;
    if(object.name.startsWith('UNIT_')){
      if(proxies[object.name])throw new Error(`Duplicate proxy: ${object.name}`);
      const bounds=new Box3().setFromObject(object);
      proxies[object.name]=[...bounds.min.toArray(),...bounds.max.toArray()];
    }
  });
  return {proxies,triangles};
}
const source=await inspect('public/building/xixova-building-visual-v2.glb');
const refined=await inspect('public/building/promoven-premium.glb');
let maxDifference=0;
for(const [name,bounds] of Object.entries(source.proxies)){
  if(!refined.proxies[name])throw new Error(`Missing proxy: ${name}`);
  bounds.forEach((value,index)=>{maxDifference=Math.max(maxDifference,Math.abs(value-refined.proxies[name][index]));});
}
const report={proxies:Object.keys(refined.proxies).length,maxBoundsDifferenceMetres:maxDifference,sourceTriangles:source.triangles,refinedTriangles:refined.triangles};
if(report.proxies!==72||maxDifference>0.0001||source.triangles!==refined.triangles)throw new Error(JSON.stringify(report));
console.log(JSON.stringify({...report,model:fileURLToPath(new URL('public/building/promoven-premium.glb',root))},null,2));
