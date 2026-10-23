import { operationalHandler } from "../_shared/operations.mjs";
import { createClient } from "npm:@supabase/supabase-js@2.109.0";

const allowedOrigin = Deno.env.get("CONNECT_APP_ORIGIN") ?? "http://127.0.0.1:5178";
const headers = { "Access-Control-Allow-Origin": allowedOrigin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store" };
const respond = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");

async function smtpResponse(conn: Deno.Conn, expected: number) {
  const decoder = new TextDecoder(); const line: number[] = [];
  while (true) {
    const byte = new Uint8Array(1); if (await conn.read(byte) !== 1) throw new Error("SMTP indisponível");
    if (byte[0] !== 10) { line.push(byte[0]); continue; }
    const text = decoder.decode(new Uint8Array(line)).trim(); line.length = 0;
    if (text.startsWith(`${expected} `)) return;
    if (text.startsWith(`${expected}-`)) continue;
    throw new Error("SMTP recusou a entrega");
  }
}
async function sendLocal(email: string, authLink: string, inviteLink: string) {
  const conn = await Deno.connect({ hostname: Deno.env.get("CONNECT_SMTP_HOST") ?? "supabase_inbucket_promoven_connect_local", port: Number(Deno.env.get("CONNECT_SMTP_PORT") ?? "1025") });
  const write = async (data: string) => { const bytes = new TextEncoder().encode(data); let offset = 0; while (offset < bytes.length) offset += await conn.write(bytes.subarray(offset)); };
  try {
    await smtpResponse(conn, 220); await write("EHLO connect.local\r\n"); await smtpResponse(conn, 250);
    await write("MAIL FROM:<connect@promoven.local>\r\n"); await smtpResponse(conn, 250);
    await write(`RCPT TO:<${email}>\r\n`); await smtpResponse(conn, 250);
    await write("DATA\r\n"); await smtpResponse(conn, 354);
    await write(`From: Promoven Connect <connect@promoven.local>\r\nTo: <${email}>\r\nSubject: Convite Promoven Connect\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nVoce recebeu um convite para acessar um empreendimento no Promoven Connect.\r\n1. Ative ou acesse sua conta pelo link seguro:\r\n${authLink}\r\n\r\n2. Depois abra o convite e complete seu perfil profissional:\r\n${inviteLink}\r\n\r\nEste convite expira em 48 horas.\r\n.\r\n`);
    await smtpResponse(conn, 250); await write("QUIT\r\n");
  } finally { conn.close(); }
}

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
  const operationId = crypto.randomUUID();
  const args = body.action === "create"
    ? { p_project_id: body.projectId, p_email: body.email, p_token_hash: digest, p_operation_id: operationId }
    : { p_id: body.invitationId, p_expected_version: body.expectedVersion, p_token_hash: digest, p_operation_id: operationId };
  const { data: invitation, error } = await userClient.rpc(body.action === "create" ? "connect_create_broker_invitation" : "connect_resend_broker_invitation", args);
  if (error) return respond(error.code === "42501" ? 403 : error.code === "23505" || error.code === "PT409" ? 409 : 422, { error: error.code === "42501" ? "forbidden" : "invitation_failed" });
  const email = invitation.invited_email as string;
  const redirectTo = `${allowedOrigin}/invite`;
  const inviteLink = `${allowedOrigin}/invite#invite=${token}`;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  let generated = await admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } });
  if (generated.error) generated = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
  const link = generated.data?.properties?.action_link;
  if (!link) {
    await userClient.rpc("connect_cancel_broker_invitation", { p_id: invitation.id, p_expected_version: invitation.version });
    return respond(503, { error: "identity_link_failed" });
  }
  try { await sendLocal(email, link, inviteLink); }
  catch {
    await userClient.rpc("connect_cancel_broker_invitation", { p_id: invitation.id, p_expected_version: invitation.version });
    return respond(503, { error: "delivery_failed" });
  }
  return respond(200, { id: invitation.id, status: invitation.status, expiresAt: invitation.expires_at });
}, {limit: 8192,mode:Deno.env.get("CONNECT_DELIVERY_MODE")??"local",proxySecret:Deno.env.get("CONNECT_PROXY_SECRET")}));
