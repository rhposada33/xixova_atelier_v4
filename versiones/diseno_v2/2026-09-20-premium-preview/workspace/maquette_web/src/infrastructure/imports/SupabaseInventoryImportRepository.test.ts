import { describe, expect, it, vi } from "vitest";
import { SupabaseInventoryImportRepository } from "./SupabaseInventoryImportRepository";

const row = { unit_code:"A",building_code:"B",floor_code:"F",unit_type_code:"T",external_reference:"",orientation:"north",view_type:"",solar_exposure:"",parking_spaces:"1",price:"",currency:"BRL",status:"",published:"",expected_version:"" };
const response = { id:"i1",project_id:"p1",mode:"create_only",status:"validated",operation_id:"op1",payload_hash:"hash",expires_at:"2099-01-01",row_count:1,new_count:1,update_count:0,unchanged_count:0,warning_count:0,error_count:0 };

describe("SupabaseInventoryImportRepository", () => {
  it("faz dry-run por RPC e preserva o operation_id", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const client = { rpc: vi.fn().mockResolvedValue({ data: response, error: null }), from: vi.fn(() => ({ select: () => ({ eq: () => ({ order }) }) })) } as any;
    const result = await new SupabaseInventoryImportRepository(client).preview("p1", "create_only", [row], 10, "op1");
    expect(result.operationId).toBe("op1");
    expect(client.rpc).toHaveBeenCalledWith("admin_preview_inventory_import", expect.objectContaining({ p_operation_id: "op1", p_payload_bytes: 10 }));
  });
  it("confirma exatamente o payload, hash e operação validados", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: { ...response, status:"completed" }, error: null }) } as any;
    const repo = new SupabaseInventoryImportRepository(client);
    await repo.confirm({ id:"i1",projectId:"p1",mode:"create_only",status:"validated",operationId:"op1",payloadHash:"hash",expiresAt:"2099",rows:[row],issues:[],rowCount:1,newCount:1,updateCount:0,unchangedCount:0,warningCount:0,errorCount:0 });
    expect(client.rpc).toHaveBeenCalledWith("admin_confirm_inventory_import", { p_import_id:"i1",p_operation_id:"op1",p_rows:[row],p_expected_hash:"hash" });
  });
  it("mapeia o conflito sin exponer SQL", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data:null,error:{ details:'{"code":"version_conflict"}',message:"SQL secreto" } }) } as any;
    await expect(new SupabaseInventoryImportRepository(client).list("p1")).rejects.toMatchObject({ code:"version_conflict",message:"Os dados mudaram após a validação. Execute um novo dry-run." });
  });
});
