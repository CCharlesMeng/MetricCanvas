# Platform 搭建画布交互优化验收

2026-10-19；基线 `7ec7bb855273d76e54034104a88585f2953a5420`。初次验收时在独立工作树实现，未改动原检出的并行工作。用户随后批准交付main，合并后复验见 [交付记录](../../plan/platform-canvas-c/delivery.md)。

## 已批准 C 的最终结果

移除侧栏摘要卡和重复移动/删除按钮；选中组件旁提供浮动操作条，使用清晰的蓝色微渐变细描边。操作条随选中组件和滚动/尺寸变化定位，目标不可见或退出编辑时隐藏；1280/1440、长标题、hover、键盘焦点与禁用状态已验证。

最终 SDD 验收见 [C 方案验收](../../plan/platform-canvas-c/acceptance.md)，25 条冻结规则全部通过，布局/规范/质量独立检视无阻断。原型已归档到私有分支 `codex/prototype-canvas-context-actions`，正式实现不导入原型。

## 功能与真源

| 能力 | 实现与验收 |
| --- | --- |
| 明确的拖动手柄、同分区/跨分区重排、实际宽度决定落点方向、边缘滚屏 | `packages/metric-canvas/src/AuthoringSection.svelte`；画布浏览器测试与 Platform 真实鼠标拖动 |
| 组件删除、Delete 输入隔离、撤销恢复、空草稿分区 | `apps/platform/src/lib/workbench/document-edit.ts` 与现有 Authoring 协调器；行为测试与 Platform 浏览器 |
| 分离组件配置/页面设置、组件清单、布局快捷宽度与逐轨调整、上移/下移 | `Inspector.svelte` 与 `ComponentProperties.svelte`；1280/1440 浏览器与截图 |
| 可直接加载的页面 | `pages/platform-canvas-experience.json`，目录注册与 `pages/README.md` 已同步；无真实业务数据 |
| 协议说明 | `PAGE-METADATA.md`、`docs/page-metadata/sections-and-layout.md`；无新 Schema 字段或版本变化 |
| 创作 Skill | 从产品真源运行 `pnpm authoring:contracts` 生成，独立目录复制与校验器等价测试通过 |

## 本地验证

- `pnpm exec vitest run tests/local-authoring-skill.test.ts tests/page-reference.test.ts tests/authoring-export-isolation.test.ts apps/platform/tests/workbench/canvas-experience.test.ts apps/platform/tests/workbench/document-edit.test.ts apps/platform/tests/workbench/authoring-coordinator.test.ts apps/platform/tests/workbench/authoring-sync.test.ts apps/platform/tests/workbench/property-edit.test.ts packages/metric-canvas/tests/authoring-layout.test.ts`：9 文件、96 测试通过。
- `pnpm --filter @metriccanvas/metric-canvas test:browser`：15 项通过，包括原生鼠标拖动、查询/分页状态保留、正式渲染无搭建装饰、带内边距分区落点横线与取消反馈。
- `node apps/platform/tests/workbench/canvas-experience-browser.mjs`：完整消费 `pages/platform-canvas-experience.json`；真实鼠标跨分区拖动、上下落点、排序、快捷宽度、画布就地操作条删除、键盘删除/文字编辑、撤销、空分区接收、最后组件拒绝、仅显式保存及页面设置均通过。页面资产与保存使用浏览器受控端口。
- `pnpm --filter @metriccanvas/metric-canvas check`、`pnpm --filter platform check`、`pnpm exec tsc --noEmit -p tests/tsconfig.json`：通过。
- `pnpm --filter platform build` 与画布包 build：通过；保留现有大 chunk 警告。
- `pnpm exec tsx packages/page/src/validate-cli.ts pages`：26 页面全部通过。
- `pnpm authoring:contracts:check`、`python3 metriccanvas-authoring/scripts/check_bundle.py`：通过，2631 项摘要核对通过。
- 使用原检出已有的锁定 Python 虚拟环境运行 `metriccanvas-authoring/test-harness/run_tests.py`：540 项，539 通过、1 跳过；脚本化无模型回归，无真实模型调用。
- `git diff --check`：通过。

浏览器脚本默认截图位于 `/private/tmp/metriccanvas-canvas-experience/`；`CANVAS_EVIDENCE_DIR` 可指定输出目录。最终截图与机器证据归档在 `docs/plan/platform-canvas-c/evidence/`。1280/1440 宽度均未出现配置面板横向溢出。

## 边界

- 保留单页至少一个组件的正式协议要求；删除最后一个组件返回明确提示，原草稿不变。
- 删除顶层组件时共享页面数据源不回收；容器组件整体操作，未新增嵌套子项的单独编辑。
- 沿用现有单步撤销、本地保护与显式保存流程；独立集成应用须启用 `allowDelete` 并处理删除意图。
- 本地静态、浏览器、受控资产与保存验证已完成；真实 Java 资产服务、真实 DQE/Relay、真实模型、远端 CI 与部署未运行。
