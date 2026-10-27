# DSL-20261027-rejection-record-budget：商务驳回明细记录关联超预算

- 来源与日期：2026-10-27 用户反馈 `business-rejection-details` 的 `DQE_QUERY_REJECTED`，附实际请求及响应。
- 操作与场景：排错；审批记录明细通过商务ID补充商务基本信息。
- 状态：已定位，修复及创作 Skill 回灌待实施。本轮用户要求解释原因，未修改产品代码或页面。

## 版本与证据边界

当前工作区 HEAD 为 ea40f6641，存在大量并行改动；目标 JSON 是未跟踪的 Schema 6.57 文档，没有 records。工作区执行器也没有此次错误文字。
本地 origin/main 引用为 54021ab6776c37c8e7e5f669e6c76cc88a3d7a48（本轮未 fetch，不宣称远端实时状态）。该修订同名页面为 Schema 6.66，records 配置为 batchSize=500、maxRows=100000、maxBytes=67108864、timeoutMs=60000；唯一匹配报错文字的位置为 packages/data-execution/src/paged-join/record-batches.ts:39。
实际浏览器加载的页面 JSON、包版本及 batchSize 未取得。用户请求 limit=1 与仓库示例 batchSize=500 不同，不能认定实际页面与该修订逐字一致。

## 最小失败现场

- 请求：9 个维度、无指标，filter.dims=[]、filter.metrics=[]；order.offset=0、limit=1，按全部输出维度升序。
- 响应：retCode=CBC.0000，results[0].code=SUCCESS，data.length=1，total_count=1299225。
- 症状：rejection-overview 报“记录关联超过行数预算，请缩小筛选范围”。
- 原始附件保留在本机 Codex attachments/20a5c86b-e322-401e-84f9-24de6cd0997f/已粘贴的文本.txt；正文不复制业务值。

## 定位结论

1. DQE 返回成功，拒绝由共享执行器的记录关联预算检查产生。readRecordBatches 先校验分批窗口，再比较主表 totalCount 与 records.maxRows，超限即停止，不会继续拉取全量。
2. limit 只控制本批行数，不会把 total_count 降为 1。100000 是记录模式预算；fallback.maxRows=1000 属于另一条完整关联路径，不能混用。
3. records 模式先分批完整读取主表，再按商务ID补列，再执行表格全局搜索、筛选、排序及分页。页面每页10行不意味着仅读取10条主表记录。
4. 该修订只给 region 配置 DQE filterBindings；审批期间 mtime 位于 records.timeFilters。records-reader.ts 中 readRecordBatches 在 filterRecordTimes 之前执行，因此缩短本地审批期间不能降低读取预算。给定请求确实没有下推筛选。
5. 全字段升序与 recordReadOrder 一致，是记录扫描的顺序；最终表格排序在完整关联后处理。
6. 不能直接移除 records 回到商务ID唯一键的路径：审批记录可能同一商务有多条，关联键不等于记录身份。不能简单把前端预算扩为百万行；当前 Schema 记录预算上限为100000。

## 重放验证

将上述 origin/main 修订的 packages/page、packages/data-execution 与目标页面导出至系统临时目录，复用本地依赖。调用真实 readRecordBatches，返回附件中的实际数据（按 queryField 映射）与 total_count；仅把测试计划 batchSize 调为1，以匹配给定请求。

结果：`REPRODUCED code=DQE_QUERY_REJECTED message=记录关联超过行数预算，请缩小筛选范围 total=1299225 maxRows=100000 requests=1`。
对照：同一行、同一预算，仅将模拟 totalCount 改为1，读取成功。对照不是修复，也没有修改真实响应。

静态诊断入口尝试失败：inspect-page-metadata.ts 导入的 fileNameErrors 在当前混合工作区 packages/page/src/index.ts 中不存在；不是目标页面校验失败证据。
未执行真实服务重查、浏览器复验、产品修复或发布。没有生产代码变更，复杂度实测不适用。

## 处理方向及待办

- 验证当前加载的页面和运行时版本，查明 limit=1 的实际配置来源。
- 短期：使用能真正写入 DQE 请求的区域条件降低主表总数；是否可降至预算内需实际执行确认。
- 优先修复方向：在真实 DQE 验证审批时间谓词与格式后，将审批期间下推到主表查询，使预算针对筛选后的行域生效。
- 若仍需百万级全范围明细：由上游完成记录级关联、全局筛选、排序、准确计数及分页，保持审批记录身份；不在浏览器完整加载百万行。
- 已验证的排查方法需在承接修复时补入 local-authoring 作者维护的定位 reference，并完成分发自洽检查；当前未将混合工作区的旧协议知识重新生成。

## 2026-10-27 修复追加

用户授权修复后，在独立工作树 rejection-time-pushdown 实施6.67字段时间绑定，主表审批期间下推，移除该筛选的本地timeFilters。旧6.66本地模式保持。回灌至查询协议正文和local-authoring数据分析reference，并由真源生成分发；详见[修复验收](../rejection-time-pushdown/acceptance.md)。用户确认真实DQE仅在其内网，本机无访问入口，真实服务验真保留未执行。前述失败现场与历史判断保留，不视为当前修复状态。


## 2026-10-27 正式集成补充

期间模式与查询期间策略正式使用 Schema 6.67（B1提交0297ca393）；显式字段时间下推迁为6.68。旧开发副本的6.66/6.67仅记录历史，不代表内部实际已安装。集成中修复记录源自动多字段排序与main单字段DQE规则冲突，保留显式排序、缺省仅关联键排序。验证和发行状态见[本次集成记录](../local-capability-integration-20261027/b2.md)，真实内部服务仍待验。
