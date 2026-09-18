# 页面创作架构调整：实施记录

后续用户验收已修订自动口径正文与报表容器策略，见[报表反馈修订](report-surface-feedback-results.md)。下文保留本轮实现时的历史证据，不作为自动插入查询范围文案的当前规则。

2026-09-17。本轮落实[架构方案](authoring-architecture-proposal.md)的本地工具、Skill 与离线回归部分。未调用 DeepSeek，未修改渲染器、未保存/发布页面、未提交 Git。原工作区已有改动保留。

## 已实现

| 范围 | 落点 | 行为 |
| --- | --- | --- |
| 版本化能力 | page-structure-plan / structure-revision 契约 | v3 新计划与修订；v1/v2 兼容；v3 分区标题可省略，用途由 purpose 单独表达 |
| 呈现编译 | domain/structure_presentation.py、section_presentation.py | metric-summary 的 compactStrip/compactSummary；bar-comparison 横向/堆叠；record-list 紧凑密度、副标题和有限列展示设置 |
| 能力投影 | structureCapabilities | 从计划 Schema 与已实现呈现族派生摘要；详细参数由实际工具 Schema 发布，不增加工具入口 |
| 可修正诊断 | structure_diagnostics.py、structure_preflight.py、MCP 入口 | 联合分支叶子路径、规则及允许枚举，不回显错误值；缺少页标题返回安全结构化错误 |
| 可见口径 | domain/structure_scope.py | v3 创建/修订共享公共查询期间和局部期间/筛选说明，按结构化事实去重；不再输出英文粒度和 groupBy 参数串 |
| 局部修订 | application/structure_revision.py | 展示修订复用查询；三方合并保留未改变的人工标题/列宽；期间修改刷新说明；旧候选不变 |
| Skill | workflows、scenarios、reading-design.md | 先定阅读层级，再选表达和占位；经营组合为可选示例，宽表核对不强制少列；局部修改不重新加载新建设计 |
| 分发 | eval_evidence.py、run_trusted_local.py、Bundle 导出 | 创建参考注入包含阅读设计；安全模型通道接受已定义能力摘要；锁文件重新生成并校验 |

创建/修订的块 Schema 有一致性测试；能力摘要与公开工具版本、页面组件 variant 有一致性测试。更改登记能力时同时更新契约、编译与对应测试，不把副本当作独立真源。

## 三种场景

- **A 经营阅读**：[冻结计划](../../../../metriccanvas-authoring/test-harness/fixtures/structure-v3-business.json)通过公开 create_content_page，4 次本地样例查询直接生成[页面 JSON](evidence/rich-business-compiled-v3.json)。主次摘要占位为 12/4/4/4，年度对比为横向双系列，两份名单各 3 列并排。不是模型自主设计结果，而是测试计划经过真实装配入口的结果。
- **B 用量监控**：显式合成用量数据，生成趋势与资源当前用量比较；两个不同查询期间就近保留，没有经营目标或客户章节。
- **C 明细核对**：通栏五列表；先经公开编辑入口写人工列宽/标题，再修改列表说明；列数、人工属性、数据源保持，DQE 总调用仍为 1。

新增测试位于 `metriccanvas-authoring/test-harness/tests/test_structure_v3.py`，覆盖上述场景以及非法呈现零查询、精确错误与隐私、缺 title、旧版行为、期间变更、能力/契约/参考路由一致性。

## 验证记录

- 新增专项 14 项通过；先写的 6 项在实现前为 4 failures / 1 error，只有旧版兼容用例通过，实现后通过。
- 全量离线回归 **480 项通过，34.399 秒**，日志 `/private/tmp/metriccanvas-v3-tests-final.log`；最后补强的用量双来源用例亦通过专项重跑。首次沙箱执行有 3 个本机端口权限错误及 1 个能力摘要白名单失败；权限项在允许本机监听的环境重跑，白名单缺陷已修正，没有忽略失败项。
- 生成经营页通过 TypeScript `parsePage`；其 `dataSources` 与用户认可的人工调整版深度相等。未对新产物进行截图或视觉验收。
- `quick_validate.py`：Skill 有效；契约导出检查与 Bundle 摘要检查通过。
- 独立干净上下文前向检查：普通表头局部修改、仅有用量趋势/当前用量的新建任务均能沿公开能力执行，未发现这两条路径的阻断。此为只读行为方案检查，不是模型生成成功率评测。

## 明确保留的边界

1. 方案中“提升生成稳定性”的最终证据仍需独立模型评测。本轮没有收费模型调用，不报告成功率提升。
2. 公共说明表达的是查询窗口，不替代指标统计期间。年度目标/推演与月度实际、名单完整性等业务限制仍由可信数据上下文和作者说明承担。
3. 已有 v1/v2 维持原说明行为；新规则通过 v3 生效，不偷偷重写历史候选。v3 仍是平面分区，不支持任意 JSON/CSS 或任意嵌套。
4. 新参考已进入本地 Bundle 和评测注入路径；真实外部宿主仍须按 tools.md 注入或提供文件读取。未宣称外部部署、生产数据提供方或真实身份接入已经验收。
5. 分组表头只读投影不完整的既有能力缺口未扩大处理；普通叶子列的编辑路径有验证。

下一步：先由用户验收工具直接生成的页面，再在明确授权与预算下，用冻结的 A/B/C 场景做模型端新旧对照；将合法候选、正常收尾、业务覆盖和视觉验收分别计分。
