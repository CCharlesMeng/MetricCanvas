import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifacts, renderSnapshot } from '../tools/package-build/surface';
import { describe, expect, it } from 'vitest';

/**
 * 四个交付物的公开面快照门禁(ADR-0071)。
 *
 * 交付物一旦发布，主入口与每个子路径导出的名字就是对外承诺。此前 `page` 主入口
 * 是 19 个 `export *`，公开面等于那 19 个模块的全部内容，新增符号会自动成为承诺
 * 且无人看见。快照把这件事变成显式的：任何名字进出都让门禁变红，评审时看到的
 * 是具体哪个符号。
 *
 * 枚举走语法解析而非运行时导入：`ui` 子路径导出 Svelte 组件，根 vitest 没有
 * svelte 插件，且公开面是「暴露了哪些名字」而不是「运行起来是什么值」。
 * 产物入口与源码入口的一致性由发布构建那张票单独接管。
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const snapshotDir = resolve(root, 'tests/public-api');
const update = process.env.UPDATE_PUBLIC_API === '1';

describe('四个交付物的公开面', () => {
  it('发布交付物解除 private 并与页面协议包锁步同版', () => {
    const page = JSON.parse(readFileSync(resolve(root, artifacts['@metriccanvas/page']!.manifest), 'utf8'));
    expect(page.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
    for (const [name, artifact] of Object.entries(artifacts)) {
      const manifest = JSON.parse(readFileSync(resolve(root, artifact.manifest), 'utf8'));
      expect(manifest.private, `${name} 必须允许发布`).not.toBe(true);
      expect(manifest.version, `${name} 必须与 @metriccanvas/page 同版`).toBe(page.version);
    }
  });

  for (const [name, artifact] of Object.entries(artifacts)) {
    it(`${name} 的导出名与快照一致`, () => {
      const file = resolve(snapshotDir, `${name.replace('@metriccanvas/', '')}.txt`);
      const actual = renderSnapshot(name, artifact.entries);
      if (update) {
        mkdirSync(snapshotDir, { recursive: true });
        writeFileSync(file, actual);
        return;
      }
      expect(existsSync(file), `缺少公开面快照 ${relative(root, file)}`).toBe(true);
      expect(actual).toBe(readFileSync(file, 'utf8'));
    });
  }

  it('每个交付物声明的子路径都被快照覆盖，新增子路径不能绕过门禁', () => {
    for (const [name, artifact] of Object.entries(artifacts)) {
      const manifest = JSON.parse(readFileSync(resolve(root, artifact.manifest), 'utf8')) as {
        exports?: Record<string, unknown>;
      };
      expect(Object.keys(manifest.exports ?? {}).sort(), `${name} 的 exports 与快照入口不一致`)
        .toEqual(Object.keys(artifact.entries).sort());
    }
  });
});
