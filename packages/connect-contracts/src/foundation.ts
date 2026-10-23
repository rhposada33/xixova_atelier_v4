export type MembershipRole = "organization_admin" | "sales_manager";
export interface ConnectProfile { userId: string; fullName: string; active: boolean; }
export interface ConnectOrganization { id: string; name: string; slug: string; status: "active" | "suspended"; version: number; }
export interface ConnectMembership { organizationId: string; userId: string; role: MembershipRole; active: boolean; version: number; }
