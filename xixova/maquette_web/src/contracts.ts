import type { ProjectSolarConfig } from "./solar/types";

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type WallMode = "inteligentes" | "todas" | "exteriores" | "ocultas";
export interface Opening { id:string; tipo:"puerta"|"ventana"; distancia:number; ancho:number; alto:number; antepecho:number }
export interface Room { id:string; nombre:string; contorno:Vec2[]; centro:Vec3; area_m2:number; altura:number; cubierto?:boolean; solarSamples:Vec3[] }
export interface Wall { id:string; a:Vec2; b:Vec2; espesor:number; altura:number; exterior?:boolean; aberturas:Opening[] }
export interface SceneElement { id:string; categoria:string; dimensiones:Vec3; posicion:Vec3; rotacion:number; [key:string]:unknown }
export interface WebAssetLevel { url:string; bytes:number; activos:string[] }
export interface SceneData {
  proyecto:string; nombre:string; variante:string; configuracion:Record<string,unknown>;
  solar?:ProjectSolarConfig; espacios:Room[]; paredes:Wall[]; aberturas:Opening[];
  elementos:SceneElement[]; puntos_interes:unknown[]; luces?:Array<{id:string;posicion:Vec3;potencia:number;temperatura_k?:number}>;
  activos_glb:boolean; web_assets?:{inicial:string;objetivo:string;proxies:string[];niveles:Record<string,WebAssetLevel>};
}
export type UnitAvailability="available"|"reserved"|"sold";
export type BuildingVisualMode="neutral_day"|"warm_dusk";
export interface BuildingUnit { id:string;code:string;projectId:string;buildingId:string;towerId:string;floor:number;status:UnitAvailability;bedrooms:number;suites:number;parkingSpaces:number;privateAreaM2:number;totalAreaM2:number;orientation:string;viewType:string;priceBRL:number;modelObjectId:string;interiorProjectId?:string;published:boolean;updatedAt:string }
export interface UnitFilters { minPrice:number;maxPrice:number;minFloor?:number;maxFloor?:number;minArea:number;maxArea:number;orientation?:string;bedrooms?:number;sun?:string;viewType?:string }
export interface BuildingManifest { model:string;inventory:string;visualModes:BuildingVisualMode[];statistics:string;residentialFloors:number;units:number;provisional:boolean }
export interface CatalogProject { id:string; name:string; variant:string; floors:number[]; units:string[]; scene:string; manifest:string; thumbnail:string; bytes:number }
export interface CatalogManifest { schema:1; defaultProject:string;defaultView?:"building"|"interior";building?:BuildingManifest;projects:CatalogProject[] }
