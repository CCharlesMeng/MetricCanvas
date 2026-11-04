import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { build } from 'vite';
import { expect, it } from 'vitest';
import config from '../packages/embed/vite.config';

it('keeps a large imported widget image outside JS in the actual library build', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'embed-image-budget-'));
  try {
    const payload = createHash('shake256', { outputLength: 1_200_000 }).update('embed-image-fixture').digest('base64');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><metadata>${payload}</metadata></svg>`;
    await writeFile(resolve(root, 'large.svg'), svg);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1sAAAAASUVORK5CYII=', 'base64');
    await writeFile(resolve(root, 'pixel.png'), png);
    await writeFile(resolve(root, 'raw.svg'), '<svg><title>raw text stays text</title></svg>');
    await writeFile(resolve(root, 'entry.js'), [
      'export { default as image } from "./large.svg?inline";',
      'export { default as duplicate } from "./large.svg?url";',
      'export { default as pixel } from "./pixel.png";',
      'export { default as raw } from "./raw.svg?raw";'
    ].join('\n'));
    const result = await build({
      ...config,
      configFile: false,
      logLevel: 'silent',
      build: { ...config.build, write: false, lib: { ...config.build!.lib as object, entry: resolve(root, 'entry.js') } }
    });
    const bundle = Array.isArray(result) ? result[0] : result;
    if (!('output' in bundle)) throw new Error('Expected an ESM build');
    const images = bundle.output.filter(file => file.type === 'asset' && file.fileName.endsWith('.svg'));
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ source: Buffer.from(svg) });
    expect(bundle.output.find(file => file.fileName.endsWith('.png'))).toMatchObject({ source: png });
    const entry = bundle.output.find(file => file.type === 'chunk' && file.isEntry);
    if (!entry || entry.type !== 'chunk') throw new Error('Missing image consumer entry');
    expect(Buffer.byteLength(entry.code)).toBeLessThan(10_000);
    expect(entry.code).toContain('new URL(');
    expect(entry.code).toContain('import.meta.url');
    expect(entry.code).not.toContain('data:image');
    expect(entry.code).toContain('raw text stays text');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
