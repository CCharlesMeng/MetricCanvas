# 记录关联取消行数上限

2026-10-27，基线5620b6f8069b22075d06d258081c2a009132c32f；独立工作树record-row-budget。用户明确要求取消记录关联的行数预算，本次没有扩大为取消字节与超时限制。

## 声明与行为

Schema6.69：records.maxRows改为可选；省略即不比较主表totalCount与累计行数，显式数值保持原1—100000约束和拒绝行为。records同层batchSize、maxBytes、timeoutMs仍必填。商务驳回明细与record-join-demo删除maxRows。records.maxRows与fallback.maxRows分属不同执行路径，后者不限制记录模式。

完整读取后按关联键补列、全局搜索/筛选/排序/分页、重复审批记录、准确总数和完整窗口检查均保持。取消、字节限制、超时及导出单表10000行限制不变。没有百万级真实服务性能承诺。

## 功能链路

- 产品：packages/page/src/schema/paged-join.ts、版本能力paged-join-unbounded-rows（6.69）；packages/data-execution/src/paged-join/record-batches.ts只对已声明maxRows计费。
- 页面：pages/business-rejection-details.json、pages/capabilities/table/record-join-demo.json；新增record-join-no-row-limit.json，显式Dashboard，100001条合成数据、128MiB字节限制、60秒超时。
- 协议：PAGE-METADATA.md、docs/page-metadata/data-sources.md、reference-map.json、合法契约向量record-join-unbounded-page.json。
- Skill：local-authoring1.3.0，data-analysis说明从用户确认的取消行数要求出发，产品真源生成知识与独立校验器；MC同源更新。
- 使用问题：docs/evidence/dsl-usage/2026-10-27-rejection-record-budget.md追加本批，索引状态更新，历史失败现场保持。

## 验证

产品回归175文件1546项通过；覆盖超过十万条完整关联并搜索最后一条、总数1299225时仍继续请求第二批（随后注入上游失败，验证不会伪报成功）、旧显式行数预算、字节、取消、超时、重复键、计数变化和截断。1299225是用户原始响应数；新测试使用合成响应，不表示读取了真实1299225条。

119个页面校验通过；pnpm check全项目通过（Svelte零错误零警告）；pnpm build:packages通过。最终Skill分发、MC与浏览器结果见后续收口记录。

验收发现基线5620b6f8新增QueryTimeRangeError和normalizeQueryTime但公开API快照未刷新；源导出已存在，本批仅补两个快照名称，没有新增该API实现。

## 复杂度

metriccanvas-ts-ast/1，TypeScript5.9.3；自身selfCC，全部修改函数和新增辅助/测试回调分别测量；Svelte提取script后统计，模板由实际浏览器和类型检查覆盖。

| 函数 | 前 | 后 |
|---|---:|---:|
| chargeRows |4|5|
| readRecordBatches |5|6|
| loadPage（Playground） |12|13|
| pageExternalInputs |10|11|
| unboundedRecordRows（新增） |—|3|

新增测试回调最大7，浏览器函数/回调最大2。修改/新增函数均≤15，扫描文件未出现超限函数；本批无新增或修改的未关闭复杂度项。测量原文保存在本证据目录complexity-*.json。

## 边界与状态

本批未调用真实内网DQE/Relay、未部署、未运行真实DS模型。结果仍可能因字节或超时失败，移除行数上限不会把完整关联变成上游分页。本工作树改动尚未提交或推送，不宣称已在远端main。


## 最终收口结果

在最后一次生成产物完成后顺序执行检查：8文件215项通过（local-authoring188、公开API8、记录协议与版本19）；分发隔离9项通过，其余21项未纳入默认Skill范围。MC合同导出1256 product/4 authoring/1 interface一致，覆盖检查与32项MC测试通过，可见诊断夹具检查通过。

浏览器正式入口http://127.0.0.1:5202/pages/record-join-no-row-limit，Chrome headless1440×1000；100001条完整加载后可搜索末尾BIZ-50000并查看补列责任人，清空搜索恢复完整总数、翻至第2页、排序后总数保持。注入上游失败时仅保留DQE_TRANSPORT_ERROR诊断与空态，没有部分审批行。首屏本机合成场景耗时12876ms，不代表真实DQE性能。截图population.png、final-record.png及result.json保留输入场景与结果；独立校验器对实际业务JSON返回ok=true。

早期验证分别暴露旧版测试依赖业务页默认maxRows、裸夹具文件名与id不符、知识主题超过16KiB及基线公开API快照漏项，均已按真源修正；没有放宽门禁。一次MC检查与产物重生成并行，读取到中间文件而失败，该轮不计通过；上述最终检查在生成完成后顺序执行。

代码、页面、协议、Skill1.3.0及派生物保留在本工作树，未提交、未推送、未部署。预算问题已回灌原使用问题记录及local-authoring作者说明；真实内网DQE与Relay继续标记未验证。


## 提交交付

用户随后明确授权提交并push main。交付基线仍为5620b6f8；产品源码和验证输入未改变，复用上述已完成验收。原始日志、截图和测量已备份至本机 `/Users/moon/.codex/delivery-evidence/record-row-budget-20261027/`，不依赖临时工作树保存。交付路径清单为同目录delivery-paths.json。最终远端SHA和完整CI结论见本次交付回执，未以旧SHA的通过替代新提交CI。
