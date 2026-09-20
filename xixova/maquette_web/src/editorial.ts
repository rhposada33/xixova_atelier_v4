import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Small architectural details in the same metre / Z-up coordinates as the plan. */
export function editorialDetails(world:THREE.Scene,data:any){
 const group=new THREE.Group();group.name='Editorial architectural details';world.add(group);
 const material=(color:string,roughness=.72,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const oak=material('#a87943'),cream=material('#eee5d4'),olive=material('#767a43'),metal=material('#49483b',.32,.65),stone=material('#cfc3ac');
 if(data.proyecto==='terraza_luz'){oak.name='v2_roble';cream.name='v2_lino_marfil';olive.name='v2_lino_salvia';}
 const box=(x:number,y:number,z:number,w:number,d:number,h:number,m:THREE.Material,round=0)=>{const n=new THREE.Mesh(round?new RoundedBoxGeometry(w,d,h,3,round):new THREE.BoxGeometry(w,d,h),m);n.position.set(x,y,z);n.castShadow=n.receiveShadow=true;group.add(n);return n};
 const cylinder=(x:number,y:number,z:number,r:number,h:number,m:THREE.Material)=>{const n=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.94,h,32),m);n.rotation.x=Math.PI/2;n.position.set(x,y,z);n.castShadow=n.receiveShadow=true;group.add(n);return n};
 const leafMatrices:THREE.Matrix4[][]=[[],[],[]],leafTransform=new THREE.Object3D();
 const plant=(x:number,y:number,s=1)=>{cylinder(x,y,.18*s,.17*s,.36*s,stone);for(let i=0;i<58;i++){const a=i*2.399,reach=(.1+(i%7)*.032)*s;leafTransform.scale.set(.035*s,.16*s,.012*s);leafTransform.position.set(x+Math.cos(a)*reach,y+Math.sin(a)*reach,.36*s+(i%11)*.062*s);leafTransform.rotation.set(.4+Math.sin(a)*.6,.35,a);leafTransform.updateMatrix();leafMatrices[i%3].push(leafTransform.matrix.clone())}};
 // Terrace balustrades: thin bronze frames and transparent glass preserve the view.
 if(data.proyecto==='terraza_luz'){
 const glass=new THREE.MeshPhysicalMaterial({color:'#d7e4d7',transparent:true,opacity:.14,roughness:.12,metalness:.1,depthWrite:false,side:THREE.DoubleSide});
 const rail=(ax:number,ay:number,bx:number,by:number)=>{const length=Math.hypot(bx-ax,by-ay),angle=Math.atan2(by-ay,bx-ax),count=Math.ceil(length/1.1);for(let i=0;i<=count;i++)box(ax+(bx-ax)*i/count,ay+(by-ay)*i/count,.62,.035,.035,1.2,metal);const top=box((ax+bx)/2,(ay+by)/2,1.22,length,.04,.04,metal);top.rotation.z=angle;const pane=box((ax+bx)/2,(ay+by)/2,.64,length,.014,1.08,glass);pane.rotation.z=angle;pane.castShadow=false;};
 rail(2.4,-1.48,11.15,-1.48);rail(11.15,-1.48,11.15,7.2);rail(2.4,-1.48,2.4,0);
 for(let i=0;i<15;i++)plant(2.7+i*.56,-1.24,.48+(i%3)*.06);
 for(let i=0;i<12;i++)plant(10.94,-.3+i*.63,.58+(i%3)*.12);
 for(const [x,y,s] of [[2.8,-.55,1.3],[10.5,6.7,1.6],[9.05,6.6,1.1],[6.1,3.8,.8],[.4,6.8,.8]])plant(x,y,s);
 // Linen upholstery, individual cushions and a timber base.
 box(6,1.55,.2,2.3,.9,.18,oak,.045);box(6,1.89,.72,2.3,.18,1.02,cream,.065);
 for(let i=0;i<3;i++){box(5.27+i*.73,1.47,.46,.7,.78,.3,cream,.07);const cushion=box(5.32+i*.68,1.69,.8,.42,.15,.42,i===1?cream:olive,.07);cushion.rotation.x=.16;cushion.rotation.y=(i-1)*.12;}
 box(4.84,1.48,.56,.16,.87,.58,cream,.045);box(7.16,1.48,.56,.16,.87,.58,cream,.045);
 const rugMaterial=material('#c2b49a');rugMaterial.name='v2_alfombra';box(6,.72,.11,3,2.2,.025,rugMaterial);
 for(const [x,y] of [[6,-.7],[10.25,2.1]]){cylinder(x,y,.72,.42,.065,oak);cylinder(x,y,.37,.055,.66,metal);for(const side of [-1,1]){box(x+side*.64,y,.44,.42,.45,.08,cream,.035);box(x+side*.79,y,.69,.065,.46,.48,oak,.02);for(const dy of [-.17,.17])box(x+side*.64,y+dy,.23,.035,.035,.43,metal);}cylinder(x,y,.78,.07,.08,stone);}
 // Oak screening at the glazed terrace transitions.
 for(const x of [2.5,9.4])for(let i=0;i<9;i++)box(x+i*.065,-.025,1.05,.028,.075,2.1,oak);
 // Layered linen bedding and bedside lights give the private rooms a warm focal point.
 for(const [x,y,w] of [[7.75,5.6,1.82],[4.5,5.8,1.42]]){
 box(x,y,.25,w,1.96,.3,oak,.05);box(x,y,.48,w-.05,1.93,.28,cream,.09);
 box(x,y+.92,.73,w+.1,.13,1.23,cream,.06);
 box(x,y-.1,.65,w-.04,1.45,.08,cream,.035);box(x,y-.56,.71,w-.01,.54,.045,olive,.02);
 for(const side of [-1,1]){const pillow=box(x+side*w*.245,y+.56,.73,w*.43,.45,.17,cream,.075);pillow.rotation.z=side*.08;if(w>1.5){box(x+side*(w*.5+.24),y+.68,.38,.4,.46,.62,oak,.025);cylinder(x+side*(w*.5+.24),y+.68,.91,.12,.22,cream);cylinder(x+side*(w*.5+.24),y+.68,1.02,.09,.04,new THREE.MeshBasicMaterial({color:'#ffe3a0'}));}}
 box(x,y,.12,w+.55,2.5,.025,material('#99977f'));
 }
 }
 const leafGeometry=new THREE.SphereGeometry(1,7,5);leafMatrices.forEach((matrices,i)=>{const leaves=new THREE.InstancedMesh(leafGeometry,material(['#354d22','#526b2b','#74843c'][i]),matrices.length);matrices.forEach((m,j)=>leaves.setMatrixAt(j,m));leaves.castShadow=leaves.receiveShadow=true;group.add(leaves)});
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),material(data.proyecto==='terraza_luz'?'#aaa79d':'#eeece3',1));ground.position.z=-.19;ground.receiveShadow=true;world.add(ground);
 const sun=new THREE.DirectionalLight('#ffe2a5',4.1);sun.position.set(0,-7,11);sun.target.position.set(5,3,0);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-11,right:11,top:11,bottom:-11,near:.1,far:45});sun.shadow.normalBias=.025;sun.shadow.bias=-.00015;sun.shadow.radius=3;world.add(sun,sun.target);return sun;
}
