export type LeadFormData={name:string;company:string;role:string;whatsapp:string;email:string;cityState:string;unitsRange:string;launchWindow:string;model3dStatus:string;message:string;consent:boolean};
export type LeadSubmissionAdapter={submit:(data:LeadFormData)=>Promise<void>};
export function normalizeWhatsapp(value:string){const digits=value.replace(/\D/g,'');if(!digits)return '';return digits.startsWith('55')?`+${digits}`:`+55${digits}`}
export const localLeadAdapter:LeadSubmissionAdapter={async submit(){/* Intentionally local: no data leaves the browser. */}};
