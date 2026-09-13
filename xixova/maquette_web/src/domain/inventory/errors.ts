export type InventoryErrorCode='configuration'|'network'|'invalid_data'|'not_found'|'aborted';
export class InventoryError extends Error {
  constructor(public readonly code:InventoryErrorCode,message:string,options?:{cause?:unknown}){super(message,options);this.name='InventoryError';}
}
export const inventoryErrorMessage=(error:unknown)=>error instanceof InventoryError?error.message:'Não foi possível carregar a disponibilidade.';
