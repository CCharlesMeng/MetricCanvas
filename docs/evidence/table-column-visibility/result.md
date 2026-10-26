# 表格列条件显隐：本仓实现与本地验收

日期：2026-10-26。实施检出：`/Users/moon/.codex/worktrees/table-column-visibility/DataDashboard`，分支 `codex/table-column-visibility`，初始基线 `fea823fc7458f47fa9d803d6d26da89f151c82eb`，交付集成基线 `50485ec7b421a44ab01a461fc0c4adf1d7c6b191`。本批写出 Schema 6.62，能力标识为 `conditional-table-columns`。本记录覆盖交付前本地集成；提交、远端和 CI 结果以 Git 及最终交付回执为准。未改主工作区并行产品修改，未部署。

## 完成范围

字段列与递归列组的 `visibleWhen` 共用原条件求值。列隐藏后清除相关用户排序、表头条件、草稿和候选请求，搜索只读取可见 main 字段；保留业务默认排序、仍有效关键词及其他列操作。没有有效搜索时的纯列变化保留页码与请求代次。空列组收起，零业务列保留标题和专用提示，释放展开实例。

普通/embedded/forecastMatrix/reportCompact、Tab、详情与行内子表共用列规则。私有输入不能被其他作用域列条件引用。原始声明、源字段和共享数据快照不裁剪；新搜索关联与远程源独占约束只对显式声明列条件的表格生效。新能力不能借通用 6.35 条件门禁或 5.x 读取路径进入。

正文/详情 Excel、Report PDF/PNG共用冻结投影；导出启动后修改页面筛选，文件仍保持启动时列范围。已有行内子表导出限制保留，未将显隐当作权限或停查机制。

## 文件组织与唯一归属

| 位置 | 唯一职责 |
|---|---|
| `packages/page/src/schema/components/table.ts` | 列协议、Zod 和对应递归类型 |
| `packages/page/src/table/` | 列遍历与字段身份、搜索关联、输入作用域、原文档编辑定位、原视图与展开模板协议 |
| `packages/engine/runtime/src/table/` | 纯列投影、纯视图调和、原 TableSession 提交、候选与展开实例生命周期 |
| `packages/engine/runtime-ui/src/table/` | 原控制器草稿/选项、视图接入、原导出任务及 Excel 编码 |
| `packages/engine/widgets/src/components/table/header/` | 从既有 Table 提取页头和原样式；布局继续使用原表头算法 |

原公开导出符号保留，新增内部共享符号经公开面快照核对；没有新旧两份实现或旧文件透传壳。schema、能力扫描、编辑和布局复用声明列遍历/叶子规则。所有新增手写实现文件低于 400 行；迁入原有大职责文件不代表其存量复杂度已清零。

## 验收命令与结果

| 检查 | 结果与证据边界 |
|---|---|
| `pnpm test --exclude tests/authoring-export-isolation.test.ts` | **346 文件通过，3091 测试通过、4 项原有跳过**。包含协议、运行时、widgets、平台/Playground、本地创作、仓外安装及公开面回归 |
| `METRICCANVAS_PYTHON=<项目已有工具虚拟环境>/bin/python pnpm test tests/authoring-export-isolation.test.ts -t 无旧链时可运行` | 最终源码的仓外独立导出检查 **1 通过，29 未选择**；不把未选择项计为通过 |
| 导出隔离完整检查 | 较早实施快照的该文件 30 项通过；当时整体 authoring 检查另有知识预算、升级样例两项失败，修复后已由上述当前源码测试覆盖。不将较早检查冒充最终源码 30 项全量复跑 |
| `pnpm check` | TypeScript、各包及 Platform/Playground 的 Svelte 检查通过，0 个 Svelte 错误/警告 |
| `pnpm build:packages` | 五个产品包构建通过 |
| `pnpm authoring:contracts` / `authoring:contracts:check` | 从产品真源生成并一致性核对；1220 product、4 authoring、1 interface 输出 |
| `table-column-visibility-browser.mjs` | Chrome 实际页面通过：四变体、搜索缩放、选项回退、可见复合字段 XLSX、零列、390px、展开释放、子表私有呈现、详情和 Tab；无 pageerror |
| `table-column-export-browser.mjs` | Chrome 实际 PDF/PNG 下载通过；启动后切换筛选，冻结视图仍无隐藏列；核对文件签名与渲染表头，无 pageerror |

本地创作新增精确主题 `table.visibility`。主题输出 13348 字节，`table.search` 16040 字节、`table.export` 16373 字节，均小于既有 16384 字节预算；完整规则保留，不提高预算或截断知识。独立 Skill 的哈希/知识闭合、仓外校验与旧页面升级由本地创作测试覆盖。

使用项目已安装 Python 3.12 虚拟环境提取现有 MCP 工具契约，未运行真实模型或真实外部服务。系统 Python 缺少 fastmcp 的环境错误未作为产品失败或通过证据。

浏览器复现：在该检出执行 `pnpm --filter playground dev --host 127.0.0.1 --port 5197`，然后运行上述两个浏览器脚本。原始日志、截图、工作簿、PDF、PNG和复杂度 JSON 保存在本地 `artifacts/`，按仓库规则不随 Git 交付。

## 功能到真源的映射

| 能力 | 实际页面 | 文档/独立本地创作 |
|---|---|---|
| 列组、四变体、搜索、Excel | `/pages/table-column-visibility` | `components/table.md#table-column-visibility`，`table.visibility`，真实场景同份合法夹具 |
| Tab、快照详情、内联展开子表 | `/pages/table-column-visibility-scopes` | 同一列规则；子表/详情原限制和输入隔离 |
| PDF/PNG冻结 | `/pages/table-column-visibility-report` | 表格导出与条件文档、Report 既有导出协议 |
| 旧版/非法 row/搜索字段缺列/远程独占/私有输入 | page 与 runtime 的 `table-column-*.test.ts`、生成契约向量 | 专用能力下限、错误路径及独立校验器 |

上述浏览器页面使用内联合成数据；远程调和通过模拟网关集成测试验证一次请求、视图清理与业务排序保留。查询子表的原有执行、取消、隔离由既有回归继续覆盖。没有真实 DQE/Relay/业务事实接入结果，不宣称其已验收。

## 复杂度与剩余项

工具 `metriccanvas-ts-ast/1`，TypeScript 5.9.3。交付基线重新扫描 62 个受影响手写可执行文件，1994 个函数/闭包（生成的压缩脚本按产品真源计数）；Svelte 仅按 compiler 定位 instance/module 脚本，模板分支另由浏览器验收。新增函数没有 selfCC > 15，存量超限函数没有 selfCC 增长；每个函数独立计数，不以工厂或 subtreeCC 代替。

| 相关函数 | 基线 → 当前 selfCC |
|---|---:|
| `compilePresentation/evaluate/component`（主要投影闭包） | 16 → 11 |
| `presentationTarget` | 24 → 5 |
| `tableColumnPresentation` | 新增 7 |
| `reconcileColumnView` | 新增 6 |
| `tableSearchErrors`（从原 checkTableSearch 提取） | 原职责 10 → 11 |
| `createTableController/reset` | 6 → 6 |
| RuntimeSurface 的 `exportTable` | 6 → 7，任务/冻结实现已移入 table/export/task |
| `orchestrate/start` / `refetch` / 筛选订阅回调 | 26 → 26 / 17 → 17 / 22 → 22 |
| `presentationPolicyErrors` | 29 → 29 |
| 迁移的 `rowExpansionErrors` / 主回调 | 21 → 21 / 65 → 65 |

剩余超限项：源执行编排生命周期、原条件错误编排和原展开模板校验。新增规则已放入独立职责模块；为保留原错误有序输出、查询取消及初始化行为，本批保留这些存量流程，不声称全仓治理完成。其余未改职责的超限项见本地完整测量，不扩展为本批重构范围。

既有大文件仍有 `RuntimeSurface.svelte` 1858 行、`Table.svelte` 1731 行、`validate.ts` 2545 行；这是剩余架构债务。本批抽出表格导出任务/会话捕获、表格搜索校验与 Table 页头，分别收敛到明确职责目录；其余运行时、组件和校验职责没有整体重排。

## 未执行与保留

- Git commit/push 与精确 SHA CI 按本次授权执行，回执单独报告；生产部署未执行。工作树按仓库清理标准收口。
- 真实 DQE/Relay/CloudIOC 权限及业务事实、真实 DS 模型未运行；浏览器/模拟网关不能替代。
- Edge 未单独复验；当前实际浏览器证据为 Chrome。
- main 已交付原文容错、独立置顶行和 pagedUnion；本批保留其行为，将旧路径引用迁入 table 目录，并复用同一个叶子列遍历。新增 Excel 组合回归验证隐藏明细列时置顶单元格仍与可见列对齐。

## main 集成补验

目标 main 已使用 Schema 6.60/6.61、ADR-0120/0121，本批顺延至 Schema 6.62、ADR-0122；不改变先前能力下限。生成文件从合并后产品真源重建，MC 页面及诊断例也按同版本重新生成。105 个页面文档全部通过，MC 示例漂移检查和内容覆盖 6 项通过。

交付复杂度以 origin/main 为基线，无新增 selfCC > 15 或存量超限增长；`tableInteractionGate` 8→9，控制器 binding 4→4，remoteTableSearch 4→4。前表中的初始基线数据保留以解释原实施，最终集成完整数据位于本地 `artifacts/complexity-delivery.json`。
