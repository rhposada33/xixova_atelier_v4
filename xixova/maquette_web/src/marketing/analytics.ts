export type MarketingEvent='header_schedule_click'|'header_demo_click'|'hero_schedule_click'|'hero_demo_click'|'lead_form_view'|'lead_form_start'|'lead_form_validation_error'|'lead_form_submit'|'lead_form_success'|'lead_form_failure'|'calendar_click'|'whatsapp_click'|'demo_open';
export type MarketingAnalytics=(event:MarketingEvent)=>void;
let provider:MarketingAnalytics|undefined;
export function setMarketingAnalytics(next?:MarketingAnalytics){provider=next}
export function trackMarketingEvent(event:MarketingEvent){try{provider?.(event)}catch{/* Analytics must never affect the visitor. */}}
