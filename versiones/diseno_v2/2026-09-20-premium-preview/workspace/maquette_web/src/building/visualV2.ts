/** V2 is the public default. The original remains an explicit, reversible fallback. */
const requestedVisual = new URLSearchParams(location.search).get('visual');
export const visualV2 = requestedVisual !== 'original';
