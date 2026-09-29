const allowedViews=new Set(['edificio','interior']);
const allowedModels=new Set(['garden_house_18','terraza_luz','jequitiba_final_03']);
const allowedClients=new Set(['jequitiba']);
const allowedVisuals=new Set(['v1','v2','original']);
export function normalizeDemoQuery(search:string){const input=new URLSearchParams(search),output=new URLSearchParams();const vista=input.get('vista');if(vista&&allowedViews.has(vista))output.set('vista',vista);const unidad=input.get('unidad');if(unidad&&/^\d{3,4}$/.test(unidad))output.set('unidad',unidad);const maqueta=input.get('maqueta');if(maqueta&&allowedModels.has(maqueta))output.set('maqueta',maqueta);const piso=input.get('piso');if(piso&&/^\d{1,2}$/.test(piso)&&Number(piso)>=1&&Number(piso)<=99)output.set('piso',String(Number(piso)));const area=input.get('area');if(area&&/^[a-z0-9_-]{1,64}$/i.test(area))output.set('area',area);const cliente=input.get('cliente');if(cliente&&allowedClients.has(cliente))output.set('cliente',cliente);const visual=input.get('visual');if(visual&&allowedVisuals.has(visual))output.set('visual',visual);return output}
export function demoUrl(search:string|URLSearchParams=''){const query=normalizeDemoQuery(search.toString());return `/demo${query.size?`?${query}`:''}`}
export function legacyDemoTarget(search:string){const query=normalizeDemoQuery(search);return query.size?`/demo?${query}`:null}
