export type PrivacyPhase = 'requested' | 'verified' | 'approved' | 'prepared' | 'completed';
export type PrivacyPlanAction = 'request' | 'verify' | 'approve' | 'hold';
export interface PrivacyCase { id: string; leadId: string|null; ticket: string; phase: PrivacyPhase; hold: boolean; independentApproval: boolean; result: Record<string,unknown>; }
export interface PrivacyPreview { leadId: string; version: number; executionEnabled: false; hold: boolean; activityRecords: number; resourceRecords: number; relatedLeads: number; directFields: string[]; indirectReferences: string[]; reason: string; }
