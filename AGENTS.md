# MetricCanvas(指标画布)

以业务需求为起点的 AI 原生数据应用平台:受控查询定义提供动态数据,`inline` 保留静态数据场景,声明式页面描述应用,统一运行时渲染页面,AI 完成查询生成、页面组合与数据分析。

- 产品目标与边界:`origin.md`
- 整体解决方案:`docs/solution.md`
- 页面 Schema:`PAGE-METADATA.md`
- Schema 元数据规则与示例:`docs/schema-metadata.md`
- 领域词汇表:`CONTEXT.md`(输出中涉及领域概念时,必须使用词汇表定义的术语)
- 关键决策记录:`docs/adr/`(先读 [`docs/adr/README.md`](docs/adr/README.md) 基线,再按需展开具体 ADR)

## Agent skills

### Skill 来源

SDD 系列 skill(`sdd-dev-frontend`、`sdd-init-frontend`、`sdd-task-frontend`、`sdd-review-frontend`、`sdd-task`)与 `session-optimize` 由 `moon-skills` 仓维护,统一以仓库级软链接接入 `.agents/skills/`,各指向 `moon-skills/skills/` 下的同名目录。软链内容一律以上游为准,不要就地修改,要改去 `moon-skills` 改;这些软链已在 `.gitignore` 中排除,不随本仓交付。

`.agents/skills/repair-page-metadata/` 是本仓自有 skill,由本仓维护并随仓交付。

### 何时走 SDD

改动只要需要对着**外部设计源**(设计稿、规格、旧系统截图)还原视觉或结构,就走 `sdd-dev-frontend`;纯逻辑改动、重构、修 bug、加测试不走。判据是改动对着什么,不是改动多大。理由是"像不像"没有客观标准,SDD 的机器判据正是为这类问题准备的;"对不对"这类问题 `pnpm test` 已经够了。

### Issue tracker

本仓库的 issue 和 PRD 存放于 GitHub Issues(`CCharlesMeng/MetricCanvas`),使用 `gh` CLI 操作。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认五个 triage 标签(needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix)。详见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文布局:根目录 `CONTEXT.md` + `docs/adr/`。详见 `docs/agents/domain.md`。
