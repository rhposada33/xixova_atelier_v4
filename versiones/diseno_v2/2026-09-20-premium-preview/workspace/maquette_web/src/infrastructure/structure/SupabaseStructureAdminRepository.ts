import type { SupabaseClient } from "@supabase/supabase-js";
import {
  InventoryError,
  type InventoryErrorCode,
} from "../../domain/inventory";
import type {
  Building,
  Floor,
  ManagedProject,
  ProjectInput,
  Readiness,
  StructureAdminRepository,
  UnitType,
} from "../../domain/structure";
const num = (v: unknown) => (v == null ? undefined : Number(v));
const project = (r: any): ManagedProject => ({
  id: r.id,
  organizationId: r.organization_id,
  name: r.name,
  slug: r.slug,
  description: r.description ?? undefined,
  status: r.status,
  country: r.country,
  state: r.state ?? undefined,
  city: r.city ?? undefined,
  address: r.address ?? undefined,
  latitude: num(r.latitude),
  longitude: num(r.longitude),
  timezone: r.timezone,
  currency: r.currency,
  estimatedDeliveryDate: r.estimated_delivery_date ?? undefined,
  northOffsetDegrees: Number(r.north_offset_degrees),
  publicInventoryEnabled: r.public_inventory_enabled,
  visualExperienceEnabled: r.visual_experience_enabled,
  version: Number(r.version),
  buildingCount: Number(r.building_count ?? 0),
  floorCount: Number(r.floor_count ?? 0),
  unitTypeCount: Number(r.unit_type_count ?? 0),
  unitCount: Number(r.unit_count ?? 0),
});
const building = (r: any): Building => ({
  id: r.id,
  projectId: r.project_id,
  code: r.code,
  name: r.name,
  displayOrder: r.display_order,
  active: r.active,
  version: Number(r.version),
  floorCount: Number(r.floor_count ?? 0),
  unitCount: Number(r.unit_count ?? 0),
  modelPath: r.model_path,
});
const floor = (r: any): Floor => ({
  id: r.id,
  buildingId: r.building_id,
  code: r.code,
  label: r.label,
  floorNumber: r.floor_number,
  displayOrder: r.display_order,
  heightMeters: num(r.height_meters),
  active: r.active,
  version: Number(r.version),
  unitCount: Number(r.unit_count ?? 0),
  modelObjectId: r.model_object_id ?? undefined,
});
const unitType = (r: any): UnitType => ({
  id: r.id,
  projectId: r.project_id,
  code: r.code,
  name: r.name,
  description: r.description ?? undefined,
  privateArea: Number(r.private_area),
  totalArea: num(r.total_area),
  bedrooms: r.bedrooms,
  suites: r.suites,
  bathrooms: num(r.bathrooms),
  parkingSpaces: num(r.parking_spaces),
  active: r.active,
  version: Number(r.version),
  unitCount: Number(r.unit_count ?? 0),
  interiorProjectId: r.interior_project_id ?? undefined,
  floorPlanPath: r.floor_plan_path ?? undefined,
});
const messages: Record<string, string> = {
  not_found: "Recurso não encontrado.",
  forbidden: "Você não possui permissão.",
  inactive_user: "Seu acesso está inativo.",
  version_conflict:
    "Este registro foi alterado por outro usuário. Recarregue antes de salvar.",
  invalid_input: "Revise os dados informados.",
  invalid_transition: "Esta transição não é permitida.",
  dependency_conflict: "Existem dependências ativas.",
  duplicate_code: "Este código já está em uso.",
  project_not_ready: "O projeto ainda possui pendências estruturais.",
};
function fail(e: any): never {
  let code = "unknown";
  try {
    code = JSON.parse(e?.details ?? "{}").code ?? code;
  } catch {}
  throw new InventoryError(
    code as InventoryErrorCode,
    messages[code] ?? "Não foi possível concluir a operação.",
  );
}
const args = (i: ProjectInput) => ({
  p_name: i.name,
  p_slug: i.slug,
  p_description: i.description ?? "",
  p_country: i.country,
  p_state: i.state ?? "",
  p_city: i.city ?? "",
  p_address: i.address ?? "",
  p_latitude: i.latitude ?? null,
  p_longitude: i.longitude ?? null,
  p_timezone: i.timezone,
  p_currency: i.currency,
  p_estimated_delivery_date: i.estimatedDeliveryDate ?? null,
  p_north_offset_degrees: i.northOffsetDegrees,
});
export class SupabaseStructureAdminRepository implements StructureAdminRepository {
  constructor(private c: SupabaseClient) {}
  private async rpc(name: string, p: any) {
    const { data, error } = await this.c.rpc(name, p);
    if (error) fail(error);
    return data;
  }
  async listProjects(organizationId: string): Promise<ManagedProject[]> {
    return (
      (await this.rpc("admin_list_projects", {
        p_organization_id: organizationId,
        p_page: 1,
        p_page_size: 100,
        p_search: null,
        p_status: null,
      })) ?? []
    ).map(project);
  }
  async createProject(organizationId: string, input: ProjectInput) {
    return project(
      await this.rpc("admin_create_project", {
        p_organization_id: organizationId,
        ...args(input),
      }),
    );
  }
  async updateProject(id: string, version: number, input: ProjectInput) {
    return project(
      await this.rpc("admin_update_project", {
        p_id: id,
        p_expected_version: version,
        ...args(input),
      }),
    );
  }
  async validateProject(id: string) {
    return (await this.rpc("admin_validate_project_readiness", {
      p_project_id: id,
    })) as Readiness;
  }
  async changeProjectStatus(
    id: string,
    version: number,
    status: any,
    reason: string,
    confirm: boolean,
  ) {
    return project(
      await this.rpc("admin_change_project_status", {
        p_id: id,
        p_expected_version: version,
        p_new_status: status,
        p_reason: reason,
        p_confirm: confirm,
      }),
    );
  }
  async setCapabilities(
    id: string,
    version: number,
    inventory: boolean,
    visual: boolean,
  ) {
    return project(
      await this.rpc("admin_set_project_capabilities", {
        p_id: id,
        p_expected_version: version,
        p_public_inventory_enabled: inventory,
        p_visual_experience_enabled: visual,
      }),
    );
  }
  async validateVisual(id: string) {
    return await this.rpc("admin_validate_project_visual", {
      p_project_id: id,
    });
  }
  async listBuildings(projectId: string) {
    return (
      (await this.rpc("admin_list_buildings", { p_project_id: projectId })) ??
      []
    ).map(building);
  }
  async saveBuilding(i: any) {
    return building(
      await this.rpc("admin_save_building", {
        p_id: i.id ?? null,
        p_project_id: i.projectId,
        p_expected_version: i.expectedVersion ?? null,
        p_code: i.code,
        p_name: i.name,
        p_display_order: i.displayOrder,
        p_active: i.active,
      }),
    );
  }
  async listFloors(buildingId: string) {
    return (
      (await this.rpc("admin_list_floors", { p_building_id: buildingId })) ?? []
    ).map(floor);
  }
  async saveFloor(i: any) {
    return floor(
      await this.rpc("admin_save_floor", {
        p_id: i.id ?? null,
        p_building_id: i.buildingId,
        p_expected_version: i.expectedVersion ?? null,
        p_code: i.code,
        p_label: i.label,
        p_floor_number: i.floorNumber,
        p_display_order: i.displayOrder,
        p_height_meters: i.heightMeters ?? null,
        p_active: i.active,
      }),
    );
  }
  async previewFloors(
    buildingId: string,
    start: number,
    end: number,
    codePattern: string,
    labelPattern: string,
  ) {
    return await this.rpc("admin_preview_floor_generation", {
      p_building_id: buildingId,
      p_start: start,
      p_end: end,
      p_code_pattern: codePattern,
      p_label_pattern: labelPattern,
    });
  }
  async confirmFloors(
    buildingId: string,
    start: number,
    end: number,
    codePattern: string,
    labelPattern: string,
  ) {
    return await this.rpc("admin_confirm_floor_generation", {
      p_building_id: buildingId,
      p_start: start,
      p_end: end,
      p_code_pattern: codePattern,
      p_label_pattern: labelPattern,
      p_operation_id: crypto.randomUUID(),
    });
  }
  async listUnitTypes(projectId: string) {
    return (
      (await this.rpc("admin_list_unit_types", { p_project_id: projectId })) ??
      []
    ).map(unitType);
  }
  async saveUnitType(i: any) {
    return unitType(
      await this.rpc("admin_save_unit_type_confirmed", {
        p_id: i.id ?? null,
        p_project_id: i.projectId,
        p_expected_version: i.expectedVersion ?? null,
        p_code: i.code,
        p_name: i.name,
        p_description: i.description ?? "",
        p_private_area: i.privateArea,
        p_total_area: i.totalArea ?? null,
        p_bedrooms: i.bedrooms,
        p_suites: i.suites,
        p_bathrooms: i.bathrooms,
        p_parking_spaces: i.parkingSpaces ?? null,
        p_active: i.active,
        p_confirm_impact: i.confirmImpact ?? false,
      }),
    );
  }
  async createUnit(i: any) {
    return await this.rpc("admin_create_structural_unit", {
      p_project_id: i.projectId,
      p_building_id: i.buildingId,
      p_floor_id: i.floorId,
      p_unit_type_id: i.unitTypeId,
      p_unit_code: i.unitCode,
      p_external_reference: i.externalReference ?? "",
      p_orientation: i.orientation,
      p_view_type: i.viewType ?? null,
      p_sun_exposure: i.sunExposure ?? null,
      p_currency: i.currency,
      p_parking_spaces: i.parkingSpaces,
      p_initial_price: i.initialPrice ?? null,
      p_initial_status: "available",
      p_initial_published: false,
    });
  }
  async updateUnit(i: any) {
    return await this.rpc("admin_update_structural_unit", {
      p_id: i.id,
      p_expected_version: i.expectedVersion,
      p_building_id: i.buildingId,
      p_floor_id: i.floorId,
      p_unit_type_id: i.unitTypeId,
      p_external_reference: i.externalReference ?? "",
      p_orientation: i.orientation,
      p_view_type: i.viewType ?? null,
      p_sun_exposure: i.sunExposure ?? null,
      p_currency: i.currency,
      p_parking_spaces: i.parkingSpaces,
    });
  }
}
