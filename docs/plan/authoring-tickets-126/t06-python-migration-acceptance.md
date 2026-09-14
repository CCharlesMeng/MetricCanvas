# T06 / #132 Python 布局迁移调查与验收设计

2026-09-14，S3。状态：调查完成，迁移未实施；等待 S0 发布 #129 已验收集成 SHA，不等待 M0。本文不冻结产品版本或兼容策略。

## 登记与范围

- task ID：`01a09f69-d2b5-71b0-ba93-c7cc183d4ee2`。
- 工作树：`/private/tmp/metriccanvas-s3-132`；分支：`codex/s3-132-python-layout`。
- 调查基线：`057703b1604f4937601f99534c713a4f72995c08`。
- S0 已接受逐文件登记，无冲突。Python 作者代码及其测试由 S3 修改；产品协议、生成快照与锁由 S2 唯一生成。
- 本轮唯一变更为本文。#134 的受控编辑、部分成功、创建/修改 Skill 和新组件不在本轮实施范围。

计划触及的准确路径（非承诺全部修改）：

```text
metriccanvas-authoring/tool/metriccanvas_authoring/domain/page_building.py
metriccanvas-authoring/tool/metriccanvas_authoring/domain/page_validation.py
metriccanvas-authoring/tool/metriccanvas_authoring/application/build_page.py
metriccanvas-authoring/tool/metriccanvas_authoring/application/compose_page.py
metriccanvas-authoring/test-harness/tests/test_build_page.py
metriccanvas-authoring/test-harness/tests/test_page_validation.py
metriccanvas-authoring/test-harness/tests/test_compose_page.py
metriccanvas-authoring/test-harness/tests/test_component_building.py
metriccanvas-authoring/test-harness/tests/test_stdio.py
docs/plan/authoring-tickets-126/t06-python-migration-acceptance.md
```

若需要新增规范化模块或调整 sdist 打包文件，先补报精确路径。只读共享触点：`contracts/metriccanvas/`、`metriccanvas-authoring/contract-snapshot/`、`contracts/exported/`（Bundle 内）、`contract-lock.json`、`bundle.lock.json`。

## 已核实的实现

1. `assemble_page_document` 接收调用方提供的 schema_version，输出 schemaVersion/id/meta/dataSources/sections，目前不显式输出页面顶层布局。组件的 `layout.span` 是组件占位，不能递归更名。现有构造支持十类数据组件与 reportHeader。
2. `create_compose_page` 从 `load_bundle_info` 读取锁定的 pageSchemaVersion，确定性装配后执行完整页面校验，计算规范 JSON SHA-256 并交付 PageBuildArtifact；依赖只有数据上下文和 DQE，没有保存端口。
3. `create_build_page` 是包装 compose 的既有保存兼容路径。#132 只迁移它接收到的页面产物，不改变普通问数保存策略，不把该路径的保存行为误判成内容 MCP 新增副作用。
4. `validate_page_document` 直接读取产品导出的 page/schema.json，再执行 Python 语义检查；当前 `_capability_floor_issues` 为空实现。不能据此认为新版能力下限与旧版规范化已支持。
5. `test_page_validation.py` 已遍历全部共享正反向量，反例严格比对完整 type/path 集合；pending 清单封闭，不能以新增豁免通过迁移。
6. stdio 测试分别覆盖默认工具面 discover_data_context/build_page 和 Relay 工具面 discover_data_context/compose_page，以及不向模型文本泄露完整产物。已有测试应复用。
7. sdist 当前包含页面 schema、组件目录等运行资产，未包含独立版本策略文件。若 #129 增加必须消费的机器资产，必须让独立安装产物一并包含它，不能从仓根读取补洞。

## 请求 S2 冻结的输入

已向 S2 任务 `01a09f69-a06b-7703-b87b-ccdfe05d765e` 发出以下需求：

- 当前写出版本、旧基线支持版本集合、缺省布局行为，以及每个声明版本允许的字段形状。
- 双字段同值与异值、旧版本带新字段、新版本带旧字段的处理规则；不凭字段存在与否猜测版本。
- 公开规范化入口及输出/失败约定，确保拒绝非法输入后才做受控转换；原始页面文档不得就地改写。
- 共享 report/dashboard 正例与对应规范化结果，未知主/次版本、缺失/非法版本及字段错配的稳定 type/path 反例。
- 产品 Schema、版本规则、黄金向量及其 Bundle 快照/锁的生成提交；若独立安装新增资产，明确路径。

## 迁移验收矩阵

S2 本轮消息给出的待集成方案：增量 6.1，继续接受 6.0；6.0 使用 layout 拒绝；6.0/6.1 单独 layoutForm 可读；任何双字段（含同值）拒绝；缺省 report；规范写出为 6.1 + layout。此消息尚未替代 S0 验收 SHA。Python 消费无已知方向性阻碍，但须补能力下限/双字段检查，并保留完整文档中的文本引用、分组字段、DQE 原始 initial，不能把物化结果反写为新基线。

所有“按契约”预期均在 #129 集成后替换为精确版本、向量名和错误键，不提前自定策略。

| ID / #132 条件 | 输入与公开入口 | 必须观察到的结果 | 证据归属 |
|---|---|---|---|
| P01 规范写出 | stdio compose_page 及既有 build_page，代表性指标卡/表格 | 产物使用冻结版本和页面 layout；无 layoutForm；组件 layout.span 保持合法；内容摘要与可信产物通道保持 | S3 工具测试 |
| P02 构造回归 | 现有十类数据组件、reportHeader 构造用例 | 新版完整页面校验通过，字段映射、查询、内嵌初始行、标题及口径组保持 | S3 现有构造测试 |
| P03 旧版读取 | 契约允许的旧版 report/dashboard、缺省布局；Python 公开读取/规范化函数 | 与浏览器同意/拒绝；规范化后仅布局字段及契约要求的版本变化；源输入深比较不变；重复规范化幂等 | S3；共享预期由 S2 导出 |
| P04 错配拒绝 | 未知主/次版本、非法/缺失版本、双字段同值/异值、声明版本与布局字段错配、非法布局值 | 按 #129 逐例稳定失败或接受；失败 type/path 与共享向量一致；不猜测替代字段、不丢掉非法字段后再接受 | S3 全量 conformance |
| P05 内容保持 | 带 filters/filterBindings、params、查询、内嵌初始行、手工占位与容器的旧基线 | 规范化保留未触及内容；不重建页面、不改变布局形态；保留合法跨形态容器组合 | S3 规范化测试 |
| P06 跨语言一致 | S2 的全部共享正反向量；S3 生成的代表性新页面交产品公开校验 | Python/产品端接受集合和错误键一致，pending 仍为空；report/dashboard 等价运行证据引用 S2 验收 | S3 + S2 |
| P07 副作用边界 | Relay stdio compose_page 成功及非法请求 | 无保存/发布调用；失败不交付合法成功产物；build_page 保持既有保存兼容语义 | S3 既有公开测试 |
| P08 独立交付 | Bundle 校验、漂移检查；新增运行资产时安装 sdist 并离开仓根执行 | 只消费随包生成契约，无仓根依赖，锁一致；导出由 S2 执行 | S3 消费验证 / S2 生成 |

#132 不新建完整页面编辑 MCP；旧基线的公开 Python 读取/规范化能力供 #134 后续消费。逐操作回滚、依赖跳过和合法成功子集属于 #134，不以 #132 的协议迁移测试冒充完成。

## 已执行的基线验证

使用现有 Python 3.12 虚拟环境，仅复用解释器与依赖；测试和产品资产均从本独立工作树读取。命令工作目录为本工作树。

```sh
PYTHONDONTWRITEBYTECODE=1 /Users/moon/Documents/Code/公司项目/DataDashboard/metriccanvas-authoring/tool/.venv/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_*.py'
PYTHONDONTWRITEBYTECODE=1 /Users/moon/Documents/Code/公司项目/DataDashboard/metriccanvas-authoring/tool/.venv/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_java_page_assets.py'
PYTHONDONTWRITEBYTECODE=1 /Users/moon/Documents/Code/公司项目/DataDashboard/metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/scripts/check_bundle.py
```

- 全量执行 153 项：151 项通过；2 项本机 HTTP 端口测试因沙箱禁止 bind 报 PermissionError。
- 第二条命令在沙箱外复验整个 Java 适配测试文件：7 项全部通过，涵盖上述两项。无产品失败遗留；没有声称单次全量运行全绿。
- Bundle 0.2.0：460 个摘要检查通过。
- 以上是旧共同基线证据，不是 #132 新协议验收。HTTP 为本机受控服务，不代表真实 Java/Relay/DQE 联调。

## 续跑与交付

等待 S0 的 #129 已验收集成 SHA、版本契约及证据。收到后读取 #129/#132 最新评论，确认该 SHA 包含契约与生成快照，再合入本分支并运行针对性兼容检查；按矩阵完成 Python 作者代码。S3 提交代码后由 S2 从唯一作者源刷新涉及作者文件的 Bundle 锁并交 S0 验收集成，不能由 S3 手工补摘要。

最终回执包含本次基线/提交 SHA、逐文件差异、精确版本、矩阵对应测试结果、产品校验结果、外部状态和回退方式，回写 #132 并交 S0/S2 解锁 #133。当前仅文档调查提交可单独撤销，不影响产品运行；实现阶段回退须由 S0 协调消费者与生成快照成套回退。
