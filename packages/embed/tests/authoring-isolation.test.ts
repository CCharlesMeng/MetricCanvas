import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { build } from 'vite';

interface WorkspacePackage {
  path: string;
  manifest: {
    name: string;
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
}

const root = fileURLToPath(new URL('../../..', import.meta.url));

/** packages/ 下既有包，也有按交付物分组的目录(ADR-0071)，分组目录自身没有 manifest。 */
function discoverPackages(directory: string, depth = 0): WorkspacePackage[] {
  const manifestPath = resolve(directory, 'package.json');
  if (existsSync(manifestPath)) {
    return [{ path: directory, manifest: JSON.parse(readFileSync(manifestPath, 'utf8')) }];
  }
  if (depth > 1) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => discoverPackages(resolve(directory, entry.name), depth + 1));
}

const packages = new Map(
  discoverPackages(resolve(root, 'packages')).map((pkg) => [pkg.manifest.name, pkg])
);

/** engine 把四份源码收进一个包，所以它没有单一 src/，各源码目录各带一个(ADR-0071)。 */
function sourceDirectories(path: string): string[] {
  if (existsSync(resolve(path, 'src'))) return [resolve(path, 'src')];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(path, entry.name, 'src')))
    .map((entry) => resolve(path, entry.name, 'src'));
}

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
    expect(installedWorkspaceDependencies('@metriccanvas/metric-canvas')).toContain('@metriccanvas/engine');
    for (const name of ['@metriccanvas/engine', '@metriccanvas/embed']) {
      const installed = installedWorkspaceDependencies(name);
      expect(installed).not.toContain('@metriccanvas/metric-canvas');
      for (const dependency of installed) {
        for (const directory of sourceDirectories(packages.get(dependency)!.path)) {
          const files = readdirSync(directory, { recursive: true });
          expect(files.filter((file) => /authoring|MetricCanvas|QueryInspector/i.test(String(file)))).toEqual([]);
        }
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
