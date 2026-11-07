import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBank } from './bank';
import { Hub } from './hub';

const PORT = Number(process.env.PORT ?? 8787);
const CLIENT_DIR = resolve(fileURLToPath(new URL('../../client/dist', import.meta.url)));

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    return;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  let path = join(CLIENT_DIR, normalize(decoded));
  if (!path.startsWith(CLIENT_DIR + sep) && path !== CLIENT_DIR) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(path) || statSync(path).isDirectory()) path = join(CLIENT_DIR, 'index.html');
  if (!existsSync(path)) {
    res.writeHead(404).end('Client not built. Run npm run build.');
    return;
  }
  const hashed = path.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(path).pipe(res);
});

// One room hitting a bug must not end every other game on the server.
process.on('uncaughtException', (err) => console.error('Uncaught error', err));

new Hub(server, loadBank());
server.listen(PORT, () => console.log(`Trivia Battle server on http://localhost:${PORT}`));
