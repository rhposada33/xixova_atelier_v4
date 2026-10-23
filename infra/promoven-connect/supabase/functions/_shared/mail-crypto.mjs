// Hybrid envelope: Edge has SPKI public key only. Only the worker holds PKCS8 private keys.
const encode=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const aad=id=>new TextEncoder().encode(`connect.mail.v1:${id}:broker-invite.pt-BR.v1`);
export async function sealMail(payload,id,kid,publicKey){
 if(!/^[a-zA-Z0-9_-]{1,32}$/.test(kid??'')||!publicKey)throw Error('mail_key_missing');
 const rsa=await crypto.subtle.importKey('spki',decode(publicKey),{name:'RSA-OAEP',hash:'SHA-256'},false,['wrapKey']);
 const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']),iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(id)},key,new TextEncoder().encode(JSON.stringify(payload)));
 return {alg:'RSA-OAEP-256+A256GCM',kid,iv:encode(iv),key:encode(await crypto.subtle.wrapKey('raw',key,rsa,{name:'RSA-OAEP'})),data:encode(data)};
}
export async function openMail(envelope,id,privateKeys){
 if(envelope?.alg!=='RSA-OAEP-256+A256GCM'||!privateKeys?.[envelope.kid])throw Error('mail_key_missing');
 const rsa=await crypto.subtle.importKey('pkcs8',decode(privateKeys[envelope.kid]),{name:'RSA-OAEP',hash:'SHA-256'},false,['unwrapKey']);
 const key=await crypto.subtle.unwrapKey('raw',decode(envelope.key),rsa,{name:'RSA-OAEP'},{name:'AES-GCM',length:256},false,['decrypt']);
 const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(envelope.iv),additionalData:aad(id)},key,decode(envelope.data));
 const value=JSON.parse(new TextDecoder().decode(bytes));
 if(!value||!/^[a-f0-9]{64}$/.test(value.token)||Object.keys(value).some(k=>!['token','authLink','authLinkAt'].includes(k)))throw Error('mail_payload_invalid');
 return value;
}
