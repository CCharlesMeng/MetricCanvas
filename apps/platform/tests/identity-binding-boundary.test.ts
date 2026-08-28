import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SERVER_SOURCE = fileURLToPath(new URL('../src/', import.meta.url)).replace(/\/$/u, '');

function typescriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = `${directory}/${entry}`;
    return statSync(path).isDirectory()
      ? typescriptFiles(path)
      : entry.endsWith('.ts')
        ? [path]
        : [];
  });
}

describe('身份绑定依赖边界', () => {
  it('getServerDataGateway 只能由 services.server.ts 的 bindIdentity 引用', () => {
    const references = typescriptFiles(SERVER_SOURCE)
      .filter((path) => !path.endsWith('/data-gateway.server.ts'))
      .filter((path) => readFileSync(path, 'utf8').includes('getServerDataGateway'));

    expect(references).toEqual([`${SERVER_SOURCE}/lib/server/services.server.ts`]);
    const compositionRoot = readFileSync(references[0]!, 'utf8');
    expect(compositionRoot).toMatch(
      /export function bindIdentity\([\s\S]*?\{[\s\S]*?getServerDataGateway/u
    );
  });

  it('Agent POST 与 stream 入口都在构造 runner 前绑定 locals.identity', () => {
    for (const relative of [
      'routes/api/agent/+server.ts',
      'routes/api/agent/stream/+server.ts'
    ]) {
      const source = readFileSync(`${SERVER_SOURCE}/${relative}`, 'utf8');
      expect(source).toContain('bindIdentity(');
      expect(source).toContain('locals.identity');
    }
  });
});
