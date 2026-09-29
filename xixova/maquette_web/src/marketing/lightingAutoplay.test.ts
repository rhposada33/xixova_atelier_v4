import {describe,expect,it} from 'vitest';
import {AUTOPLAY_RESUME_MS,resolveTemporaryPause,shouldAutoplay,temporarilyPause,toggleExplicitPause} from './lightingAutoplay';

describe('lighting autoplay',()=>{
  it('starts the five-second delay from the latest temporary interaction',()=>{const first=temporarilyPause({mode:'running',resumeAt:null},1_000);const latest=temporarilyPause(first,2_750);expect(latest).toEqual({mode:'temporary',resumeAt:2_750+AUTOPLAY_RESUME_MS});expect(resolveTemporaryPause(latest,7_749)).toEqual(latest);expect(resolveTemporaryPause(latest,7_750)).toEqual({mode:'running',resumeAt:null})});
  it('does not let a temporary interaction resume an explicit pause',()=>{const explicit=toggleExplicitPause({mode:'temporary',resumeAt:9_000});expect(explicit).toEqual({mode:'explicit',resumeAt:null});expect(temporarilyPause(explicit,9_001)).toEqual(explicit);expect(toggleExplicitPause(explicit)).toEqual({mode:'running',resumeAt:null})});
  it('keeps an in-progress interaction paused until it ends',()=>{const active=temporarilyPause({mode:'running',resumeAt:null},100,false);expect(active).toEqual({mode:'temporary',resumeAt:Infinity});expect(resolveTemporaryPause(active,100_000)).toEqual(active)});
  it('honors reduced motion even when the timeline is otherwise running',()=>{expect(shouldAutoplay({mode:'running',resumeAt:null},false)).toBe(true);expect(shouldAutoplay({mode:'running',resumeAt:null},true)).toBe(false);expect(shouldAutoplay({mode:'explicit',resumeAt:null},false)).toBe(false)});
});
