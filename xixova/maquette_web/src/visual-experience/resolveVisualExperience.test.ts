import {describe,expect,it} from 'vitest';
import {resolveVisualExperience} from './resolveVisualExperience';

describe('selector da ambientação Visual V2',()=>{
  it('mantém V1 por padrão e em produção',()=>{
    expect(resolveVisualExperience()).toBe('v1');
    expect(resolveVisualExperience({search:'?visual=v2',mode:'production',appEnvironment:'production'})).toBe('v1');
    expect(resolveVisualExperience({requestedByEnvironment:'v2',mode:'production',appEnvironment:'production'})).toBe('v1');
  });
  it('aceita V2 somente em contextos de prévia',()=>{
    expect(resolveVisualExperience({search:'?visual=v2',dev:true})).toBe('v2');
    expect(resolveVisualExperience({search:'?visual=v2',mode:'homologation'})).toBe('v2');
    expect(resolveVisualExperience({requestedByEnvironment:'v2',appEnvironment:'staging'})).toBe('v2');
  });
  it('mantém os retornos seguros e a compatibilidade histórica',()=>{
    expect(resolveVisualExperience({search:'?visual=v1',dev:true,requestedByEnvironment:'v2'})).toBe('v1');
    expect(resolveVisualExperience({search:'?visual=original',dev:true,requestedByEnvironment:'v2'})).toBe('v1');
    expect(resolveVisualExperience({search:'?visual=desconhecido',dev:true,requestedByEnvironment:'v2'})).toBe('v1');
  });
});
