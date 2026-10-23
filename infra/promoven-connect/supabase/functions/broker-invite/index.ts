import { sealMail } from "../_shared/mail-crypto.mjs";
import { operationalHandler } from "../_shared/operations.mjs";
import { createClient } from "npm:@supabase/supabase-js@2.109.0";

const allowedOrigin = Deno.env.get("CONNECT_APP_ORIGIN") ?? "http://127.0.0.1:5178";
const headers = { "Access-Control-Allow-Origin": allowedOrigin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store" };
const respond = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");

Deno.serve(operationalHandler("broker-invite",async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond(405, { error: "method_not_allowed" });
  if (Deno.env.get("CONNECT_DELIVERY_MODE") !== "local") return respond(503, { error: "delivery_not_configured" });
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return respond(401, { error: "unauthorized" });
  const url = Deno.env.get("SUPABASE_URL")!; const anon = Deno.env.get("SUPABASE_ANON_KEY")!; const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: identity, error: identityError } = await userClient.auth.getUser();
  if (identityError || !identity.user) return respond(401, { error: "unauthorized" });
  let body: { action?: string; projectId?: string; email?: string; invitationId?: string; expectedVersion?: number };
  try { body = await request.json(); } catch { return respond(400, { error: "invalid_body" }); }
  if (!body || !["create", "resend"].includes(body.action ?? "")) return respond(400, { error: "invalid_body" });
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const digest = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
  const offeredId=request.headers.get("Idempotency-Key");
  if(offeredId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(offeredId))return respond(400,{error:"invalid_operation"});
  const operationId=offeredId??crypto.randomUUID();
  if(Object.keys(body).some(k=>!["action","projectId","email","invitationId","expectedVersion"].includes(k)))return respond(400,{error:"invalid_body"});
  // Recipient is derived from the authorized invitation in SQL; no client-provided mail payload.
  if(body.action==="resend"&&(body.email!==undefined||body.projectId!==undefined))return respond(400,{error:"invalid_body"});
  let payload;
  try{payload=await sealMail({token},operationId,Deno.env.get("CONNECT_MAIL_KEY_ID"),Deno.env.get("CONNECT_MAIL_PUBLIC_KEY"));}
  catch{return respond(503,{error:"mail_key_unavailable"});}
  const admin=createClient(url,service,{auth:{persistSession:false}});
  const result=await admin.rpc("connect_queue_invitation",{p_actor:identity.user.id,p_action:body.action,
    p_project:body.projectId??null,p_email:body.email??null,p_invitation:body.invitationId??null,p_version:body.expectedVersion??null,
    p_token_hash:digest,p_operation:operationId,p_payload:payload});
  if(result.error)return respond(result.error.code==="42501"?403:["23505","PT409"].includes(result.error.code)?409:422,{error:"invitation_queue_failed"});
  return respond(202,result.data);

}, {limit: 8192,mode:Deno.env.get("CONNECT_DELIVERY_MODE")??"local",proxySecret:Deno.env.get("CONNECT_PROXY_SECRET")}));
