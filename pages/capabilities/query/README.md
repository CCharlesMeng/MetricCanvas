# pages/capabilities/query

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 已存储计数直接绘制柱状图（6.56）

入口：`/pages/stored-count-measures`；[页面 JSON](stored-count-measures.json)。无需 URL 参数。

启动 `pnpm dev:playground` 可看内嵌合成初始行；区域交互需同时启动 `pnpm sim:dqe`，也可用 `pnpm dev:dqe` 一起启动。

1. 首屏柱图与明细显示东区项目数量/已完成数量 12/9、南区 7/5、零值区 0/0、缺失区 —/3。零值显示 0，缺失不补零。
2. 顶部区域选择“南区”，图表和明细变为同一行 7/5；切换“零值区”和“缺失区”比较真实零和缺失，再清空选择恢复四行。
3. 查看页面 JSON：两个计数都保留在 `output_dims`，`output_metrics` 为空，页面字段显式声明 `role: measure`；区域编号仍为 `number + dimension`。

异常复现：将页面版本改为 6.55，校验报能力由 6.56 引入；将计数字段角色改为 `dimension`，系列绑定报要求 `measure`。对应反例纳入产品契约与仓外校验器。

此页直接展示合成表中已有数值，不添加求和、计数、去重或重新分组；不能据此证明真实 DQE 支持该查询、真实业务口径或权限已验收。测量与浏览器结果见 `docs/evidence/stored-count-measures/acceptance.md`。

## 查询数值容错与缺失值呈现

入口：`/pages/query-numeric-tolerance`；[页面 JSON](query-numeric-tolerance.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

将占位符、空值和非法数值显示为缺失，保留真实零；比较表格、折线和指标卡。

合成演示

首屏可预览；动态查询需仿真

1. 检查八行数值依次为 10.0、—、—、12.5、0.0、-4.0、—、—。
2. 排序后检查八行仍保留，比较缺失指标卡与真实 0% 的区别。

容错仅针对查询数值度量；字段缺失、维度类型错误和 inline 数据仍受严格校验。HTTP 异常注入由回归测试覆盖。

关键声明：`dataSources.*.fields`, `dataSources.*.source.initial`。

关联：[empty-state-showcase](../layout/empty-state-showcase.json)。

## 查询分页、排序与级联取数｜项目评估

入口：`/pages/query-result-where-page`；[页面 JSON](query-result-where-page.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

改变主表排序或翻页后，下游分别筛选当前查询窗口中的大额和小额项目再取评估明细。

合成演示

交互取数需本地仿真

1. 启动本地 DQE Sim，切换主表任意列排序，观察回到第一页。
2. 翻到下一页，比较主表项目与两张下游评估表的编号。

下游使用当前查询窗口，不是全部 80 个项目；两个下游条件彼此独立。

关键声明：`dataSources.*.source.query.resultBindings`, `sections[].components[].props.pagination`。

关联：[business-sdt-cascade-example](../../business/report/sdt/business-sdt-cascade-example.json)。

关联：[multi-query-table](../table/multi-query-table.json)。


## DQE 对象查询

页面：[`dqe-object-query-demo.json`](dqe-object-query-demo.json)，入口 `/pages/dqe-object-query-demo`。使用 Dashboard 现有页头与表格；数据全部来自本地 DQE Sim 合成表（24条一月、4条二月审批；每商务两条审批；隐藏商务筛选显式声明14个已知合成编号作为可信候选）。无必需 URL 参数。

运行 `pnpm dev:dqe` 后打开 Playground 页面。若为独立工作树使用其他端口，给 Sim 与 Playground 设置同一 DQE_SIM_PORT，并通过 Vite --port 指定空闲端口。

1. 首屏审批表查询分页5行，总24行；完整结果表包含差额计算及关联合同金额。商务重复保留、审批记录ID唯一。
2. 翻到下一页或按金额排序，当前窗口驱动的指标表随窗口编号集合变化。搜索完整 B003 得两条审批；空匹配显示空态。
3. 修改审批日期为二月，总4行；选择东区或设置金额下限继续收窄，原始一月默认条件不残留。点击编号写入隐藏商务筛选并联动已绑定源。
4. 完整审批表导出包含当前条件下的完整记录；窗口源导出范围继续按共享的显式完整/窗口用途决定，不冒充全量。
5. 指标结果反向驱动对象查询；主表完整对象结果通过 joinAggregate 关联普通指标结果。详见行为测试对窗口绑定、完整绑定及行数的断言。

异常夹具位于 `packages/page/tests/dqe-object-query.test.ts` 与 `packages/data-execution/tests/dqe-object-query.test.ts`：缺对象、字段或时间目标、版本过低、参数不成对、完整结果总数失配、多列排序未提供可信编码。包含搜索、列候选及多列排序需要与普通 DQE 相同的可信接入能力，默认网关明确报错；这些真实能力没有被 Sim 页面证明。

## DQE 单字段排序回归（2026-10-27）

启动 `pnpm dev:dqe`，访问 `/pages/query-result-where-page`，初始金额降序、切换执行周期列和翻页，网络请求的 order 只能使用 order_by_field/type 与 offset/limit。Shift 追加第二排序列时明确失败，不能发送 by 数组；普通点击恢复单列查询。访问 `/pages/table-row-expansion-query` 展开客户，子表格默认按行键升序，切换产品列排序时不追加行键。访问 `/pages/multi-source-table` 验证两个来源整体排序和翻页；此页为合成独立网关，也经过正式 DQE 排序编码校验。418行等指标、行键逆序、跨200行批次由 dqe-sort-contract.test.ts 验证。合成浏览器与 Mock 不证明真实 DQE 的比较、计数或跨批稳定性。
