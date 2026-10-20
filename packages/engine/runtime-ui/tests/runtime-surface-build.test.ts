import { readFileSync } from 'node:fs';
import { compile } from 'svelte/compiler';
import { transformSync } from 'esbuild';
import { expect, it } from 'vitest';

it('RuntimeSurface 生成的服务端 JavaScript 不包含重复绑定', () => {
  const filename = new URL('../src/RuntimeSurface.svelte', import.meta.url);
  const source = readFileSync(filename, 'utf8');
  const result = compile(source, { filename: filename.pathname, generate: 'server' });
  expect(() => transformSync(result.js.code, { loader: 'js', format: 'esm' })).not.toThrow();
});
