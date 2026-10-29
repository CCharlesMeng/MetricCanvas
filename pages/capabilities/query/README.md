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

## 对象查询作为记录关联主表

入口：`/pages/object-record-join-demo`；[页面 JSON](object-record-join-demo.json)。运行 `pnpm dev:dqe`，无需 URL 参数。使用标准 DQE 网关和本地 Sim 合成记录，不使用绕开请求编码的专用网关。

1. 一月共24条审批，每商务两条，主表每批5条完整读取；首屏按审批时间降序显示 R024 至 R020，合同金额按商务编号补列。
2. 翻到第二页，首条为 R019；搜索 B003 得 R006/R005 两条，合同金额均为3000。清空搜索，按审批金额升序后首条为 R001。
3. 合同金额表头筛选下限12000，得到 R024/R023；清除表头条件后完整导出24条审批记录。所有操作在完整关联快照上执行。
4. 审批日期改为2025年2月，得到4条；区域选择东区、审批金额下限2700，得到 R027，合同金额14000。改为三月为空结果。
5. 查看实际请求：object 使用 `filter.fields` 时间范围、`order.offset/limit` 和单字段 `order_by_field:商务编号/type:asc`，不自动添加多字段排序。表格降序不覆盖成员扫描顺序。

缺陷回归和截断/跨批总数变化反例位于 `packages/data-execution/tests/object-record-join.test.ts`；真实商务页面的 object 主成员、审批时间下推、责任人与生命状态补列由 `rejection-time-pushdown.test.ts` 复验。显式多字段查询排序仍要求可信适配，不能用本修复绕过。Sim 仅验证执行编排与编码；重复关联键的跨批稳定顺序、准确计数和真实 DQE/Relay 仍需接入验真。

## DQE 单字段排序回归（2026-10-27）

启动 `pnpm dev:dqe`，访问 `/pages/query-result-where-page`，初始金额降序、切换执行周期列和翻页，网络请求的 order 只能使用 order_by_field/type 与 offset/limit。Shift 追加第二排序列时明确失败，不能发送 by 数组；普通点击恢复单列查询。访问 `/pages/table-row-expansion-query` 展开客户，子表格默认按行键升序，切换产品列排序时不追加行键。访问 `/pages/multi-source-table` 验证两个来源整体排序和翻页；此页为合成独立网关，也经过正式 DQE 排序编码校验。418行等指标、行键逆序、跨200行批次由 dqe-sort-contract.test.ts 验证。合成浏览器与 Mock 不证明真实 DQE 的比较、计数或跨批稳定性。

## 创作契约与时间精度

入口：`/pages/authoring-contract-reliability`；[页面 JSON](authoring-contract-reliability.json)。无需 URL 参数或 DQE 服务；启动 `pnpm dev:playground`。

1. 普通指标卡和汇总呈现都显示 **2**。两者由 `block_component` 使用完整的两行可信证据装配；源初始缓存仅一行。演示页面以完整 inline 行呈现，不把缓存当完整性证明。
2. “实际解析结果”展示共享测试向量的规范结果与失败码；月粒度搭配八位日值必须报 `TIME_VALUE_PRECISION_INVALID`，非法日历值、倒置范围也被拒绝。
3. 最后表格故意声明 `month + 20260401/20260930`。控制台应显示 `[MetricCanvas][DQE_QUERY_REJECTED] TIME_VALUE_PRECISION_INVALID: filter.time.start`，不会向服务发出该请求。当前运行时将错误源投影成空行，表格显示“暂无数据”；这不代表业务空结果，必须结合诊断判定。刷新后行为相同。

矩阵和两张卡由 `tools/scripts/authoring-contract-demo.py` 调用实际 Python 公共模块生成；TypeScript 测试读取本页非法查询，并复验浏览器筛选后的生效查询。生成命令：`PYTHONDONTWRITEBYTECODE=1 <Python解释器> tools/scripts/authoring-contract-demo.py`。证据不代表真实 Relay、IAM 或 DQE 年/月/日协议已联调。记录见 `docs/evidence/authoring-session-audit-20261027/implementation.md`。


### 分页级联的等价月份格式

`/pages/query-result-where-page`沿用既有DQE Sim场景：页面可保存紧凑年月202610，共享执行器的实际请求会规范为2026-10。仿真夹具接受这两个等价表示，仅接受该夹具月份；其他月份、日期精度值仍拒绝。原有按全部可排序列切换、全局排序后分页、结果行集合驱动下游查询和冻结窗口导出规则保持。验证由tools/dqe-sim/tests/query-result-where.test.ts经真实本地HTTP和共享运行时执行；不代表真实内网DQE格式验收。
## 零总数与已有行

启动 `pnpm dev:playground`，打开 `/pages/query-zero-total-demo`。页面自动发现，使用页面试验场专属合成HTTP响应，不需要业务DQE；普通业务页面和平台网关不变。

- 第一张表：主查询返回甲地区部0.0、乙地区部-2.0，服务总数仍为0；显示两行。
- 第二张表：主查询总数正常，辅助查询返回相同两行但总数0；辅助得分按region正确对齐，整表不清空。
- 第三张表：总数0、返回0行，呈现正常空表头和空态。
- 打开浏览器控制台，异常源仅输出一次 `TOTAL_COUNT_MISMATCH`，包含pageId、dataSourceId/Path、引用组件和bindingPath、rowCount=2、totalCount=0、completeness=unverified，不包含原始行。正常空结果不告警。

页面只展示已返回数据，不证明完整结果。完整导出仍拒绝该矛盾响应；非法字段、非零对象完整总数矛盾与完整输入边界由 `tests/zero-total-rendering.test.ts` 验证。此场景不证明业务DQE已修正总数。
