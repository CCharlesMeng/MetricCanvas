# 依赖安全修复结果（2026-09-14）

本轮修复已完成。最终全依赖树 `pnpm audit --json` 返回 0 条已知漏洞告警；[审计原始 JSON](./2026-09-14-dependency-security-audit.json)与[完整依赖清单](./2026-09-14-npm-dependency-inventory.md)对应当前锁文件。此前剩余的 11 项告警（7 high、3 moderate、1 low；去重后 10 个 GHSA）已清除。零告警表示本次数据库未检出，不保证没有未披露漏洞。

## 已落实的版本

| 包 | 原版本 → 最终版本 | 处理与依据 |
| --- | --- | --- |
| `@sveltejs/kit` | 2.70.1 → 2.70.2 | 两应用最低版本为 `^2.70.2`；修复请求头拒绝服务。[GHSA-29g2-3rmr-qm68](https://github.com/advisories/GHSA-29g2-3rmr-qm68) |
| `@types/node` | 26.1.1 → 24.13.4 | 根目录、页面试验场及间接工具链统一到 Node 24；本地运行时 24.11.1，CI 使用 Node 24。属于兼容性对齐，不是 Node 运行时安全更新。 |
| `vitest` 与 `@vitest/*` | 4.1.10 → 4.1.11 | 修复 mocker 路径遍历 / 任意文件读取。[GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) |
| `cookie` | 0.6.0 → 0.7.2 | 仅覆盖 Kit 2.70.2 的依赖边，保留其旧 parse/serialize 接口；修复非法字符处理。[GHSA-pxg6-pf52-xh8x](https://github.com/advisories/GHSA-pxg6-pf52-xh8x) |
| `postcss` | 8.5.19 → 8.5.26 | 按用户指定采用 8.5.26，覆盖旧版本 `<8.5.26`；包含 8.5.23 的越界 source map 文件读取修复。[GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) |
| `nanoid` | 3.3.16 → 3.3.18 | 覆盖受影响旧版本，修复自定义生成器 size=0 无限循环。[GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) |
| `fast-uri` | 3.1.3 → 3.1.6 | 覆盖受影响 3.x 范围，修复下列 6 条公告。 |

安全覆盖声明在 `pnpm-workspace.yaml`，实际版本由 `pnpm-lock.yaml` 固定。PostCSS、nanoid、fast-uri 的修复版本均在其上游依赖范围内；定向更新未刷新旧解析，因此用显式范围覆盖保证安装修复版本。Cookie 不在 Kit 原声明的 `^0.6.0` 范围内，已专门验证兼容性。将来升级 Kit 后，应重新检查并移除已无必要的 cookie 覆盖；其余覆盖也应随上游修复与运行时版本更新复核。

Vitest 更新同时带来其工具链的兼容范围更新，包括 es-module-lexer、obug、picomatch、tinyexec 和 tinyrainbow；具体多版本分布见完整清单。其余用户指定的直接包版本保持：Svelte 5.56.6、adapter-static 3.0.10、vite-plugin-svelte 7.2.0、Vite 8.1.5、TypeScript 5.9.3、svelte-check 4.7.3、tsx 4.23.1、@sveltejs/package 2.5.8、@playwright/test 1.62.0。

## fast-uri 公告依据

fast-uri 公告的 3.x 修复线：

| 公告 | 问题 | 修复版本 |
| --- | --- | --- |
| [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx) | 字面反斜杠作为 authority 分隔符导致主机解析混淆 | 3.1.4 |
| [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7) | 反斜杠作为 authority 引导符导致主机解析混淆 | 3.1.5 |
| [GHSA-5jgf-p345-68v8](https://github.com/advisories/GHSA-5jgf-p345-68v8) | 相对协议引用跳过 IDN 规范化 | 3.1.6 |
| [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc) | 畸形 IPv6 规范化导致 SSRF 风险 | 3.1.6 |
| [GHSA-fph4-wmhf-6fwf](https://github.com/advisories/GHSA-fph4-wmhf-6fwf) | 主机名重复百分号解码导致 SSRF 风险 | 3.1.6 |
| [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp) | 百分号编码协议规范化导致主机解析混淆 | 3.1.6 |

## 验证

- `pnpm audit --json`：退出码 0，所有严重级别计数均为 0。
- `pnpm check`：安全修复批次通过，两个应用均 0 errors / 0 warnings；随后仅将 PostCSS 从 8.5.23 调整到 8.5.26，按构建工具变更重新验证两个应用构建。
- `pnpm test`：安全修复批次（PostCSS 8.5.23）使用 Vitest 4.1.11，126 个文件通过，922 项通过、1 项跳过。HTTP 集成测试在允许本地端口监听的环境执行。
- `pnpm build`、`pnpm build:playground`：PostCSS 8.5.26 下重新执行通过；仍有构建 chunk 体积提示。
- 对两个应用实际安装的 Kit 调用 `get_cookies` / `add_cookies_to_headers`：确认其解析到 cookie 0.7.2，解析解码、设置值、HttpOnly/Secure/SameSite 标志、删除的 Max-Age=0 均符合预期；非法名称、path、domain 均被拒绝。

## 依赖清单口径

全部 10 个 workspace（含根目录）共有 165 个外部包版本；生产树 29 项、开发树 156 项，两类交集 20 项。生产与开发清单按依赖路径独立统计，同一包可同时出现在两类中，因此不可直接相加。审计工具的 devDependencies 计数 136 是排除生产集合后的开发专属数，与清单开发树 156 项的口径不同。

[Markdown 全量清单](./2026-09-14-npm-dependency-inventory.md)分别列出直接生产依赖、直接开发依赖、workspace 内部依赖、peer 声明及两类的完整间接依赖；[JSON 清单](./2026-09-14-npm-dependency-inventory.json)保留来源 workspace 与锁定版本。包含跨平台可选包，并非生产部署产物的文件级 SBOM。
