# npm 依赖全量清单（2026-09-14）

数据来自全部 10 个 workspace（含仓库根目录）的 manifest 与最终 pnpm 锁文件。

## 分类口径

- 生产：从各 workspace 的 `dependencies` / `optionalDependencies` 出发，递归包含其间接依赖。
- 开发：从各 workspace 的 `devDependencies` 出发，递归包含其间接依赖。
- 同一包可以同时属于两类；workspace 内部包单列，peer 声明另列。
- 全量树包含锁文件记录的跨平台可选包，不等于本机实际安装集合，也不等于最终浏览器 bundle；按 manifest 分类的生产依赖也不必然代表存在 Node 生产服务。
- 以下版本为实际锁定版本，不是 manifest 范围。

## 概览

外部包按「包名 + 版本」去重：**165** 项；生产树 **29** 项，开发树 **156** 项，两类重叠 **20** 项。

## 生产直接依赖

| 包 | 锁定版本 | 声明位置 |
| --- | --- | --- |
| `ajv` | 8.20.0 | `packages/page` |
| `echarts` | 6.1.0 | `packages/engine` |
| `svelte` | 5.56.6 | `packages/embed` |
| `zod` | 4.4.3 | `packages/page` |

## 开发直接依赖

| 包 | 锁定版本 | 声明位置 |
| --- | --- | --- |
| `@playwright/test` | 1.62.0 | `packages/embed`, `packages/metric-canvas` |
| `@sveltejs/adapter-static` | 3.0.10 | `apps/platform`, `apps/playground` |
| `@sveltejs/kit` | 2.70.2 | `apps/platform`, `apps/playground` |
| `@sveltejs/package` | 2.5.8 | `.` |
| `@sveltejs/vite-plugin-svelte` | 7.2.0 | `.`, `apps/platform`, `apps/playground`, `packages/embed`, `packages/metric-canvas` |
| `@types/node` | 24.13.4 | `.`, `apps/playground` |
| `svelte` | 5.56.6 | `.`, `apps/platform`, `apps/playground`, `packages/engine`, `packages/metric-canvas` |
| `svelte-check` | 4.7.3 | `apps/platform`, `apps/playground`, `packages/embed`, `packages/engine`, `packages/metric-canvas` |
| `tsx` | 4.23.1 | `.` |
| `typescript` | 5.9.3 | `.`, `packages/embed`, `packages/engine`, `packages/metric-canvas` |
| `vite` | 8.1.5 | `.`, `apps/platform`, `apps/playground`, `packages/embed`, `packages/metric-canvas` |
| `vitest` | 4.1.11 | `.` |

## Workspace 内部直接依赖

| 声明位置 | 内部包 | 分类 |
| --- | --- | --- |
| `apps/platform` | `@metriccanvas/application-runtime` | 生产 |
| `apps/platform` | `@metriccanvas/engine` | 生产 |
| `apps/platform` | `@metriccanvas/metric-canvas` | 生产 |
| `apps/platform` | `@metriccanvas/page` | 生产 |
| `apps/playground` | `@metriccanvas/application-runtime` | 生产 |
| `apps/playground` | `@metriccanvas/engine` | 生产 |
| `apps/playground` | `@metriccanvas/page` | 生产 |
| `packages/application-runtime` | `@metriccanvas/engine` | 生产 |
| `packages/embed` | `@metriccanvas/engine` | 生产 |
| `packages/embed` | `@metriccanvas/page` | 生产 |
| `packages/engine` | `@metriccanvas/page` | 生产 |
| `packages/engine` | `@metriccanvas/dqe-sim` | 开发 |
| `packages/metric-canvas` | `@metriccanvas/engine` | 生产 |
| `packages/metric-canvas` | `@metriccanvas/page` | 生产 |

## Peer 依赖声明

| 声明位置 | 包 | 要求范围 |
| --- | --- | --- |
| `packages/engine` | `svelte` | `>=5.29.0 <6` |
| `packages/metric-canvas` | `svelte` | `>=5.29.0 <6` |

## 生产依赖完整列表（含间接依赖）

| 包 | 锁定版本 | 另一类也使用 | 路径性质 |
| --- | --- | --- | --- |
| `@jridgewell/gen-mapping` | 0.3.13 | 是 | 存在必需路径 |
| `@jridgewell/remapping` | 2.3.5 | 是 | 存在必需路径 |
| `@jridgewell/resolve-uri` | 3.1.2 | 是 | 存在必需路径 |
| `@jridgewell/sourcemap-codec` | 1.5.5 | 是 | 存在必需路径 |
| `@jridgewell/trace-mapping` | 0.3.31 | 是 | 存在必需路径 |
| `@sveltejs/acorn-typescript` | 1.0.11 | 是 | 存在必需路径 |
| `@types/estree` | 1.0.9 | 是 | 存在必需路径 |
| `@types/trusted-types` | 2.0.7 | 是 | 存在必需路径 |
| `acorn` | 8.17.0 | 是 | 存在必需路径 |
| `ajv` | 8.20.0 | 否 | 存在必需路径 |
| `aria-query` | 5.3.1 | 是 | 存在必需路径 |
| `axobject-query` | 4.1.0 | 是 | 存在必需路径 |
| `clsx` | 2.1.1 | 是 | 存在必需路径 |
| `devalue` | 5.8.1 | 是 | 存在必需路径 |
| `echarts` | 6.1.0 | 否 | 存在必需路径 |
| `esm-env` | 1.2.2 | 是 | 存在必需路径 |
| `esrap` | 2.3.0 | 是 | 存在必需路径 |
| `fast-deep-equal` | 3.1.3 | 否 | 存在必需路径 |
| `fast-uri` | 3.1.6 | 否 | 存在必需路径 |
| `is-reference` | 3.0.3 | 是 | 存在必需路径 |
| `json-schema-traverse` | 1.0.0 | 否 | 存在必需路径 |
| `locate-character` | 3.0.0 | 是 | 存在必需路径 |
| `magic-string` | 0.30.21 | 是 | 存在必需路径 |
| `require-from-string` | 2.0.2 | 否 | 存在必需路径 |
| `svelte` | 5.56.6 | 是 | 存在必需路径 |
| `tslib` | 2.3.0 | 否 | 存在必需路径 |
| `zimmerframe` | 1.1.4 | 是 | 存在必需路径 |
| `zod` | 4.4.3 | 否 | 存在必需路径 |
| `zrender` | 6.1.0 | 否 | 存在必需路径 |

## 开发依赖完整列表（含间接依赖）

| 包 | 锁定版本 | 另一类也使用 | 路径性质 |
| --- | --- | --- | --- |
| `@emnapi/core` | 1.11.1 | 否 | 仅可选路径 |
| `@emnapi/runtime` | 1.11.1 | 否 | 仅可选路径 |
| `@emnapi/wasi-threads` | 1.2.2 | 否 | 仅可选路径 |
| `@esbuild/aix-ppc64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/android-arm` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/android-arm64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/android-x64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/darwin-arm64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/darwin-x64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/freebsd-arm64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/freebsd-x64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/linux-arm` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/linux-arm64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/linux-ia32` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/linux-loong64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/linux-mips64el` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/linux-ppc64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/linux-riscv64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/linux-s390x` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/linux-x64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/netbsd-arm64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/netbsd-x64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/openbsd-arm64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/openbsd-x64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/openharmony-arm64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/sunos-x64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/win32-arm64` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/win32-ia32` | 0.28.1 | 否 | 仅可选路径 |
| `@esbuild/win32-x64` | 0.28.1 | 否 | 仅可选路径 |
| `@jridgewell/gen-mapping` | 0.3.13 | 是 | 存在必需路径 |
| `@jridgewell/remapping` | 2.3.5 | 是 | 存在必需路径 |
| `@jridgewell/resolve-uri` | 3.1.2 | 是 | 存在必需路径 |
| `@jridgewell/sourcemap-codec` | 1.5.5 | 是 | 存在必需路径 |
| `@jridgewell/trace-mapping` | 0.3.31 | 是 | 存在必需路径 |
| `@napi-rs/wasm-runtime` | 1.1.6 | 否 | 仅可选路径 |
| `@oxc-project/types` | 0.139.0 | 否 | 存在必需路径 |
| `@playwright/test` | 1.62.0 | 否 | 存在必需路径 |
| `@polka/url` | 1.0.0-next.29 | 否 | 存在必需路径 |
| `@rolldown/binding-android-arm64` | 1.1.5 | 否 | 仅可选路径 |
| `@rolldown/binding-darwin-arm64` | 1.1.5 | 否 | 仅可选路径 |
| `@rolldown/binding-darwin-x64` | 1.1.5 | 否 | 仅可选路径 |
| `@rolldown/binding-freebsd-x64` | 1.1.5 | 否 | 仅可选路径 |
| `@rolldown/binding-linux-arm-gnueabihf` | 1.1.5 | 否 | 仅可选路径 |
| `@rolldown/binding-linux-arm64-gnu` | 1.1.5 | 否 | 仅可选路径 |
| `@rolldown/binding-linux-arm64-musl` | 1.1.5 | 否 | 仅可选路径 |
| `@rolldown/binding-linux-ppc64-gnu` | 1.1.5 | 否 | 仅可选路径 |
| `@rolldown/binding-linux-s390x-gnu` | 1.1.5 | 否 | 仅可选路径 |
| `@rolldown/binding-linux-x64-gnu` | 1.1.5 | 否 | 仅可选路径 |
| `@rolldown/binding-linux-x64-musl` | 1.1.5 | 否 | 仅可选路径 |
| `@rolldown/binding-openharmony-arm64` | 1.1.5 | 否 | 仅可选路径 |
| `@rolldown/binding-wasm32-wasi` | 1.1.5 | 否 | 仅可选路径 |
| `@rolldown/binding-win32-arm64-msvc` | 1.1.5 | 否 | 仅可选路径 |
| `@rolldown/binding-win32-x64-msvc` | 1.1.5 | 否 | 仅可选路径 |
| `@rolldown/pluginutils` | 1.0.1 | 否 | 存在必需路径 |
| `@standard-schema/spec` | 1.1.0 | 否 | 存在必需路径 |
| `@sveltejs/acorn-typescript` | 1.0.11 | 是 | 存在必需路径 |
| `@sveltejs/adapter-static` | 3.0.10 | 否 | 存在必需路径 |
| `@sveltejs/kit` | 2.70.2 | 否 | 存在必需路径 |
| `@sveltejs/load-config` | 0.2.0 | 否 | 存在必需路径 |
| `@sveltejs/package` | 2.5.8 | 否 | 存在必需路径 |
| `@sveltejs/vite-plugin-svelte` | 7.2.0 | 否 | 存在必需路径 |
| `@tybys/wasm-util` | 0.10.3 | 否 | 仅可选路径 |
| `@types/chai` | 5.2.3 | 否 | 存在必需路径 |
| `@types/cookie` | 0.6.0 | 否 | 存在必需路径 |
| `@types/deep-eql` | 4.0.2 | 否 | 存在必需路径 |
| `@types/estree` | 1.0.9 | 是 | 存在必需路径 |
| `@types/node` | 24.13.4 | 否 | 存在必需路径 |
| `@types/trusted-types` | 2.0.7 | 是 | 存在必需路径 |
| `@vitest/expect` | 4.1.11 | 否 | 存在必需路径 |
| `@vitest/mocker` | 4.1.11 | 否 | 存在必需路径 |
| `@vitest/pretty-format` | 4.1.11 | 否 | 存在必需路径 |
| `@vitest/runner` | 4.1.11 | 否 | 存在必需路径 |
| `@vitest/snapshot` | 4.1.11 | 否 | 存在必需路径 |
| `@vitest/spy` | 4.1.11 | 否 | 存在必需路径 |
| `@vitest/utils` | 4.1.11 | 否 | 存在必需路径 |
| `acorn` | 8.17.0 | 是 | 存在必需路径 |
| `aria-query` | 5.3.1 | 是 | 存在必需路径 |
| `assertion-error` | 2.0.1 | 否 | 存在必需路径 |
| `axobject-query` | 4.1.0 | 是 | 存在必需路径 |
| `chai` | 6.2.2 | 否 | 存在必需路径 |
| `chokidar` | 4.0.3 | 否 | 存在必需路径 |
| `chokidar` | 5.0.0 | 否 | 存在必需路径 |
| `clsx` | 2.1.1 | 是 | 存在必需路径 |
| `convert-source-map` | 2.0.0 | 否 | 存在必需路径 |
| `cookie` | 0.7.2 | 否 | 存在必需路径 |
| `dedent-js` | 1.0.1 | 否 | 存在必需路径 |
| `deepmerge` | 4.3.1 | 否 | 存在必需路径 |
| `detect-libc` | 2.1.2 | 否 | 存在必需路径 |
| `devalue` | 5.8.1 | 是 | 存在必需路径 |
| `es-module-lexer` | 2.3.2 | 否 | 存在必需路径 |
| `esbuild` | 0.28.1 | 否 | 存在必需路径 |
| `esm-env` | 1.2.2 | 是 | 存在必需路径 |
| `esrap` | 2.3.0 | 是 | 存在必需路径 |
| `estree-walker` | 3.0.3 | 否 | 存在必需路径 |
| `expect-type` | 1.4.0 | 否 | 存在必需路径 |
| `fdir` | 6.5.0 | 否 | 存在必需路径 |
| `fsevents` | 2.3.2 | 否 | 仅可选路径 |
| `fsevents` | 2.3.3 | 否 | 仅可选路径 |
| `is-reference` | 3.0.3 | 是 | 存在必需路径 |
| `kleur` | 4.1.5 | 否 | 存在必需路径 |
| `lightningcss` | 1.32.0 | 否 | 存在必需路径 |
| `lightningcss-android-arm64` | 1.32.0 | 否 | 仅可选路径 |
| `lightningcss-darwin-arm64` | 1.32.0 | 否 | 仅可选路径 |
| `lightningcss-darwin-x64` | 1.32.0 | 否 | 仅可选路径 |
| `lightningcss-freebsd-x64` | 1.32.0 | 否 | 仅可选路径 |
| `lightningcss-linux-arm-gnueabihf` | 1.32.0 | 否 | 仅可选路径 |
| `lightningcss-linux-arm64-gnu` | 1.32.0 | 否 | 仅可选路径 |
| `lightningcss-linux-arm64-musl` | 1.32.0 | 否 | 仅可选路径 |
| `lightningcss-linux-x64-gnu` | 1.32.0 | 否 | 仅可选路径 |
| `lightningcss-linux-x64-musl` | 1.32.0 | 否 | 仅可选路径 |
| `lightningcss-win32-arm64-msvc` | 1.32.0 | 否 | 仅可选路径 |
| `lightningcss-win32-x64-msvc` | 1.32.0 | 否 | 仅可选路径 |
| `locate-character` | 3.0.0 | 是 | 存在必需路径 |
| `magic-string` | 0.30.21 | 是 | 存在必需路径 |
| `mri` | 1.2.0 | 否 | 存在必需路径 |
| `mrmime` | 2.0.1 | 否 | 存在必需路径 |
| `nanoid` | 3.3.18 | 否 | 存在必需路径 |
| `obug` | 2.1.4 | 否 | 存在必需路径 |
| `obug` | 2.2.1 | 否 | 存在必需路径 |
| `pathe` | 2.0.3 | 否 | 存在必需路径 |
| `picocolors` | 1.1.1 | 否 | 存在必需路径 |
| `picomatch` | 4.0.5 | 否 | 存在必需路径 |
| `picomatch` | 4.0.7 | 否 | 存在必需路径 |
| `playwright` | 1.62.0 | 否 | 存在必需路径 |
| `playwright-core` | 1.62.0 | 否 | 存在必需路径 |
| `postcss` | 8.5.26 | 否 | 存在必需路径 |
| `readdirp` | 4.1.2 | 否 | 存在必需路径 |
| `readdirp` | 5.1.1 | 否 | 存在必需路径 |
| `rolldown` | 1.1.5 | 否 | 存在必需路径 |
| `sade` | 1.8.1 | 否 | 存在必需路径 |
| `scule` | 1.3.0 | 否 | 存在必需路径 |
| `semver` | 7.8.5 | 否 | 存在必需路径 |
| `set-cookie-parser` | 3.1.2 | 否 | 存在必需路径 |
| `siginfo` | 2.0.0 | 否 | 存在必需路径 |
| `sirv` | 3.0.2 | 否 | 存在必需路径 |
| `source-map-js` | 1.2.1 | 否 | 存在必需路径 |
| `stackback` | 0.0.2 | 否 | 存在必需路径 |
| `std-env` | 4.2.0 | 否 | 存在必需路径 |
| `svelte` | 5.56.6 | 是 | 存在必需路径 |
| `svelte-check` | 4.7.3 | 否 | 存在必需路径 |
| `svelte2tsx` | 0.7.61 | 否 | 存在必需路径 |
| `tinybench` | 2.9.0 | 否 | 存在必需路径 |
| `tinyexec` | 1.3.1 | 否 | 存在必需路径 |
| `tinyglobby` | 0.2.17 | 否 | 存在必需路径 |
| `tinyrainbow` | 3.1.1 | 否 | 存在必需路径 |
| `totalist` | 3.0.1 | 否 | 存在必需路径 |
| `tslib` | 2.8.1 | 否 | 仅可选路径 |
| `tsx` | 4.23.1 | 否 | 存在必需路径 |
| `typescript` | 5.9.3 | 否 | 存在必需路径 |
| `undici-types` | 7.18.2 | 否 | 存在必需路径 |
| `vite` | 8.1.5 | 否 | 存在必需路径 |
| `vitefu` | 1.1.3 | 否 | 存在必需路径 |
| `vitest` | 4.1.11 | 否 | 存在必需路径 |
| `why-is-node-running` | 2.3.0 | 否 | 存在必需路径 |
| `yaml` | 2.9.0 | 否 | 仅可选路径 |
| `zimmerframe` | 1.1.4 | 是 | 存在必需路径 |

## 机器可读证据

[JSON 完整清单](./2026-09-14-npm-dependency-inventory.json)包含每项依赖的来源 workspace、声明范围、锁定版本、分类与 overrides。
