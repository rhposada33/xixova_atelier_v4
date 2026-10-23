import {createHmac,timingSafeEqual} from 'node:crypto';
// Contract only. No HTTP listener, no provider configured. Durable event dedup is in SQL.
export async function processWebhook({raw,timestamp,signature,secret,rpc,now=Date.now()}){
 if(!secret||secret.length<32||raw.length>4096||!/^\d{13}$/.test(timestamp??'')||Math.abs(now-Number(timestamp))>60000||!/^[a-f0-9]{64}$/.test(signature??''))throw Error('webhook_rejected');
 const expected=createHmac('sha256',secret).update(timestamp+'\n'+raw).digest();if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))throw Error('webhook_rejected');
 const d=JSON.parse(raw);if(!d||!['delivered','bounced'].includes(d.type)||Object.keys(d).some(k=>!['id','messageId','type','providerId'].includes(k)))throw Error('webhook_rejected');
 return rpc('connect_mail_webhook',{p_event:d.id,p_id:d.messageId,p_type:d.type,p_provider:d.providerId});
}
