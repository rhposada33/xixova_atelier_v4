import type { CatalogManifest, CatalogProject, SceneData } from "./contracts";

const absolute=(path:string)=>new URL(path,document.baseURI).toString();
export async function loadCatalog():Promise<CatalogManifest>{
  const response=await fetch(absolute("catalog.json"));
  if(!response.ok)throw new Error("No se pudo abrir el catálogo");
  const value=await response.json() as CatalogManifest;
  if(value.schema!==1||!value.projects?.length)throw new Error("Catálogo incompatible");
  return value;
}
export async function loadScene(project:CatalogProject):Promise<SceneData>{
  const response=await fetch(absolute(project.scene));
  if(!response.ok)throw new Error(`No se pudo abrir ${project.name}`);
  const scene=await response.json() as SceneData;
  const projectRoot=new URL("../",absolute(project.scene));
  if(scene.web_assets)Object.values(scene.web_assets.niveles).forEach(level=>level.url=new URL(level.url,projectRoot).toString());
  return scene;
}
export function selectionFromURL(catalog:CatalogManifest,search=location.search){
  const query=new URLSearchParams(search),requested=query.get("maqueta");
  const project=catalog.projects.find(item=>item.id===requested)??catalog.projects.find(item=>item.id===catalog.defaultProject)??catalog.projects[0];
  const floor=Number(query.get("piso"))||project.floors[0];
  const suffix=query.get("unidad")||project.units[0];
  return {project,floor,unit:String(suffix).startsWith(String(floor))?String(suffix):`${floor}${suffix}`};
}
export function updateSelection(values:{project?:string;floor?:number;unit?:string;area?:string}){
  const url=new URL(location.href);
  for(const [key,value] of Object.entries({maqueta:values.project,piso:values.floor,unidad:values.unit,area:values.area}))
    value===undefined||value===""?url.searchParams.delete(key):url.searchParams.set(key,String(value));
  history.replaceState(null,"",url);
}
