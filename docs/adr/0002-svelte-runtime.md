# 统一运行时采用 Svelte + shadcn-svelte

运行时是一个渲染封闭 BI 组件集的引擎,不是开放生态的应用开发框架。团队从 Angular 迁移,在评估 React(看板生态最厚、shadcn 原版、AI 辅助开发语料最多)后,选择 Svelte + shadcn-svelte,取其代码简洁、性能和包体优势、迁移心智负担小。

架构上 AI 生成的是页面规格而非运行时代码,框架的 AI 代码生成语料差距不影响平台核心运转方式。

## Consequences

- shadcn-svelte 为社区移植,组件更新滞后原版;看板专用生态(图表、拖拽网格)较薄,优先选用框架无关库(如 ECharts、AG Grid)补齐。
- 若未来出现必须依赖 React 专属生态的需求,切换成本约一个季度级别,属已知接受的风险。
