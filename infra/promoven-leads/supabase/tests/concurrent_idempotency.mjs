import assert from 'node:assert/strict';
import pg from 'pg';

const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw new Error('Defina DATABASE_URL somente para o Postgres local deste projeto.');
const hash=value=>Buffer.from(value.toString(16).padStart(64,'0'),'hex');
const args=(id,payload,rate)=>[hash(id),hash(payload),hash(rate),'Ana Silva','Construtora Exemplo',null,'+5511999999999','ana@exemplo.com','São Paulo / SP','31 a 80','De 3 a 6 meses','Ainda não',null,'website','/',null,null,null,'2026-09-18',new Date(),new Date()];
const sql='select public.accept_commercial_lead($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) as result';
const one=async client=>{await client.query('begin');await client.query('set local role service_role');const result=await client.query(sql,args(900,901,902));await client.query('commit');return result.rows[0].result};
const pool=new pg.Pool({connectionString});
try{const [a,b]=await Promise.all([pool.connect(),pool.connect()]);try{const results=await Promise.all([one(a),one(b)]);assert.deepEqual(results.sort(),['accepted','accepted']);const count=await pool.query('select count(*)::int as count from public.commercial_leads where name=$1',['Ana Silva']);assert.equal(count.rows[0].count,1,'concurrent idempotency inserts one lead');}finally{a.release();b.release()}}finally{await pool.end()}
