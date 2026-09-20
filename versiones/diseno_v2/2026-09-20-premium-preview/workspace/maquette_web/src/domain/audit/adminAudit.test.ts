import {describe,expect,it} from 'vitest';
import {adminActionLabel,parseBrazilianDate,redactAuditText,visibleAuditValues} from './adminAudit';
describe('atividade administrativa segura',()=>{
  it('mapeia códigos reais para português e desconhecidos para etiqueta neutra',()=>{
    expect(adminActionLabel('invitation.accepted')).toBe('Convite aceito');
    expect(adminActionLabel('inventory_import.completed')).toBe('Importação concluída');
    expect(adminActionLabel('unexpected.internal')).toBe('Atividade administrativa');
  });
  it('mostra apenas campos permitidos e redige emails',()=>{
    expect(visibleAuditValues({status:'accepted',role:'organization_admin',email:'private@example.com',token_hash:'x',operation_id:'x',name:'private@example.com',nested:{secret:'x'}}))
      .toEqual([{label:'Estado',value:'Aceito'},{label:'Perfil',value:'Administrador'},{label:'Nome',value:'[redigido]'}]);
    expect(redactAuditText('Contato private@example.com')).toBe('Contato [redigido]');
  });
  it('interpreta datas brasileiras e rejeita datas impossíveis',()=>{
    expect(parseBrazilianDate('15/09/2026')).toBe('2026-09-15T03:00:00.000Z');
    expect(()=>parseBrazilianDate('31/02/2026')).toThrow('Data inválida.');
    expect(()=>parseBrazilianDate('2026-09-15')).toThrow('dd/mm/aaaa');
  });
});
