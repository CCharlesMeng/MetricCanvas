# 图表卡内按钮与下拉筛选

2026-10-22，基线 `ef6df6f72ed0ef790e1bdd01321776d354003eff`。用户确认原型后，正式替换 `/pages/filter-group-page`；旧原型链接由目录中的 legacyPaths 映射重定向。原显隐与带符号指标卡回归场景移至 `/pages/filter-group-state-page`，不删除已验收能力。

## 交付关系

- 6.47：`filterGroup.props.display` 为 buttons（默认）／select，`align` 为 left（默认）／right。新增字段分别受版本门禁；继续共用固定候选、必选单选、集中显隐、URL、只读和冻结导出，无新的状态或查询范围规则。
- 下拉直接复用 DimensionFilter / Selection；布局复用组合卡 12 列栅格。两个控件各占 6 列，图表占 12 列；指标单位和合计通过相同的 visibleWhen 选择。
- 本地仿真夹具显式提供指标、区域和全区域汇总成员。两个查询同时消费两个 filterBindings。`all` 不是引擎通用的不限值；本次没有运行真实 DQE、Relay 或生产部署验收。
- 页面协议、能力目录、模块语义及 local-authoring 完整示例与独立校验器均从同一真源生成；原型源代码保留在原型分支，main 仅保留正式实现和旧链接映射。

## 实际验证

| 检查 | 结果 |
|---|---|
| 实际 Playground 浏览器 | 1440 / 390px，3 项通过：按钮和下拉共同影响图表与合计；URL 恢复；非法与多值回退；只读禁用 |
| 嵌入浏览器 | 新案例、原显隐案例和四类迁移图表共 9 项通过 |
| 定向协议、运行时、Sim | 30 项通过，包括两个新字段的版本下限和按钮／下拉冻结导出 |
| 文档及 local-authoring 定向 | 123 项通过；仓外复制安装、知识与哈希闭合、全部向量等价验证 |
| `pnpm validate` | 76/76 页面通过 |
| `pnpm check` | 工作区 Svelte / TypeScript 通过；新增目录跳转后 Playground 再检查 0 errors / 0 warnings |
| `pnpm build`、`pnpm packages:check` | 产品构建与入口声明检查通过；保留既有 bundle 体积提示 |
| `pnpm --filter playground build` | 通过；旧链接正式重定向和页面源码无正式页面 id 分支 |
| `pnpm authoring:contracts:check` | 1012 产品、4 创作、1 接口文件一致 |
| Bundle 摘要 | 3511 项通过 |

完整回归与远端 CI 在交付前核对，结论以最终提交的交付回执为准。源码、锁文件、契约摘要见 inputs.json。

可观察值：初始收入合计 1,710 万元；切换订单为 5,579 笔；选择华东为 3,095 笔；切回收入为 951 万元。浏览器验证了实际 HTTP 查询条件、显示值、canvas 绘图高度和控件落位，没有用控件文本代替取数证据。控件不请求候选端口。

实际 Playground：`http://127.0.0.1:5187/pages/filter-group-page`，DQE Sim 为 18328。正常浏览器视口的页面截图见 [playground.png](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-filter-toolbar/playground.png)。原工作区与原 5173 服务未改动。
