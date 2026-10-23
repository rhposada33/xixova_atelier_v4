/** Server-to-server only. Original bytes never enter Storage. */
export type NormalizationRequest = { contentType: 'image/png'|'image/jpeg'|'image/webp'; bytes: Uint8Array };
export type NormalizationResponse = { contentType: 'image/png'; bytes: Uint8Array; sha256: string };
export type NormalizationFailure = 401 | 413 | 422 | 429 | 503;
