import*as THREE from'three';
import type{RoomSolarData,RoomSunlightResult}from'./types';

export class SunlightAnalyzer{
 private ray=new THREE.Raycaster();private origin=new THREE.Vector3();private direction=new THREE.Vector3();
 constructor(private rooms:RoomSolarData[],private blockers:THREE.Object3D[],private threshold=.2){}
 analyze(direction:[number,number,number],daylight:boolean):RoomSunlightResult[]{
  this.direction.set(...direction).normalize();
  return this.rooms.map(room=>{
   let clear=0;
   if(daylight)for(const sample of room.solarSamples){this.origin.set(...sample).addScaledVector(this.direction,.015);this.ray.set(this.origin,this.direction);this.ray.near=.01;this.ray.far=10000;if(this.ray.intersectObjects(this.blockers,true).length===0)clear++}
   const total=room.solarSamples.length,ratio=total?clear/total:0;
   return{roomId:room.id,directSunlight:daylight&&ratio>=this.threshold,exposureRatio:ratio,illuminatedSamples:clear,totalSamples:total};
  });
 }
}
