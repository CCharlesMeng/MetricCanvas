import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { build } from 'vite';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const packages = new Map(
  readdirSync(resolve(root, 'packages')).map((directory) => {
    const path = resolve(root, 'packages', directory);
    const manifest = JSON.parse(readFileSync(resolve(path, 'package.json'), 'utf8'));
    return [manifest.name, { path, manifest }];
  })
);

function installedWorkspaceDependencies(name: string, found = new Set<string>()): Set<string> {
  if (found.has(name)) return found;
  const pkg = packages.get(name);
  if (!pkg) return found;
  found.add(name);
  for (const dependency of Object.keys({
    ...pkg.manifest.dependencies,
    ...pkg.manifest.optionalDependencies,
    ...pkg.manifest.peerDependencies
  })) installedWorkspaceDependencies(dependency, found);
  return found;
}

describe('纯渲染交付不包含创作 Module', () => {
  it('安装依赖单向指向渲染包，创作包不是纯渲染的传递依赖', () => {
    expect(installedWorkspaceDependencies('@metriccanvas/metric-canvas')).toContain('@metriccanvas/runtime-ui');
    for (const name of ['@metriccanvas/runtime-ui', '@metriccanvas/embed']) {
      const installed = installedWorkspaceDependencies(name);
      expect(installed).not.toContain('@metriccanvas/metric-canvas');
      for (const dependency of installed) {
        const files = readdirSync(resolve(packages.get(dependency)!.path, 'src'), { recursive: true });
        expect(files.filter((file) => /authoring|MetricCanvas|QueryInspector/i.test(String(file)))).toEqual([]);
      }
    }
  });

  it('实际嵌入构建的模块图及所有 JS/CSS 产物均不加载创作实现', async () => {
    const modules = new Set<string>();
    const artifacts: string[] = [];
    await build({
      root: resolve(root, 'packages/embed'),
      configFile: resolve(root, 'packages/embed/vite.config.ts'),
      logLevel: 'silent',
      build: { write: false },
      plugins: [{
        name: 'assert-render-only-graph',
        generateBundle(_options, bundle) {
          for (const id of this.getModuleIds()) modules.add(id);
          for (const output of Object.values(bundle)) {
            if (output.type === 'chunk') artifacts.push(output.code);
            else if (/\.(css|js)$/.test(output.fileName)) artifacts.push(String(output.source));
          }
        }
      }]
    });
    expect([...modules].some((id) => id.endsWith('/RuntimeSurface.svelte'))).toBe(true);
    expect([...modules].filter((id) => /packages\/metric-canvas\/|authoring-layout|AuthoringSection|QueryInspector/.test(id))).toEqual([]);
    expect(artifacts.length).toBeGreaterThan(0);
    for (const artifact of artifacts) {
      expect(artifact).not.toMatch(/authoring-controls|authoring-selected|application\/x-metriccanvas-component|select_component|move_component|edit_component/);
    }
  }, 60_000);
});
