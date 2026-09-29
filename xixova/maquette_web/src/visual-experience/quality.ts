import type {VisualQualityProfile,VisualQualityTier} from './types';

export function selectVisualQuality(width:number, devicePixelRatio:number, requested?:VisualQualityTier):VisualQualityProfile {
  const tier = requested === 'premium' ? 'premium' : width <= 850 ? 'mobile' : 'standard';
  const profile:Record<VisualQualityTier,Omit<VisualQualityProfile,'tier'>> = {
    mobile: {maxPixelRatio:1.25,horizonInstances:12},
    standard: {maxPixelRatio:1.5,horizonInstances:20},
    premium: {maxPixelRatio:2,horizonInstances:28},
  };
  return {tier,...profile[tier],maxPixelRatio:Math.min(devicePixelRatio,profile[tier].maxPixelRatio)};
}
