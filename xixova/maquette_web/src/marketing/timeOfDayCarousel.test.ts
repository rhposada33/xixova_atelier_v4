import {describe,expect,it} from 'vitest';
import {mayAutoplay,nextTimeOfDay,previousTimeOfDay,remainingAfterSuspend,TIME_OF_DAY_CYCLE_MS} from './timeOfDayCarousel';

describe('time of day carousel state',()=>{
  it('starts and cycles from Manhã through all four moments',()=>{expect(nextTimeOfDay(0)).toBe(1);expect(nextTimeOfDay(3)).toBe(0);expect(previousTimeOfDay(0)).toBe(3)});
  it('preserves the exact remaining duration while suspended',()=>{expect(remainingAfterSuspend(TIME_OF_DAY_CYCLE_MS,1_900)).toBe(3_100);expect(remainingAfterSuspend(400,900)).toBe(0)});
  it('autoplays only when the active image is ready and no suspension applies',()=>{expect(mayAutoplay({reduced:false,paused:false,visible:true,inView:true,activeReady:true,pending:false})).toBe(true);for(const blocked of [{reduced:true},{paused:true},{visible:false},{inView:false},{activeReady:false},{pending:true}])expect(mayAutoplay({reduced:false,paused:false,visible:true,inView:true,activeReady:true,pending:false,...blocked})).toBe(false)});
});
