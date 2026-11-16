# pages/capabilities/query

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## DQE 401 / 403 / 419 页面失效与登录接入

入口 `/auth-required-review`，复用本目录 [dqe-request-timeout.json](dqe-request-timeout.json) 的完整 Dashboard 页面；无需参数或真实 DQE。启动 `pnpm dev:playground`，先看到合成审批行，再点击发送 401、403 或 419：处理次数增加一次，页面内容消失；继续发送不再取数。点击“模拟登录后重新进入”后出现新请求的合成行。取消勾选“传入 onAuthRequired”则保留原有错误处理；500 不调用登录处理。

该入口只仿真 HTTP 和记录回调，不跳转实际登录页。验证运行时接缝、缓存与重挂载，不代表真实登录或业务数据验收；新建集成应用只需在 mount 或 RuntimeView 输入增加 onAuthRequired，不修改页面 JSON、网关配置或拦截器。

## DQE 请求默认180秒超时

入口 `/pages/dqe-request-timeout`；[页面 JSON](dqe-request-timeout.json)。无需 URL 参数。启动 `pnpm dev:dqe` 可查看 DQE Sim 审批合成数据；该页面没有内嵌初始行，打开即走普通 DQE 网关。

启动 `pnpm --filter playground dev --host 127.0.0.1 --port 5204`，运行 `DQE_TIMEOUT_BASE_URL=http://127.0.0.1:5204 node apps/playground/tests/dqe-request-timeout-browser.mjs <证据目录>`。脚本读取这份完整页面并在浏览器拦截 DQE HTTP，使用浏览器虚拟时钟模拟慢响应，无需等待三分钟或启动 DQE 服务：超过120秒仍加载，150秒返回后显示审批行；另一次请求等到180秒才报 `DQE_TIMEOUT`，不显示部分行。重新打开后可恢复成功。

显式 `timeoutMs` 覆盖、维度候选值请求与180秒边界由网关行为测试覆盖。默认值由运行时统一提供，不需要页面字段；records 批次与完整读取/导出预算独立生效。本场景是合成 HTTP 与浏览器计时证据，不证明真实 DQE、网关代理或 Relay 的超时配置。

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

查询顶层数值度量的属性漏返也按缺失处理，保留列并记录诊断；缺少维度属性、嵌套映射属性和 inline 数据仍受严格校验。HTTP 异常注入由回归测试覆盖。

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

## 父子表的零总数兼容

启动 `pnpm dev:playground`，打开 `/pages/query-zero-total-hierarchy`，无需参数或业务 DQE。页面 JSON 为 `query-zero-total-hierarchy.json`，专属合成 HTTP 响应和候选位于 `apps/playground/fixtures/zero-total-gateway.ts`。

1. 父查询实际返回甲地区部0、乙地区部-2，原始 `total_count` 保持0。首屏显示甲地区部；本地下一页显示乙地区部，不出现“父汇总结果不完整”。
2. 地区范围选择乙地区部，仅显示该父行；切回全部后展开甲地区部，子表查询同样返回 total_count=0，仍显示甲代表处、得分7，父表得分保持0；查询分页仍沿用原总数协议，本场景不验证未知总数翻页。选择甲代表处时，完整归属查询定位甲地区部并自动展开。
3. 控制台保留 `TOTAL_COUNT_MISMATCH` 定位告警，返回行没有被改写为可信 initial；导出完整父子 Excel 仍失败，不下载部分数据。
4. 重复/缺失父行键和非零总数矛盾仍失败，见 `tests/hierarchy-zero-total-rendering.test.ts`；取消、迟到响应、查找歧义与导出边界复用 hierarchy-selection/hierarchy-export 回归。

以上为本地合成查询链路与统一运行时验收，不证明真实 DQE 总数已更正。用户捕获响应仅用于本机忽略目录回放，不写入本示例或分发知识。

## 页面数据源分支诊断

启动 `pnpm dev:playground`，打开 `/pages/data-source-diagnostics`。页面使用合成初始行，不需要 DQE 服务；正常显示“示例地区部”和数值 12。

1. 展开“查看页面 JSON”，复制完整文档，在 `/preview` 的“Page JSON 编辑器”粘贴。正常文档应通过校验并显示一行。
2. 将 `dataSources.sales.source.query.body.dsl_list` 的唯一元素复制一份，使数组含两项。应只出现一条 `SCHEMA_ERROR`，定位 `/dataSources/sales/source/query/body/dsl_list`，说明当前为 2 条，建议拆成独立页面数据源；不得提示 `queryField` 未定义或缺少 `currency/items/members`。
3. 恢复一项后正常渲染；改成空数组应报告当前为 0 条。将 `source.type` 改为 `qurey`，应定位 `/dataSources/sales/source/type` 并列出允许值。

静态诊断来自产品共享校验器；浏览器验证错误输出和恢复，不证明真实 DQE 查询或业务口径。


## 响应漏返数值指标，保留行与列

入口：`/pages/query-missing-measures`；[页面 JSON](query-missing-measures.json)。无需 URL 参数。启动 `pnpm dev:playground`，使用内嵌合成初始行，无需 DQE 服务。

1. 检查表格保留三行和“数值”“金额（元）”两列；第一行数值显示 `—`，后两行保留 `0.0` 和 `-4.0`。
2. 金额属性在三行中均未返回，整列显示 `—`；声明的字段、`output_metrics` 和表格列均保留。
3. 点击数值列排序，确认三行仍在，缺失没有被补零。
4. 异常复现：将第一行的 `样例` 属性也删除后粘贴至 `/preview`，应报 `MISSING_QUERY_FIELD`，维度键缺失不能按数值缺项处理。

查询诊断按字段汇总 `MISSING_NUMERIC_QUERY_FIELD`，动态 DQE 与初始行共用归一化；真实动态入口、保存重开和组合结果由回归测试及捕获响应回放覆盖。本页只证明合成数据的浏览器呈现，不代表真实 DQE 服务已验收。

## 对象账期默认与自定义查询（6.101）

入口 `/pages/object-period-query`，无需 URL 参数。运行 `pnpm dev:playground`，页面专用合成网关回显产品实际编码的 filter.fields，不需要启动 DQE Sim。切换年、季、月或近一年，对照“默认账期”“固定月账期”“自定义审批日期”“手写对象条件”四个表格：默认切换 yearly/quarterly/monthly 及账期码；单期等值、多期闭区间；固定月始终 monthly；自定义日期保留真实日期起止；手写 FY2026 条件不随期间变化。`?state=error` 可复现合成查询错误。

声明与请求由定向执行测试覆盖，测试直接读取本页面；本批按用户要求不运行视觉或浏览器测试。回显仅证明本仓请求编码，真实 DQE 的范围运算、聚合、权限及数据口径未验收。


## DQE 独立请求与默认并发

<!-- example-guide: task=independent-requests; page=dqe-independent-requests; components=card-01,card-06,card-15 -->

复用用途：核对十几条独立查询默认直接提交，后续快查询不等待前五条慢查询释放应用额度；查询间仍一请求一查询，独立返回。

参考对象：入口 `/pages/dqe-independent-requests`；页面 `dqe-independent-requests.json` 中 `query-01` 至 `query-15` 与 `card-01` 至 `card-15` 一一绑定，重点比较 `card-01`、`card-06` 和 `card-15`。

移植边界：15 个指标名称及返回数值只用于合成测试，不能带入业务页面。运行时和内置网关默认不设固定并发上限，显式接入限额仍生效；依赖查询、非活动 Tab、缓存、取消及后台预加载继续遵循既有规则。本例不提供视口优先或动态并发，也不承诺真实 DQE 服务容量。

可观察预期与环境：启动 `pnpm dev:playground`，无需 URL 参数或 DQE 服务。页面专属合成 HTTP 适配器将前五条查询延迟 5 秒，后十条延迟 100 毫秒。刷新后，后十张卡先显示 6 至 15，前五张保留等待状态；随后全部完成。浏览器测试读取本页，单元回归另行验证 15 个单项请求均在任何响应完成前提交，以及显式限额、共享与取消。这里验证应用调度和呈现，不代表浏览器实际连接数、真实 DQE、Relay 或生产提速。
