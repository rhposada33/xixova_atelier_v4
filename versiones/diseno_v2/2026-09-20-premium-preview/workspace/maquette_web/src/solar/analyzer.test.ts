import{describe,expect,it}from'vitest';import*as THREE from'three';import{SunlightAnalyzer}from'./analyzer';
const room=[{id:'room',nombre:'Room',solarSamples:[[0,0,1] as [number,number,number]]}];
describe('SunlightAnalyzer',()=>{
 it('clasifica rayos libres y noche',()=>{const a=new SunlightAnalyzer(room,[],.2);expect(a.analyze([1,0,1],true)[0].directSunlight).toBe(true);expect(a.analyze([1,0,1],false)[0].directSunlight).toBe(false)});
 it('detecta un obstáculo',()=>{const wall=new THREE.Mesh(new THREE.BoxGeometry(.1,2,2));wall.position.x=1;wall.updateMatrixWorld();const r=new SunlightAnalyzer(room,[wall],.2).analyze([1,0,0],true)[0];expect(r.directSunlight).toBe(false);expect(r.illuminatedSamples).toBe(0)});
});
