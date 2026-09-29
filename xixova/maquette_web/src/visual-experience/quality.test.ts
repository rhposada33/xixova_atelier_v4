import {describe,expect,it} from 'vitest';
import {selectVisualQuality} from './quality';

describe('perfis de qualidade Visual V2',()=>{
  it('limita DPR e densidade por perfil',()=>{
    expect(selectVisualQuality(390,3)).toMatchObject({tier:'mobile',maxPixelRatio:1.25,horizonInstances:12});
    expect(selectVisualQuality(1440,3)).toMatchObject({tier:'standard',maxPixelRatio:1.5,horizonInstances:20});
    expect(selectVisualQuality(1440,3,'premium')).toMatchObject({tier:'premium',maxPixelRatio:2,horizonInstances:28});
  });
});
