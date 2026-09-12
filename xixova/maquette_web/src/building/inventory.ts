export type UnitAvailability = 'available' | 'reserved' | 'sold';
export type Orientation = 'north'|'northeast'|'east'|'southeast'|'south'|'southwest'|'west'|'northwest';
export interface BuildingUnit {
  id:string; code:string; projectId:string; buildingId:string; towerId:string; floor:number;
  status:UnitAvailability; bedrooms:number; suites:number; parkingSpaces:number;
  privateAreaM2:number; totalAreaM2:number; orientation:Orientation; viewType:'sea'|'city'|'garden'|'pool';
  priceBRL:number; modelObjectId:string; interiorProjectId?:string; published:boolean; updatedAt:string;
}
export const buildingConfig = {
  projectId:'xixova-residences', buildingId:'xixova-tower', towerId:'A', floors:18, unitsPerFloor:4,
  floorHeight:3.15, residentialBase:4, width:24, depth:34,
  modelUrl:'building/xixova-building.glb', defaultUnit:'1203', updatedAt:'2026-09-12T00:00:00Z',
  statuses:{available:54,reserved:6,sold:12},
  reservedCodes:['401','704','902','1201','1504','1702'],
  soldCodes:['101','104','202','203','301','304','502','603','801','1004','1302','1603'],
  provisional:true,
  typologies:[
    {bedrooms:3,suites:2,parkingSpaces:2,area:118,orientation:'northeast' as Orientation,view:'garden' as const,base:1040000},
    {bedrooms:2,suites:1,parkingSpaces:1,area:82,orientation:'northwest' as Orientation,view:'city' as const,base:740000},
    {bedrooms:3,suites:2,parkingSpaces:2,area:96,orientation:'southeast' as Orientation,view:'sea' as const,base:920000},
    {bedrooms:4,suites:3,parkingSpaces:3,area:146,orientation:'southwest' as Orientation,view:'garden' as const,base:1220000},
  ],
};
export const inventory:BuildingUnit[]=Array.from({length:buildingConfig.floors},(_,f)=>
  buildingConfig.typologies.map((type,i)=>{
    const floor=f+1,code=String(floor*100+i+1),area=type.area+(floor>16?8:0);
    return {id:`unit-${code}`,code,projectId:buildingConfig.projectId,buildingId:buildingConfig.buildingId,towerId:buildingConfig.towerId,floor,
      status:buildingConfig.reservedCodes.includes(code)?'reserved' as const:buildingConfig.soldCodes.includes(code)?'sold' as const:'available' as const,
      bedrooms:type.bedrooms,suites:type.suites,parkingSpaces:type.parkingSpaces,privateAreaM2:area,totalAreaM2:Math.round(area*1.22),
      orientation:type.orientation,viewType:type.view,priceBRL:type.base+floor*35000+(type.view==='sea'?120000:0)+(floor>16?150000:0),
      modelObjectId:`UNIT_${code}_PROXY`,interiorProjectId:i===0||i===3?'garden_house_18':'terraza_luz',published:true,updatedAt:buildingConfig.updatedAt};
  })).flat();
export const statusLabel:Record<UnitAvailability,string>={available:'Disponible',reserved:'Reservada',sold:'Vendida'};
export const orientationLabel:Record<Orientation,string>={north:'Norte',northeast:'Nordeste',east:'Este',southeast:'Sudeste',south:'Sur',southwest:'Sudoeste',west:'Oeste',northwest:'Noroeste'};
export const formatBRL=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(value);
export const isMorning=(u:BuildingUnit)=>['east','northeast','southeast'].includes(u.orientation);
export interface UnitFilters {minPrice:number;maxPrice:number;floor:string;minArea:number;maxArea:number;orientation:string;bedrooms:number;sun:string;sea:boolean;}
export const defaultFilters:UnitFilters={minPrice:600000,maxPrice:2500000,floor:'',minArea:50,maxArea:200,orientation:'',bedrooms:0,sun:'',sea:false};
export function filterUnits(units:BuildingUnit[],f:UnitFilters){return units.filter(u=>u.published&&u.priceBRL>=f.minPrice&&u.priceBRL<=f.maxPrice&&(!f.floor||u.floor===Number(f.floor))&&u.privateAreaM2>=f.minArea&&u.privateAreaM2<=f.maxArea&&(!f.orientation||u.orientation===f.orientation)&&(!f.bedrooms||u.bedrooms===f.bedrooms)&&(!f.sun||(f.sun==='morning'?isMorning(u):!isMorning(u)))&&(!f.sea||u.viewType==='sea'));}
export const canExplore=(u:BuildingUnit)=>Boolean(u.interiorProjectId);
export const canPropose=(u:BuildingUnit)=>u.status==='available';
