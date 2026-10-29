# DQE 表头候选默认扫描预算

2026-10-29，独立工作树 dqe-full-query-candidates。接续完整原查询与前端去重、空闲预加载；本批仍未提交、推送或合入 main。

## 已确认行为

- 单次完整原查询候选扫描默认最多1000条原始结果，每批200条；恰好1000条发5批，offset为0、200、400、600、800，不探测第6批。此上限按去重前结果行数计算，候选菜单50项分页独立。
- 首批取得准确 total_count 后，若候选原始结果范围超过预算，抛出结构化 DQE_CANDIDATE_LIMIT_EXCEEDED 并停止，不显示部分候选。业务TopN仍保留，比较 min(total_count, TopN) 与预算。取消、总数变化、截断等完整性规则保留。
- 懒加载与可见绘制后的空闲预加载共用预算。超限时菜单显示查询上限及缩小原表筛选范围/联系管理员提高上限的提示，禁用候选搜索，不给无效重试按钮；修改原表其他筛选条件后可以恢复候选。普通表格分页不受候选预算影响，主查询仍优先。
- 超过1000条必须显式配置。平台门户 readConfig()/独立入口 __METRICCANVAS__ 传 columnCandidatesMaxRows: 2000；独立 createDqeGateway 传 columnCandidates: {mode:'fullQuery', maxRows:2000}。默认 batchSize=200，可独立调整。两个数都必须为正安全整数，单批请求也受剩余预算约束，不允许无限值。配置不写入页面 JSON 或 DQE 业务条件。
- 可选上限通过平台会话配置投影保留，每次候选读取现读；修改预算不使身份会话失效。缺省维持1000，非法上限在候选HTTP前失败，普通表格查询仍可用。
- 不改专用 encodeColumnCandidates 优先级；此扫描预算约束 fullQuery 回退。已完整加载的本地行集与组合查询沿用既有契约。

## 参数与可观察入口

页面 JSON：pages/capabilities/table/table-column-candidates-query.json；合成 DQE 数据：apps/playground/fixtures/full-query-candidates.ts。

- http://127.0.0.1:5183/pages/table-column-candidates-query ：620条，默认200一批完整读取，80个去重代表处。
- ?state=over-limit ：1001条，首批200读取后停止；菜单有超限提示，零部分选项，表格可翻到第21条。
- ?state=raised-limit ：同一1001条，合成集成配置显式1200上限，按200一批共6批取得完整候选。
- ?state=blocked-candidates / ?state=truncated ：挂起、抢占及截断行为保持。

用户操作与证据边界见 pages/capabilities/table/README.md。PAGE-METADATA.md、docs/page-metadata/components/table.md、docs/host-contract.md、docs/plan/table-column-candidates/dqe-handoff.md 已同步。local-authoring 1.11.4 经官方导出生成知识和锁；MC生成错误说明 DQE_CANDIDATE_LIMIT_EXCEEDED。

## 本地验证

| 验收 | 结果 |
|---|---|
| data-execution/runtime/候选/可见性/应用配置/公共API | 101文件696项通过；后续平台会话与缩小筛选恢复补充3文件23项通过（有重叠，不相加） |
| Chrome浏览器 | 6项通过，含1001超限提示、禁用候选搜索、无部分选项、表格翻页，以及显式提高配置后完整读取；candidate-limit.png 已人工查看 |
| local-authoring | 5文件194项通过；最后文档更新再验Skill与page-reference；仓外完整复制零外部链接、新页面校验通过，见standalone-skill.json |
| MC | 官方契约导出/一致性、覆盖、33项Python测试、可见夹具检查通过 |
| 类型 | data-execution、engine、application-runtime、Playground、platform、根tests通过；Svelte 0错误0警告 |
| 构建 | data-execution与engine包通过 |
| 真实服务与远端 | 真实DQE/Relay、真实模型、CI与生产部署未执行；尚未提交或合入main |

完整export-isolation此前同一批次已通过；本轮生成器算法未改，未重复该耗时专项。单次预算不等于整页整个会话的累计请求预算；多列、候选搜索、加载更多在候选页缓存未命中时仍会分别扫描受限范围，成本未归零。前端200行请求不保证数据库仅处理200行；DQE查询计划、分页稳定性与权限仍需真实服务验收。

## 复杂度

仓内 metriccanvas-ts-ast/1，TypeScript5.9.3，逐函数selfCC，包含新增测试回调；原始输出 complexity-before.json、complexity-after.json。

| 函数 | 前 | 后 |
|---|---:|---:|
| fullQueryColumnCandidates | 9 | 8 |
| positiveSize | 新增 | 3 |
| assertWithinBudget | 新增 | 3 |
| candidateRuntimeConfig | 新增 | 2 |
| createInjectedDqeGateway/columnCandidates getter | 新增 | 1 |
| readRuntimeConfig / readPageAssetsRuntimeConfig | 9 / 9 | 9 / 9 |
| installLocalDevRuntimeConfig | 8 | 8 |
| createDqeGateway/fetchColumnCandidates | 8 | 8 |
| 合成 DQE receipt | 7 | 9 |

本批修改与新增函数均≤15。Svelte只增加派生布尔值、错误呈现分支及disabled绑定，无新增函数；未把模板当TS函数测量。扫描发现未触及gatewayNormalizationError=16→16，非本批修改，无新增超限项。此前候选编排44→44的存量及后续入口仍见 ../dqe-column-candidates-preload-20261029/result.md，本批未修改它。

## main 交付复核

交付基线更新到 origin/main `15672c4e321f85da4a376fe57d2c62ba9efa82fd`；保留其批次超时示例、页面无关夹具选择与页头迁移说明，生成文件从合并后的真源重新导出，local-authoring版本1.11.4。冲突解决未改变候选业务语义。

同一最终源码重新验证：107文件895项本地测试、6项Chrome浏览器测试通过；data-execution、engine、application-runtime、Playground类型检查通过，Svelte均0错误0警告；MC契约一致性、覆盖、33项Python测试及可见夹具通过；Skill仓外复制零外部链接、页面校验通过。测试覆盖新基线的批次超时行为。Playground夹具选择器AST selfCC按最新main同口径为14→8，辅助函数rejectionPreviewRowCount=4、rejectionPreviewDelay=3保持不变；其余复杂度结论与上述实现证据相同。

提交按用户明确要求带 `[skip ci]`：远端CI有意跳过，不能把本地通过报告为CI通过。原始日志、截图与扫描报告保留在本地归档；真实DQE/Relay和部署未验收。
