import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  ssr: {
    // Workspace packages expose TypeScript source. Keep them in Vite's SSR
    // transform pipeline instead of handing extensionless imports to Node ESM.
    noExternal: [/^@metriccanvas\//]
  }
});
