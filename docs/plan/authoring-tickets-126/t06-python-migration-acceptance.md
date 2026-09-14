# T06 / #132 Python 布局迁移调查与验收设计

2026-09-14，S3。状态：Python 作者实现与 S2 生成契约成套复验通过，提交 S0 验收集成。下文调查部分保留开工时事实，实际实施与最终证据见末尾；本文不另行冻结产品版本或兼容策略。

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

S2 随后提供待验收向量（已从其独立工作树只读核对）：`layout-before-6.1`、`layout-dual-equal`、`layout-dual-conflict`、`layout-invalid-value`，以及正例 `layout-6.1-report` / `layout-6.1-dashboard`。错误均为 SCHEMA_ERROR：6.0 + layout 对应 `/layout`；双字段对应 `/layoutForm`；非法 layout 对应 `/layout`；未知版本对应 `/schemaVersion`。S2 指定 6.0 双字段合法值同时报告 `/layout` 与 `/layoutForm`，实现时需覆盖完整错误集合。

不新增独立版本资产：读取版本范围来自 Schema 的 schemaVersion 枚举，写出版本来自 contract-lock。规范化仅在完整原文校验成功后复制原文、提升版本到 6.1、删除 layoutForm，并依次从 layout、layoutForm、report 确定布局形态；不需要为此调整 sdist 资产清单。上述仍为待 S0 验收集成输入，不代表 #129 或 #132 已通过。

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

## #129 放行后的实施记录

- S0 放行基线：`32d0e08976b443aed69d18922f12da051470fbc6`，已合入本工作树。最新 #129 评论与 `t03-layout-compatibility.md` / `t03-evidence.md` 已核对。
- 作者提交：`479bf25dd68d22470cd45663ae075c6c18e5a39f`。准确六文件：上述 page_building.py、page_validation.py、test_build_page.py、test_component_building.py、test_page_validation.py、test_stdio.py。没有修改应用用例、注册器或新增模块。
- 新增公开 Python `normalize_page_document(value)`：成功返回 `{ok: true, document, errors: []}`，失败仅返回 `{ok: false, errors}`；完整校验通过后深复制，读取现有 contract-lock 当前版本，转换顶层 layout。源文档、参数引用、分组字段、原始行与嵌套手工设置保留。调用方先核验持久化原文 hash。
- `validate_page_document` 补齐 6.0 + layout 能力下限及双字段拒绝，仍使用产品 Schema 枚举限制支持版本；同一 6.0 双字段输入同时报告两个错误。
- 构造器显式写出 layout: report，版本仍由现有 Bundle 锁提供；组件占位不变。没有增加布局选择业务能力、内容编辑 MCP 或改普通问数保存语义。

### 已执行证据

| 验收项 | 实际结果 |
|---|---|
| 迁移前差距复现 | 合入 #129 后运行 test_page_validation.py，精确复现 layout-before-6.1、layout-dual-equal、layout-dual-conflict 三项失败 |
| P03/P04/P05/P06 | 修改后该文件 5 项测试通过，包含全部32项共享矩阵、全部共享正反例、规范化完整文档等价、幂等、输入及嵌套内容不变、非法文档不返回产物；pending 仍为空 |
| P02 | test_component_building.py 通过，既有十类组件分别形成 report/dashboard 完整6.1页面并校验；reportHeader与查询装配沿原build/compose用例回归 |
| P01/P07 | 全量156项测试中公开stdio用例通过，检查6.1/layout产物、可信信封与模型摘要隔离、无savedRevision、失败无产物；保存兼容路径仍保留原语义 |
| P06 产品校验 | 将1份compose查询产物和13份共享合法文档经Python规范化输出到临时目录，以本树 `packages/page/src/validate-cli.ts` 校验：14/14通过；复用依赖只创建临时node_modules软链接，运行后已移除 |
| P08 独立安装 | `uv build --sdist` 后以 `uv pip install --no-deps --target` 安装到独立临时目录；离开仓根以Python隔离模式运行32/32矩阵通过，运行契约路径确认为安装包 `_bundle/contract-snapshot`，未修改共享虚拟环境 |

首次全量运行156项仅剩2项共享构造期望差异：build/compose预期文档仍为6.0且没有layout，实际产物已为6.1/layout。S2负责从冻结历史期望经产品公开规范化派生当前期望，保留历史来源与业务字段，不以Python输出重写黄金答案。S3未改快照、导出生成器或锁；最终全绿记录待其独立生成提交后补充。

本轮未回写GitHub评论：自动审批因拟发布本地路径、任务ID及内部协作信息拒绝，已向用户说明并请求许可，S0已知悉且不代发。仓内与协作任务证据继续交付；#132不由S3关闭。真实Java/Relay/DQE联调未执行，使用既有受控替身。

### 最终组合验收

S2 生成源提交 `4f6be5f5a33e41385d4dabbb96e67b7a5d885062` 已单独 cherry-pick，实际验证组合 SHA 为 `1a185463a5357ce5b47fb5479f9f0cc3c99bec3c`。其准确五文件为 `tools/scripts/export-authoring-contracts.ts` 及 Bundle 内的 `bundle.lock.json`、`contract-lock.json`、`contracts/manifest.json`、`contracts/exported/build-page-conformance.json`。未包含 #131 实现，没有重复合入作者代码。本文最终记录随后单独提交，不改变已验证产品树。

- 全量 Python：`python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_*.py'`，156项全部通过，0失败、0错误；完整日志 `/private/tmp/s3-132-final-tests.log`。包含stdio真实进程边界与本机HTTP替身，执行时允许本机端口。
- 产品与生成：`node --import tsx tools/scripts/export-authoring-contracts.ts --check`，190 product / 4 authoring / 1 interface均无漂移；`check_bundle.py`，474摘要全过。S3只运行check，不生成。
- 组合树再次以公开产品CLI验证 `/private/tmp/s3-132-product-pages`：14/14通过。页面为当前Python生成/规范化结果；其中代表性查询产物来源于compose及受控DQE替身。
- 从组合树重新构建 `/private/tmp/s3-132-final-dist/metriccanvas_authoring-0.2.0.tar.gz` 并安装至 `/private/tmp/s3-132-final-installed`，离开仓根、Python `-I` 模式运行全部32矩阵再次通过，运行资产确认来自随包 `_bundle`。测试矩阵仅作为外部测试输入读取，不是运行时依赖。
- `git diff --check`通过；临时node_modules软链接已移除；产品快照/锁均来自S2提交。此前2项共享期望差异已归零。

P01–P08对应证据齐全，本仓范围可验收；正式集成与下游放行由S0裁决。可解锁 #133 的Python部分，仍须同时满足 #131。未实现 #134、参数新语法、额外组件、Java/Relay服务或真实环境联调。

回退：作者提交与S2生成提交成套逆向撤销，避免保留不匹配的Bundle锁或黄金期望；6.0原始文档未改写。若已经产生6.1修订，继续保留#129的双版本读取，不退回仅支持6.0的消费者。业务保存/发布及原始hash检查仍由原调用方负责。
