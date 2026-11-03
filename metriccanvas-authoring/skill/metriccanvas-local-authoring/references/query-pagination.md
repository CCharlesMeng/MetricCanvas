# 后端分页优先

所有查数场景都先判断后端分页能力；能力与业务语义成立时优先使用，不等用户另提要求。覆盖新建页面、本轮修改涉及的旧页数据源、补列、级联、行内明细、候选与导出。保留用户已确认的取数范围；纯样式或文案任务不扩展为仓库批量迁移。

分页分两种目标：浏览只取当前窗口；完整计算、完整候选与完整导出可在协议支持时分批从后端取得全部所需结果。前者减少本轮行域，后者只限制单批传输，仍须证明完整性。inline 没有后端，不伪造动态查询。

## 先判断请求范围

1. 列出本轮相关数据源、查询、全部消费者及依赖；将当前页、固定 TopN、完整集合分开。显式 complete、已有 local 或历史结构只是现状，不是继续全量读取的理由。
2. 核对实际行粒度、字段映射、关联基数、后端排序、准确 total_count 及 offset/limit 能力。相同维度和期间的指标先按[指标合并与查询拆分](data-analysis.md)判断同查能力；成立时直接返回同一行，省去补列。
3. 选择下表对应路径。后端能力未知时保存未执行候选并列出缺口；已知不支持时保留合法路径并说明具体限制。完整结果消费者需要独立查询时分离来源，保持其结果范围。

## 按场景选择

| 查数场景 | 优先路径与读取入口 | 页大小与批次 |
|---|---|---|
| 普通指标查询或对象查询供表格浏览 | `data.query`、`query.core`、`table.pagination`；Table 使用 query 分页，DQE order 声明 limit 和初始 offset:0，响应提供完整匹配总数 | 未指定时每页10条，用 order.limit:10；此分支没有 batchSize |
| 多查询按同一业务键补列 | `data.pagedJoin.pagination`；先取选页成员当前窗口，其他成员仅按本页去重键补列，保留基准源行粒度 | 组合源 pagination 显式 mode:query、pageSize:10、batchSize:10；Table 只写 mode:query |
| 多条基准记录共享关联键 | `data.pagedJoin.pagination`、`data.pagedJoin.records`；使用真实唯一记录字段，按基准记录选页；补列源仍满足关联基数 | 同上；按需模式批次放在 pagination，不沿用旧 records.batchSize、完整读取 maxRows 或本地 timeFilters |
| 上游当前页驱动下游 | [窗口级联示例](page-metadata/examples/query-result-page-window-page.json)；resultBindings 只消费当前查询窗口；排序或翻页更新下游输入 | 主查询 order.limit 控制页大小；maxValues 是输入集合上限，不是请求批次 |
| 多来源逐行合并后统一排序 | `data.pagedUnion`、[多来源表格](multi-source-table.md)；用合并源维护有序读取流和最终分页 | 组合源 pagination.pageSize 默认选10，Table 使用 query；按此分支字段配置，不添加 batchSize 或 pagedJoin 的 mode 字段 |
| 行内按父行查明细 | [行内查询示例](page-metadata/examples/table-row-expansion-query.json)；每个实例独立查询分页，保留父行条件 | 专属 query 的 order.limit 默认10、offset:0；无额外初始 pageSize |
| 筛选候选、表头候选 | `table.search`、`table.pagination` 与所属[筛选协议](page-metadata/filters.md)；优先由候选端口按页搜索、去重与加载 | 使用该端口支持的批次；浏览10条不将候选改成只取10项，完整候选域与预算保持 |
| 完整导出或必须消费完整结果的计算 | `table.export`、`data.query`、`data.pagedJoin`、`data.pagedUnion`、[具名算子](page-metadata/compute.md)中实际支持的完整读取路径 | 可分批时逐批取得完整集合；只取第一页不能作为完整结果，不给不支持批次的分支发明字段 |

pageSize 是最终页面行数，batchSize 是支持该字段的协议中的读取或补列批次。两者一起核对，分别设置；不把10/10推广到所有协议。接口一次 POST 中的 dsl_list 批量合并也不是行分页。

保留后端已有的聚合语义。单个 KPI、整体汇总、完整趋势、并集、跨源完整计算、完整候选与导出不能缩成第一页。先判断能否让后端返回所需聚合结果，或采用已有完整分批路径；确需完整读取时说明该源和原因。分页窗口内的计算与完整集合计算按协议分别验收。

## 已有页面迁移

- 普通 query：Table 改为 pagination:{mode:query}，在 DQE order 设置正整数 limit 及 offset:0；确认无完整集合消费者后移除 resultScope:complete。query 分支的 Table 不另写 pageSize。
- 有前端关联或计算：先核对输入范围与原始字段。能够同查的指标合并后补齐 queryField；必须多查询时按上表迁移，不仅改 Table.mode。补列计算字段只有具备相应后端路径才保留全局排序或筛选。
- 历史 pagedJoin：使用显式查询分页分支，清理完整读取 fallback 和旧 records 批次/本地时间设置。canSelectPage 必须有服务能力依据；现行成员只支持单字段关联键，组合键不能退回不唯一的单字段，也不虚构可供后端筛选的拼接键。
- 保留固定条件、参数、权限、时间、排序及业务 TopN；仅迁移分页所需对象。共享来源有不同范围消费者时拆分。查询变化后核对 initial 与缓存身份，移除失效快照。

## 完成判据

完整校验之后，在精确页面修订上检查首屏、下一页、末页、排序或筛选重置及成功空结果。普通查询确认 limit/offset 随翻页变化；组合/级联确认补列只包含当前页输入；合并源确认最终排序与来源读取共同正确。总数用完整匹配数，返回窗口行数不得冒充总数。

按数据源报告请求范围、实际页大小、适用的 batchSize、保留完整读取的原因与未验证能力。校验、合成/仿真、浏览器请求和真实服务分别举证；只有真实请求响应证明后端接受编码、兑现总数与排序后，才将能力标记为已验证。缺少真实环境时完成候选与可执行检查，保留具体待验项。
