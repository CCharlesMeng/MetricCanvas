import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { optimizeSvgFile } from './optimize-svg.mjs';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('./optimize-svg.mjs', import.meta.url));
const fixture = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" aria-labelledby="heading">
  <title id="heading">测试图</title><desc>Gradient with retained IDs</desc>
  <metadata>${'editor metadata '.repeat(80_000)}</metadata>
  <defs><linearGradient id="paint"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs>
  <path id="shape" fill="url(#paint)" d="M 0.123456789 0 L 100 0 L 100 100 L 0 100 Z"/>
</svg>`;

async function workspace(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'svg-optimize-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('optimizes a >1 MB SVG while preserving source, viewBox, IDs and accessible text', async t => {
  const root = await workspace(t);
  const input = join(root, 'source.svg');
  const output = join(root, 'optimized.svg');
  await writeFile(input, fixture);
  const report = await optimizeSvgFile(input, output);
  const svg = await readFile(output, 'utf8');
  assert.equal(await readFile(input, 'utf8'), fixture);
  assert(report.beforeBytes > 1_000_000);
  assert(report.afterBytes < 1000);
  assert.equal(report.afterBytes, Buffer.byteLength(svg));
  assert.equal(report.base64DataUrlBytes, Buffer.byteLength(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`));
  for (const expected of ['viewBox="0 0 100 100"', 'id="paint"', 'id="shape"', 'id="heading"', 'url(#paint)', '<title', '<desc']) {
    assert(svg.includes(expected), `Missing preserved content: ${expected}`);
  }
});

test('refuses to overwrite sources, existing files and aliases to the source', async t => {
  const root = await workspace(t);
  const input = join(root, 'source.svg');
  const output = join(root, 'existing.svg');
  await writeFile(input, fixture);
  await writeFile(output, 'existing content');
  await assert.rejects(optimizeSvgFile(input, input), /differ from the source/);
  await assert.rejects(optimizeSvgFile(input, output), { code: 'EEXIST' });
  await assert.rejects(optimizeSvgFile(input, join(root, '.', 'source.svg')), /differ from the source/);
  assert.equal(await readFile(input, 'utf8'), fixture);
  assert.equal(await readFile(output, 'utf8'), 'existing content');
});

test('CLI accepts paths with spaces and defaults to an ignored output directory', async t => {
  const root = await workspace(t);
  const input = join(root, '超大 图片.svg');
  await writeFile(input, fixture);
  const { stdout, stderr } = await exec(process.execPath, [cli, input], { cwd: root });
  const report = JSON.parse(stdout);
  assert.equal(stderr, '');
  assert.equal(report.output, join(root, '.scratch', 'svg-optimized', '超大 图片.optimized.svg'));
  assert.equal(report.precision, 6);
  assert.equal(await readFile(input, 'utf8'), fixture);
  const explicit = join(root, 'explicit.svg');
  const result = await exec(process.execPath, [cli, input, '-o', explicit, '--precision', '3'], { cwd: root });
  assert.equal(JSON.parse(result.stdout).precision, 3);
  assert.match(await readFile(explicit, 'utf8'), /M\.123[ ,]/);
});

test('invalid SVG or precision fails before writing an output', async t => {
  const root = await workspace(t);
  const input = join(root, 'invalid.svg');
  const output = join(root, 'output.svg');
  await writeFile(input, '<svg><path></svg>');
  await assert.rejects(optimizeSvgFile(input, output), /Unexpected close tag/);
  await assert.rejects(optimizeSvgFile(input, output, 1.5), /precision must/);
  await assert.rejects(optimizeSvgFile(input, output, -1), /precision must/);
  await writeFile(input, Buffer.from([0xff]));
  await assert.rejects(optimizeSvgFile(input, output), /not valid for encoding utf-8/);
  await assert.rejects(readFile(output), { code: 'ENOENT' });
});

test('CLI prints help and rejects missing input or unknown options', async () => {
  assert.match((await exec(process.execPath, [cli, '--help'])).stdout, /Usage:/);
  await assert.rejects(exec(process.execPath, [cli]), /Usage:/);
  await assert.rejects(exec(process.execPath, [cli, '--unknown']), /Unknown option/);
});
