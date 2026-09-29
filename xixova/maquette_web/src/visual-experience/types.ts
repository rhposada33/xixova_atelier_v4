import type * as THREE from 'three';

export type VisualExperienceVersion = 'v1' | 'v2';
export type VisualLightingMode = 'neutral_day' | 'warm_dusk';
export type VisualQualityTier = 'mobile' | 'standard' | 'premium';

export type VisualQualityProfile = {
  tier: VisualQualityTier;
  maxPixelRatio: number;
  horizonInstances: number;
};

export type VisualExperienceController = {
  update(timeSeconds: number, mode: VisualLightingMode, camera: THREE.Camera): void;
  dispose(): void;
  diagnostics: Readonly<{ profile: VisualQualityTier; resources: number }>;
};
