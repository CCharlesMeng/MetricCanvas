# T08 / #134 内容编辑验收证据

S3，2026-09-14。本仓最终组合验收通过，待S0集成。原实施基线 `e65b012c0a93d5c9a1ac9c0e51e320133e97a0f1`；作者提交 `501eda4d8c92cf215f7424224963f582bd4d0886`。原工作树 `/private/tmp/metriccanvas-s3-134` 保留6.1隔离证据；正式6.2组合见末节。完整接线与操作定义见 [t08-content-edit-contract.md](t08-content-edit-contract.md)。

## 范围与所有权

本票实现独立内容stdio进程入口，复用既有发现/DQE/组页，新增可信完整基线读取和九类受控操作。逐操作复制/校验/提交、失败回滚、依赖跳过、净无变化不产物。创建支持report/dashboard；修改保留未触及内容、原始查询/行、手工设置，形态转换仅显式执行。

作者提交准确18文件：

- `metriccanvas-authoring/tool/metriccanvas_authoring/domain/component_editing.py`
- `metriccanvas-authoring/tool/metriccanvas_authoring/domain/page_editing.py`
- `metriccanvas-authoring/tool/metriccanvas_authoring/application/content_ports.py`
- `metriccanvas-authoring/tool/metriccanvas_authoring/application/edit_page.py`
- `metriccanvas-authoring/tool/metriccanvas_authoring/adapters/inbound/content_mcp.py`
- `metriccanvas-authoring/tool/metriccanvas_authoring/adapters/outbound/content_baselines.py`
- `metriccanvas-authoring/tool/metriccanvas_authoring/content_server.py`
- `metriccanvas-authoring/tool/metriccanvas_authoring/server.py`
- `metriccanvas-authoring/tool/server.py`
- `metriccanvas-authoring/tool/pyproject.toml`
- `metriccanvas-authoring/contracts/authored/page-edit-request.schema.json`
- `metriccanvas-authoring/test-harness/content_stdio_server.py`
- `metriccanvas-authoring/test-harness/tests/test_content_baselines.py`
- `metriccanvas-authoring/test-harness/tests/test_content_mcp.py`
- `metriccanvas-authoring/test-harness/tests/test_page_editing.py`
- `metriccanvas-authoring/test-harness/tests/test_distribution.py`
- `metriccanvas-authoring/README.md`
- `docs/archive/authoring-tickets-126/t08-content-edit-contract.md`

本证据文档在作者提交后追加。两server文件已获S0追加登记，仅延迟初始化；rg确认旧server.mcp消费者已无剩余。未修改page_building.py、page_validation.py、test_page_validation.py、test_build_page.py或test_stdio.py；S2的#143窗口保持隔离。

## Acceptance criteria

| #134 条件 | 本仓证据 |
|---|---|
| 复用构造、公开工具标题/布局/类型/白名单属性 | compose调用既有用例；真实content stdio创建report/dashboard；九操作域测试；类型切换复用目录门槛/构造/分组字段解析；原十组件构造回归全过 |
| 可信完整基线、未触及内容保持、模型摘要 | 原文ref/hash先核验；只读文件token端口与缺失/非法/hash/ref反例；分组字段、params、filters、查询/初始行、嵌套组件、多轮手工后语言修改深比较；stdio文本无dataSources/业务行，完整程序信封保留 |
| 独立失败/依赖跳过/整页合法/无变化不保存 | 部分成功四态结果；属性批内失败整操作回滚；移动失败不丢组件；非法必填标题由整页校验回滚；全失败/净零/仅版本规范化不返回artifact；无保存端口与文件写入 |
| 独立入口、结构化结果与可扩展注册 | 安装及源码入口；content工具清单仅discover/compose/edit；旧compatibility/relay全量回归；请求Schema封闭分支、OPERATION_HANDLERS注册、统一事务边界及稳定code/path |

## 实际运行记录

解释器 `/Users/moon/Documents/Code/公司项目/DataDashboard/metriccanvas-authoring/tool/.venv/bin/python`，复用依赖但测试/契约来自本独立工作树。

- 作者全量 `python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_*.py'`：**183项通过，0失败/错误**，日志 `/private/tmp/s3-134-full-tests.log`。本机HTTP需要允许bind，stdio为实际子进程；外部服务仍是受控替身。
- `test_page_editing.py`：20项行为测试。初次发现tabContainer有component与components两种合法分支，遍历已覆盖两分支；分组字段转换复用既有解析，不自行猜role。
- `test_content_baselines.py`：4项端口保护；`test_content_mcp.py`：3项异步公开用例，覆盖多次真实stdio调用和旧创建信封Schema一致性。
- Python产生10份编辑结果：部分成功、移动、props、类型切换、dashboard，以及params/grouped-fields/query/composite/filters代表页面。以本工作树 `node --import tsx packages/page/src/validate-cli.ts /private/tmp/s3-134-product-pages` 校验：**10/10通过**。使用临时只读node_modules依赖链接，交付前移除。
- 作者sdist构建/独立安装至 `/private/tmp/s3-134-installed`；离开仓根，以Python隔离模式执行 `/private/tmp/s3-134-installed-check.py`，真实启动安装的 `metriccanvas-content` 并完成partial编辑/安全text；安装的compatibility与relay入口工具清单正确。运行资产来自包内 `_bundle`。日志 `/private/tmp/s3-134-installed-check.log`。

## 外部与后续边界

本票没有真实Java/Relay/DQE身份、文件spool填充或生命周期保存接线。模型只接收摘要依赖Relay截取structuredContent，不能拿通用MCP直通冒充真实集成。文件目录由可信程序按身份/工作区隔离，token映射不可变；本仓只验证读取与内容保护，不自建身份权威。

未实现#135–#137组件/容器/绑定扩展、保存/发布、Java算法或#146工作台语言交接。创建/修改Skill的真实模型行为评测仍按#126外部边界单列，确定性测试不证明模型路由准确度；本票没有把普通问数Skill改成Platform创建/修改路由。

回退仅撤销本票作者与生成提交成套变更；没有外部写入或存量文档迁移。#132/#133的双版本读取与旧工具入口保留。S0验收后可解锁#146的内容工具前置，生命周期/工作台前置仍由对应票提供。

## 最终6.2组合验收

S0先集成#143，因此本票没有把6.1生成锁覆盖新基线。最终工作树 `/private/tmp/metriccanvas-s3-134-final`，分支 `codex/s3-134-content-edit-final`：

- 共同基线：`be73806a0120d0826fd57a0edf62745760d5561a`。
- 作者501eda4仅cherry-pick一次，实际为 `608a3bd`（完整SHA以该提交解析）。
- S2最终生成来源 `855076a9ebab1e1199018caa7109187d72ab7f07` → 本树 `710f428f0de4dbb83ba11bbaed53a65bf422e892`，这是实际产品验证树；生成仅4文件：export-authoring-contracts.ts、contracts/manifest.json、contract-lock.json、bundle.lock.json（后三项Bundle内）。
- 原6.1生成2d1623b/29f3862仅保留历史证据，不纳入最终交付。最终页面6.2/产品rc.3，保留#143全部作者/生成增量，没有#144实现。

最终完整Python **184项全过，0失败/错误**，日志 `/private/tmp/s3-134-62-tests.log`。包含content/compatibility/relay真实stdio、全部新旧合法反例、40布局矩阵与13参数矩阵；没有新增pending豁免。

生成漂移check **194 product / 4 authoring / 1 interface**通过；Bundle **495摘要**通过。S3只消费S2生成提交并运行check，没有手改或生成产品锁。

重新构建最终sdist `/private/tmp/s3-134-62-dist/metriccanvas_authoring-0.2.0.tar.gz` 并安装至 `/private/tmp/s3-134-62-installed`。离开仓根以Python-I运行安装的content stdio完成部分成功修改与文本隔离；安装compatibility/relay工具清单保持，日志 `/private/tmp/s3-134-62-installed-check.log`。安装包使用自身_bundle，信息确认6.2/rc.3；独立运行**53/53共享矩阵通过**，另验证6.2维度参数页面受控标题编辑保留params、query.paramBindings、filters完整原文。

产品公开CLI在最终树验证**11/11 Python编辑产物通过**（前述10份加维度参数页），没有渲染端协议分歧。临时依赖链接已移除，diff check通过。t08两份文档随后仅更新证据与基线说明，不改变已验证产品树。

外部状态保持：真实提供方接线/模型评测未完成；本票无保存/发布副作用。先前GitHub评论自动审批拒绝保持，不重发、不请其他任务代发，仓内证据交S0。
