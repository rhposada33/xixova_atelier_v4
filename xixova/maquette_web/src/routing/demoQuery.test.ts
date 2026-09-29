import {describe,expect,it} from 'vitest';
import {demoUrl,legacyDemoTarget,normalizeDemoQuery} from './demoQuery';
describe('queries da demonstração',()=>{
  it('preserva somente parâmetros reconhecidos e válidos',()=>expect(normalizeDemoQuery('?vista=edificio&unidad=1203&x=<script>').toString()).toBe('vista=edificio&unidad=1203'));
  it('normaliza números e rejeita valores desconhecidos',()=>expect(normalizeDemoQuery('?piso=08&maqueta=inexistente&cliente=outro').toString()).toBe('piso=8'));
  it('preserva os seletores visuais suportados',()=>expect(normalizeDemoQuery('?visual=v1&visual=v2').toString()).toBe('visual=v1'));
  it('mantém o fallback visual histórico',()=>expect(normalizeDemoQuery('?visual=original').toString()).toBe('visual=original'));
  it('redireciona apenas raízes legacy válidas',()=>{expect(legacyDemoTarget('?vista=edificio&unidad=1203')).toBe('/demo?vista=edificio&unidad=1203');expect(legacyDemoTarget('?utm_source=teste')).toBeNull()});
  it('gera a URL canônica da demo',()=>expect(demoUrl('vista=interior&maqueta=terraza_luz')).toBe('/demo?vista=interior&maqueta=terraza_luz'));
});
