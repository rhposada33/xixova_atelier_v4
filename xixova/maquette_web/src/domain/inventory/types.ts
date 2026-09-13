export type UnitStatus='available'|'reserved'|'sold'|'blocked'|'coming_soon'|'hidden';
export type PublicUnitStatus=Extract<UnitStatus,'available'|'reserved'|'sold'>;
export type Orientation='north'|'northeast'|'east'|'southeast'|'south'|'southwest'|'west'|'northwest';
export type ViewType='sea'|'city'|'garden'|'pool';
export type SunExposure='morning'|'afternoon';

export interface PropertyUnit {
  id:string;organizationId:string;projectId:string;buildingId:string;floorId:string;unitTypeId:string;
  code:string;floor:number;status:UnitStatus;bedrooms:number;suites:number;parkingSpaces:number;
  privateAreaM2:number;totalAreaM2?:number;orientation:Orientation;viewType?:ViewType;
  sunExposure?:SunExposure;priceBRL?:number;modelObjectId:string;interiorProjectId?:string;
  published:boolean;updatedAt:string;
}

export interface InventorySummary {total:number;available:number;reserved:number;sold:number;blocked:number;comingSoon:number;}
export interface PublishedUnitsQuery {organizationSlug:string;projectSlug:string;signal?:AbortSignal;}
export interface UnitFilters {minPrice:number;maxPrice:number;floor:string;minArea:number;maxArea:number;orientation:string;bedrooms:number;sun:string;sea:boolean;}
export interface ProjectInventoryConfig {organizationSlug:string;projectSlug:string;defaultUnitCode:string;floors:number;unitsPerFloor:number;modelUrl:string;}

export interface InventoryReader {
  listPublishedUnits(query:PublishedUnitsQuery):Promise<PropertyUnit[]>;
  getPublishedUnit(organizationSlug:string,projectSlug:string,code:string,signal?:AbortSignal):Promise<PropertyUnit|null>;
  getInventorySummary(organizationSlug:string,projectSlug:string,signal?:AbortSignal):Promise<InventorySummary>;
}

export interface UpdateUnitInput {status?:UnitStatus;priceBRL?:number;published?:boolean;}
export interface ChangeUnitStatusCommand {status:UnitStatus;reason?:string;}
export interface InventoryAdminRepository {
  listAllUnits(projectId:string):Promise<PropertyUnit[]>;
  updateUnit(unitId:string,changes:UpdateUnitInput):Promise<PropertyUnit>;
  changeUnitStatus(unitId:string,command:ChangeUnitStatusCommand):Promise<PropertyUnit>;
}
