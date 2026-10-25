// Local only: no Vercel credentials, API calls, project linking or deployments.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.versions.node.split('.')[0], '24', 'Use Node 24.x, como o projeto Vercel.');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const temp = mkdtempSync(join(tmpdir(), 'connect-vercel-'));
const packages = ['packages/connect-contracts', 'apps/promoven-connect-web'];
const ignored = new Set(['node_modules', 'dist', '.git', '.vercel', '.local', 'test-results', 'playwright-report', 'pilot-results', 'media-results', 'broker-recheck']);
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('VITE_') && !key.startsWith('VERCEL')));
const report = { node: process.versions.node, source: root, temp, checks: [], artifacts: [] };
let logIndex = 0;
function run(cwd, args, extra = {}, succeeds = true) {
  const result = spawnSync('npm', args, { cwd, env: { ...env, ...extra }, encoding: 'utf8' });
  const log = join(temp, `${++logIndex}.log`);
  writeFileSync(log, (result.stdout ?? '') + (result.stderr ?? ''));
  assert.equal(result.status === 0, succeeds, `npm ${args.join(' ')}: veja ${log}`);
  report.checks.push({ command: `npm ${args.join(' ')}`, expected: succeeds ? 'success' : 'rejection', log });
  console.log(`PASS npm ${args.join(' ')} (${succeeds ? 'success' : 'rejected'})`);
}
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(join(dir, item.name)) : [join(dir, item.name)]);
function artifacts(app) {
  const dist = join(app, 'dist');
  const result = files(dist).sort().map(file => ({ file: relative(dist, file), sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }));
  for (const file of files(dist)) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /127\.0\.0\.1|localhost|56321|56410|escobar|service_role|sb_secret_|CANARY_|supabase\.co|\/auth\/v1|\/functions\/v1/i, `Unexpected remote bundle content: ${relative(dist, file)}`);
    assert.doesNotMatch(text, /-----BEGIN (?:RSA )?PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    assert.ok(!file.endsWith('.map'), 'No source maps in publication artifact');
  }
  assert.equal(result.length, 3, 'Only HTML, CSS and the standalone unavailable UI JS should ship');
  return result;
}

console.log(`Evidence directory: ${temp}`);
for (const copy of ['a', 'b']) {
  for (const pkg of packages) {
    const destination = join(temp, copy, pkg);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(root, pkg), destination, { recursive: true, filter: path => !ignored.has(basename(path)) && !basename(path).startsWith('.env') });
    const lock = readFileSync(join(destination, 'package-lock.json'), 'utf8');
    run(destination, ['ci', '--offline', '--no-audit', '--no-fund']);
    assert.equal(readFileSync(join(destination, 'package-lock.json'), 'utf8'), lock);
  }
  const app = join(temp, copy, packages[1]);
  if (copy === 'a') {
    run(join(temp, copy, packages[0]), ['run', 'typecheck']);
    run(join(temp, copy, packages[0]), ['test']);
    run(app, ['run', 'typecheck']);
    run(app, ['run', 'lint']);
    run(app, ['run', 'test:unit']);
  }
  // Deliberately poisonous files: a remote build must ignore all dotenv files.
  for (const filename of ['.env.local', '.env.remote', '.env.production']) {
    writeFileSync(join(app, filename), 'VITE_CONNECT_ENV=local\nVITE_CONNECT_SUPABASE_URL=http://127.0.0.1:56321\nVITE_SERVICE_ROLE=CANARY_ENV_FILE\n');
  }
  run(app, ['run', 'build:vercel'], { VERCEL_ENV: 'preview', VITE_CONNECT_ENV: 'preview', VITE_VERCEL_URL: 'CANARY_PLATFORM_METADATA.example', PRIVATE_KEY: 'CANARY_PRIVATE_VARIABLE' });
  report.artifacts.push({ copy, target: 'preview', files: artifacts(app) });
}
assert.deepEqual(report.artifacts[0].files, report.artifacts[1].files, 'Two clean builds must match byte for byte');
const appB = join(temp, 'b', packages[1]);
run(appB, ['run', 'build:vercel'], { VERCEL_ENV: 'production', VITE_CONNECT_ENV: 'production' });
report.artifacts.push({ copy: 'b', target: 'production', files: artifacts(appB) });
run(appB, ['run', 'build:vercel'], { VERCEL_ENV: 'preview', VITE_CONNECT_ENV: 'local' }, false);
run(appB, ['run', 'build:vercel'], { VERCEL_ENV: 'preview', VITE_CONNECT_ENV: 'preview', VITE_CONNECT_SUPABASE_URL: 'http://127.0.0.1:56321' }, false);
run(appB, ['run', 'build'], { VERCEL: '1', VERCEL_ENV: 'preview' }, false);
writeFileSync(join(temp, 'report.json'), JSON.stringify({ status: 'PASS', ...report }, null, 2) + '\n');
console.log(`PASS: two identical Preview builds; Production built; unsafe builds rejected. ${join(temp, 'report.json')}`);
