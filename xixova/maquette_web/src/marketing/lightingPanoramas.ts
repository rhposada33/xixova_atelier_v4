import type {LightingPresetId} from './lightingTimeline';

export type LightingPanorama={
  desktop:{avif:string;webp:string};
  mobile?:{avif:string;webp:string};
};

// Assets remain intentionally unconfigured until a future approved background
// is supplied. The preview then keeps its clean CSS-gradient fallback.
export const lightingPanoramas:Readonly<Partial<Record<LightingPresetId,LightingPanorama>>>={};
