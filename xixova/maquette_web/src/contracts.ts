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
export interface CatalogProject { id:string; name:string; variant:string; floors:number[]; units:string[]; scene:string; manifest:string; thumbnail:string; bytes:number }
export interface CatalogManifest { schema:1; defaultProject:string; projects:CatalogProject[] }

