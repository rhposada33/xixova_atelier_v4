import {describe,expect,it} from 'vitest';
import {ROOM_PANEL_COUNT,createNightPattern,interpolatedArrival,nightPresence,staticActivityTime} from './nightPattern';

describe('night room pattern',()=>{
  it('is deterministic and keeps the occupied rooms within the approved night range',()=>{const first=createNightPattern(),second=createNightPattern();expect(first).toEqual(second);expect(first).toHaveLength(ROOM_PANEL_COUNT);const active=first.filter(room=>room.occupied).length;expect(active).toBeGreaterThanOrEqual(Math.ceil(ROOM_PANEL_COUNT*.35));expect(active).toBeLessThanOrEqual(Math.floor(ROOM_PANEL_COUNT*.55));expect(first.filter(room=>room.television).length).toBeGreaterThan(0)});
  it('fades the independently staggered pattern through dusk and back to day',()=>{const room=createNightPattern()[0];expect(interpolatedArrival(room,0)).toBe(0);expect(interpolatedArrival(room,1)).toBe(1);expect(nightPresence(.04)).toBe(0);expect(nightPresence(.18)).toBeCloseTo(.5);expect(nightPresence(.32)).toBe(1)});
  it('keeps the animated pattern static for reduced motion',()=>{expect(staticActivityTime(true,42)).toBe(0);expect(staticActivityTime(false,42)).toBe(42)});
});
