export type CommercialConfig={companyName:string;whatsappNumber?:string;calendarUrl?:string;demoUrl:string;siteUrl:string;socialLinks:ReadonlyArray<{label:string;url:string}>};
const clean=(value?:string)=>value?.trim()||undefined;
const whatsappNumber=clean(import.meta.env.VITE_PROMOVEN_WHATSAPP_NUMBER)?.replace(/\D/g,'');
export const commercialConfig:CommercialConfig={companyName:'Promoven',whatsappNumber,calendarUrl:clean(import.meta.env.VITE_PROMOVEN_CALENDAR_URL),demoUrl:'/demo',siteUrl:'https://www.promoven.online',socialLinks:[]};
export const whatsappUrl=whatsappNumber?`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Olá, gostaria de falar com a Promoven.')}`:undefined;
export const contactUrl=whatsappUrl;
