# 商务驳回明细：审批期间在记录预算前下推

日期：2026-10-27。用户在原诊断后明确授权修复。基线：54021ab6776c37c8e7e5f669e6c76cc88a3d7a48，fetch origin main后建立独立工作树rejection-time-pushdown。原工作区大量并行改动及旧同名页面保持。本次未提交、推送或部署。

## 根因与修复

真实附件的DQE查询成功，但未下推时间条件，total_count=1299225。6.66记录模式在全部读取之后才执行records.timeFilters，因此在本地期间筛选之前就超过100000行预算。limit=1只影响单批，不影响总数。

6.67复用target:time、queryField、valueFormat，将普通DQE的指定时间字段编码为filter.dims中的>=及<=。日/月范围先按日历展开，datetime落到当天00:00:00/23:59:59，compact为YYYYMMDD；不转换时区。静态条件保留并以AND叠加；原统计filter.time行为保持。拒绝字段/格式缺一、非法日历和分钟精度范围，防止静默扩大查询。对象查询的既有协议不变。查询模式的分支和版本能力识别同步覆盖。

业务页及record-join-demo将mtime绑定到主表“审批完成时间”，移除对应records.timeFilters；基本信息保留notApplicableFilters，并按商务ID补列。保留记录身份、同一商务多条审批、100000行/64MiB/60秒预算、完整窗口及总数检查。过滤后仍超预算时继续明确拒绝，不截断结果。

## 可复验的请求

[expected-request.json](expected-request.json)由实际修改后的业务页、SourceProgram、默认筛选和DQE网关编码生成，无业务数据、凭据或内网地址。默认2026-09，主表范围为2026-09-01 00:00:00至2026-09-30 23:59:59；批大小500。

用户确认真实DQE只在其内网，因此本次未执行真实服务。内网验收需同步更新6.67运行时与页面，核对请求谓词、响应总数确实按期间缩小、跨批计数稳定，以及基本信息不接收审批期间。真实后端是否接受该维度范围与其性能不由本地验收证明。

## 验证

- 修复前：rejection-time-pushdown.test.ts稳定复现原错误，模拟无期间条件时返回1299225；三种指定字段编码也失败。
- 修复后：相同共享网关调用路径获得期间内12条，基本信息仅按商务ID补列；切到8月空结果，跳过补列。日期编码覆盖闰年2月、iso、compact、datetime、静态条件保留、旧统计时间、非法日期和分钟精度拒绝。
- 页面、共享执行、运行时及local-authoring：177文件、1683项通过，详见tests.log。含旧6.66本地时间模式、记录身份、取消、失败、重复键、读取超限、候选与导出回归，以及仓外安装/独立校验器。
- 类型：page、data-execution、Playground和tests/tsconfig.json通过；Svelte 0错误0警告。
- 页面目录：113/113通过；仓外复制local-authoring后对实际business-rejection-details.json校验ok=true，查询与pagedJoin知识路由包含6.67下推边界。
- 真源重新生成1251个product、4个authoring、1个interface产物，契约检查通过。Schema升级示例及MC可见诊断页随当前版本重新生成；再次生成分发后更新诊断摘要，最终MC夹具检查与契约检查均通过。
- 分发隔离检查：按local-authoring默认范围仅计生成校验器漂移检测和作者说明保留两项；完整隔离套件包含其他Skill及历史Bundle/MC场景，已停止该扩大范围轮次，未计为通过。最终结果追加于本文末尾。

首次全量检查早于派生物生成完成，出现旧版本快照/契约漂移；停止该过期轮次后重新生成并完整复测，上述通过结果来自最终产物。生成期间修正新版本语义索引、显式链接锚点和知识标题登记。系统Python缺少fastmcp/jsonschema，改用已有authoring虚拟环境完成生成和MC诊断夹具同步，不把工具环境失败当作产品通过。

## 浏览器

独立工作树Vite入口：http://127.0.0.1:5192/pages/record-join-demo。通过Codex浏览器实操：默认9月1205条；起止都改为8月并Enter后0条；改回9月并搜索BIZ-00001得到初审/复审两条，见[browser.png](browser.png)。sourceFailure=true产生DQE_TRANSPORT_ERROR，表格无部分行及成功总数。合成Adapter在返回总数与窗口前应用期间；真实HTTP请求编码由共享网关回归覆盖。

## 复杂度

口径metriccanvas-ts-ast/1，TypeScript 5.9.3，自身selfCC，嵌套回调逐项计量；原始数据为complexity-*.json。未修改UI样式或生产Svelte分支。

| 函数 | 前 | 后 |
|---|---:|---:|
| encodedMetricItem | 13 | 13 |
| setMetricTimeBinding（新增） | — | 8 |
| metricShapeErrors | 7 | 6 |
| queryDateFilterErrors | 6 | 11 |
| timePeriodMatches | 10 | 11 |
| valuesForQuery（合成数据） | 5 | 6 |
| filterPreviewTime（新增） | — | 3 |
| usesMetricFieldTime（新增） | — | 4 |
| 原记录本地日期测试回调 | 6 | 7 |
| 原记录非法配置测试回调 | 7 | 7 |

新增辅助函数、匿名回调及新测试均≤15；新增能力入口及两层检测回调逐项见测量输出。存量gatewayNormalizationError=16未修改；其余未关闭复杂度项没有扩入本次范围。没有以外层低分代替闭包测量。

## 文档与Skill回灌

- 协议：PAGE-METADATA.md、docs/page-metadata/queries-and-bindings.md、data-sources.md、reference-map.json。
- 场景：pages/capabilities/table/README.md及根pages/README.md。
- Skill作者入口：metriccanvas-authoring/skill/metriccanvas-local-authoring/references/data-analysis.md的“记录关联预算与期间筛选”；协议知识、校验器、知识模型和锁从真源生成。
- 问题记录：docs/evidence/dsl-usage/2026-10-27-rejection-record-budget.md，原失败现场保留并追加本次修复。

已完成本地修复与回灌；真实内网服务验真尚未执行。原工作树不具备records运行时代码，不能只把新页面复制过去宣称已运行；后续交付须同时携带运行时、页面及同版协议分发。

## 最终收口

local-authoring定向隔离检查2项通过，其余28项未纳入本次执行范围，见export-isolation.log。最终契约检查、MC可见诊断夹具检查及git diff --check通过。独立工作树保留完整未提交改动与验收材料，供后续审阅/交付；没有声称内网DQE、远端CI或部署通过。


正式集成补充：本文件保留源工作树6.67的历史验收；main正式能力版本为6.68，最新共享网关、排序冲突修复及本地复测见[集成记录](../local-capability-integration-20261027/b2.md)。原图和expected-request保留为历史样本，不代替当前实际请求或真实服务验真。
