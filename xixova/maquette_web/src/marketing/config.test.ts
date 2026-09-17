import {describe,expect,it} from 'vitest';import {commercialConfig,contactUrl} from './config';
describe('configuração comercial',()=>{it('não publica contato fictício',()=>{expect(contactUrl).toBeUndefined();expect(commercialConfig.demoUrl).toBe('/demo')})});
