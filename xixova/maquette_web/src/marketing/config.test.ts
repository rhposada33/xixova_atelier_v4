import {afterEach,describe,expect,it,vi} from 'vitest';
import {commercialConfig,contactUrl} from './config';

afterEach(()=>{vi.unstubAllEnvs();vi.resetModules()});
describe('configuração comercial',()=>{
  it('não publica contato fictício',()=>{expect(contactUrl).toBeUndefined();expect(commercialConfig.demoUrl).toBe('/demo')});
  it('não habilita produção apenas com URL e flag',async()=>{
    vi.stubEnv('VITE_APP_ENV','production');vi.stubEnv('VITE_PROMOVEN_LEADS_ENABLED','true');vi.stubEnv('VITE_PROMOVEN_LEADS_ENDPOINT','https://example.test/lead');
    const {commercialLeadsEnabled}=await import('./config');
    expect(commercialLeadsEnabled).toBe(false);
  });
  it('permite staging isolado e exige HTTPS e dados legais em produção',async()=>{
    vi.stubEnv('VITE_APP_ENV','staging');vi.stubEnv('VITE_PROMOVEN_LEADS_ENABLED','true');vi.stubEnv('VITE_PROMOVEN_LEADS_ENDPOINT','http://127.0.0.1:8000/');
    expect((await import('./config')).commercialLeadsEnabled).toBe(true);
    vi.resetModules();vi.stubEnv('VITE_APP_ENV','production');
    vi.stubEnv('VITE_PROMOVEN_LEGAL_ENTITY','Promoven Teste');vi.stubEnv('VITE_PROMOVEN_CNPJ','00.000.000/0000-00');vi.stubEnv('VITE_PROMOVEN_ADDRESS','Rua Teste');vi.stubEnv('VITE_PROMOVEN_PRIVACY_CONTACT','privacidade@example.test');vi.stubEnv('VITE_PROMOVEN_PRIVACY_APPROVED','true');
    expect((await import('./config')).commercialLeadsEnabled).toBe(false);
    vi.resetModules();vi.stubEnv('VITE_PROMOVEN_LEADS_ENDPOINT','https://example.test/lead');
    expect((await import('./config')).commercialLeadsEnabled).toBe(true);
  });
});
