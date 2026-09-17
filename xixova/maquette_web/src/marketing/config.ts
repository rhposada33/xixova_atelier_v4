export type CommercialConfig={companyName:string;whatsappUrl?:string;email?:string;demoUrl:string;siteUrl:string;socialLinks:ReadonlyArray<{label:string;url:string}>};
export const commercialConfig:CommercialConfig={companyName:'Promoven',demoUrl:'/demo',siteUrl:'https://www.promoven.online',socialLinks:[]};
export const contactUrl=commercialConfig.whatsappUrl||(commercialConfig.email?`mailto:${commercialConfig.email}`:undefined);
