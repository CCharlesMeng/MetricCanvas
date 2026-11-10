# MetricCanvas(指标画布)

以业务需求为起点的 AI 原生数据应用平台:受控查询定义提供动态数据,`inline` 保留静态数据场景,声明式页面描述应用,统一运行时渲染页面,AI 完成查询生成、页面组合与数据分析。

- 产品目标与边界:`origin.md`
- 整体解决方案:`docs/solution.md`
- 页面 Schema:`PAGE-METADATA.md`
- Schema 元数据规则与示例:`docs/schema-metadata.md`
- 领域词汇表:`CONTEXT.md`(输出中涉及领域概念时,必须使用词汇表定义的术语)
- 关键决策记录:`docs/adr/`(先读 [`docs/adr/README.md`](docs/adr/README.md) 的速查表定位状态,再进 [`docs/adr/topics/`](docs/adr/topics/) 读现行结论,最后才按需展开具体 ADR 原文)
- 过程性文档分三层:`docs/plan/`(在做的)、`docs/evidence/`(被 ADR 或代码当论据的)、`docs/archive/`(已收口批次,**探索时默认不读**,从批次结论页进)。判据见 [`docs/plan/README.md`](docs/plan/README.md)

## Agent skills

### Skill 来源

SDD 系列 skill(`sdd-dev-frontend`、`sdd-init-frontend`、`sdd-task-frontend`、`sdd-review-frontend`、`sdd-task`)与 `session-optimize` 由 `moon-skills` 仓维护,统一以仓库级软链接接入 `.agents/skills/`,各指向 `moon-skills/skills/` 下的同名目录。软链内容一律以上游为准,不要就地修改,要改去 `moon-skills` 改;这些软链已在 `.gitignore` 中排除,不随本仓交付。

`.agents/skills/repair-page-metadata/` 是本仓自有 skill,由本仓维护并随仓交付。

`.agents/skills/metriccanvas-local-authoring` 指向本仓独立分发的 `metriccanvas-authoring/skill/metriccanvas-local-authoring/`。新增、更新或交付该 Skill 时读取 [`docs/agents/local-authoring-skill-maintenance.md`](docs/agents/local-authoring-skill-maintenance.md)，在产品真源生成知识与校验器；安装目录内的知识和运行依赖必须闭合。

### 何时走 SDD

改动只要需要对着**外部设计源**(设计稿、规格、旧系统截图)还原视觉或结构,就走 `sdd-dev-frontend`;纯逻辑改动、重构、修 bug、加测试不走。判据是改动对着什么,不是改动多大。理由是"像不像"没有客观标准,SDD 的机器判据正是为这类问题准备的;"对不对"这类问题 `pnpm test` 已经够了。

### Playground 示例

新增 `pages/` 示例显式使用 `layout: "dashboard"`，复用现有 Dashboard 页头与组件；仅用户明确要求或验收 Report 专属能力时使用 `report`。

### IOC 页头迁移（必选）

用户提供或要求修改的 JSON 属于 IOC 看板，且仍以旧工具栏或自拼组件承担页头时，按 [页头迁移](.agents/skills/metriccanvas-local-authoring/references/ioc-header-migration.md) 分析标题、筛选归属与作用范围、默认值、查询绑定及操作，再迁移为首 section 首组件 `type:"iocHeader"`（业务属性在 props，旧根级仅兼容读取）。完成后明确告知用户已迁移及实际改动；存在无法等价承接的功能时保留原件并说明缺口。已有 `iocHeader` 的页面沿用并核对，正文独立章节标题保留。

### 每次编码的复杂度检查（必选）

每次新增、修改或重构代码，均执行 [代码复杂度规则](docs/agents/code-complexity.md)：编码前识别职责与分支，编码后实测修改函数和全部新增辅助函数，按规则处理存量超限，并验证行为保持。完成说明须给出测量口径、相关函数前后结果及未关闭项。

### Git 交付

提交、push、跨分支交付或分支/工作树清理使用 [scoped-main-delivery](.agents/skills/scoped-main-delivery/SKILL.md)，以本仓入口为准。每次交付收口执行其中的已合并分支与工作树清理，并报告保留项及原因。

### 提交内容与文件体积（必选）

- 提交范围限于产品源码、必要配置、正式文档及测试直接消费的最小夹具。验证过程文件、evidence、截图、日志、扫描报告、交付回执、临时脚本、构建输出和分发归档默认只留本地，优先写入已忽略的 `.scratch/`、`artifacts/` 或 `test-results/`；Markdown 格式也不例外。验证仍须执行，命令、结果和未验范围在最终答复或 PR 中说明，长期结论就地更新正式文档。
- `docs/evidence/` 的新增文件和过程性更新默认不纳入交付；也不能换到 `docs/plan/`、`docs/archive/` 或夹具目录绕过。确需提交来源材料或验证附件时，先说明具体路径、消费者与不可替代用途，并取得用户对该文件的明确确认；不自行用 `git add -f` 放行。
- 单文件以 **1 MB = 1,000,000 字节**为上限。提交前检查全部待提交新增、修改及重命名文件在 Git 暂存区中的实际 blob 大小，包含二进制、锁文件、生成文件与夹具。超过上限默认移出提交范围，优先精简、拆分职责、按需生成或放到仓外制品存储；不能为过线机械切片。例外须逐文件报告路径、字节数、用途和替代方案，并取得用户明确确认；普通的“提交/push”授权不构成例外。
- 已跟踪文件同样受以上提交检查约束；存量不自动豁免。清理存量文件时核对消费者和引用，按确认范围处理，保留并行工作，不直接批量删除或改写 Git 历史。

### Embed 分发基线（必选）

修改运行时、组件、依赖或打包配置并交付 embed 时，执行 [Embed 分发基线](docs/agents/embed-distribution.md)：每个发布 JS 文件未压缩体积 ≤1,000,000 字节，ES/global 公共入口、完整分包闭合与浏览器接入均须通过构建门禁。

### 功能与协议能力验收（必选）

所有新功能及页面协议能力更新（新增、调整、修复、收紧或废弃），均须按 [功能与协议能力验收要求](docs/agents/feature-acceptance.md) 完成 Playground 可观察场景、页面元数据文档及 `metriccanvas-local-authoring` 同步，作为实施完成条件。

### Schema 演进（必选）

后续功能演进优先保持或减少 Schema，把可复用的计算、容错与执行逻辑沉淀到引擎。实施前按 [Schema 最小化](docs/agents/page-metadata-changes.md#schema-最小化必选) 检查现有协议能否表达需求，并记录字段增减及引擎承接的职责。

涉及 Schema 变更（包括字段增删、类型、约束、默认值或语义调整），必须先向用户说明现有协议为什么不能满足、可选方案及各方案的影响，并给出拟采用的最小声明；等待用户明确确认协议方案后再实现。需求、搜索字段或业务目标的确认不等于协议方案确认；字段净增为零也不能跳过此步骤。具体按 [页面元数据定义与修改流程](docs/agents/page-metadata-changes.md) 执行。

### Issue tracker

本仓库的 issue 和 PRD 存放于 GitHub Issues(`CCharlesMeng/MetricCanvas`),使用 `gh` CLI 操作。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认五个 triage 标签(needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix)。详见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文布局:根目录 `CONTEXT.md` + `docs/adr/`。详见 `docs/agents/domain.md`。

### Skill 验收范围

后续 Skill 验证默认只验收 `metriccanvas-local-authoring`（local-authoring），包括知识生成一致性、仓外独立安装及页面校验。其他 Skill、历史 authoring Bundle 行为测试和真实 DS 模型验收仅在用户明确要求时追加。产品协议、运行时、页面搭建、Playground 浏览器和 CI 检查仍按改动执行。

### Skill 对接 DS 模型验收

仅在用户明确要求对接或复验 DS 真实模型时，按 `docs/agents/skill-ds-model-acceptance.md` 分层验收无模型预检、确定性主流程、真实模型、页面产物、浏览器与分发自洽性，并分别报告结论。
