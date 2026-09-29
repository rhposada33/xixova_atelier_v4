import type {VisualExperienceVersion} from './types';

export type VisualExperienceInput = {
  search?: string;
  mode?: string;
  appEnvironment?: string;
  requestedByEnvironment?: string;
  dev?: boolean;
};

export const previewContext = ({mode,appEnvironment,dev}:VisualExperienceInput) =>
  dev === true || mode === 'homologation' || appEnvironment === 'homologation' || appEnvironment === 'staging';

/** Resolves only the new ambient presentation. The legacy `visual=original` keeps its existing fallback. */
export function resolveVisualExperience(input:VisualExperienceInput = {}):VisualExperienceVersion {
  const requested = new URLSearchParams(input.search || '').get('visual');
  if (requested === 'v1' || requested === 'original') return 'v1';
  if (requested && requested !== 'v2') return 'v1';
  const preview = previewContext(input);
  if (requested === 'v2') return preview ? 'v2' : 'v1';
  return preview && input.requestedByEnvironment === 'v2' ? 'v2' : 'v1';
}

const runtimeSearch = typeof location === 'undefined' ? '' : location.search;
export const activeVisualExperience = resolveVisualExperience({
  search: runtimeSearch,
  mode: import.meta.env.MODE,
  appEnvironment: import.meta.env.VITE_APP_ENV,
  requestedByEnvironment: import.meta.env.VITE_VISUAL_EXPERIENCE_VERSION,
  dev: import.meta.env.DEV,
});
