import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { Plugin } from 'vite';

// Library mode otherwise inlines every image, including explicit ?inline imports.
export function staticImages(): Plugin {
  return {
    name: 'metriccanvas-static-images',
    enforce: 'pre',
    apply: 'build',
    load(id) {
      if (!/\.(?:svg|png|jpe?g|gif|webp|avif|ico)(?:\?(?:inline|url))?$/i.test(id)) return null;
      const file = id.split('?')[0];
      const reference = this.emitFile({ type: 'asset', name: basename(file), source: readFileSync(file) });
      // Rolldown resolves this to new URL(relativePath, import.meta.url).href.
      return `export default import.meta.ROLLUP_FILE_URL_${reference};`;
    }
  };
}
