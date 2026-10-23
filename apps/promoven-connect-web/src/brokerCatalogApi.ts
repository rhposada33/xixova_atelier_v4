import { validateBrokerInventoryFilters, type BrokerCatalogDetail, type BrokerCatalogProject, type BrokerCatalogUnit, type BrokerInventoryFilters, type BrokerInventoryPage } from "@promoven/connect-contracts";
import { connectClient } from "./supabase";

function check(error: {code?: string; message: string} | null) {
  if (!error) return;
  if (error.code === "P0002" || error.code === "42501") throw new Error("Empreendimento indisponível ou acesso não autorizado.");
  if (error.code === "PT409") throw new Error("Os dados foram alterados. Atualize a página.");
  throw new Error(error.message);
}
export const brokerCatalogApi = {
  async projects(): Promise<BrokerCatalogProject[]> { const {data,error}=await connectClient().rpc("connect_broker_catalog_projects"); check(error); return data??[]; },
  async project(id:string): Promise<BrokerCatalogDetail> { const {data,error}=await connectClient().rpc("connect_broker_project_detail",{p_project_id:id}); check(error); return data; },
  async inventory(id:string,filters:BrokerInventoryFilters,priceVisible:boolean,offset=0): Promise<BrokerInventoryPage> {
    const {data,error}=await connectClient().rpc("connect_broker_inventory",{p_project_id:id,p_filters:validateBrokerInventoryFilters(filters,priceVisible),p_limit:20,p_offset:offset});check(error);return data;
  },
  async unit(projectId:string,unitId:string): Promise<BrokerCatalogUnit> { const {data,error}=await connectClient().rpc("connect_broker_unit_detail",{p_project_id:projectId,p_unit_id:unitId});check(error);return data; },
  async favorites(projectId:string): Promise<string[]> { const {data,error}=await connectClient().rpc("connect_broker_favorites",{p_project_id:projectId});check(error);return data??[]; },
  async favorite(projectId:string,unitId:string,saved:boolean): Promise<void> { const {error}=await connectClient().rpc("connect_set_broker_favorite",{p_project_id:projectId,p_unit_id:unitId,p_saved:saved});check(error); },
  async setPriceVisibility(projectId:string,version:number,visible:boolean): Promise<void> { const {error}=await connectClient().rpc("connect_set_broker_price_visibility",{p_project_id:projectId,p_expected_version:version,p_visible:visible});check(error); },
};
