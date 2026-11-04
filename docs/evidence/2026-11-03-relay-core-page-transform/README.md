# B：查询、结果与页面候选纯核心

日期：2026-11-03。本会话 `01a1a118-3e1e-7b23-b66a-bf4e8b1fd43d`。基线 `485faa0a0f81f0e882e2ff23f1de5ec672884f88`，隔离目录 `/Users/moon/.codex/worktrees/relay-core-page-transform/DataDashboard`。主目录与首批来源只读；没有提交、push、CI 或部署。

依据是主控目录当前 Spec/执行表/协调表/四项规划及 ADR-0129；旧 memory 的 MCP/保存归属已被此次规格取代。只定向重放首批 I08a 的 `data/field_presentation.py` 和对应测试，未复制生成物。Schema 字段净增减为 **0**；创作中间状态、评估时间、作用域及保存事实不进入 PageDocument。

## 原调用图与分批顺序

1. `create_query_data → current_for_query → parse_data_context → derive_executable_units → source_description.describe → map_source_description → dqe.execute → validate_mapped_rows → apply_field_presentation`。先提取前置派生、显式描述映射、执行后规则，线上入口保留取数与原失败顺序。
2. `QueryResults.execute/_execute_one → authorize/current/store/CAS/retry → create_query_data → build_query_source`；`require → store/metadata/authorize/current`；`evidence → 字段/行/关系投影`。仅提取证据投影和事实匹配，不搬保存循环，不假造授权。
3. `PlatformAuthoring.mutate → state.reserve/CAS → saver.verify_current → results.require → referenced.compose/edit → saver.save → artifact/preview`。从中提取 compose/edit 的实际变换；在线 current/resolve 仍由兼容包装逐步执行。
4. `create_compose_page → create_query_data → apply_component_policy → assemble_page_document → validate → artifact`。另提取 `compose_queried_page`；在线策略获取仍在兼容包装。
5. `TurnState.reserve/finish` 的版本/重复请求/unknown 前置规则及 `Lifecycle.saved` 的状态/完整 provider-response 核对提取为纯函数，旧线上入口委托它们；实际 CAS/Java/恢复保持原处。

## 可调用切片

公共模块由 C 的稳定 facade 装配，不要求 Relay 导入私有模块。每模块提供 `OPERATIONS`、`invoke`、`SELF_TESTS`；操作的 outputSchema 描述成功 data，全局信封归 C。

| 操作 | 完整输入 | 输出与边界 |
| --- | --- | --- |
| `query.prepare` | spec、dataContext；显式 strict/sourceDescriptions/requireSourceDescription/stableFieldIds | 派生取数单元、查询定义、字段；`execution:not-run` |
| `results.normalize` | 同上及每单元 executions：rows、可选 totalCount/capturedAt | 查询数据源、字段呈现及完整性；`evidence:supplied`，没有执行查询 |
| `page.compose` | pageId、可选 schemaVersion、request、resultRecords（按 source id） | 页面候选、块结果、调整和完整有序诊断 |
| `page.edit` | baseline、request、resultRecords（按 resultRef）；可选 summaryEnabled/scopeAnnotations | 同一受控操作批；依赖顺序、单操作回滚、部分成功、输入不变 |
| `results.check` | record、binding、contextVersion、policyIdentity | 仅匹配；`authorization:not-checked` |
| `work.check` | work、expectedVersion、requestHash | reserve/reuse 决定和候选工作记录；`cas:not-run` |
| `receipt.check` | command、response；完整 provider-response 或非 saved 状态 | 核对供给事实；`evidence:supplied`，不保存/重发/查询 |

页面和回执模块声明 `RESOURCES=['page-validation']`。C 通过验证发行中的 path/hash/defaultSchema 构造 A 的 NodeValidationResources，程序侧传入 `invoke(...,page_schema=...,node_resources=...)`，不把资源路径交给模型。业务 `input.evaluation` 可选；B 声明 `SCHEMA_BINDINGS={'evaluation':'authoring.evaluation'}` 构建引用（属性以 `{}` 占位），由 C 从 A 的 describe 输出内联唯一 EVALUATION_SCHEMA 后发布闭合 Interface；B 用 dataclasses.replace 复制资源并透传明确值。ISO/时区语义与时间敏感拒绝由 A2 真正产品链实施，B 没有第二份日期算法。

`resultRecords` 的一条记录至少为 `{source:<queryDataSource>,rows:[...],totalCount:<integer|null>}`；relations 可选。行/字段保持原值，不把未知总条数当作完整。缺执行记录为 `RESULT_EVIDENCE_MISSING`；编辑中缺引用只失败对应操作，后续独立操作继续。composition 仍保留既有 `STRUCTURE_SOURCE_NOT_FOUND` 等原诊断。字段映射和呈现按相同真源执行，可信百分比语义不会因 partial/unknown coverage 消失；精度不足保持百分号并发出 `PRESENTATION_PRECISION_LIMIT`。

查询核心只使用明确的绝对时间范围；未发现 now/today 读取。结果状态投影把墙钟读取移到线上 `QueryResults.evidence` 包装，纯 `project_result_evidence(...,now=...)` 接收显式比较时刻；若用于轮次重放，应从同一 evaluation.instant 派生 epoch 秒。真实身份与数据权限、结果记录来源、新鲜度和 CAS 原子性仍须 Relay 证明。

## 调用例

固定合成输入和断言在 `data/product_vectors.py` 及各模块 SELF_TESTS。连续切片由 `test_product_transforms.py::test_compose_query_result_and_edit_slice` 直接展示：

```python
normalized = data_operations.invoke('results.normalize', {
    'spec': spec, 'dataContext': snapshot, 'executions': executions})
record = {'source': normalized['data']['sources']['result'],
          'rows': executions[0]['rows'], 'totalCount': executions[0]['totalCount']}
candidate = page_operations.invoke('page.compose', {
    'pageId': 'offline-example', 'request': request,
    'resultRecords': {'result': record}})
# candidate 仅为候选，saveStatus 为 not_requested。
```

## 验证与复杂度

锁定 Python：主目录 `metriccanvas-authoring/tool/.venv/bin/python`；无运行时安装依赖。

- `product-tests.log`：**17/17 通过**。包括完整切片、原值/输入不变、空结果与未知/缺证据区分、完整性、映射失败、依赖/回滚、scope/version/policy、unknown 阻断、精确回执、在线 query/edit 委托精确对比。
- `offline-probe.json`：从 `/tmp` 以 `python -I -B offline_probe.py <tool-source-root>` 运行，审计钩子拒绝 socket 创建/连接/DNS；10 个固定向量通过，未导入 httpx/fastmcp。这证明 L1 源码产品入口禁网，不替代 C 的四项仓外闭包验收。
- `regression.json` / `regression.log`：14 个相关测试模块 **194 项，191 通过、3 失败、0 error、0 skip**。`baseline-failures.log` 用原始 HEAD 的 query/compose/operation_batch 模块重放，3 项完全相同：两个时间粒度用例期待 `TIME_GRANULARITY_NOT_IN_DATA_CONTEXT`、实际 `TIME_GRANULARITY_UNSUPPORTED`；一个存量呈现操作不在原 EDIT_SCHEMA，报 `OPERATION_INVALID`。没有重录这些断言。
- `complexity.json`：Radon **6.0.1**，同口径前后测量所有 B 修改/新增源码、测试、辅助函数与闭包；新增/修改函数均 ≤15。核心前后：query_data 闭包 **33→10**；referenced.compose **42→1**（新 compose_candidate **13**）；referenced.edit **34→5**（新 edit_candidate **3**）；Lifecycle.saved **19→9**；TurnState.reserve **7→2**。新增 provider 回执核对 **11**、字段映射 **11**、查询派生 **7**、结果投影 **13**。
- `fixed-gate-complexity.json`：仓库固定 Radon 门禁通过，没有放宽门禁。

最终源文件列表/字节摘要见 `source-manifest.json`。只携带 allowlist，导出依赖由 C 实际 AST 闭包解析；不得把生命周期、store、真实 MCP、Client 或整个工具包塞入产品发行。

## 尚未关闭的集成层级

- A2 的显式 instant/timeZone 真正 Node 验收、跨 TZ 一致性，以及 B 资源透传的四项集成回放由 A/C 完成；源码旧默认校验包装仍保持，不能由其通过宣称完整产品校验。
- 页面协议未新增字段；I08a 行为修复的页面试验场/浏览器、页面元数据文档与 local-authoring 同源生成仍须主控统一集成。B 未写共享文档或生成锁，也未复制旧生成物。需同步的语义是“百分比在部分结果/未知总数及微小值下仍保留单位；格式建议与用户意图区分；精度不足给诊断”。
- 页面候选操作覆盖现有受控单源/既有 pagedJoin 组合，不承诺所有合法 Schema 的通用创建/编辑，也没有实现新的多槽创作能力。
- C 的四项双次导出、仓外实际7操作及资源兼容/回退、独立 Skill 安装、真实 Relay/Java/DQE/CAS/unknown 重启、真实模型、CI/部署均不能由本证据推断。老在线入口暂保留。

## c8 运行时绑定复核（后续定向证据）

直接调用 C 冻结候选 `/tmp/mc-four-frozen-20261103-c8/mc-tool/cli.py`，releaseId `e98cd6dcc92ce03b215479f13dadece35adf534c3341880d6126556e1a7d4b1f`，使用锁定 Python `-I -B`、固定请求信封、cwd `/tmp`，没有重新构建。

- `page.edit`、`receipt.check` 各测 `evaluation:null`、`{}`、非法 `timeZone:Not/AZone`，共 **6/6** 返回退出码 **2** 与单条 `INVALID_EVALUATION_CONTEXT`，未进入保存/查询。
- 两操作的最终 Interface evaluation Schema 与实际共享资源相同，资源 SHA-256 与 release.files 一致；源码 `{}` 占位没有作为最终运行契约放行。
- 用合法冻结 evaluation，再各测一份业务非法输入；**2/2** 的完整有序 diagnostics 及 data 与冻结 B 源码实际返回逐值相同。page.edit 依次为 `OPERATION_INVALID`、`COMPONENT_NOT_FOUND`；receipt.check 为 `RESPONSE_MISMATCH`，均退出 **2**。

完整请求上下文、结果与摘要在 `runtime-binding-c8.json`。这是实际稳定 facade 的定向复核；没有重跑无关 194 项，也不证明其他浏览器、真实 Relay、授权、保存或部署层级。B 的 17 文件源码清单与摘要未变。最早复核曾因 Node bundle 缺 `evaluation-schema.json` 在构建阶段失败，没有用伪造共享文件绕过；本次 c8 使用 A 真源实际生成的共享 Schema 复验通过。
