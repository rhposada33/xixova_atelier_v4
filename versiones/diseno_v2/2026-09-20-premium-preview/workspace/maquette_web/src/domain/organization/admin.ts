export type OrganizationStatus='draft'|'active'|'suspended'|'archived';
export type MembershipRole='organization_admin'|'seller'|'viewer';
export type InvitationStatus='pending_delivery'|'sent'|'accepted'|'delivery_failed'|'expired'|'revoked';
export interface ManagedOrganization{id:string;name:string;legalName?:string;slug:string;country:string;state?:string;city?:string;timezone:string;currency:string;status:OrganizationStatus;version:number;memberCount:number;projectCount:number;}
export interface OrganizationInput{name:string;legalName?:string;slug:string;country:string;state?:string;city?:string;timezone:string;currency:string;}
export interface ManagedMember{userId:string;fullName?:string;role:MembershipRole;active:boolean;joinedAt:string;version:number;}
export interface OrganizationInvitation{id:string;organizationId:string;email:string;role:MembershipRole;status:InvitationStatus;expiresAt:string;sentAt?:string;deliveryAttempts:number;deliveryErrorCode?:string;version:number;}
export interface Page<T>{items:T[];total:number;page:number;pageSize:number;}
export interface OrganizationAdminRepository{
  listOrganizations(query:{page:number;pageSize:number;search?:string;status?:OrganizationStatus}):Promise<Page<ManagedOrganization>>;
  createOrganization(input:OrganizationInput):Promise<ManagedOrganization>;
  updateOrganization(id:string,expectedVersion:number,input:OrganizationInput):Promise<ManagedOrganization>;
  changeStatus(id:string,expectedVersion:number,status:Exclude<OrganizationStatus,'draft'>,reason:string):Promise<ManagedOrganization>;
}
export interface MembershipAdminRepository{
  listMembers(organizationId:string,page:number,pageSize:number):Promise<Page<ManagedMember>>;
  updateMembership(command:{organizationId:string;userId:string;expectedVersion:number;role:MembershipRole;active:boolean;remove?:boolean}):Promise<void>;
  listInvitations(organizationId:string):Promise<OrganizationInvitation[]>;
  invite(command:{organizationId:string;email:string;role:MembershipRole;operationId:string}):Promise<{status:InvitationStatus;invitationId:string}>;
  retryInvitation(command:{invitationId:string;expectedVersion:number;operationId:string}):Promise<{status:InvitationStatus;invitationId:string}>;
  revokeInvitation(invitationId:string,expectedVersion:number,reason:string):Promise<void>;
  accept(token:string):Promise<{organizationId:string;role:MembershipRole}>;
}
