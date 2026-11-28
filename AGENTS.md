# MetricCanvas（指标画布）

以业务需求为起点的 AI 原生数据应用平台：受控查询定义提供动态数据，`inline` 保留静态数据场景，声明式页面描述应用，统一运行时渲染页面，AI 完成查询生成、页面组合与数据分析。

## 核心入口导航

- **代码架构与改动定位**：[`ARCHITECTURE.md`](ARCHITECTURE.md)（包职责、依赖方向、自动化门禁与按包快速验证矩阵）
- **产品目标与整体方案**：[`origin.md`](origin.md)、[`docs/solution.md`](docs/solution.md)
- **页面协议与数据上下文**：[`PAGE-METADATA.md`](PAGE-METADATA.md)（版本真源在 `packages/page/src/version.ts`）、[`PAGE-PARAMETERS.md`](PAGE-PARAMETERS.md)、[`docs/schema-metadata.md`](docs/schema-metadata.md)
- **领域词汇表**：[`CONTEXT.md`](CONTEXT.md)（输出中涉及领域概念时，**必须**使用词汇表定义的术语，禁止漂移到 `_Avoid_` 词条）
- **架构决策记录**：[`docs/adr/README.md`](docs/adr/README.md)（先查速查表定位状态，再进 [`docs/adr/topics/`](docs/adr/topics/) 读现行结论，最后按需展开具体 ADR 原文；详见 [`docs/agents/domain.md`](docs/agents/domain.md)）
- **过程性文档三层分工**：`docs/plan/`（在做的）、`docs/evidence/`（仅保留索引，详见下述提交约束）、`docs/archive/`（已收口批次，**探索时默认不读**，从批次结论页进）；判据见 [`docs/plan/README.md`](docs/plan/README.md)

## Agent Skills

### Skill 来源

- **本仓随仓交付的 Skill**（位于 `.agents/skills/`）：
  - `repair-page-metadata`：页面元数据排障与回归修复，由本仓直接维护。
  - `scoped-main-delivery`：工作树基线同步、范围交付、CI 等待与分支/工作树清理，由本仓直接维护。
  - `metriccanvas-local-authoring`：指向本仓独立分发的 `metriccanvas-authoring/skill/metriccanvas-local-authoring/`。新增、更新或交付时须执行 [`docs/agents/local-authoring-skill-maintenance.md`](docs/agents/local-authoring-skill-maintenance.md)，从产品真源生成知识与校验器并确保仓外安装闭合。
- **可选上游软链接 Skill**（本机接入 `moon-skills` 时存在，已在 `.gitignore` 排除、不随本仓交付）：SDD 系列（`sdd-dev-frontend`、`sdd-init-frontend`、`sdd-task-frontend`、`sdd-review-frontend`、`sdd-task`）与 `session-optimize`。软链内容一律以上游为准，不要就地修改。

### 何时走 SDD

改动只要需要对着**外部设计源**（设计稿、规格、旧系统截图）还原视觉或结构，就走 `sdd-dev-frontend`；纯逻辑改动、重构、修 bug、加测试不走。判据是改动对着什么，不是改动多大。

## 强制工程治理规则

### 快速治理与架构门禁（必选）

每次改动完成后执行 `pnpm verify:fast`（依次运行 `pnpm lint`、`pnpm hygiene:check`、`pnpm architecture:check`）。源码依赖规则与存量退出条件见 [`docs/agents/architecture-ratchet.md`](docs/agents/architecture-ratchet.md)；CI 汇总与全量门禁见 [`docs/agents/ci-delivery.md`](docs/agents/ci-delivery.md)。

### 每次编码的复杂度检查（必选）

每次新增、修改或重构可执行代码，均执行 [`docs/agents/code-complexity.md`](docs/agents/code-complexity.md) 与 `pnpm complexity:check`：

- 编码前识别职责与分支；编码后实测修改函数及全部新增辅助函数（含嵌套闭包），确保新增 `selfCC ≤ 15`、生产/工具嵌套闭包 `subtreeCC ≤ 45`、生产源文件 `≤ 600` 行，存量台账只降不升。
- 实测下降时在同一改动中收紧 `tools/scripts/complexity-debt.json`；完成说明须给出测量口径、相关函数前后结果及未关闭项。

### 提交内容与文件体积（必选）

- 提交范围限于产品源码、必要配置、正式文档及测试直接消费的最小夹具。验证过程文件、evidence、截图、日志、扫描报告、交付回执、临时脚本、构建输出和分发归档默认只留本地（优先写入已忽略的 `.scratch/`、`artifacts/` 或 `test-results/`，Markdown 亦然）；长期结论就地更新正式文档，验证命令与结果在最终答复或 PR 中说明。
- `docs/evidence/` 的新增文件和过程性更新默认不纳入交付，也不得改放 `docs/plan/`、`docs/archive/` 或夹具目录绕过。确需提交来源材料时须逐文件说明路径、消费者与不可替代用途，并取得用户明确确认；禁止自行 `git add -f`。
- **单文件上限为 1 MB（1,000,000 字节）**：提交前通过 `pnpm hygiene:check`（及 `node tools/scripts/check-repo-hygiene.mjs --staged`）核对全部新增、修改、重命名文件的实际 Git 暂存区 blob 大小，以及 `docs/evidence/` 路径规则。超限默认移出提交范围（精简、拆分职责、按需生成或放仓外存储，禁止机械切片）；例外须逐文件报告路径、字节数、用途和替代方案并取得用户明确确认，普通“提交/push”授权不构成例外。
- 已跟踪文件受同等约束、存量不自动豁免；清理存量时须先核对消费者与引用，按确认范围处理，保留并行工作，不批量删除或改写 Git 历史。

### 工作树开发与 Git 交付

每轮新开发或恢复开发（包括复用旧工作树），以及提交、push、跨分支交付和分支/工作树清理，均使用 [`scoped-main-delivery`](.agents/skills/scoped-main-delivery/SKILL.md)（清理细则见 [`docs/agents/git-cleanup.md`](docs/agents/git-cleanup.md)）。修改文件前完成最新 `origin/main` 同步与基线核对；交付时核对同文件累计已确认修改，收口清理已合并分支与工作树并报告保留项及原因。

## 协议、页面与分发规范

### Schema 演进（必选）

后续功能演进优先保持或减少 Schema，把可复用的计算、容错与执行逻辑沉淀到引擎。实施前按 [`docs/agents/page-metadata-changes.md`](docs/agents/page-metadata-changes.md#schema-最小化必选) 检查现有协议能否表达需求，并记录字段增减及引擎承接的职责。

涉及 Schema 变更（包括字段增删、类型、约束、默认值或语义调整），**必须先向用户说明**现有协议为何不能满足、可选方案及影响，给出拟采用的最小声明，**等待用户明确确认协议方案后再实现**。需求、搜索字段或业务目标的确认不等于协议方案确认；字段净增为零也不能跳过此步骤。

### 功能与协议能力验收（必选）

所有新功能及页面协议能力更新（新增、调整、修复、收紧或废弃），均须按 [`docs/agents/feature-acceptance.md`](docs/agents/feature-acceptance.md) 在同一实施批次完成：页面试验场可观察场景与浏览器验收、页面元数据文档更新，以及 `metriccanvas-local-authoring` 同步，作为实施完成条件。

### 页面样式归属（必选）

- **实现**：先定位负责呈现的组件、引擎和样式入口；共用样式落到正式组件或引擎，页面特有差异优先用已有页面配置表达。
- **盘点**：复用预览时逐项核对本地 CSS、Vite 源码替换、组件替换及配置注入；预览覆盖仅用于临时验证并须显式标明。模拟数据可用于验收，组件、样式和布局仍走正式渲染链路。
- **验收**：使用同一份交付 JSON，在关闭预览覆盖的标准入口复现约定效果；面向 Embed 交付时用实际构建产物复验，并在交付说明记录验证入口、代码提交/产物版本及未在目标环境验证的差异。

### 页面试验场示例

新增 `pages/` 示例显式使用 `layout: "dashboard"`，复用现有 Dashboard 页头与组件；仅用户明确要求或验收 Report 专属能力时使用 `report`。维护规范见 [`docs/agents/playground-example-maintenance.md`](docs/agents/playground-example-maintenance.md)。

### IOC 页头迁移（必选）

用户提供或要求修改的 JSON 属于 IOC 看板，且仍以旧工具栏或自拼组件承担页头时，按 [页头迁移](.agents/skills/metriccanvas-local-authoring/references/ioc-header-migration.md) 分析标题、筛选归属与作用范围、默认值、查询绑定及操作，再迁移为首 section 首组件 `type: "iocHeader"`（业务属性在 `props`，旧根级仅兼容读取）。完成后明确告知用户已迁移及实际改动；无法等价承接的功能保留原件并说明缺口。已有 `iocHeader` 的页面沿用并核对，正文独立章节标题保留。

### Embed 分发基线（必选）

修改运行时、组件、依赖或打包配置并交付 embed 时，执行 [`docs/agents/embed-distribution.md`](docs/agents/embed-distribution.md)：每个发布 JS 文件未压缩体积 ≤ 1,000,000 字节，ES/global 公共入口、完整分包闭合与浏览器接入均须通过构建门禁。

## 协作流程与专项验收

- **Issue Tracker**：GitHub Issues（`CCharlesMeng/MetricCanvas`），使用 `gh` CLI，约定见 [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)。
- **Triage Labels**：`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`，详见 [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md)。
- **Domain Docs**：单上下文布局（根目录 `CONTEXT.md` + `docs/adr/`），详见 [`docs/agents/domain.md`](docs/agents/domain.md)。

### Skill 验收范围

默认只验收 `metriccanvas-local-authoring`（知识生成一致性、仓外独立安装及页面校验）；其他 Skill、历史 authoring Bundle 行为测试和真实 DS 模型验收仅在用户明确要求时追加（DS 真实模型按 [`docs/agents/skill-ds-model-acceptance.md`](docs/agents/skill-ds-model-acceptance.md) 分层验收并分别报告结论）。产品协议、运行时、页面搭建、页面试验场浏览器和 CI 检查仍按改动执行。
