import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import type { Plugin } from 'vite';

const maxJsBytes = 1_000_000;
const imageMimeTypes: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon'
};

// Images travel as data, so integrating bundlers never need to resolve their file URLs.
export function staticImages(): Plugin {
  return {
    name: 'metriccanvas-static-images',
    enforce: 'pre',
    apply: 'build',
    load(id) {
      if (!/\.(?:svg|png|jpe?g|gif|webp|avif|ico)(?:\?(?:inline|url))?$/i.test(id)) return null;
      const file = id.split('?')[0];
      // Canonical imports share one payload even when components use different suffixes.
      if (id !== file) return `export { default } from ${JSON.stringify(file)};`;
      const source = readFileSync(file);
      const mime = imageMimeTypes[extname(file).toLowerCase()];
      return `export default ${JSON.stringify(`data:${mime};base64,${source.toString('base64')}`)};`;
    },
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type === 'asset') {
          if (imageMimeTypes[extname(output.fileName).toLowerCase()]) {
            this.error(`Packaged image ${output.fileName} must be a data URL, not an external asset.`);
          }
          continue;
        }
        const bytes = Buffer.byteLength(output.code);
        if (bytes > maxJsBytes) {
          this.error(`${output.fileName}: ${bytes} bytes exceeds the 1,000,000-byte JS limit. Optimize source images or reduce chunk contents.`);
        }
      }
    }
  };
}
