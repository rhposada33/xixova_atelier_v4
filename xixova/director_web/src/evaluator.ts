export type Key={id:string,tiempo:number,valor:any,interpolacion:string};
export type Track={id:string,tipo:string,objetivo:string,propiedad:string,claves:Key[]};
export type Shot={id:string,inicio:number,duracion:number,camara:string,transicion?:string};
export type Script={fps:number,duracion:number,tomas:Shot[],pistas:Track[],marcadores:any[]};

export function sample(track:Track|undefined,time:number):any{
 const keys=[...(track?.claves||[])].sort((a,b)=>a.tiempo-b.tiempo); if(!keys.length)return undefined;
 if(time<=keys[0].tiempo)return structuredClone(keys[0].valor); if(time>=keys[keys.length-1].tiempo)return structuredClone(keys[keys.length-1].valor);
 const index=keys.findIndex(k=>k.tiempo>=time),a=keys[index-1],b=keys[index];let t=(time-a.tiempo)/(b.tiempo-a.tiempo);
 if(a.interpolacion==='hold')t=0;else if(['bezier','ease_in_out'].includes(a.interpolacion))t=t*t*(3-2*t);else if(a.interpolacion==='ease_in')t=t*t;else if(a.interpolacion==='ease_out')t=1-(1-t)*(1-t);
 const blend=(x:number,y:number)=>x+(y-x)*t;
 if(Array.isArray(a.valor))return a.valor.map((x:number,i:number)=>blend(x,b.valor[i]));
 if(typeof a.valor==='boolean')return t<.5?a.valor:b.valor;
 return blend(a.valor,b.valor);
}

export function activeShot(script:Script,time:number):Shot{
 return [...script.tomas].sort((a,b)=>a.inicio-b.inicio).find(s=>time>=s.inicio&&time<s.inicio+s.duracion)||script.tomas[script.tomas.length-1];
}

export function stateAt(script:Script,time:number){
 const shot=activeShot(script,time),values=new Map<string,Map<string,any>>();
 for(const track of script.pistas){let target=values.get(track.objetivo);if(!target){target=new Map();values.set(track.objetivo,target)}target.set(track.propiedad,sample(track,time))}
 const camera=values.get(shot.camara)||new Map();
 return{shot,camera,values,frame:Math.min(Math.round(script.duracion*script.fps),Math.floor(time*script.fps)+1)};
}

export function cameraWarnings(scene:any,state:ReturnType<typeof stateAt>):string[]{
 const p=state.camera.get('posicion'),q=state.camera.get('objetivo');if(!p||!q)return[];const warnings:string[]=[];
 const distance=(a:number[],b:number[],x:number[])=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((x[0]-a[0])*dx+(x[1]-a[1])*dy)/l)):0;return Math.hypot(x[0]-a[0]-t*dx,x[1]-a[1]-t*dy)};
 if(scene.paredes.some((w:any)=>p[2]>=0&&p[2]<=w.altura&&distance(w.a,w.b,p)<w.espesor/2+.03))warnings.push('Cámara dentro de pared');
 if(scene.elementos.some((e:any)=>Math.abs(p[0]-e.posicion[0])<e.dimensiones[0]/2&&Math.abs(p[1]-e.posicion[1])<e.dimensiones[1]/2&&p[2]<e.posicion[2]+e.dimensiones[2]))warnings.push('Cámara dentro de mobiliario');
 return warnings;
}
