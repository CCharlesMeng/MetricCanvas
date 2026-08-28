# tests.md — 测试用什么写、怎么定位元素、怎么跑?

## 框架与分布

<!-- 覆盖:仓根 vitest.config.ts、apps/*/tests/、packages/*/tests/、tools/*/tests/(2026-08-28) -->

| ID | 指路 | 是什么、何时用 | 被引用 |
| --- | --- | --- | --- |
| `TEST-1` | 仓根 `vitest.config.ts` | **vitest 是主测试框架**,单一配置在仓根,`include` 三段 glob 覆盖 `apps` / `packages` / `tools`。**没有 `environment` 设置**,即全部用例跑在 Node 环境——这决定了下面 `PATTERN-TEST-1`。跑法见 `RUN-16` | 166 个测试文件 |
| `TEST-2` | 各包 `tests/` 目录,文件名 `*.test.ts` | 位置约定:测试与 `src/` **平级**,不与被测文件同目录,不用 `__tests__`。分布(文件数):`apps/platform` 48、`packages/page` 26、`packages/widgets` 20、`packages/runtime-ui` 16、`packages/runtime` 15、`packages/mcp` 10、`apps/canvas` 8、`packages/data-gateway` 7、`tools/dqe-sim` 6、`packages/persistence-postgres` 3、`packages/page-lifecycle` / `packages/template-library` / `tools/dev-cli` 各 2、`tools/design-facts` 1 | `TEST-1` 的 glob |
| `TEST-3` | `packages/embed/tests/browser/embed.spec.ts` + `packages/embed/playwright.config.ts` | **唯一起浏览器的测试**(Playwright,21 个用例)。真实渲染、真实计算样式、真实视口。凡是「渲染结果对不对」「样式生效没」只能在这里断言。跑法见 `RUN-19` | `RUN-19` |
| `TEST-4` | `tests/contract.ts`(`packages/page-lifecycle`、`packages/template-library`),由各领域包的 `memory.contract.test.ts` 与 `packages/persistence-postgres/tests/*.contract.test.ts` 分别喂给内存/PostgreSQL 实现 | 跨实现共享的行为契约用例。同一个端口有两份实现时**照这个形状写**,不要给两份实现各写一套断言——任一断言在某一实现下失败就说明行为漂移了 | 每份契约各由 2 个实现测试消费 |
| `TEST-5` | `packages/embed/tests/serve.mjs` | 浏览器测试的静态服务(Playwright 的 `webServer`,`reuseExistingServer: true`)。也是 `RUN-8` 手工看示例页用的那个 | `TEST-3`、`RUN-8` |
| `TEST-10` | 直接 import 具体页面资产的用例:`apps/canvas/tests/flow-analysis-report.test.ts`、`.../customer-activity-risk-briefing.test.ts`、`packages/runtime/tests/ioc-*.test.ts`、`packages/runtime/tests/page-contract-integration.test.ts` | **页面资产级集成用例**,断言的是**跨产物一致性**:页面文档的查询与 `tools/dqe-sim/fixtures/` 的仿真 fixture 对不对得上、页面经编排后的数据流对不对。新增一份复杂页面时照这个形状写,别写成「断言它能通过校验」——那是 `RUN-17` 的事,见 `PATTERN-TEST-4` | 各 1 处,共 6 个文件 |

## 元素定位约定

<!-- 覆盖:packages/embed/tests/browser/、packages/runtime-ui/src/、packages/widgets/src/(2026-08-24) -->

| ID | 指路 | 是什么、何时用 | 被引用 |
| --- | --- | --- | --- |
| `TEST-6` | 结构属性,发出点在 `packages/runtime-ui/src/RuntimeSection.svelte`:`data-section-id`、`data-component`(值是 `<sectionId>/<componentId>`)、`data-component-type`、`data-component-variant` | **定位分区与组件单元格的首选手段**。它们是刻意留给测试与调试的结构锚点,不是样式钩子;改分区或组件 id 会连带影响它们 | `TEST-3` 的多数用例 |
| `TEST-7` | 挂载根 `[data-metriccanvas-runtime]`(发出点 `packages/embed/src/index.ts`),内部结构类名 `.runtime-view`、`.page-content`、`.page-section`、`.section-grid`、`.cell` | 嵌入形态的定位入口:先取挂载根,再往里取。`.cell` 是组件单元格,`:scope >` 配合它区分嵌套层级 | `TEST-3` 全部用例 |
| `TEST-8` | 表格内的 `data-column-field`、`data-table-title`(`packages/widgets/src/components/table/Table.svelte`);筛选控件的 `data-candidates-status`(`packages/runtime-ui/src/filters/DimensionFilter.svelte`) | 组件内部的结构锚点。列按字段名区分,候选值加载状态可直接断言 | `TEST-3` |
| `TEST-9` | `data-testid`,只出现在 `apps/platform/src/lib/PageAuthoringWorkbench.svelte`(14 处)与 `apps/platform/src/lib/workbench/MetadataJsonDrawer.svelte`(8 处) | **`data-testid` 在本仓不是通用约定**,只有 platform 创作工作台在用。查看器与统一运行时侧一律用 `TEST-6` / `TEST-7` 的结构属性,不要新加 `data-testid` | `apps/platform/tests/workbench/` |

## 规范

#### `PATTERN-TEST-1` · 单元测试不渲染组件

| 项 | 内容 |
| --- | --- |
| 规则 | vitest 侧**不能**渲染 Svelte 组件:没有 jsdom / happy-dom,没有 testing-library,没有组件挂载工具。因此组件行为必须先抽成纯函数再测(这就是 `COMP-9`~`COMP-14` 与 `table/*.ts` 存在的原因);真要断言渲染结果或样式,只能加 `TEST-3` 的用例。**「给这个组件加个单元测试」在本仓不成立**,计划期不要这么写任务 |
| 依据清单 | `TEST-1`、`TEST-2`、`TEST-3` |
| 依据样本 | 全仓 `package.json` 无 jsdom / happy-dom / testing-library 依赖;`vitest.config.ts` 无 `environment`;166 个 vitest 文件里零处 `mount(` / `render(`;`packages/widgets/tests/` 20 个文件测的全是 `options.ts` / `columns.ts` / `rows.ts` / `presentation.ts` / `view-state.ts` 这类纯函数 |
| 违例判定 | vitest 用例里出现组件挂载或 DOM 断言;或为了测组件而引入 DOM 环境依赖却没同时更新本条 |

#### `PATTERN-TEST-2` · 定位优先级:结构属性 → 语义角色 → 文案

| 项 | 内容 |
| --- | --- |
| 规则 | 浏览器测试定位元素依次尝试:`TEST-6` / `TEST-7` / `TEST-8` 的结构属性 → `getByRole`(含 `name` 与 `level`)→ `getByText`。列表类元素按 `data-section-id` / `data-component` / `data-column-field` 区分行与列,**不按 `nth-child` 或文本顺序** |
| 依据清单 | `TEST-6`、`TEST-7`、`TEST-8`、`TEST-9` |
| 依据样本 | `embed.spec.ts` 里 `locator('[data-component="tables/summary-table"]')`、`locator('[data-section-id="overview"]')`、`getByRole('heading', { name: …, level: 2 })`、`getByText('128,600')` 的混合用法,共 21 个用例 |
| 违例判定 | 用 `nth-child` / 数组下标定位业务元素,或在查看器侧新加 `data-testid` |

#### `PATTERN-TEST-3` · 依赖外部服务的用例必须显式门控

| 项 | 内容 |
| --- | --- |
| 规则 | 需要 Postgres / 容器的用例一律用 `describe.runIf(process.env.TEST_POSTGRES === '1')` 包起来,默认跳过。所以 `RUN-16` 全绿**不代表**这些用例跑过了——要跑得自己开开关(`RUN-14`)并按 `RUN-6` 准备容器 |
| 依据清单 | `TEST-4`、`RUN-14`、`RUN-6` |
| 依据样本 | `packages/persistence-postgres/tests/` 下三份测试的 `runIf`;该包的 `@testcontainers/postgresql` 开发依赖 |
| 违例判定 | 新增依赖外部服务的用例而不加门控(会让默认跑法变红),或用 `it.skip` 硬跳过代替门控 |

#### `PATTERN-TEST-4` · 页面文档改动的回归门是校验命令

| 项 | 内容 |
| --- | --- |
| 规则 | 改了 `STRUCT-7` 下的页面文档,或改了页面 Schema,回归门是 `RUN-17`(全量校验 10 份页面文档)+ `RUN-16`。**「这份页面文档合法吗」由 `RUN-17` 回答,不写成 vitest 用例**;针对具体页面资产的 vitest 用例只用来断言跨产物一致性(`TEST-10` 的形状) |
| 依据清单 | `RUN-17`、`STRUCT-7`、`TEST-1`、`TEST-10` |
| 依据样本 | `packages/page/src/validate-cli.ts` 遍历页面资产目录全量校验;`packages/page/tests/validate*.test.ts` 测的是校验器行为而不是具体页面资产;`TEST-10` 那 6 个文件断言的是页面文档与仿真 fixture / 编排结果的对应关系 |
| 违例判定 | 新增只为「断言某份 `pages/*.json` 合法」而存在的 vitest 用例;或改了页面文档只跑 `RUN-16` 就交 |
