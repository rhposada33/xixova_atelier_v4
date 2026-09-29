export type CommercialConfig={companyName:string;whatsappNumber?:string;calendarUrl?:string;demoUrl:string;siteUrl:string;socialLinks:ReadonlyArray<{label:string;url:string}>};
const clean=(value?:string)=>value?.trim()||undefined;
const whatsappNumber=clean(import.meta.env.VITE_PROMOVEN_WHATSAPP_NUMBER)?.replace(/\D/g,'');
export const commercialConfig:CommercialConfig={companyName:'Promoven',whatsappNumber,calendarUrl:clean(import.meta.env.VITE_PROMOVEN_CALENDAR_URL),demoUrl:'/demo',siteUrl:'https://www.promoven.online',socialLinks:[]};
export const whatsappUrl=whatsappNumber?`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Olá, gostaria de falar com a Promoven.')}`:undefined;
export const contactUrl=whatsappUrl;

export const commercialLegalReady=Boolean(clean(import.meta.env.VITE_PROMOVEN_LEGAL_ENTITY)&&clean(import.meta.env.VITE_PROMOVEN_CNPJ)&&clean(import.meta.env.VITE_PROMOVEN_ADDRESS)&&clean(import.meta.env.VITE_PROMOVEN_PRIVACY_CONTACT)&&import.meta.env.VITE_PROMOVEN_PRIVACY_APPROVED==='true');
export const commercialLeadsEnabled=import.meta.env.VITE_PROMOVEN_LEADS_ENABLED==='true'&&Boolean(clean(import.meta.env.VITE_PROMOVEN_LEADS_ENDPOINT))&&(import.meta.env.VITE_APP_ENV==='staging'||(commercialLegalReady&&clean(import.meta.env.VITE_PROMOVEN_LEADS_ENDPOINT)?.startsWith('https://')));
