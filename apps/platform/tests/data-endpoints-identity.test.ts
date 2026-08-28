import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROUTES = [
  '../src/routes/api/data/query/+server.ts',
  '../src/routes/api/data/dimension-values/+server.ts'
];

describe('平台 HTTP 取数入口的身份绑定', () => {
  it.each(ROUTES)('%s 从 locals 取身份并仅经 bindIdentity 取 gateway', (route) => {
    const source = readFileSync(fileURLToPath(new URL(route, import.meta.url)), 'utf8');
    expect(source).toContain('({ request, locals })');
    expect(source).toContain('bindIdentity(');
    expect(source).toContain('locals.identity');
    expect(source).toContain('getRuntimePlatformServices()');
    expect(source).not.toContain('getServerDataGateway');
  });
});
