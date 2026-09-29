import {describe,expect,it} from 'vitest';
import {normalizeWhatsapp} from './localLead';
import {setMarketingAnalytics,trackMarketingEvent} from './analytics';
describe('lead local',()=>{
  it('normaliza WhatsApp brasileiro sin imponer máscara',()=>{expect(normalizeWhatsapp('(11) 99999-9999')).toBe('+5511999999999');expect(normalizeWhatsapp('+55 11 99999-9999')).toBe('+5511999999999');expect(normalizeWhatsapp('')).toBe('')});
  it('emite únicamente el nombre del evento y tolera falta de proveedor',()=>{expect(()=>trackMarketingEvent('lead_form_submit')).not.toThrow();const events:string[]=[];setMarketingAnalytics(event=>events.push(event));trackMarketingEvent('lead_form_success');expect(events).toEqual(['lead_form_success']);setMarketingAnalytics()});
});
