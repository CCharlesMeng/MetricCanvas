import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { staticImages } from './build-tools/static-images';

// Shared modules are grouped by responsibility; optional imports retain their lazy boundary.
const chunkGroups = [
  { name: 'graphics', test: /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?zrender\// },
  { name: 'charts', test: /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?echarts\// },
  { name: 'excel', test: /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?exceljs\// },
  { name: 'vendor', test: /node_modules\// },
  { name: 'export-codecs', test: /\/report-(?:pdf-worker-source|png-worker-source|pdf-capture)\.ts$/ },
  { name: 'runtime', test: /\/packages\/(?:page|data-execution|engine\/(?:runtime|data-gateway))\// },
  { name: 'widgets-table', test: /\/packages\/engine\/widgets\/src\/components\/table\// },
  { name: 'widgets-charts', test: /\/packages\/engine\/widgets\/src\/(?:components\/(?:bar-chart|line-chart|pie-chart|gauge|map-chart)\/|shared\/EChart\.svelte)/ },
  { name: 'widgets', test: /\/packages\/(?:ui|engine\/widgets)\// },
  { name: 'runtime-ui', test: /\/packages\/engine\/runtime-ui\// }
];

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  plugins: [
    staticImages(),
    svelte({
      // 组件样式随 JS 注入其挂载根；嵌入模式的根是 ShadowRoot。
      emitCss: false
    }),
    {
      name: 'metriccanvas-global-entry',
      generateBundle() {
        // Preserve ESM interpretation when dist is copied out of this package.
        this.emitFile({ type: 'asset', fileName: 'package.json', source: '{"type":"module"}\n' });
        const bridge = readFileSync(new URL('./build-tools/global-bridge.js', import.meta.url), 'utf8');
        const hash = createHash('sha256').update(bridge).digest('hex').slice(0, 8);
        const bridgePath = `chunks/global-bridge-${hash}.js`;
        this.emitFile({ type: 'asset', fileName: bridgePath, source: bridge });
        this.emitFile({
          type: 'asset',
          fileName: 'metriccanvas-runtime.global.js',
          source: readFileSync(new URL('./build-tools/global-loader.js', import.meta.url), 'utf8')
            .replace('__METRICCANVAS_GLOBAL_BRIDGE__', `./${bridgePath}`)
        });
      }
    }
  ],
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    minify: true,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'MetricCanvas',
      formats: ['es'],
      fileName: () => 'metriccanvas-runtime.es.js'
    },
    rolldownOptions: {
      output: {
        minify: true,
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        codeSplitting: {
          groups: chunkGroups.map((group, index) => ({
            ...group,
            // Rolldown can pass native Windows IDs alongside Vite-normalized IDs.
            test: (moduleId: string) => group.test.test(moduleId.replaceAll('\\', '/')),
            priority: chunkGroups.length - index,
            entriesAware: true
          }))
        },
        strictExecutionOrder: true
      }
    }
  }
});
