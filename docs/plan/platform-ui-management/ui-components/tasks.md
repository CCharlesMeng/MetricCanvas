# MetricCanvas UI / 公共控件 — 实现计划

**Goal:** 独立可消费的中性基础 UI；日期保持既有行为，管理控件按冻结 OS Theme 来源还原。

**关键结构决策:** REQ-DEC-1/2/3；UI-only 不加载领域/图表。页面 Table 不在本 Story 迁移。

**TaskPacket:** project=DataDashboard | codespec_path=docs/plan/platform-ui-management | story=ui-components | verification_schema=v2 | test_framework=vitest | component_test_status=unavailable | component_test_framework=none | browser_test_status=available | browser_test_framework=playwright | search_paths=packages/ui | project_type=frontend | frontend_design_path=docs/plan/platform-ui-management/ui-components/story-delta-frontend-design.md | baseline_source=reference_page | prototype_dir= | reference_route=https://opentiny.design/tiny-vue/zh-CN/os-theme/components/grid | affected_routes=/tests/browser/index.html | required_states=hover,focus,disabled,selected,empty,overflow | restore_tasks=2,3,4,5,6 | risk_triggers=visual,new-pattern,shared-boundary,interaction

## 项目边界

| 范围内 | 范围外 |
| --- | --- |
| packages/ui 及直接工程入口 | 页面资产/查询/保存/发布；普通引擎 Table；未使用的高级 Grid |

## 页面、路由与组件层级

| 路由 | 页面/入口 | 变化 |
| --- | --- | --- |
| /tests/browser/index.html | UiHarness | 使用真实控件组成验证入口 |

UiHarness → Button / Input / Textarea / Select / Tabs / Tag / Grid / Pagination / Dropdown / Dialog / Empty / DatePicker。

## 模块与文件

| 文件 | 类型 | 新建/修改 | 职责与对外导出 | 复用既有资产 | Task |
| --- | --- | --- | --- | --- | --- |
| packages/ui/src/components/date-picker/DatePicker.svelte | 组件/类型/验证 | 新建 | 日期迁移，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 1 |
| packages/ui/src/components/date-picker/DatePickerIcon.svelte | 组件/类型/验证 | 新建 | 日期迁移，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 1 |
| packages/ui/src/components/date-picker/calendar.ts | 组件/类型/验证 | 新建 | 日期迁移，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 1 |
| packages/ui/src/types.ts | 组件/类型/验证 | 新建 | 日期迁移，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 1 |
| packages/ui/tests/calendar.test.ts | 组件/类型/验证 | 新建 | 日期迁移，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 1 |
| packages/ui/src/components/button/Button.svelte | 组件/类型/验证 | 新建 | 按钮与输入，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 2 |
| packages/ui/src/components/input/Input.svelte | 组件/类型/验证 | 新建 | 按钮与输入，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 2 |
| packages/ui/src/components/textarea/Textarea.svelte | 组件/类型/验证 | 新建 | 按钮与输入，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 2 |
| packages/ui/src/shared/Theme.svelte | 组件/类型/验证 | 新建 | 按钮与输入，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 2 |
| packages/ui/src/components/select/Select.svelte | 组件/类型/验证 | 新建 | 选择与菜单，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 3 |
| packages/ui/src/components/dropdown/Dropdown.svelte | 组件/类型/验证 | 新建 | 选择与菜单，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 3 |
| packages/ui/src/shared/popover.ts | 组件/类型/验证 | 新建 | 选择与菜单，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 3 |
| packages/ui/src/components/grid/Grid.svelte | 组件/类型/验证 | 新建 | 表格与分页，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 4 |
| packages/ui/src/components/pagination/Pagination.svelte | 组件/类型/验证 | 新建 | 表格与分页，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 4 |
| packages/ui/src/types.ts | 组件/类型/验证 | 新建 | 表格与分页，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 4 |
| packages/ui/src/components/tabs/Tabs.svelte | 组件/类型/验证 | 新建 | 页签与状态，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 5 |
| packages/ui/src/components/tag/Tag.svelte | 组件/类型/验证 | 新建 | 页签与状态，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 5 |
| packages/ui/src/components/empty/Empty.svelte | 组件/类型/验证 | 新建 | 页签与状态，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 5 |
| packages/ui/src/components/dialog/Dialog.svelte | 组件/类型/验证 | 新建 | 对话框与展示入口，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 6 |
| packages/ui/tests/browser/UiHarness.svelte | 组件/类型/验证 | 新建 | 对话框与展示入口，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 6 |
| packages/ui/tests/browser/main.ts | 组件/类型/验证 | 新建 | 对话框与展示入口，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 6 |
| packages/ui/tests/browser/index.html | 组件/类型/验证 | 新建 | 对话框与展示入口，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 6 |
| packages/ui/src/index.ts | 组件/类型/验证 | 新建 | 对话框与展示入口，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 6 |
| packages/ui/tests/browser/components.spec.ts | 组件/类型/验证 | 新建 | 浏览器可观察行为，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 7 |
| packages/ui/playwright.config.ts | 组件/类型/验证 | 新建 | 浏览器可观察行为，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 7 |
| packages/ui/vite.config.ts | 组件/类型/验证 | 新建 | 浏览器可观察行为，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 7 |
| packages/ui/package.json | 组件/类型/验证 | 新建 | 浏览器可观察行为，仅中性值与事件 | 原日期实现 / 官方 CSS 资产；其余无现成公开基础控件 | 7 |

## 状态与数据流

| 状态 | 所有者 | 来源 | 消费方 | 失效 |
| --- | --- | --- | --- | --- |
| value/rows/page/active | 调用者 | props | 控件 | 新输入替换 |
| 输入草稿/焦点/浮层 | 控件 | 原生事件 | 控件 | commit/关闭/卸载 |

## 视觉基线来源

| 项 | 内容 |
| --- | --- |
| 基线档位 | reference_page |
| 视觉来源 | 官方 OS Theme 3.32.0，资产摘要见 ../../../evidence/platform-ui-os-theme-2026-10-12/sources.json；日期保持原冻结来源与样式 |
| 区块 | 同态基础控件；不复制文档站业务文案与布局 |
| 必测状态 | default/hover/focus/disabled/selected/open/empty/error 中实际使用者 |
| 已知缺口 | 官方状态实测尚在补齐；缺口不宣称通过 |

## 用例追溯

| AT | 标题 | 验证范围 | 验证方法 | Task |
| --- | --- | --- | --- | --- |
| AT-UI-1 | 日期迁移 | S1_COMPONENT | test_case | 1 |
| AT-UI-2 | 按钮与输入 | S1_COMPONENT | restore_contract | 2 |
| AT-UI-3 | 选择与菜单 | S1_COMPONENT | restore_contract | 3 |
| AT-UI-4 | 表格与分页 | S1_COMPONENT | restore_contract | 4 |
| AT-UI-5 | 页签与状态 | S1_COMPONENT | restore_contract | 5 |
| AT-UI-6 | 对话框与展示入口 | S1_COMPONENT | restore_contract | 6 |
| AT-UI-7 | 浏览器可观察行为 | S1_COMPONENT | test_case | 7 |

## Task List

步骤勾选表示实施与证据登记已完成；逐声明是否验收仍以 alpha-tests.md 为准。完整状态视觉、Edge 与真实服务缺口未因勾选消失。

### Task 1: 日期迁移 [用例: AT-UI-1]

**形态:** 逻辑

**受影响声明:** AT-UI-1

**Files:**

- Create: `packages/ui/src/components/date-picker/DatePicker.svelte` — 日期迁移
- Create: `packages/ui/src/components/date-picker/DatePickerIcon.svelte` — 日期迁移
- Create: `packages/ui/src/components/date-picker/calendar.ts` — 日期迁移
- Create: `packages/ui/src/types.ts` — 日期迁移
- Create: `packages/ui/tests/calendar.test.ts` — 日期迁移

- [x] **Step 1: 基线与缺口** — 核对来源及原行为，新增控件无原实现 RED。
- [x] **Step 2: 实现与验证** — 按冻结事实实现并取得相应证据。
- [x] **Step 3: 记录证据** — 更新声明账本，按用户要求不自动提交。

### Task 2: 按钮与输入 [用例: AT-UI-2]

**形态:** 还原

**受影响声明:** AT-UI-2

**Files:**

- Create: `packages/ui/src/components/button/Button.svelte` — 按钮与输入
- Create: `packages/ui/src/components/input/Input.svelte` — 按钮与输入
- Create: `packages/ui/src/components/textarea/Textarea.svelte` — 按钮与输入
- Create: `packages/ui/src/shared/Theme.svelte` — 按钮与输入

- [x] **Step 1: 基线与缺口** — 核对来源及原行为，新增控件无原实现 RED。
- [x] **Step 2: 实现与验证** — 按冻结事实实现并取得相应证据。
- [x] **Step 3: 记录证据** — 更新声明账本，按用户要求不自动提交。

### Task 3: 选择与菜单 [用例: AT-UI-3]

**形态:** 还原

**受影响声明:** AT-UI-3

**Files:**

- Create: `packages/ui/src/components/select/Select.svelte` — 选择与菜单
- Create: `packages/ui/src/components/dropdown/Dropdown.svelte` — 选择与菜单
- Create: `packages/ui/src/shared/popover.ts` — 选择与菜单

- [x] **Step 1: 基线与缺口** — 核对来源及原行为，新增控件无原实现 RED。
- [x] **Step 2: 实现与验证** — 按冻结事实实现并取得相应证据。
- [x] **Step 3: 记录证据** — 更新声明账本，按用户要求不自动提交。

### Task 4: 表格与分页 [用例: AT-UI-4]

**形态:** 还原

**受影响声明:** AT-UI-4

**Files:**

- Create: `packages/ui/src/components/grid/Grid.svelte` — 表格与分页
- Create: `packages/ui/src/components/pagination/Pagination.svelte` — 表格与分页
- Create: `packages/ui/src/types.ts` — 表格与分页

- [x] **Step 1: 基线与缺口** — 核对来源及原行为，新增控件无原实现 RED。
- [x] **Step 2: 实现与验证** — 按冻结事实实现并取得相应证据。
- [x] **Step 3: 记录证据** — 更新声明账本，按用户要求不自动提交。

### Task 5: 页签与状态 [用例: AT-UI-5]

**形态:** 还原

**受影响声明:** AT-UI-5

**Files:**

- Create: `packages/ui/src/components/tabs/Tabs.svelte` — 页签与状态
- Create: `packages/ui/src/components/tag/Tag.svelte` — 页签与状态
- Create: `packages/ui/src/components/empty/Empty.svelte` — 页签与状态

- [x] **Step 1: 基线与缺口** — 核对来源及原行为，新增控件无原实现 RED。
- [x] **Step 2: 实现与验证** — 按冻结事实实现并取得相应证据。
- [x] **Step 3: 记录证据** — 更新声明账本，按用户要求不自动提交。

### Task 6: 对话框与展示入口 [用例: AT-UI-6]

**形态:** 还原

**受影响声明:** AT-UI-6

**Files:**

- Create: `packages/ui/src/components/dialog/Dialog.svelte` — 对话框与展示入口
- Create: `packages/ui/tests/browser/UiHarness.svelte` — 对话框与展示入口
- Create: `packages/ui/tests/browser/main.ts` — 对话框与展示入口
- Create: `packages/ui/tests/browser/index.html` — 对话框与展示入口
- Create: `packages/ui/src/index.ts` — 对话框与展示入口

- [x] **Step 1: 基线与缺口** — 核对来源及原行为，新增控件无原实现 RED。
- [x] **Step 2: 实现与验证** — 按冻结事实实现并取得相应证据。
- [x] **Step 3: 记录证据** — 更新声明账本，按用户要求不自动提交。

### Task 7: 浏览器可观察行为 [用例: AT-UI-7]

**形态:** 逻辑

**受影响声明:** AT-UI-7

**Files:**

- Create: `packages/ui/tests/browser/components.spec.ts` — 浏览器可观察行为
- Create: `packages/ui/playwright.config.ts` — 浏览器可观察行为
- Create: `packages/ui/vite.config.ts` — 浏览器可观察行为
- Create: `packages/ui/package.json` — 浏览器可观察行为

- [x] **Step 1: 基线与缺口** — 核对来源及原行为，新增控件无原实现 RED。
- [x] **Step 2: 实现与验证** — 按冻结事实实现并取得相应证据。
- [x] **Step 3: 记录证据** — 更新声明账本，按用户要求不自动提交。

## 风险与回滚

保留原根浮层、Svelte 最低版本消费、日期共享校验向量；回退只恢复导入与源码，不改页面数据。
