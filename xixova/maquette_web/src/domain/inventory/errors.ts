export type InventoryErrorCode='configuration'|'network'|'invalid_data'|'not_found'|'aborted'|'forbidden'|'inactive_user'|'version_conflict'|'status_conflict'|'invalid_transition'|'invalid_input';
export class InventoryError extends Error {
  constructor(public readonly code:InventoryErrorCode,message:string,options?:{cause?:unknown}){super(message,options);this.name='InventoryError';}
}
export const inventoryErrorMessage=(error:unknown)=>error instanceof InventoryError?error.message:'Não foi possível carregar a disponibilidade.';
