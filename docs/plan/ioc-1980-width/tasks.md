# DataDashboard / US1980 · IOC 页面与组件宽度解耦 — 单仓实现计划

**Goal:** 解除 IOC 页面宽度与共享组件几何的耦合：Page Metadata 保持 `Section → Component`，页面只负责外框和网格分配，组件只服从运行时布局盒；1980px 作为跨页回归样本。

**关键结构决策:** 沿用 `layoutForm: dashboard` 作为页面外框几何唯一真源；跨组件比例只由 Section 的 `columnTracks` 表达；`RuntimeSection` 为每个 Component 生成 DOM 布局盒并建立容器边界。该盒是实现细节，不是元数据层级；组件根宽度恒服从该容器，内部响应式从全局视口切换到容器宽度。

**TaskPacket:** project=DataDashboard | codespec_path=docs/plan/ioc-1980-width | story=US1980 | test_framework=Vitest + Playwright | search_paths=apps/canvas/src/routes/(viewer)/pages/[pageId]/,apps/canvas/tests/,packages/runtime-ui/src/,packages/widgets/src/components/,packages/embed/tests/browser/,docs/host-contract.md | project_type=frontend | frontend_design_path=docs/plan/ioc-1980-width/story-delta-frontend-design.md | baseline_source=text_spec | prototype_dir= | reference_route= | affected_routes=/pages/ioc-project-overview,/pages/ioc-opportunity-analysis,/pages/ioc-opportunity-list,/pages/ioc-project-detail | required_states=overflow | restore_tasks=1,2,3,4 | risk_triggers=visual,shared-boundary,new-pattern

**知识 trace:** `PATTERN-STYLE-1`、`PATTERN-STYLE-2`、`PATTERN-STYLE-5`、`PATTERN-TEST-1`、`PATTERN-TEST-2`、`PATTERN-TEST-4`、`PATTERN-RUN-1`

## 项目边界

| 范围内 | 范围外 |
| --- | --- |
| IOC 四页的宽度分层契约；Canvas 看板外框；运行时组件布局盒的容器边界；项目详情专用 variant；1980px 与相同容器/不同视口回归 | 改页面数据、文案、交互；新增布局形态或组件宽度字段；改变既有容器阈值；修改非 IOC 报表观感 |

## 页面与文件

| 路由 / 文件 | 本 Story 的职责 | Task |
| --- | --- | --- |
| `/pages/ioc-project-overview`、`/pages/ioc-opportunity-analysis`、`/pages/ioc-opportunity-list`、`/pages/ioc-project-detail` | 复用公共满宽外框并纳入 1980 回归 | 1 |
| `apps/canvas/src/routes/(viewer)/pages/[pageId]/+page.svelte` | 按 `documentLayoutForm` 为看板布局形态交出全部可用宽度 | 1 |
| `apps/canvas/tests/dashboard-frame.test.ts` | 固化 Canvas 看板外框不回退到固定 1679px 轨道 | 1 |
| `docs/host-contract.md` | 明确宿主可用宽度与 1980 回归样本的边界 | 1 |
| `packages/runtime-ui/src/RuntimeSection.svelte` | 为每个 Component 的运行时布局盒建立 inline-size 容器边界；移除按子 variant 改写父网格 | 2 |
| `packages/widgets/src/components/report-header/ReportHeader.svelte` | `projectDetail` 根节点只服从组件布局盒 | 3 |
| `packages/widgets/src/components/key-value-panel/KeyValuePanel.svelte` | `detailSummary` 根节点和内部回流服从容器 | 3 |
| `packages/widgets/src/components/composite-card/CompositeCard.svelte` | `projectNorms` 根节点和内部回流服从容器 | 3 |
| `packages/widgets/src/components/table/Table.svelte` | `forecastMatrix` 根节点服从容器，宽表仅内部滚动 | 4 |
| `packages/widgets/src/components/field-text/FieldText.svelte` | `narrative` 根节点和内部回流服从容器 | 4 |
| `packages/embed/tests/browser/embed.spec.ts` | 真实 IOC 页面验证 1980 与相同容器/不同视口契约 | 2、3、4 |

## 用例追溯

| AT | 标题 | Task |
| --- | --- | --- |
| AT-1 | IOC 四页在 1980px 下占满宿主且无页面级横向滚动 | 1 |
| AT-2 | 相同容器宽度在不同视口下产生相同组件布局结果 | 2 |
| AT-3 | 项目详情页头、档案卡、规范卡服从各自的组件布局盒 | 3 |
| AT-4 | 项目详情预测表、叙事卡服从各自的组件布局盒且宽表只在内部滚动 | 4 |

## Task List

### Task 1: IOC 页面公共满宽外框 [用例: AT-1]

**受影响声明:** AC-2、R6-1、F2-1

- [x] 对公共外框取得因果证据：看板外框不含固定 1679px 轨道。
- [x] 实现公共宿主外框占满可用宽度，并同步宿主契约。
- [x] 回填 `alpha-tests.md`。

### Task 2: 建立组件容器宽度契约 [用例: AT-2]

**受影响声明:** AC-1、AC-4、R6-2、F2-2

- [x] 取得相同容器、不同视口的 RED。
- [x] 为运行时组件布局盒建立 inline-size 容器边界，移除父网格对子 variant 的读取并转绿。
- [x] 回填 `alpha-tests.md`。

### Task 3: 项目详情页头与档案区容器化 [用例: AT-3]

**受影响声明:** AC-1、AC-3、AC-4、R6-3、F2-3

- [x] 移除项目详情页头、档案卡、规范卡中的页面派生根宽。
- [x] 将其内部响应式输入迁移为容器宽度并取得 GREEN。
- [x] 回填 `alpha-tests.md`。

### Task 4: 项目详情预测表与叙事区容器化 [用例: AT-4]

**受影响声明:** AC-1、AC-3、AC-4、R6-4、F2-4

- [x] 移除预测表与叙事卡中的页面派生根宽。
- [x] 让表格内部滚动与叙事回流只由容器决定并取得 GREEN。
- [x] 回填 `alpha-tests.md`。

## 风险与回滚

| 风险 | 缓解 | 回滚 |
| --- | --- | --- |
| 公共构件 variant 被其他页面复用 | 仅修改项目详情有限 variant，并用真实四页做 1980 回归 | 恢复对应 variant 的内部规则，不回退 Canvas 公共满宽契约 |
| 宽表在窄容器被压缩 | 保留既有最小表宽，让表格自己的滚动层承载溢出 | 恢复表格内部滚动层规则 |
