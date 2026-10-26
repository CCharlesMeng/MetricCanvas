# Platform 交互审计先行整改结果

日期：2026-10-25。本文保留首次实施的验收环境与历史结果；当前 main 的迁移和交付验收见[交付记录](delivery.md)。本次用户确认先行实施 P1-2、P1-3、P2-1、P2-2、P2-4，五项本仓实现与本地验收完成。完整问题、确认范围及后续专项以[唯一执行计划](../../plan/2026-10-25-platform-interaction-audit.md)为准。

## 已关闭范围

| 原编号 | 最终行为 | 主要实现 |
|---|---|---|
| P1-2 | 默认展示已配置条件的业务名称与摘要；按需新增/编辑。基础表单支持筛选已选择/未选择、时间已填写/未填写；复杂规则完整保留，进入高级 JSON。语法错误和无效引用均不覆盖原规则，错误在窗口内解释 | `ConditionProperties.svelte`、`ConditionRuleEditor.svelte`、`condition-editor.ts`、`ComponentProperties.svelte` |
| P1-3 | 工作台页面标题与组件修改共用工作副本、本机保护及显式保存。发送 Agent 前排空正在编辑的输入，完整最新页面仍为创作输入。管理页基本信息独立直接保存接口保留 | `PageAuthoringWorkbench.svelte`，复用 `editPageTitle` 和原协调器 |
| P2-1 | 顶部“页面管理”使用既有 Dialog；右侧“页面属性”。管理信息不再插入画布挤占高度，发布、历史及权限/未决门禁保留 | `PageAuthoringWorkbench.svelte`、`Inspector.svelte` |
| P2-2 | 从目录选择组件后定位并显示选框；属性面板持续提供“切换组件”。原列表排序与画布移动逻辑保留 | `selectComponentFromList`、`Inspector.svelte` |
| P2-4 | 默认选择项只含可切换形态；若当前形态不能局部构造，仍保留其禁用的当前形态标签。完整不适用原因从既有候选契约按需展开，不放宽数据约束 | `Inspector.svelte` |

另修复浏览器验收暴露的既有页头生命周期错误：IocHeader 的字体就绪测量可能晚于卸载，旧代码访问已清空的 filters。测量闭包捕获本次元素，清理后令回调失效，ResizeObserver 同时断开；不改变布局或筛选语义。修复后的标题、保存、条件编辑重绘没有新增浏览器异常。修复前保留的日志时间为北京时间 19:38–19:39；正常 Platform 和 Playground 最终错误日志均为空。

界面复用 `@metriccanvas/ui` 的 Select、Textarea、Dialog 及原工作台按钮，表单间距沿用 PageInfoForm，条件区沿用 ComponentProperties 的呈现。验收夹具将全局 header/details 样式约束到 body 直接子项，避免污染真实工作台组件。

## 可观察场景与浏览器证据

页面：[`platform-interaction-audit.json`](../../../pages/platform/platform-interaction-audit.json)，Dashboard，当前产品版本 6.51，纯内联合成数据。操作和启动见 [`pages/platform/README.md`](../../../pages/platform/README.md#工作台交互审计验收)。

- Playground：`http://127.0.0.1:5173/pages/platform-interaction-audit` 自动发现新页面。清空“区域”后，带 visibleWhen 的文字消失，其他图表及合计不被假装重查；[页面截图](playground.jpg)。
- 隔离工作台：`http://127.0.0.1:5176/flow/create?page=platform-interaction-audit&resource=resource-platform-interaction-audit`。真实 Platform 组件、合成页面资产及明确标识的 Chat 替身；未连接真实服务。
- 标题输入通过实际键盘提交后：未保存工作副本、保存按钮及本机保护可见；`sendCount=0/infoWrites=0/assetWrites=0`，没有服务端写入。[未保存证据](title-unsaved.jpg)。确认保存后：`lastIntent=confirm-save`、`sendCount=1`，完整输入同时包含最新标题和新增条件，工作台变为已保存。[保存证据](title-saved.jpg)。
- 默认页面属性只有已配置条件摘要，没有大量空白 JSON。[摘要](condition-summary.jpg)、[基础表单](condition-basic.jpg)。非法 `{` 留在窗口报错；合法 JSON 中引用 missing 筛选器同样被拒绝，取消保留原规则。[非法引用](condition-rejected.jpg)。含 all/not/containsAny 的组合规则应用、重新打开仍完整保留，默认使用高级编辑。[组合规则](condition-complex.jpg)。
- 目录选择“底部区域占比”后，实际目标进入视口并显示蓝色选框（取样 top≈380px）；通过“切换组件”选择“操作说明”后目标切回 `intro/instructions`，top≈266px。[定位与切换](component-located.jpg)。
- 顶部“页面管理”打开既有对话框，关闭后回到原画布。[管理对话框](page-management.jpg)。
- 正常 Platform 查询页：`http://127.0.0.1:5175/create?page=demo&resource=local-demo`。本地资产及 DQE Sim，Chat 未接通；本轮只选择组件和查看候选，没有保存或发布这份已有工作副本。选 GMV 指标卡，展开查看不可用形态，柱/线/饼图明确解释当前 0 个维度而需要 1 个等原因。[形态原因](unavailable-shapes.jpg)。纯内联场景沿用原限制，不提供查询形态局部构造。

## 文档与 local-authoring

同步 `PAGE-METADATA.md`、`docs/page-metadata/conditions.md`、`sections-and-layout.md`、语义标题注册和页面目录说明。没有新增页面字段或升级 Schema。

在 `/tmp/mc-interaction-projection` 独立源码快照中生成投影：以当前 HEAD 产品真源、上述两份语义文档及新页面为输入；为保持已存在的并行表格文档及其已生成投影，纳入同一份表格文档后核对没有新的表格投影差异。只回写生成器产生的本次知识、镜像和清单差异，不手改派生哈希，不覆盖并行表格代码。`authoring:contracts:check` 在当前完整工作区通过。

默认只运行 local-authoring 验收；仓外安装验证、目录链接闭合、版本/哈希一致性及导出隔离均通过。生成器同步了其管理的镜像，没有追加其他 Skill 或真实模型验收。

## 已执行检查

| 检查 | 结果 |
|---|---|
| `pnpm exec vitest run`：condition-editor、property-edit、document-edit、component-list-order、working-copy-agent、authoring-sync、authoring-coordinator、page-info、platform-shell-and-composer | 9 文件、82 测试通过 |
| `pnpm --filter platform check` | Svelte 与 TypeScript 通过，0 错误/告警 |
| `pnpm --filter @metriccanvas/engine check` | Svelte 与 TypeScript 通过，0 错误/告警 |
| `pnpm build:packages` | 5 个包构建通过；Platform 最终构建从源码消费本批引擎修改 |
| `pnpm --filter platform build` | 通过；保留既有大包体积提示，未把它作为本批拆包范围 |
| `validate(platform-interaction-audit.json)` | 完整页面校验 0 错误 |
| `pnpm authoring:contracts:check` | 1090 product、4 authoring、1 interface 当前一致 |
| `pnpm authoring:check` | 4 文件、73 测试通过，包含仓外独立安装与生成隔离 |
| `git diff --check` | 通过 |
| 实际浏览器 | 正常 Platform、隔离工作台、Playground 关键路径均通过；截图如上 |

复杂度口径 `metriccanvas-ts-ast/1`、TypeScript 5.9.3；所有修改函数、全部新增辅助函数及源模板回调均已实测。`savePageTitle` 5→4、属性 `submit` 11→8、页头 `measure` 2→3；新增 `applyPropertyEdit` 和 `presentationLabel` 均为 12，其余新增函数不超过 7。本批无超限未关闭项，完整清单见[复杂度实测](complexity.md)。

## 保留项

- P1-4 多步撤销/重做、P1-5 编辑/预览连续性：按用户要求未实施，计划中分别保留问题、职责入口及待确认边界。现有单步撤销和预览状态所有权保持。
- P1-1、P2-3、P2-5 未获本批采纳，保留在完整清单，没有实施。
- 真实云宝、Java、DQE、Relay、门户、真实 DS 模型及远端 CI 未执行；本地合成链路不代表这些系统验收。
- 首次实施时未执行 Git 提交、推送、发布或工作树/分支清理；2026-10-26 的提交授权及交付验收见[交付记录](delivery.md)。原工作区并行改动保留。
