import {describe,expect,it} from 'vitest';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';

const edgePath=new URL('../../../../../supabase/functions/invite-organization-member/index.ts',import.meta.url);
const configPath=new URL('../../../../../supabase/config.toml',import.meta.url);
const edge=readFileSync(edgePath,'utf8');
const config=readFileSync(configPath,'utf8');
const files=(root:string):string[]=>readdirSync(root).flatMap(name=>{const path=join(root,name);return statSync(path).isDirectory()?files(path):[path];});

describe('limites de segurança do convite',()=>{
  it('exige validação JWT no gateway da Edge Function',()=>{expect(config).toMatch(/\[functions\.invite-organization-member\]\s+verify_jwt = true/);});
  it('restringe CORS por origem, método e headers requeridos pelo cliente Supabase',()=>{expect(edge).toContain("allowed.includes(origin)");expect(edge).toContain("'POST,OPTIONS'");expect(edge).toContain("'authorization,content-type,apikey,x-client-info'");expect(edge).not.toContain('x-idempotency-key');expect(edge).not.toContain("allow-origin':'*'");});
  it('mantém o cliente privilegiado somente na Edge Function',()=>{expect(edge).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");const frontend=files('src').filter(path=>!path.endsWith('invitationSecurity.test.ts')).map(path=>readFileSync(path,'utf8')).join('\n');expect(frontend).not.toMatch(/service[_-]?role|SUPABASE_SERVICE_ROLE_KEY/i);});
  it('não inclui referências privilegiadas no artefato web',()=>{const artifact=files('dist').filter(path=>/\.(js|html|css)$/.test(path)).map(path=>readFileSync(path,'utf8')).join('\n');expect(artifact).not.toMatch(/service[_-]?role|SUPABASE_SERVICE_ROLE_KEY/i);});
  it('não registra email, token ou secrets',()=>{expect(edge).not.toMatch(/console\.(?:log|error)\([^\n]*(?:email|token|service)/i);expect(edge).not.toContain('access_token');});
  it('não devolve detalhes técnicos das RPC',()=>{expect(edge).not.toContain('prepareError.details');expect(edge).toContain("{code:'request_rejected'}");});
});
