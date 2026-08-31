# dev-baseline — US1980 · IOC 页面与组件宽度解耦

| 字段 | 值 |
| --- | --- |
| Story / repo | US1980 / DataDashboard（单 app：`apps/canvas`） |
| 基线源 | `text_spec`：用户确认“组件与页面宽度不应耦合”，并于 2026-08-31 确认按容器宽度重写 |
| 来源指纹 | `story-delta-frontend-design.md` sha256 `4a7442fdff1cf671b9165d23550a51eb66f010a113d4da7a37806ca83ee4c498` |
| 冻结状态 | 已冻结 ✅ |
| 确认时间 | 2026-08-31（Asia/Shanghai） |
| 声明状态 | 冻结时全部为 `UNVERIFIED`；逐条状态见 `alpha-tests.md` 的 AC ↔ 证据映射 |
| app baseline | `apps/canvas/frontend-baselines/`；本次读取 `index.md`、`structure.md`、`runtime.md`、`styles.md`、`testing.md` |
| 设计事实 / 区块规格 | 无（基线源为文字规格） |
| 还原契约 | `docs/plan/ioc-1980-width/restore-contract.json` |

## 给人的摘要

- 做什么：让四个 IOC Page 在 1980px 回归视口占满宿主，并让项目详情共享组件只服从 Section 分配的内容单元。
- 标准来自哪里：用户确认的文字规格；1980px 是回归样本，不是组件断点或固定宽度。
- 本次确认：4 条 AC，5 条还原声明，6 条功能声明；无豁免、无必须决策项。

## 执行起点（环境）

| 项 | 值 |
| --- | --- |
| `base-ref` | `d6c87cd16e198da281f3540cb7d96ed03aeba853` |
| 需求路径 | `docs/plan/ioc-1980-width/tasks.md`、`alpha-tests.md`、`story-delta-frontend-design.md` |
| 起点质量命令 | Canvas frame Vitest；`@metriccanvas/runtime-ui`、`@metriccanvas/widgets`、`@metriccanvas/embed` check；失败集合为空 |
| 场景 | 本地 Canvas / Embed 示例；无需账号；Page Metadata 取 `pages/ioc-*.json`；浏览器 Chromium |
| Story 限制 | 工作区已有未提交改动；只承接计划文件清单中的宽度解耦改动，不覆盖其他改动 |

## 起点质量

| 已选模块 | 命令 / scope | cache | exit / failures | 证据键 |
| --- | --- | --- | --- | --- |
| targeted-quality | `pnpm exec vitest run apps/canvas/tests/dashboard-frame.test.ts` | MISS → RECORDED | 0 / 无 | `4bb9821b9eb6c715a4d7d2d225652db1eb0008a8ba83940278ca6375c704ebc1` |
| targeted-quality | `pnpm --filter @metriccanvas/runtime-ui check` | MISS → RECORDED | 0 / 无 | 同上 |
| targeted-quality | `pnpm --filter @metriccanvas/widgets check` | MISS → RECORDED | 0 / 无 | 同上 |
| targeted-quality | `pnpm --filter @metriccanvas/embed check` | MISS → RECORDED | 0 / 无 | 同上 |

## 验证组合（初始）

| 风险触发器 | 模块 | 独立检视与维度 | 依赖声明 |
| --- | --- | --- | --- |
| `visual`、`shared-boundary`、`new-pattern` | `causal`、`render`、`targeted-quality`、`regression`、`review-restore`、`review-layout`、`review-convention`、`review-quality` | restore：R5/R6；layout、convention、quality 按最终 diff 重编译最小维度 | AC-1～AC-4 均为 `UNVERIFIED` |

## 工程依据

| Story 需要 | 采用依据 |
| --- | --- |
| 页面布局形态与宿主分工 | `PATTERN-STYLE-1`、`PATTERN-STYLE-2` |
| 共享组件样式与容器响应 | `PATTERN-STYLE-5`；规范候选 `NC-1`：补录既有 container query 所有权模式 |
| Section 列轨与父子职责 | `PATTERN-STYLE-2`；规范候选 `NC-2`：`COMP-5` 对 `columnTracks` 的描述需由 `sdd-init-frontend` 归一 |
| 单元、组件与浏览器验证 | `PATTERN-TEST-1`、`PATTERN-TEST-2`、`PATTERN-TEST-4`、`PATTERN-RUN-1` |

代码侧勘察采用 `full`：命中共享边界、新范式与跨视口风险；已完成 `recon-codebase` 和 `recon-spec` 只读勘察。

## 功能理解

宿主只提供可用宽度；Page 的布局形态决定外框；Section 用元数据列轨分配内容单元；组件根占满内容单元，内部响应按最近 inline-size 容器判断。项目详情现有 225:583 比例继续只存在于 Page Metadata。1980×1080 验证四页满宽和页面级无溢出；固定 900px 宿主在 1980 与 1200 两种视口下验证组件结果不随视口变化。

## QA 基线

### R5 — 空态与边界内容

| 编号 | 判定对象（页面 / 区块） | 边界条件 | 具体期望 | 取证方式 |
| --- | --- | --- | --- | --- |
| R5-1 | 项目详情 / 预测表 | 内容单元窄于表格 1584px 固有内容宽度 | 预测表根节点不撑宽 Page；滚动层 `overflow-x` 为 `auto`，其 `scrollWidth` 大于 `clientWidth`，横向溢出只由表格内部承载 | 冻结契约 + Playwright · render/exact + render/overflow ownership · 文字规格第 6、8 条 |

### R6 — 指定视口下的布局完整性

| 编号 | 视口宽度 | 判定对象（页面 / 区块） | 具体期望 | 取证方式 |
| --- | --- | --- | --- | --- |
| R6-1 | 1980×1080 | 四个 IOC Page 外框 | 每个 `layoutForm: dashboard` 内容盒占满宿主可用宽度（误差 ≤1px）；文档宽度不超过视口 1px；无 Page 级横向滚动、组件重叠或根节点裁断 | 冻结契约 + Playwright · render/overflow + render/numeric · 文字规格第 5、6 条 |
| R6-2 | 1980×1080 与 1200×1080；宿主均固定 900px | 项目详情 / 内容单元契约 | 两个视口下 Section 列轨、五类组件根宽、内部布局签名和溢出所有者逐项相同；父网格不根据 `detailSummary` / `projectNorms` 子 variant 改写结构 | Playwright · render/exact · 文字规格第 1、4、7 条 |
| R6-3 | 宿主内容单元 900px 回归场景 | 项目详情 / 页头与档案区 | `projectDetail`、`detailSummary`、`projectNorms` 根宽分别等于所属内容单元宽度（误差 ≤1px），可收缩且不含 1679、450、1168px 页面派生根宽 | 冻结契约 + Playwright · static/forbidden_literals + render/numeric + render/clip · 文字规格第 2、3 条 |
| R6-4 | 宿主内容单元 900px 回归场景 | 项目详情 / 预测表与叙事区 | `forecastMatrix`、`narrative` 根宽分别等于所属内容单元宽度（误差 ≤1px），可收缩且不含 1632px 页面派生根宽；预测表只在内部滚动 | 冻结契约 + Playwright · static/forbidden_literals + render/numeric + render/clip · 文字规格第 2、6 条 |

### F1 — AC ↔ 测试层级映射

| 编号 | AC 锚点 | 覆盖层级 | 选择理由 |
| --- | --- | --- | --- |
| F1-1 | AC-1、AC-4 / AT-2 | Playwright 浏览器集成 | 只有真实 CSS 布局能证明相同容器在不同视口下结果相同 |
| F1-2 | AC-2 / AT-1 | Vitest 静态契约 + Playwright 浏览器集成 | 静态测试阻止宿主固定宽度回退，浏览器测量四个真实 Page |
| F1-3 | AC-3 / AT-3、AT-4 | Playwright 浏览器集成 + 包级 check | 浏览器比较组件根与内容单元几何，类型检查覆盖共享组件边界 |

### F2 — 每条 AC 的可观察判定

| 编号 | AC 锚点 | 页面与路由 | 操作 | 可观察结果 |
| --- | --- | --- | --- | --- |
| F2-1 | AC-2 / AT-1 | 四个 `/pages/ioc-*` 路由 | 在 1980×1080 打开真实 Page | dashboard 内容盒宽度等于宿主，文档无页面级横向滚动 |
| F2-2 | AC-1、AC-4 / AT-2 | Embed 中的项目详情 Page | 分别在 1980 与 1200 视口，把宿主固定为 900px 并采集布局事实 | 两次采集对象逐项相等，响应输入只来自容器 |
| F2-3 | AC-3 / AT-3 | `/pages/ioc-project-detail` 页头与档案区 | 采集组件根和所属内容单元矩形 | 三类根宽与父内容单元误差均 ≤1px |
| F2-4 | AC-3 / AT-4 | `/pages/ioc-project-detail` 预测表与叙事区 | 采集组件根、滚动层和 Page 文档宽度 | 两类根宽与父内容单元误差均 ≤1px；仅表格滚动层存在横向溢出 |

### F3 — 必测异常与边界分支清单

| 编号 | 类别 | 判定对象 | 触发方式 | 期望表现 |
| --- | --- | --- | --- | --- |
| F3-1 | overflow | 项目详情预测表 | 让内容单元窄于表格 1584px 固有内容宽度 | Page 不被撑宽；表格内部滚动层可横向滚动，列不被压缩 |

### 豁免表

| 编号 | 所属维度 | 判定对象 | 与原型的偏差 | 实际采用 | 理由 | 有效范围 |
| --- | --- | --- | --- | --- | --- | --- |
| — | — | — | 无豁免 | — | — | — |

### 已知缺口

| 编号 | 缺什么 | 影响哪一块 | 分类 | 证据 | 建议处理 |
| --- | --- | --- | --- | --- | --- |
| — | 无 | — | — | — | — |

### 变更记录

| 日期 | 变更项（编号） | 变更内容 | 理由 | 确认状态 | 新指纹 |
| --- | --- | --- | --- | --- | --- |
| 2026-08-31 | 初始冻结 | 将 1980 从组件标准修正为回归样本，冻结容器驱动宽度所有权 | 用户明确要求组件与 Page 解耦并确认继续 | 已确认 | `4a7442fdff1cf671b9165d23550a51eb66f010a113d4da7a37806ca83ee4c498` |

## 指纹附录

| 对象 | 指纹 |
| --- | --- |
| REPO `base-ref` | `d6c87cd16e198da281f3540cb7d96ed03aeba853` |
| 需求输入 | `story-delta-frontend-design.md` sha256 `4a7442fdff1cf671b9165d23550a51eb66f010a113d4da7a37806ca83ee4c498` |
| 原型 | 无 |
| QA baseline | 由 `restore-contract.json` 的 `baseline.sha256` 冻结 |
| restore contract | 待编译后由 `restore-contract.json` 的 `contract_sha256` 记录 |
