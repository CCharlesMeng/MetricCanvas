# MetricCanvas(指标画布)

以业务指标为核心的 AI 原生数据应用平台:表服务提供数据,页面规格描述应用,统一运行时渲染页面,AI 完成页面组合与数据分析。

- 项目背景与调整目标:`origin.md`
- 整体解决方案:`docs/solution.md`
- 领域词汇表:`CONTEXT.md`(输出中涉及领域概念时,必须使用词汇表定义的术语)
- 关键决策记录:`docs/adr/`

## Agent skills

### Issue tracker

本仓库的 issue 和 PRD 存放于 GitHub Issues(`CCharlesMeng/MetricCanvas`),使用 `gh` CLI 操作。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认五个 triage 标签(needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix)。详见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文布局:根目录 `CONTEXT.md` + `docs/adr/`。详见 `docs/agents/domain.md`。
