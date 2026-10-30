# 对象参数、表头候选与10条分页验收

交付基线：origin/main `4c2c4f0dd1eb00aa95f905ea3643bf57cf73c35d`，Schema6.77；local-authoring由1.14.6更新到1.14.7。仅交付本批源文件与从此基线重新生成的产物，主工作区其他未提交工作保留。

## 行为与入口

- `/pages/business-rejection-details-pagination-10` 使用普通object主查询，初始limit10/offset0，后续offset10/20；按当前页商务ID补列，保留同商务多条审批。
- 对象调用统一使用query_type/object_type/output_fields、filter.fields中的field_name/value_list/operator以及order。原始用户示例作为参数夹具保留，空条件/排序也发送空结构，不推断字段类型或发明DISTINCT参数。
- 对象列候选仅投影目标字段，保留完整匹配条件，移除本列条件、表格排序和分页；完整返回后本地去重。默认不带明细页limit，显式候选行数上限仍限制投影响应并对超限明确失败。
- 显式候选编码优先；固定TopN保留已有fullQuery兜底的原查询和范围，指标查询路径保留。缺总数、截断、失败和取消不产生部分候选。

页面JSON与步骤见[人工检查](../../../pages/temporary/business-rejection-pagination-10/README.md)。协议真源为[对象查询](../../page-metadata/queries-and-bindings.md#object-query-parameters)，对应生成文档、知识与分发锁由官方导出器同步。

## 实际验证

| 层级 | 命令或操作 | 结果 |
| --- | --- | --- |
| 查询、原有完整候选、Sim与审批记录 | pnpm test packages/data-execution/tests/object-column-candidates.test.ts packages/data-execution/tests/dqe-object-query.test.ts packages/data-execution/tests/column-candidates.test.ts packages/data-execution/tests/full-query-candidates.test.ts packages/engine/runtime-ui/tests/business-rejection-sim.test.ts tools/dqe-sim/tests/rejection-details.test.ts | 6文件66项通过 |
| Skill、文档与注入配置 | pnpm test tests/local-authoring-skill.test.ts tests/page-reference.test.ts apps/playground/tests/runtime-config.test.ts | 3文件54项通过 |
| 类型 | pnpm check | 全部通过，Svelte零错误零警告 |
| 页面目录 | pnpm validate | 149页通过、0失败 |
| 生成 | pnpm authoring:contracts；pnpm authoring:contracts:check | 1317份产品产物生成，一致性通过 |
| 仓外独立安装 | 复制完整local-authoring到仓外目录，确认无符号链接，运行独立validate-page.mjs校验实际页面 | errors为空 |
| 浏览器精确修订 | 独立交付checkout以5199运行，使用标准HTTP网关连接DQE Sim；打开阶段候选，选择初审 | 候选为初审/复审，总数603，仍每页10条 |
| 真实DQE/Relay | 未运行 | 不作为本地通过结论 |

浏览器使用合成数据。9月原始阶段投影含1205行，前端去重后2项；这不证明后端DISTINCT。期间、其他列条件和候选搜索作用域有定向回归。原始分页版的审批结果候选和下一页已在本地浏览器检查，最新基线进一步复验阶段筛选与10条主窗口。

## 复杂度

同一metriccanvas-ts-ast/1、TypeScript5.9.3口径：encodeObjectQuery自身CC11→11；createDqeGateway自身1→1，内部fetchColumnCandidates自身8→10；新增projectedQuery=6、assertActive=2、objectColumnCandidates=6，所有新增测试函数/回调≤3。Sim行生成函数自身1→1、内部回调6→6。未改gatewayNormalizationError自身CC16为存量项，未在本批拆分。详见[实测函数](complexity.json)。

CI由推送后的准确SHA运行，完整authoring:check、全量测试、构建与兼容性结论以该次CI为准，不用本地静态检查代替。早期旧基线曾停止过宽的导出故障注入回归，未将其声明为通过；本批已换最新main重跑上述检查。

## CI诊断快照修复

首轮CI的完整local-authoring回归227项已通过，但MC快照检查报diagnostics.json漂移。官方mc-content-fixtures.py生成器确认只有三份诊断/布局回执中的内容与清单哈希需要同步，页面JSON和运行逻辑没有变化。已重新生成这三份回执，mc-content-fixtures.py --check通过；MC来源覆盖、33项Python内容包回归、7项TypeScript覆盖回归及独立MC打包均通过。最终CI结论以补推后的准确SHA为准。
