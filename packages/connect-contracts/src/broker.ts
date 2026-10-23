export type BrokerVerification = "pending" | "verified" | "rejected";
export type BrokerAccessStatus = "invited" | "active" | "suspended" | "revoked";
export type BrokerInvitationStatus = "pending" | "accepted" | "expired" | "cancelled";

export interface BrokerProfileInput { displayName: string; professionalEmail: string; professionalPhone: string; creciNumber: string; creciState: string; }
export interface BrokerProfile extends BrokerProfileInput { userId: string; verificationStatus: BrokerVerification; }
export interface BrokerAccess { id: string; organizationId: string; projectId: string; brokerUserId: string; status: BrokerAccessStatus; verificationStatus: BrokerVerification; version: number; reason: string | null; }
export interface BrokerInvitation { id: string; organizationId: string; projectId: string; invitedEmail: string; status: BrokerInvitationStatus; expiresAt: string; version: number; }
export interface BrokerProject { projectId: string; organizationId: string; organizationName: string; name: string; city: string; state: string; status: BrokerAccessStatus; }

export function parseBrokerProfile(value: unknown): BrokerProfileInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Perfil inválido.");
  const input = value as Record<string,unknown>;
  const fields = ["displayName","professionalEmail","professionalPhone","creciNumber","creciState"];
  if (Object.keys(input).some(k=>!fields.includes(k))) throw new Error("Campo de perfil não permitido.");
  const get = (key:string,max:number) => { const v=input[key]; if(typeof v!=="string"||!v.trim()||v.trim().length>max)throw new Error(`Campo ${key} inválido.`);return v.trim(); };
  const displayName=get("displayName",160);const professionalEmail=get("professionalEmail",254).toLowerCase();const professionalPhone=get("professionalPhone",30);const creciNumber=get("creciNumber",30).toUpperCase();const creciState=get("creciState",2).toUpperCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(professionalEmail)||!/^[A-Z0-9./-]{3,30}$/.test(creciNumber)||!/^[A-Z]{2}$/.test(creciState)||professionalPhone.length<8)throw new Error("Dados profissionais inválidos.");
  return {displayName,professionalEmail,professionalPhone,creciNumber,creciState};
}

export type MailDeliveryState = "pending" | "processing" | "sent" | "retry" | "failed" | "cancelled";
export interface InvitationDelivery { invitationId: string; state: MailDeliveryState; attempts: number; nextAttemptAt: string; code: string | null; sentAt: string | null; }
