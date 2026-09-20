import type {Orientation,UnitStatus} from './types';

export type OrganizationRole='platform_admin'|'organization_admin'|'seller'|'viewer';
export type AdminUnitSortField='code'|'floor'|'price'|'updated_at';
export type SortDirection='asc'|'desc';

export interface OrganizationSummary {id:string;name:string;slug:string;role:OrganizationRole;}
export interface ProjectSummary {id:string;organizationId:string;name:string;slug:string;status:string;}
export interface ProjectAdminSummary {projectId:string;total:number;available:number;reserved:number;sold:number;hidden:number;recentlyUpdated:number;}

export interface AdminPropertyUnit {
  id:string;organizationId:string;projectId:string;buildingId:string;floorId:string;unitTypeId:string;
  code:string;floor:number;unitTypeName:string;status:UnitStatus;bedrooms:number;suites:number;
  parkingSpaces:number;privateAreaM2:number;totalAreaM2?:number;orientation:Orientation;
  viewType?:string;sunExposure?:string;priceBRL?:number;modelObjectId:string;interiorProjectId?:string;
  published:boolean;reservedBy?:string;reservedAt?:string;reservedUntil?:string;version:number;updatedAt:string;
}

export interface AdminUnitQuery {
  organizationId?:string;projectId?:string;buildingId?:string;page:number;pageSize:number;
  search?:string;floor?:number;status?:UnitStatus;bedrooms?:number;orientation?:Orientation;
  published?:boolean;sortBy?:AdminUnitSortField;sortDirection?:SortDirection;
}
export interface PaginatedAdminUnits {items:AdminPropertyUnit[];total:number;page:number;pageSize:number;}
export interface UnitAuditEntry {id:string;organizationId:string;projectId:string;unitId:string;unitCode:string;action:string;oldValues:Record<string,unknown>;newValues:Record<string,unknown>;reason?:string;performedBy:string;createdAt:string;}
export interface AdminHistoryQuery {unitId?:string;projectId?:string;action?:string;createdFrom?:string;createdTo?:string;}
export interface UpdateUnitPriceCommand {unitId:string;expectedVersion:number;newPrice:number;}
export interface ChangeUnitStatusCommand {unitId:string;expectedVersion:number;expectedStatus:UnitStatus;newStatus:UnitStatus;reason:string;}
export interface SetUnitPublishedCommand {unitId:string;expectedVersion:number;published:boolean;}

export interface InventoryAdminRepository {
  getCurrentProfile():Promise<{active:boolean;isPlatformAdmin:boolean}>;
  listOrganizations():Promise<OrganizationSummary[]>;
  listProjects(organizationId:string):Promise<ProjectSummary[]>;
  getProjectSummary(projectId:string):Promise<ProjectAdminSummary>;
  listUnits(query:AdminUnitQuery):Promise<PaginatedAdminUnits>;
  getUnit(unitId:string):Promise<AdminPropertyUnit|null>;
  getUnitHistory(query:AdminHistoryQuery):Promise<UnitAuditEntry[]>;
  updateUnitPrice(command:UpdateUnitPriceCommand):Promise<AdminPropertyUnit>;
  changeUnitStatus(command:ChangeUnitStatusCommand):Promise<AdminPropertyUnit>;
  setUnitPublished(command:SetUnitPublishedCommand):Promise<AdminPropertyUnit>;
}
