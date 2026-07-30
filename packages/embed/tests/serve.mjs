import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pagesRoot = resolve(root, '../../pages');
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8']
]);

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    );
    if (pathname === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    const servingPages = pathname.startsWith('/pages/');
    const publicRoot = servingPages ? pagesRoot : root;
    const publicPath = servingPages
      ? pathname.slice('/pages'.length)
      : pathname;
    const file = resolve(publicRoot, `.${publicPath}`);
    if (file !== publicRoot && !file.startsWith(`${publicRoot}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'content-type': contentTypes.get(extname(file)) ?? 'application/octet-stream'
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(4175, '127.0.0.1');
