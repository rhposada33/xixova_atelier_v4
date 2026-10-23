export interface PublicUnit { code:string; floor?:number; type?:string; bedrooms?:number; bathrooms?:number; parkingSpaces?:number; areaM2?:string; priceBRL?:string; status?:string }
export interface PublicProject { publicSlug:string; name:string; city:string; state:string; description?:string; units:PublicUnit[] }
export interface PublicShare { project:PublicProject; unitCode?:string|null; broker:{name:string;creciNumber:string;creciState:string} }
export interface BrokerShareLink { id:string; projectId:string; projectName:string; unitId:string|null; unitCode:string|null; status:"active"|"revoked"|"invalidated"|"expired"; expiresAt:string; createdAt:string; version:number }
export interface ConnectLead { id:string; projectId:string; projectName:string; unitCode:string|null; buyerName:string; contactChannel:"email"|"phone"; contactValue:string; source:"public"|"broker_link"; status:"new"; brokerName:string|null; createdAt:string }
export interface InterestPayload { buyerName:string;contactChannel:"email"|"phone";contactValue:string;message:string;unitCode:string;privacyNoticeVersion:"2026-10-23" }
