// Local approximation of the static Vercel configuration, not an edge-runtime emulator.
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(process.argv[2] ?? resolve(app, 'dist'));
const port = Number(process.argv[3] ?? '5181');
const config = JSON.parse(readFileSync(resolve(app, 'vercel.json'), 'utf8'));
const headers = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]));
const isFile = file => { try { return statSync(file).isFile(); } catch { return false; } };
if (!isFile(resolve(dist, 'index.html'))) throw new Error('Build the remote artifact first.');
const server = createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400, headers).end(); return; }
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, headers).end(); return; }
  let file = resolve(dist, `.${pathname}`);
  if (!file.startsWith(dist + sep)) file = '';
  if (!isFile(file)) {
    const route = config.rewrites.find(({ source }) => {
      if (!source.endsWith('/:path*')) return pathname === source;
      const prefix = source.slice(0, -'/:path*'.length);
      return pathname === prefix || pathname.startsWith(prefix + '/');
    });
    file = route ? resolve(dist, '.' + route.destination) : '';
  }
  if (!isFile(file)) { response.writeHead(404, headers).end(); return; }
  const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
  response.writeHead(200, { ...headers, 'Content-Type': type + '; charset=utf-8' });
  response.end(request.method === 'HEAD' ? undefined : readFileSync(file));
});
server.listen(port, '127.0.0.1', () => console.log(`Local static preflight: http://127.0.0.1:${port}`));
