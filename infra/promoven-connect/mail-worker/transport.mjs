import nodemailer from 'nodemailer';
export const messageId=id=>`<connect-${id}@promoven.local>`;
export function smtpOptions(c){
 if(!c.host||!c.port)throw Error('smtp_configuration');
 if(c.mode!=='local'&&(!c.user||!c.password||!c.from))throw Error('smtp_configuration');
 return {host:c.host,port:c.port,secure:c.mode!=='local'&&c.port===465,requireTLS:c.mode!=='local',ignoreTLS:c.mode==='local',
  tls:{rejectUnauthorized:true,minVersion:'TLSv1.2'},auth:c.mode==='local'?undefined:{user:c.user,pass:c.password},
  connectionTimeout:2500,greetingTimeout:2500,socketTimeout:4000,dnsTimeout:2000,logger:false,debug:false,transactionLog:false,disableFileAccess:true,disableUrlAccess:true};
}
export function smtpTransport(c){
 const options=smtpOptions(c);
 const transporter=nodemailer.createTransport(options);
 return {
 async send({id,recipient,text}){
  if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)||text.length>16000)throw Object.assign(Error('invalid_mail'),{kind:'permanent'});
  // Local mode cannot target a real mailbox, even if pointed at an unintended server.
  if(c.mode==='local'&&!/@(?:test\.local|example\.invalid)$/.test(recipient))throw Object.assign(Error('synthetic_recipient_required'),{kind:'permanent'});
  try{const result=await transporter.sendMail({from:c.from??'Promoven Connect <connect@promoven.local>',to:recipient,
   subject:'Convite Promoven Connect',text,messageId:messageId(id),headers:{'X-Connect-Correlation':id}});
   return {providerId:result.messageId};
  }catch(e){
   const explicit=Number(e.responseCode);
   const kind=explicit>=500?'permanent':explicit>=400?'temporary':
    ['ECONNREFUSED','ENOTFOUND','EAI_AGAIN'].includes(e.originalCode??e.errno??e.code)||['CONNECTION','GREETING','CONNECT_TIMEOUT','GREETING_TIMEOUT'].includes(e.timeoutType)?'temporary':
    ['EHLO','HELO','AUTH','MAIL FROM','RCPT TO'].includes(e.command)?'temporary':'ambiguous';
   throw Object.assign(Error('smtp_failed'),{kind});
  }
 },
 async reconcile(id){
  // Generic SMTP has no read-side receipt API. Never guess success or retry ambiguous delivery.
  if(c.mode!=='local'||!c.mailpitUrl)return {found:false};
  const r=await fetch(`${c.mailpitUrl}/api/v1/search?query=${encodeURIComponent('message-id:'+messageId(id).slice(1,-1))}`,{signal:AbortSignal.timeout(2500)});
  if(!r.ok)throw Error('reconcile_unavailable');
  const data=await r.json();return {found:(data.messages??[]).some(m=>m.MessageID===messageId(id).slice(1,-1)||m.MessageID===messageId(id)),providerId:messageId(id)};
 },
 close(){transporter.close();}
 };
}
