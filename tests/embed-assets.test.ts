import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { build } from 'vite';
import { expect, it } from 'vitest';
import config from '../packages/embed/vite.config';

it('embeds large images once across import suffixes without resource URLs', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'embed-image-budget-'));
  try {
    const payload = createHash('shake256', { outputLength: 96_000 }).update('embed-image-fixture').digest('base64');
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
      build: { ...config.build, write: false, reportCompressedSize: false, lib: { ...config.build!.lib as object, entry: resolve(root, 'entry.js') } }
    });
    const bundle = Array.isArray(result) ? result[0] : result;
    if (!('output' in bundle)) throw new Error('Expected an ESM build');
    const images = bundle.output.filter(file => file.type === 'asset' && file.fileName.endsWith('.svg'));
    expect(images).toHaveLength(0);
    expect(bundle.output.find(file => file.fileName.endsWith('.png'))).toBeUndefined();
    const entry = bundle.output.find(file => file.type === 'chunk' && file.isEntry);
    if (!entry || entry.type !== 'chunk') throw new Error('Missing image consumer entry');
    expect(Buffer.byteLength(entry.code)).toBeLessThan(200_000);
    expect(entry.code).not.toContain('new URL(');
    expect(entry.code).not.toContain('import.meta.url');
    expect(entry.code).toContain(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
    expect(entry.code).toContain(`data:image/png;base64,${png.toString('base64')}`);
    expect(entry.code).toContain('raw text stays text');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);

it('embeds decorative images on both sides of the former 8 KiB boundary', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'embed-small-images-'));
  try {
    const left = resolve('packages/engine/widgets/src/assets/section-title-left.svg');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    await writeFile(resolve(root, 'boundary.svg'), svg.padEnd(8192, ' '));
    await writeFile(resolve(root, 'over.svg'), svg.padEnd(8193, ' '));
    await writeFile(resolve(root, 'entry.js'), [
      `export { default as left } from ${JSON.stringify(`${left}?inline`)};`,
      'export { default as boundary } from "./boundary.svg?url";',
      'export { default as over } from "./over.svg";'
    ].join('\n'));
    const result = await build({
      ...config,
      configFile: false,
      logLevel: 'silent',
      build: { ...config.build, write: false, reportCompressedSize: false, lib: { ...config.build!.lib as object, entry: resolve(root, 'entry.js') } }
    });
    const bundle = Array.isArray(result) ? result[0] : result;
    if (!('output' in bundle)) throw new Error('Expected an ESM build');
    const assets = bundle.output.filter(file => file.type === 'asset' && file.fileName.endsWith('.svg'));
    expect(assets).toHaveLength(0);
    const entry = bundle.output.find(file => file.type === 'chunk' && file.isEntry);
    if (!entry || entry.type !== 'chunk') throw new Error('Missing image consumer entry');
    expect(entry.code).toContain('data:image/svg+xml;base64,');
    expect(entry.code).not.toContain('assets/section-title-left-');
    expect(entry.code).not.toContain('assets/boundary-');
    expect(entry.code).not.toContain('assets/over-');
    expect(entry.code).not.toContain('import.meta.url');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);

it.each([1, 2])('rejects oversized image chunks with %i source image(s) before writing output', async count => {
  const root = await mkdtemp(resolve(tmpdir(), 'embed-image-overflow-'));
  try {
    const entries: string[] = [];
    for (let index = 0; index < count; index++) {
      const payload = createHash('shake256', { outputLength: Math.ceil(600_000 / count) }).update(`image-${index}`).digest('base64');
      await writeFile(resolve(root, `image-${index}.svg`), `<svg xmlns="http://www.w3.org/2000/svg"><metadata>${payload}</metadata></svg>`);
      entries.push(`export { default as image${index} } from "./image-${index}.svg?inline";`);
    }
    await writeFile(resolve(root, 'entry.js'), entries.join('\n'));
    await expect(build({
      ...config,
      configFile: false,
      logLevel: 'silent',
      build: { ...config.build, write: false, reportCompressedSize: false, lib: { ...config.build!.lib as object, entry: resolve(root, 'entry.js') } }
    }).then(() => undefined)).rejects.toThrow(/exceeds the 1,000,000-byte JS limit/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);
