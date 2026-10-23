import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import WebSocket from "ws";
import { randomBytes } from "node:crypto";

const apiUrl = process.env.CONNECT_LOCAL_API_URL;
const serviceKey = process.env.CONNECT_LOCAL_SERVICE_KEY;
const databaseUrl = process.env.CONNECT_LOCAL_DATABASE_URL;
const email = process.env.CONNECT_BOOTSTRAP_EMAIL;
const password = process.env.CONNECT_BOOTSTRAP_PASSWORD;
if (apiUrl !== "http://127.0.0.1:56321" || !/^postgresql:\/\/postgres:[^@]+@127\.0\.0\.1:56322\/postgres$/.test(databaseUrl ?? "")) {
  throw new Error("Bootstrap permitido somente no Supabase Connect local (portas 56321/56322).");
}
if (!serviceKey || !email?.endsWith("@test.local") || !password || password.length < 12) {
  throw new Error("Defina chave local e credenciais sintéticas @test.local com senha de 12+ caracteres.");
}
const client = createClient(apiUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: WebSocket } });
const db = new pg.Client({ connectionString: databaseUrl });
await db.connect();
try {
  const found = await db.query("select id from auth.users where email=$1", [email]);
  let userId = found.rows[0]?.id;
  if (!userId) {
    const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("Usuário não foi criado.");
    userId = data.user.id;
  }
  const recoveryEmail = "recovery@test.local";
  const recoveryFound = await db.query("select id from auth.users where email=$1", [recoveryEmail]);
  if (!recoveryFound.rows.length) {
    const { error } = await client.auth.admin.createUser({ email: recoveryEmail, password: randomBytes(24).toString("hex"), email_confirm: true });
    if (error) throw error;
  }
  await db.query("begin");
  await db.query("insert into public.platform_admins(user_id) values($1) on conflict do nothing", [userId]);
  for (const [name, slug, role] of [
    ["Organização piloto", "piloto-local", "organization_admin"],
    ["Segundo piloto", "segundo-piloto-local", "sales_manager"],
  ]) {
    const org = await db.query("insert into public.organizations(name,slug) values($1,$2) on conflict(slug) do update set name=excluded.name returning id", [name, slug]);
    await db.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,$3) on conflict(organization_id,user_id) do update set role=excluded.role,active=true", [org.rows[0].id, userId, role]);
  }
  await db.query("commit");
  process.stdout.write("Bootstrap Connect local concluído para usuário sintético.\n");
} catch (error) {
  await db.query("rollback").catch(() => {});
  throw error;
} finally { await db.end(); }
