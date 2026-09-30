# CodeCheck 反馈整改计划与执行记录

日期：2026-09-30。上游核查基线：`752836ef`。输入：Relay《CodeCheck 第一轮缺陷修复总结》v6.0；未取得 Relay 补丁、rsp.json 和复扫结果。

## 目标与范围

将反馈转化为当前活跃代码的可验证改进，不复制旧快照的目录结构。本次不改变模块所有权、页面参数协议、保存状态机、查询授权与并发规则，不涉及产品架构调整。

1. **基线及归属**：确认 application/domain 已退出当前上游；不新增为旧双链路服务的 page_validation_common。adapters 为集成方所有，Relay 插件和 data_agent_mcp 不在本次修改范围。
2. **诊断隔离**：统一实现尽力记录且不向业务抛出的日志函数；仅记录固定事件、操作标识和异常类型，不输出外部异常正文。诊断失败不重入 logger，保存 unknown 回执必须继续落库；不吞取消与退出异常。
3. **规范修复**：父子异常去重、bool isinstance、float 默认值、dataclasses.field 遮蔽、两处生产 assert 显式失败。MCP 列表默认值使用工厂，验证省略/空数组/非法 null/数量上限；保留数组输入类型。
4. **有依据的复杂度拆分**：针对活跃 DiscoveryService._run、QueryResults.execute、页面校验 _component_issues 与 _compute_issues 拆分职责。私有辅助函数不改变公开 Interface；保持执行顺序、异常范围、CAS 和错误输出顺序。其余函数不根据缺失的 Relay 补丁机械拆分；此批不承诺所有函数满足未知的 CodeCheck 阈值。
5. **验收与交付**：增加日志故障、保存回执和 MCP 输入回归，运行完整 Python harness；运行契约导出/检查及 Bundle 摘要检查。记录每层实际结果，不将本地测试等同于 CodeCheck、DS 或真实 Relay/Java/DQE 联调。

## 明确不采纳的反馈

- `_best_hit` 保留 `tuple | None`：两种 return 都返回一个 Python 对象；空串哨兵不是必要修复，扫描策略需凭原始规则复核。
- 不在日志失败后再次调用同一 logger。
- 不重建 application/domain，不维护平铺与分层参数两条现行链路。
- 不修改受保护的内部 Adapter；按 ownership.json 与 bundle.lock.json 确认所有权。
- 不声称 noqa 能豁免 CodeCheck，不把规范告警一律称为生产 P0。

## 执行顺序及完成条件

- [x] 保存基线及修改前 MCP 实现，比较实际生成 Schema；保留工作区原有 IOC 测试及未跟踪材料。
- [x] 实施诊断隔离和规范修复，通过针对性行为回归。
- [x] 完成四个活跃函数的职责拆分，相关既有行为用例通过。
- [ ] 完整 harness、契约及 Bundle 检查全部通过：存在下述 IOC 6.12 基线阻塞。
- [x] 填写执行结果并交付；发布门禁未关闭，计划暂留此目录，待门禁通过后归档。

## 外部复验清单

Relay 维护者需提供：上游完整 SHA、安装 Bundle 摘要、插件/Adapter 版本、原始 CodeCheck 规则与复扫报告。使用固定版本 sync_upstream 先 preview；公共文件已有本地补丁或删除时先解决冲突，不能覆盖后再盲目重打。验证写入/删除列表与内部 Adapter 保留情况。真实保存超时、回执恢复及真实 DQE 请求须在集成环境复验。

## 执行结果

### 已实施的代码

- 新增 `metriccanvas-authoring/tool/metriccanvas_authoring/diagnostics.py::safe_log`；work/diagnostics、data/metadata_session、assets/drafts 共用。只捕获 Exception，单次日志尝试失败即返回，不捕获取消等 BaseException。保存日志只包含 operationId 和异常类型。
- `text_choices` 改为 `Field(default_factory=list)`。实测九个 MCP 输入 Schema 仅去除了 `text_choices` 的 `default: []` 注解；数组类型、maxItems=200、可省略规则不变。未接受显式 null。测试覆盖省略两次、显式空数组、null、201 项。
- 两处数据上下文解析的 assert 改为显式 `DATA_CONTEXT_UNPARSEABLE`，查询侧保留 discovery 阶段；优化模式验证失败不会进入 DQE。
- bool 判断、重复父子异常、float 默认值已修正；dataclasses.field 采用 `dataclass_field` 导入别名，一次消除全部遮蔽，协议键及局部语义未变。
- `_best_hit` 未变；未改内部 Adapter、Relay 插件、data_agent_mcp；没有重建旧目录。

### 职责拆分

以下是 AST 起止行统计的函数长度，不是 CodeCheck 圈复杂度，不声称达到未知扫描阈值。

| 活跃函数 | 修改前行数 | 修改后行数 | 提取职责 |
|---|---:|---:|---|
| DiscoveryService._run | 208 | 110 | 问题解析、候选检索、解释提议、提议合并、知识冲突、用户选择恢复、约束建立 |
| QueryResults.execute | 128 | 44 | 单项执行与 CAS 结果占用；批次先授权、再 gather 的顺序保留 |
| _component_issues | 132 | 100 | 指标卡、分类明细、标签容器专项校验 |
| _compute_issues | 160 | 108 | pivot 校验、计算输出与原始行冲突校验 |

主要新增辅助函数长度：`_retrieve_candidates` 16、`_interpret_requirements` 35、`_merge_proposal` 20、`_claim_result` 23、`_execute_one` 69、`_metric_card_issues` 20、`_category_breakdown_issues` 7、`_tab_container_issues` 11、`_pivot_issues` 25、`_computed_row_issues` 31。未引入状态对象或新的公开 Interface。

### 验证结果

| 验证 | 结果与限制 |
|---|---|
| 日志、单次保存、元数据、MCP 参数定向回归 | 43 项通过；包含新增日志连续故障、不重复保存、异常正文不进入日志参数的检查 |
| 完整 Python harness | 517 项，516 通过、1 失败；失败为既有参数黄金向量 6.11 与当前 TS writer 6.12 不一致，见下节 |
| 随后增加的两个空解析结果回归 | `python -O` 下 2 项通过；显式错误处理不依赖 assert |
| 校验器差分 | packages/page/fixtures 与 contract-snapshot/page/conformance 中 201 个页面输入：前后完整 issue 列表（含顺序、路径、消息）一致，输入不变；不是任意输入的形式化等价证明 |
| MCP Schema 差分 | 九个工具，仅上述默认值注解差异；运行时省略语义由定向测试验证 |
| authoring:contracts / authoring:contracts:check | 均失败于 `Incomplete page reference`；未进入输出写入步骤 |
| check_bundle.py | 失败：本次源码修改及既有基线文件摘要漂移，新增 diagnostics.py 也尚未进入锁；未手改锁 |
| git diff --check | 通过 |
| CodeCheck / DS / 真实 Relay、Java、DQE / CI | 未运行；本地 fake 和 scripted-no-model 不等于真实联调 |

复验命令（仓根）：

```sh
PYTHONDONTWRITEBYTECODE=1 metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/run_tests.py
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=metriccanvas-authoring/tool:metriccanvas-authoring/test-harness:metriccanvas-authoring/test-harness/tests metriccanvas-authoring/tool/.venv/bin/python -O -m unittest test_discover_data_context.DiscoverDataContextHarnessTest.test_empty_parser_result_fails_explicitly test_query_validation_policy.QueryValidationPolicyTest.test_empty_parser_result_fails_before_execution
pnpm authoring:contracts
pnpm authoring:contracts:check
python3 metriccanvas-authoring/scripts/check_bundle.py
git diff --check
```

### 发布门禁阻塞及后续动作

1. `test_parameter_preparation.ParameterPreparationTest.test_generated_shared_extraction_vector` 预期 schemaVersion=6.11，实际 TS 参数程序返回 6.12。这部分生产代码、测试和黄金向量均未在本次修改。
2. `tools/scripts/page-reference.ts:329` 报 IOC 6.12 参考文档未覆盖：跨源 compute 算子、detailViews、sectionGroups、sectionAnchors 等字段、枚举和分支。生成器先建立全部输出再写入，本次失败未刷新生成文件。
3. 本地 IOC 实施计划（docs/plan/2026-09-29-ioc-implementation.md，其他会话未提交材料） 明确创作契约最后整合。不能为了本批变绿提前改写该批协议或绕过参考文档覆盖检查。
4. Bundle 校验还报告原已提交但锁未同步的 `skill/metriccanvas-page-builder/SKILL.md`、`test-harness/model-evals/run_result_completeness.py`、`test-harness/tests/test_execution_improvements.py`、`pages/referenced.py`，这些文件本次未修改。其余源码摘要变化由本次整改产生，两者分开记录。
5. IOC 责任批次补齐参考文档并进入创作整合后，运行正式生成器，再检查完整 harness、两个契约命令及 Bundle。锁必须包含新 diagnostics.py 与全部实际改动；门禁通过前不可将此工作区作为可同步发布包。
6. CodeCheck 对单个隔离边界的宽泛捕获是否需要豁免，须拿到原始规则和复扫结果后处理；不加入无法确认有效的 noqa 注解。

当前状态：本次代码整改完成，发布验收未完成。用户已授权将本批源码提交并推送 main；远端 SHA 与 CI 结论以提交后的交付回执为准。未同步 Relay。计划继续保留以便接续发布门禁，不归档为已发布。
