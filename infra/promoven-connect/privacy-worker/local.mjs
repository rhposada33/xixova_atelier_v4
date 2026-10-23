import pg from 'pg';
import {execFileSync} from 'node:child_process';
export const folder=new URL('./.local/ledger',import.meta.url).pathname;
export function environment(){const info=JSON.parse(execFileSync('docker',['inspect','supabase_edge_runtime_promoven_connect_local'],{encoding:'utf8'}))[0];return Object.fromEntries(info.Config.Env.map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));}
export async function database(){const db=new pg.Client({host:'127.0.0.1',port:56322,user:'postgres',password:'postgres',database:'postgres'});await db.connect();return db;}
export async function asActor(db,actor,fn){await db.query('begin');try{await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);await db.query('set local role authenticated');const result=await fn();await db.query('commit');return result;}catch(e){await db.query('rollback');throw e;}}
