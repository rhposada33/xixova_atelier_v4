import {describe,expect,it} from 'vitest';
import {LIGHTING_DAY_PORTION,LIGHTING_END_HOUR,LIGHTING_START_HOUR,advanceLightingCycle,clampLightingHour,cycleProgressForHour,formatLightingHour,hourForCycleProgress,lightingForCycleProgress,lightingForHour,selectedLightingPreset} from './lightingTimeline';

describe('lighting timeline',()=>{
  it('clamps and formats the continuous 08:00–20:00 range',()=>{expect(clampLightingHour(4)).toBe(LIGHTING_START_HOUR);expect(clampLightingHour(24)).toBe(LIGHTING_END_HOUR);expect(formatLightingHour(17.5)).toBe('17:30')});
  it('interpolates a visible state between presets',()=>{const state=lightingForHour(14.5);expect(state.hour).toBe(14.5);expect(state.keyIntensity).toBeGreaterThan(.48);expect(state.keyIntensity).toBeLessThan(3.5)});
  it('uses one timeline for presets and the autoplay cycle',()=>{expect(selectedLightingPreset(17.4)).toBe('sunset');expect(hourForCycleProgress(cycleProgressForHour(12))).toBeCloseTo(12,6)});
  it('returns from night to morning through a direct continuous cycle seam',()=>{const night=lightingForCycleProgress(LIGHTING_DAY_PORTION),seam=lightingForCycleProgress((LIGHTING_DAY_PORTION+1)/2),morning=lightingForCycleProgress(0);expect(night.hour).toBe(20);expect(seam.keyIntensity).toBeGreaterThan(night.keyIntensity);expect(seam.keyIntensity).toBeLessThan(morning.keyIntensity);expect(morning.hour).toBe(8);const before=hourForCycleProgress(.999),after=hourForCycleProgress(advanceLightingCycle(.999,32));expect(before).toBeGreaterThan(LIGHTING_START_HOUR);expect(after).toBeGreaterThanOrEqual(LIGHTING_START_HOUR);expect(after).toBeLessThanOrEqual(LIGHTING_END_HOUR)});
});
