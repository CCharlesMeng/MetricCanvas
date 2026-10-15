import { parsePage } from '../../packages/page/src/validate';
import { fileNameErrors } from '../../packages/page/src/file-name';
import { versionPolicy } from '../../packages/page/src/version';

if (process.argv.includes('--version')) process.stdout.write(JSON.stringify({ schemaVersion: versionPolicy.current, node: '>=22' }) + '\n');
else {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const parsed = parsePage(request.document);
    const errors = parsed.ok && typeof request.fileName === 'string' ? fileNameErrors(request.fileName, parsed.page) : parsed.errors;
    process.stdout.write(JSON.stringify({ ok: errors.length === 0, schemaVersion: versionPolicy.current, errors }) + '\n');
  } catch {
    process.stderr.write('页面校验 Bridge 无法读取请求。\n'); process.exitCode = 2;
  }
}
