export type ProjectStatus = "draft" | "ready" | "published" | "archived";
export interface ManagedProject {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  status: ProjectStatus;
  country: string;
  state?: string;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  currency: string;
  estimatedDeliveryDate?: string;
  northOffsetDegrees: number;
  publicInventoryEnabled: boolean;
  visualExperienceEnabled: boolean;
  version: number;
  buildingCount: number;
  floorCount: number;
  unitTypeCount: number;
  unitCount: number;
}
export interface ProjectInput {
  name: string;
  slug: string;
  description?: string;
  country: string;
  state?: string;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  currency: string;
  estimatedDeliveryDate?: string;
  northOffsetDegrees: number;
}
export interface Building {
  id: string;
  projectId: string;
  code: string;
  name: string;
  displayOrder: number;
  active: boolean;
  version: number;
  floorCount: number;
  unitCount: number;
  modelPath: string;
}
export interface Floor {
  id: string;
  buildingId: string;
  code: string;
  label: string;
  floorNumber: number;
  displayOrder: number;
  heightMeters?: number;
  active: boolean;
  version: number;
  unitCount: number;
  modelObjectId?: string;
}
export interface UnitType {
  id: string;
  projectId: string;
  code: string;
  name: string;
  description?: string;
  privateArea: number;
  totalArea?: number;
  bedrooms: number;
  suites: number;
  bathrooms?: number;
  parkingSpaces?: number;
  active: boolean;
  version: number;
  unitCount: number;
  interiorProjectId?: string;
  floorPlanPath?: string;
}
export interface Readiness {
  ready: boolean;
  errors: string[];
  warnings: string[];
  buildings: number;
  floors: number;
  unitTypes: number;
  units: number;
  invalidReferences: number;
  duplicateCodes: number;
  missingValues: number;
}
export interface StructureAdminRepository {
  listProjects(organizationId: string): Promise<ManagedProject[]>;
  createProject(
    organizationId: string,
    input: ProjectInput,
  ): Promise<ManagedProject>;
  updateProject(
    id: string,
    version: number,
    input: ProjectInput,
  ): Promise<ManagedProject>;
  validateProject(id: string): Promise<Readiness>;
  changeProjectStatus(
    id: string,
    version: number,
    status: ProjectStatus,
    reason: string,
    confirm: boolean,
  ): Promise<ManagedProject>;
  setCapabilities(
    id: string,
    version: number,
    inventory: boolean,
    visual: boolean,
  ): Promise<ManagedProject>;
  validateVisual(id: string): Promise<{ valid: boolean; errors: string[] }>;
  listBuildings(projectId: string): Promise<Building[]>;
  saveBuilding(input: {
    id?: string;
    projectId: string;
    expectedVersion?: number;
    code: string;
    name: string;
    displayOrder: number;
    active: boolean;
  }): Promise<Building>;
  listFloors(buildingId: string): Promise<Floor[]>;
  saveFloor(input: {
    id?: string;
    buildingId: string;
    expectedVersion?: number;
    code: string;
    label: string;
    floorNumber: number;
    displayOrder: number;
    heightMeters?: number;
    active: boolean;
  }): Promise<Floor>;
  previewFloors(
    buildingId: string,
    start: number,
    end: number,
    codePattern: string,
    labelPattern: string,
  ): Promise<{ items: Floor[]; conflicts: string[]; canConfirm: boolean }>;
  confirmFloors(
    buildingId: string,
    start: number,
    end: number,
    codePattern: string,
    labelPattern: string,
  ): Promise<number>;
  listUnitTypes(projectId: string): Promise<UnitType[]>;
  saveUnitType(input: {
    id?: string;
    projectId: string;
    expectedVersion?: number;
    code: string;
    name: string;
    description?: string;
    privateArea: number;
    totalArea?: number;
    bedrooms: number;
    suites: number;
    bathrooms?: number;
    parkingSpaces?: number;
    active: boolean;
    confirmImpact?: boolean;
  }): Promise<UnitType>;
  createUnit(input: {
    projectId: string;
    buildingId: string;
    floorId: string;
    unitTypeId: string;
    unitCode: string;
    externalReference?: string;
    orientation: string;
    viewType?: string;
    sunExposure?: string;
    currency: string;
    parkingSpaces: number;
    initialPrice?: number;
  }): Promise<{ id: string }>;
  updateUnit(input: {
    id: string;
    expectedVersion: number;
    buildingId: string;
    floorId: string;
    unitTypeId: string;
    externalReference?: string;
    orientation: string;
    viewType?: string;
    sunExposure?: string;
    currency: string;
    parkingSpaces: number;
  }): Promise<{ id: string }>;
}
