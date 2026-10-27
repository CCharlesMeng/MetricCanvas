# DSL 使用问题索引

供领域 DSL 与 DQE 创作、排错及 Skill 维护按需检索。记录与收口遵循[问题回灌流程](../../agents/local-authoring-skill-maintenance.md#dsl-使用问题回灌)。索引记录历史事实和处理进度，现行规则以链接的产品真源与 Skill 为准。

先用操作、场景、症状、错误码或字段路径匹配下表，再读取命中记录。每个问题一行；ID 使用首次登记日期与短名 `DSL-YYYYMMDD-slug`，同根因复发沿用 ID。证据首次在此沉淀时放入同目录 `YYYY-MM-DD-slug.md`；已有文档直接链接其问题章节，修复待办链接既有 Issue 或计划。

| 问题 ID / 记录 | 操作 / 场景 | 症状 / 检索词 | 适用版本 / 环境 | 状态 | 现行规则 / 回灌位置 |
|---|---|---|---|---|---|
| [DSL-20261027-contract-maturity-period-linkage](2026-10-27-contract-maturity-period-linkage.md) | 保存 / 期间切换联动KPI及表格列组 | mtime、part:mode、part:value、inline不重查、同版分发差异 | 输入6.51；主工作区6.52；main与开发中实现同为6.66但能力不同 | 已回灌；正式版本6.67，内部部署待验 | local-authoring local-workflow 日期与交互、data-analysis 版本先验；开发中 conditions 已有mode规则 |
| [DSL-20261027-chart-independent-site](2026-10-27-chart-independent-site.md) | 修改 / 多图独立区域按钮 | 同一filterId共享状态、filterGroup重复、6.59输入与6.52校验器差异 | 输入及兼容运行时6.59；主工作区6.52 | 已回灌；真实DQE待验证 | local-authoring references/data-analysis.md 控件与查询对应关系、逐图请求隔离及版本先验 |

| [DSL-20261027-partner-health-increment](2026-10-27-partner-health-increment.md) | 修改 / 伙伴健康度增量合并、多槽得分表 | queryModes相同、rowKey对齐、静态主行回退、辅助查询失败整表为空 | 输入6.58；本地页面/Skill6.52；合成浏览器 | 已回灌；业务待验证 | local-authoring references/data-analysis.md 候选与写回；保留本地主行集并核对实际请求 |
| [DSL-20261027-rejection-record-budget](2026-10-27-rejection-record-budget.md) | 排错 / 审批记录关联 | DQE_QUERY_REJECTED、记录关联超过行数预算、limit=1、total_count | 工作区6.57；本地origin/main页面6.66；实际加载版本待核对 | 已定位，待修复及回灌 | records.maxRows；审批期间本地筛选不能降低读取预算 |
| [DSL-20261027-paged-union-order-contract](2026-10-27-paged-union-order-contract.md) | 排错 / 分页合并 | DQE_ROW_CONTRACT_ERROR、来源排序与合并比较规则不一致、order.by、重复/空行键 | 输入6.61；诊断源码6.66；实际部署未知 | 待验证 | local-workflow 错误定位；真实服务排序与稳定键待修复 |

## 最小记录模板

复制到具体记录，已有事实文档可补齐缺项并直接索引；未知项标明未知。保留失败样本，再追加修复与复验结论。

```md
# DSL-YYYYMMDD-slug：用户可见的问题

- 来源与日期：用户反馈/执行发现，原任务或既有 Issue 链接及必要摘录。
- 操作与场景：新增/修改/删除/排错；指标表/详情表/级联查询等。
- 版本与环境：源码提交及相关未提交差异、Schema/Skill 版本、实际运行时与服务；未知项。
- 预期与实际：用户预期、观察到的结果、错误码/字段路径；耗时问题附阶段与测量依据。
- 最小复现与证据：步骤、脱敏的失败页面片段或 DQE 请求/响应摘录、输入来源；大附件路径及可访问范围。
- 定位结论：已证实事实、尚未验证的假设、判别检查与信号；若无根因，下一项检查及阻塞。
- 修复与回灌：最小修复、适用边界、产品真源/Skill 位置；无需回灌时写明依据。
- 验证：原问题与相关合法场景的命令/操作、结果；静态/Sim/浏览器/真实 DQE 按涉及层级分别填写，未执行如实标注。
- 状态与待办：待定位/待验证/已回灌/已核验无需回灌；未完成项及既有 Issue/计划链接。
- 后续发生与复验：按日期追加新证据、复发环境、验证结论或替代规则。
```
