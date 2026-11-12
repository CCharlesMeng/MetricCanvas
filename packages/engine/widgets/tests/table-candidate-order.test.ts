import { beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compile } from 'svelte/compiler';
import { build } from 'esbuild';
import { render } from 'svelte/server';
import type { Component, ComponentProps } from 'svelte';
import type TableComponent from '../src/components/table/Table.svelte';
import { placeholderOptionsLast } from '../src/components/table/candidate-order';

let Table: Component<ComponentProps<typeof TableComponent>>;
beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL('../src/components/table/Table.svelte', import.meta.url))],
    bundle: true, write: false, platform: 'node', format: 'esm', conditions: ['svelte'], external: ['svelte', 'svelte/*'],
    plugins: [{ name: 'svelte-server', setup(plugin) {
      plugin.onLoad({ filter: /\.svelte$/ }, args => ({
        contents: compile(readFileSync(args.path, 'utf8'), { generate: 'server', filename: args.path }).js.code, loader: 'js'
      }));
    } }]
  });
  const code = bundled.outputFiles[0]!.text.replace(/(['"])(svelte(?:\/[^'"]+)?)\1/g,
    (_match, _quote, specifier: string) => JSON.stringify(pathToFileURL(require.resolve(specifier)).href));
  Table = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default;
});

function props(): ComponentProps<typeof TableComponent> {
  return {
    data: { main: { fields: { status: { type: 'string', role: 'dimension' } }, snapshot: { status: 'ready', rows: [] } } },
    props: { columns: [{ field: 'status', filterable: { mode: 'select' } }] },
    view: { pageIndex: 0, sort: [], headerFilters: {} }
  };
}

function optionLabels(input: ComponentProps<typeof TableComponent>) {
  return [...render(Table, { props: input }).body.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)]
    .map(match => match[1].replace(/<[^>]+>/g, '').trim());
}

it('preserves ordinary option order, typed values and the original input', () => {
  const options = Object.freeze([{ value: 'empty', label: '--' }, { value: 2, label: 'Z' }, { value: '2', label: 'A' }]);
  const ordered = placeholderOptionsLast(options, option => option.label);
  expect(ordered.map(option => option.value)).toEqual([2, '2', 'empty']);
  expect(options[0].value).toBe('empty');
});

it('places displayed -- last for static enums and legacy string options', () => {
  const input = props();
  input.props.columns[0].enumValues = [{ value: 'empty', label: '--' }, { value: 'z', label: 'Z' }, { value: 'a', label: 'A' }];
  expect(optionLabels(input)).toEqual(['Z', 'A', '--']);
  delete input.props.columns[0].enumValues;
  input.filterOptions = { status: ['--', 'Z', 'A'] };
  expect(optionLabels(input)).toEqual(['Z', 'A', '--']);
});

it('keeps -- after loaded pages and after ordinary missing selections', () => {
  const input = props();
  input.view.headerFilters.status = { mode: 'select', values: ['lost', '--'] };
  input.columnCandidates = { status: { status: 'ready', search: '', totalCount: 4, candidates: [{ value: '--', label: '--' }, { value: 'Z', label: 'Z' }] } };
  expect(optionLabels(input)).toEqual(['lost 已选', 'Z', '--']);
  input.columnCandidates.status.candidates.push({ value: 'A', label: 'A' });
  expect(optionLabels(input)).toEqual(['lost 已选', 'Z', 'A', '--']);
  input.columnCandidates.status = { status: 'ready', search: 'A', totalCount: 1, candidates: [{ value: 'A', label: 'A' }] };
  expect(optionLabels(input)).toEqual(['lost 已选', 'A', '-- 已选']);
  input.columnCandidates.status.search = '';
  expect(optionLabels(input)).toEqual(['lost 已选，当前条件下无匹配', 'A', '-- 已选，当前条件下无匹配']);
});
