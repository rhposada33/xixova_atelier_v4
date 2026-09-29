import type {LeadFormData,LeadSubmissionAdapter} from './localLead';

export class LeadSubmissionError extends Error {
  constructor(readonly reason:'invalid'|'limited'|'temporary') { super(reason); }
}

let pendingKey:string|undefined;
export const remoteLeadAdapter:LeadSubmissionAdapter={
  async submit(data:LeadFormData){
    const endpoint=import.meta.env.VITE_PROMOVEN_LEADS_ENDPOINT;
    if(!endpoint)throw new LeadSubmissionError('temporary');
    pendingKey??=crypto.randomUUID();
    const query=new URLSearchParams(location.search);
    const utm=Object.fromEntries(['utm_source','utm_medium','utm_campaign'].map(key=>[key,(query.get(key)||'').slice(0,200)]));
    let response:Response;
    try{
      response=await fetch(endpoint,{
        method:'POST',headers:{'Content-Type':'application/json','X-Idempotency-Key':pendingKey},
        body:JSON.stringify({data,pagePath:location.pathname,...utm}),
      });
    }catch{throw new LeadSubmissionError('temporary')}
    if(response.status===202){pendingKey=undefined;return}
    if(response.status===400||response.status===409)throw new LeadSubmissionError('invalid');
    if(response.status===429)throw new LeadSubmissionError('limited');
    throw new LeadSubmissionError('temporary');
  },
};
export function resetLeadSubmissionKey(){pendingKey=undefined}
