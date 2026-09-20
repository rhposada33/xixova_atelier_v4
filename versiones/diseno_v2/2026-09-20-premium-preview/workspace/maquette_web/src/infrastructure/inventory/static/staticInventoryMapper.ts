import type {Orientation,PropertyUnit,UnitStatus,ViewType} from '../../../domain/inventory';

export interface DemoInventoryRow {id:string;code:string;projectId:string;buildingId:string;towerId:string;floor:number;status:string;bedrooms:number;suites:number;parkingSpaces:number;privateAreaM2:number;totalAreaM2:number;orientation:string;viewType:string;priceBRL:number;modelObjectId:string;interiorProjectId?:string;published:boolean;updatedAt:string;}
const ORGANIZATION_ID='00000000-0000-4000-8000-000000000001';
const PROJECT_ID='00000000-0000-4000-8000-000000000002';
const BUILDING_ID='00000000-0000-4000-8000-000000000003';
const typeId=(final:number,upper:boolean)=>`00000000-0000-4000-8000-${String(100+final+(upper?4:0)).padStart(12,'0')}`;
export const floorId=(floor:number)=>`00000000-0000-4000-8${String(floor).padStart(3,'0')}-000000000000`;
export const unitId=(code:string)=>`00000000-0000-4001-8000-${code.padStart(12,'0')}`;

export function mapDemoRow(row:DemoInventoryRow):PropertyUnit{
  const final=Number(row.code)%100;
  return {id:unitId(row.code),organizationId:ORGANIZATION_ID,projectId:PROJECT_ID,buildingId:BUILDING_ID,floorId:floorId(row.floor),unitTypeId:typeId(final,row.floor>16),code:row.code,floor:row.floor,status:row.status as UnitStatus,bedrooms:row.bedrooms,suites:row.suites,parkingSpaces:row.parkingSpaces,privateAreaM2:row.privateAreaM2,totalAreaM2:row.totalAreaM2,orientation:row.orientation as Orientation,viewType:row.viewType as ViewType,sunExposure:['east','northeast','southeast'].includes(row.orientation)?'morning':'afternoon',priceBRL:row.priceBRL,modelObjectId:row.modelObjectId,interiorProjectId:row.interiorProjectId,published:row.published,updatedAt:row.updatedAt};
}
