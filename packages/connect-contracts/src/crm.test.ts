import {describe,it,expect} from 'vitest';
import {validateCrmFilters,crmStages} from './crm';
describe('CRM filters',()=>{it('rejects invalid stages and reversed dates',()=>{expect(()=>validateCrmFilters({status:'forged' as keyof typeof crmStages})).toThrow();expect(()=>validateCrmFilters({from:'2026-10-24T00:00:00Z',to:'2026-10-23T00:00:00Z'})).toThrow();});it('accepts scoped filters',()=>{expect(validateCrmFilters({personal:true,status:'proposal',search:'Teste'}).status).toBe('proposal');});});
