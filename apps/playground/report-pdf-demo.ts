import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile, access } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import type { Plugin } from 'vite';

const run = promisify(execFile);

async function chromiumExecutable(): Promise<string> {
  if (process.env.MC_PDF_CHROMIUM) return process.env.MC_PDF_CHROMIUM;
  const cache = process.platform === 'darwin'
    ? join(homedir(), 'Library/Caches/ms-playwright')
    : join(homedir(), '.cache/ms-playwright');
  const versions = (await readdir(cache)).filter(name => name.startsWith('chromium_headless_shell-'))
    .sort((a, b) => Number(b.split('-').at(-1)) - Number(a.split('-').at(-1)));
  for (const version of versions) {
    const binary = join(cache, version, process.platform === 'darwin'
      ? `chrome-headless-shell-mac-${process.arch === 'arm64' ? 'arm64' : 'x64'}/chrome-headless-shell`
      : 'chrome-headless-shell-linux64/chrome-headless-shell');
    try { await access(binary); return binary; } catch { /* Try the next installed version. */ }
  }
  throw new Error('本地 PDF 示例需要 Chromium。可设置 MC_PDF_CHROMIUM 指向已安装的 Chromium 可执行文件。');
}

/** Local-only development encoder. Not included in the engine or production build. */
export function reportPdfDemo(): Plugin {
  let busy = false;
  return {
    name: 'metriccanvas:local-report-pdf', apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__report-pdf', async (request, response) => {
        const origin = request.headers.origin;
        if (request.method !== 'POST' || origin !== `http://${request.headers.host}` || request.headers['content-type'] !== 'text/html'
          || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress ?? '')) {
          response.writeHead(403).end('仅允许本地同源 PDF 示例请求'); return;
        }
        if (busy) { response.writeHead(409).end('PDF 编码正在进行'); return; }
        busy = true;
        let directory: string | undefined;
        const controller = new AbortController();
        const cancel = () => { if (!response.writableEnded) controller.abort(); };
        response.on('close', cancel);
        try {
          const chunks: Buffer[] = []; let size = 0;
          for await (const chunk of request) {
            const bytes = Buffer.from(chunk); size += bytes.length;
            if (size > 12 * 1024 * 1024) throw new Error('PDF 示例内容超过 12 MiB');
            chunks.push(bytes);
          }
          const markup = Buffer.concat(chunks).toString('utf8');
          if (!markup.startsWith('<div') || !markup.includes('data-export-view')) throw new Error('需要引擎准备的导出视图');
          const executable = await chromiumExecutable();
          directory = await mkdtemp(join(tmpdir(), 'metriccanvas-pdf-'));
          const input = join(directory, 'report.html'); const output = join(directory, 'report.pdf');
          await writeFile(input, `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>经营分析报告</title><style>
            @page { size: A4; margin: 10mm; }
            html,body { margin:0; padding:0; background:white; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
            * { animation:none!important; transition:none!important; }
            table { height:auto!important; } thead { display:table-header-group!important; }
            tr { break-inside:avoid!important; } h1,h2,h3 { break-after:avoid!important; }
            [data-export-chart] { break-inside:avoid!important; }
            .report-cover { margin:0!important; width:100%!important; }
            .short-bar h1,.short-bar .as-of.inline { color:#2e3295!important; background:none!important;
              -webkit-text-fill-color:#2e3295!important; -webkit-text-stroke-width:0!important; }
            .section-grid,.cell { display:block!important; width:100%!important; }
            .page-section { margin-bottom:6mm!important; }
            .page-section:has([data-export-chart]) { break-before:page; break-inside:avoid; }
          </style></head><body>${markup}</body></html>`);
          // Chromium is a PDF compositor here: self-contained static HTML, no JS or remote assets.
          await run(executable, ['--headless', '--disable-gpu', '--disable-javascript', '--no-pdf-header-footer',
            '--disable-background-networking', '--disable-dev-shm-usage', `--user-data-dir=${join(directory, 'profile')}`,
            `--print-to-pdf=${output}`, pathToFileURL(input).href],
            { timeout: 60_000, signal: controller.signal, maxBuffer: 1024 * 1024 });
          const pdf = await readFile(output);
          if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('编码器未生成有效 PDF');
          const preview = join(directory, 'first-page');
          await run(process.env.MC_PDF_RENDERER ?? 'pdftoppm', ['-f', '1', '-singlefile', '-scale-to', '1000',
            '-png', output, preview], { timeout: 15_000, signal: controller.signal, maxBuffer: 1024 * 1024 });
          const image = await readFile(`${preview}.png`);
          response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          response.end(JSON.stringify({ pdf: pdf.toString('base64'), firstPage: image.toString('base64') }));
        } catch (cause) {
          if (!response.destroyed) response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
            .end(cause instanceof Error ? cause.message : 'PDF 编码失败');
        } finally {
          response.off('close', cancel);
          try { if (directory) await rm(directory, { recursive: true, force: true, maxRetries: 3 }); }
          finally { busy = false; }
        }
      });
    }
  };
}
