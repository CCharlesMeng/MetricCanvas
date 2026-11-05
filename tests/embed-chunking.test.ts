import { describe, expect, it } from 'vitest';
import config from '../packages/embed/vite.config';

function matches(test: unknown, id: string): boolean {
  if (test instanceof RegExp) return test.test(id);
  if (typeof test === 'function') return Boolean(test(id));
  return false;
}

function chunkFor(id: string) {
  const output = config.build?.rolldownOptions?.output;
  if (!output || Array.isArray(output) || typeof output.codeSplitting !== 'object') {
    throw new Error('Expected the actual embed code-splitting groups');
  }
  return output.codeSplitting.groups?.find((group) => matches(group.test, id))?.name;
}

const modules = [
  ['graphics', 'node_modules/.pnpm/zrender@6.1.0/node_modules/zrender/lib/core/env.js'],
  ['charts', 'node_modules/.pnpm/echarts@6.1.0/node_modules/echarts/lib/core/echarts.js'],
  ['excel', 'node_modules/.pnpm/write-excel-file@4.1.1/node_modules/write-excel-file/universal/index.js'],
  ['excel', 'node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/browser.js'],
  ['vendor', 'node_modules/.pnpm/svelte@5.56.6/node_modules/svelte/src/internal/client/index.js'],
  ['runtime', 'packages/page/src/index.ts'],
  ['runtime', 'packages/data-execution/src/index.ts'],
  ['runtime', 'packages/engine/data-gateway/src/index.ts'],
  ['widgets-charts', 'packages/engine/widgets/src/shared/EChart.svelte'],
  ['widgets-charts', 'packages/engine/widgets/src/components/bar-chart/BarChart.svelte'],
  ['widgets-table', 'packages/engine/widgets/src/components/table/Table.svelte'],
  ['widgets', 'packages/ui/src/index.ts'],
  ['runtime-ui', 'packages/engine/runtime-ui/src/index.ts'],
  ['export-codecs', 'packages/engine/runtime-ui/src/report-pdf-worker-source.ts'],
  ['export-codecs', 'packages/engine/runtime-ui/src/report-png-worker-source.ts'],
  ['export-codecs', 'packages/engine/runtime-ui/src/report-pdf-capture.ts']
];

const paths = [
  { name: 'POSIX', path: (relative: string) => `/work/MetricCanvas/${relative}` },
  { name: 'Windows forward slash', path: (relative: string) => `D:/Code/AI辅助研发/MetricCanvas/${relative}` },
  { name: 'Windows backslash', path: (relative: string) => `D:/Code/AI辅助研发/MetricCanvas/${relative}`.replaceAll('/', '\\') },
  { name: 'Windows mixed separators', path: (relative: string) => `D:\\Code\\AI辅助研发\\MetricCanvas/${relative.replaceAll('node_modules/', 'node_modules\\')}` }
];

describe.each(paths)('embed chunk ownership with $name module IDs', ({ path }) => {
  it.each(modules)('%s keeps its own modules', (expected, relative) => {
    expect(chunkFor(path(relative))).toBe(expected);
  });
});
