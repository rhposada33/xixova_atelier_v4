import*as THREE from'three';
import type{SolarPosition}from'./types';
export class SolarLightController{
 readonly sun=new THREE.DirectionalLight('#fff0cf',0);readonly target=new THREE.Object3D();
 constructor(private scene:THREE.Scene,private center:THREE.Vector3,private radius:number){
  this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);const extent=Math.max(8,radius*.75);Object.assign(this.sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.1,far:radius*5+50});this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.035;this.target.position.copy(center);this.sun.target=this.target;scene.add(this.sun,this.target);
 }
 update(p:SolarPosition){
  const elevation=Math.max(0,p.elevationDegrees),warm=1-Math.min(1,elevation/35);this.sun.color.setRGB(1,.88+(.09*(1-warm)),.7+(.27*(1-warm)));this.sun.intensity=p.daylight?.65+2.55*Math.sin(Math.min(90,elevation)*Math.PI/180):0;this.sun.position.copy(this.center).add(new THREE.Vector3(...p.direction).multiplyScalar(this.radius*2+12));
 }
 dispose(){this.scene.remove(this.sun,this.target);this.sun.dispose();}
}
