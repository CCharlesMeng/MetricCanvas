# 公司内部接入：从这里开始

目标：在本目录内完成 Relay、Java、DQE 和状态存储接线。内部只维护 `tool/metriccanvas_authoring/adapters/`；公共源码由固定 Git 提交更新。当前工厂故意返回 `ADAPTERS_NOT_CONFIGURED`，参考代码不代表真实服务已接通。

## 1. 安装并确认目录完整

以下命令在 `metriccanvas-authoring/` 根目录执行，使用 Python ≥3.12。先把该目录提交到公司 Git 仓库，记录取得公共源码的完整 Git 提交号。

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install ./tool
.venv/bin/python -m pip install -r tool/metriccanvas_authoring/adapters/requirements.txt
.venv/bin/python scripts/check_bundle.py
.venv/bin/python scripts/check_adapters.py
```

最后一条初次应输出 `ADAPTERS_NOT_CONFIGURED` 并退出 2，这是待接线，不是安装失败。若从公共清单同步得到的目录没有 adapters，先执行：

```sh
python3 scripts/sync_upstream.py --target . --init --apply
```

初始化仅在整个 adapters 目录不存在时创建，已有目录一律不填充、不覆盖。它复制 `examples/adapter_template/` 并改为内部包导入路径。新增依赖写 adapters/requirements.txt，不改公共 pyproject.toml。内部源码改动后重新执行安装；开发期可使用 `pip install -e ./tool`。内部 requirements 不自动合入公共包元数据：部署 wheel 时也必须显式安装该依赖文件。

## 2. 实现唯一工厂

入口为 `tool/metriccanvas_authoring/adapters/factory.py:create_adapters()`。返回 `bootstrap.adapter_contract.AuthoringAdapters`，接口版本 `authoring-adapters/1.0`。完整方法和数据结构见 [接口说明](contracts/authored/adapter-interface.md)。

按下面顺序分工，每项完成后使用内部单元测试验证：

| 顺序 | 内部实现 | 完成条件 |
|---|---|---|
| 1 | relay/ 的身份、current_turns | 能从已认证的调用上下文取得身份、稳定 binding、contextRef、创建空基线或编辑精确基线；不从模型参数推断权限 |
| 2 | storage/ 的 read/CAS | 多次独立子进程读取同一轮状态；并发 CAS 只有一个成功；退出不清理未知保存记录 |
| 3 | firstparty/ 的元数据与 DQE | 实际响应转换为 DataContextPort/DqeExecutionResult；字段和版本符合契约 |
| 4 | relay/ 的 analysis_authorization | 只为已确认的精确请求和数据上下文版本出具授权；错误请求不执行 DQE |
| 5 | firstparty/ 的页面读写 | 当前修订匹配、服务端条件更新、正确回执与未知结果处理 |
| 6 | relay/ 的 relay_preview | 程序通道接收完整产物后回执精确 artifactRef/ref；模型只拿摘要 |

firstparty 的 HTTP、relay 的文件/环境和 storage 的 SQLite 都只是可修改的初始实现。逐项核对真实公司接口，不能只填 URL 就宣称接通。不要求重写已符合实际协议的逻辑。

工厂可参考下面的组合形式（变量表示你创建的实际实例，不是可直接运行的 mock）：

```python
from metriccanvas_authoring.bootstrap.adapter_contract import (
    ADAPTER_INTERFACE_VERSION, AuthoringAdapters,
)

return AuthoringAdapters(
    interface_version=ADAPTER_INTERFACE_VERSION,
    current_turns=turns, store=store,
    analysis_authorization=authorization,
    lifecycle_service=java_pages, lifecycle_identities=identities,
    relay_preview=preview, data_context=metadata, dqe=dqe,
    semantic_catalog=catalog,  # 没有指标详情能力可省略；不要假装已装配
)
```

普通创建/编辑不要求参数适配。可选的 source_description、metric_relations、parameter_dependencies 根据实际能力提供。若复用公共 SemanticCatalog，在工厂中显式传 `SemanticCatalog(metadata_provider, store)`；其提供方还需 search/detail，不会按 Java 类名自动启用。

## 2.1 发现成功但查询返回 DATA_CONTEXT_GOVERNANCE_REQUIRED

先区分两个阶段：语义发现可以读取原始元数据；执行查询必须取得受治理的数据上下文快照。发现有 matches 不证明查询就绪，更不证明 DQE 已接通。

平台工厂不会自动调用 adapters/environment.py。仅设置 METRICCANVAS_DATA_CONTEXT_PROJECTION_CONFIG 不会自动注入 projection，必须在 factory.py 中显式加载。内部可以采用公共参考 `examples/adapter_template/firstparty/configuration.py`，复制到内部对应位置后这样装配：

```python
import os
from metriccanvas_authoring.adapters.firstparty.configuration import create_metadata_provider
from metriccanvas_authoring.data.semantic_catalog import SemanticCatalog

metadata = create_metadata_provider(
    java_base_url,
    identities,
    projection_path=os.environ.get("METRICCANVAS_DATA_CONTEXT_PROJECTION_CONFIG", ""),
    dataset_ids=approved_dataset_ids,
)
catalog = SemanticCatalog(metadata, store)
# 在同一个 AuthoringAdapters 中传 data_context=metadata, semantic_catalog=catalog。
```

变量来自内部可信配置；不要从模型参数取得授权范围。这是装配片段，不是可以绕过身份和轮次实现的完整工厂。参考 helper 只在工厂构造阶段加载本地配置，不发网络请求。

治理配置存放 adapters/config/ 等内部自有位置，复制并核对 `examples/relay/data-context-projection.example.json`。environment.name、security、constraints 等不能省略。示例中的 nullable/sensitive 默认值也需要内部审定，不能当作真实数据事实。

| 内容 | 来源与规则 |
|---|---|
| additivity / timeAggregation | 优先采用有效原始声明；原始为 null、空字符串或空白时采用合法治理补充；明确非法声明拒绝，不由聚合函数或后备配置掩盖 |
| 原始与治理都缺可加性/时间聚合 | 参考代码保留已有 aggregator 推导，但映射必须由指标负责人确认；没有可信依据时拒绝，不设全局默认 |
| isRatio / nullable / sensitive | 原始布尔值、逐项治理、defaults 依次查找；默认值是治理声明，不是为了过检补的假数据 |
| metricGovernance / fieldGovernance | 按数据集 ID 与字段名匹配，无通配符；真实字段名不同由内部映射 |
| 配置覆盖范围 | 所选数据集中的所有指标/维度都会投影，某个未被当前查询使用的指标也可能阻断整个快照 |

可以先限定一组已治理的数据集；注意当前参考接口中 dataset_ids=None 或 [] 表示全量，不能把空列表当作“零权限范围”。真实业务语义由指标/数据治理负责人确认，Java 提供可信字段或内部配置补充，MetricCanvas 负责契约、诊断和公共参考实现。

空值回退不意味着改变已有有效声明的优先级。参考代码不会因为指标使用 SUM 就证明它可以跨时间累加，库存等指标必须核对业务语义；不可加/期末值也不是“未知”的占位值。

配置或范围变化会改变 dataContextVersion。更新后重新发现并重新确认查询，不复用旧版本授权和结果引用。

## 2.2 诊断与采用公共修复

```sh
.venv/bin/python scripts/check_data_context.py
```

此命令加载真实内部 factory 并调用 data_context.current()，可能访问内部元数据服务；不调用公共 DQE 执行、页面保存或模型，工厂应只构造对象。成功只表示快照通过校验，报告 DQE/save/relayHandoff=not_checked。

- stage=projection_configuration：配置未注入；检查工厂加载和传入参数。
- stage=field_governance：查看 issues 中 datasetId、field、property、path、reason；path 相对于适配后的 models/field_schema，不是原始 Java 响应路径。
- stage=snapshot_validation：快照不符合公共 Schema，检查内部投影。
- 其他失败只输出稳定错误码，不回显原始异常、HTTP 响应或配置文件内容。

字段诊断最多返回 100 项，并报告 issueCount/truncated。输出包含元数据名称，仅供受信任内部排错，不发送给模型；没有业务行、治理原值、凭据或 SQL。

公共更新不会覆盖现有 adapters，因此已有内部部署要人工采用本批修复：

1. 更新公共源码并重新安装 tool，取得支持 diagnostics 的 DataContextError 和诊断脚本。
2. 对照 examples/adapter_template/firstparty/data_context_http.py，移植空值回退及治理缺失汇总；保留内部字段映射与认证。
3. 对照 dataset_metadata_http.py，移植 projection 未注入的结构化诊断；按需加入 configuration.py，并在内部 factory 调用。
4. 运行内部测试、check_data_context，再重新发现、确认并执行查询，最后创建/编辑验收。

不要求整文件覆盖，特别不要用公共模板覆盖已经接线的内部实现。未移植结构化诊断的旧适配器仍可运行，但诊断脚本只能报告其错误码，无法凭空列出缺失字段。

## 3. 配置 Relay 并启动

将同一公共提交的 `skill/metriccanvas-platform-authoring/` 整目录安装到 Relay 的 Skill 目录。将 `examples/relay/mcp_configs/metriccanvas-platform-content.json` 复制到内部 `adapters/config/`，替换命令绝对路径，再登记到 Relay 实际 MCP 配置。服务名必须是 `metriccanvas-platform-content`。

```sh
.venv/bin/python scripts/check_adapters.py
.venv/bin/python scripts/check_adapters.py --context-ref '<真实可信轮次引用>'
.venv/bin/metriccanvas-platform-content
```

第一条只检查装配，不要求启动时已有用户轮次，不做公共网络探测或页面写入；工厂应仅构造对象，不主动查询。第二条会调用内部轮次提供方。最后一条运行 stdio MCP，等待 Relay 输入；正常启动不应向 stdout 打日志。

Relay 插件的源码维护位置与部署位置不同。轮次插件在 Relay 进程取得用户/会话/页面状态，预览桥接插件在 Relay 进程消费产物时，不能简单搬到 MCP 子进程后删除。源码可归入 adapters/relay/，再部署到 Relay 的 .relay/plugins/ 等指定位置；内部适配器通过可信通道与它们协作。包外的重复 MCP 装配入口可以退役，但需先验证插件职责仍被覆盖。

每次调用的用户身份由 Relay 已认证上下文注入。可使用调用专属子进程配置或内部安全通道，不能修改 Relay 父进程共享 os.environ 来切换并发用户。不要把 token 放入提交的 JSON、工具参数、日志或模型上下文。数据库与程序通道目录放源码之外，必须跨子进程/重启保留所需状态；每次调用新建且退出即删除的临时目录不满足要求。

Relay 必须把 MCP 结果里的 modelSummary 和完整 artifactEnvelope 分开处理；不能把完整页面送回模型再让模型复制。若 Relay 丢弃 structuredContent，内部 relay_preview 需改用已有程序通道接收完整产物。ready 仅证明接收成功，页面实际显示另验。

## 4. 验收并回传

公共本地验证（mock，无真实模型）：

```sh
.venv/bin/python test-harness/run_tests.py --check
.venv/bin/python -m unittest discover -s test-harness/tests -p 'test_deployment*.py'
.venv/bin/python -m unittest discover -s test-harness/tests -p 'test_platform_main_flow.py'
```

真实环境按 [内部验收](INTERNAL-VALIDATION-0.3.1.md) 执行创建和编辑，至少回传：公共提交、内部提交、接口版本、装配报告、各场景结果、脱敏请求关联 ID、DQE/Java 保存/产物接收调用数。禁止回传凭据和真实业务数据。

本地 mock 通过、装配通过、真实服务联通、模型成功、页面实际显示分别记录，不互相替代。

## 5. 后续单向更新

在单独的上游源码检出目录执行 git fetch，选择明确的提交；不要将上游直接 merge 到内部工作目录。使用新上游提交里的同步脚本：

```sh
python3 /path/to/upstream/metriccanvas-authoring/scripts/sync_upstream.py \
  --source /path/to/upstream --ref '<公共提交 SHA>' \
  --target /path/to/internal/metriccanvas-authoring
```

默认只预览。检查写入、删除列表后，在同一命令末尾加 `--apply`。脚本校验上游公共哈希和当前公共文件；发现本地公共修改、目标冲突或符号链接则停止。同步不操作内部 Git 索引，不提交、不推送，始终保留 adapters。升级前在内部 Git 提交工作区，以便审查与恢复。

更新完成后重新安装、执行 check_bundle 和 check_adapters、运行内部测试与创建/编辑主流程，然后在公司 Git 提交。回退到采用本所有权协议的旧公共提交也使用同一脚本；接口相容性仍须检查。迁移前版本不能自动作为回退源。跨版本内部数据恢复由内部存储实现负责，源码回退不回滚业务数据。

若从迁移前版本升级，旧 adapters 会原样保留；内部需要从新模板手动增加 factory.py，并将旧 service_identity 导入改到公共 data.service_identity。不会自动把旧代码强制改写为新接口。

公共模板修复会更新 examples/adapter_template，不会覆盖内部实现，内部自行判断是否吸收。工厂契约版本不匹配时先完成内部迁移，不绕过检查。

## 真实接口对账

参考实现的元数据查询使用 X-Auth-Token/x-operator-id 请求头及 body.workspaceId、可选 datasetIds；不是在 body 发送 X-Workspace-Id。DQE 则在请求头传 X-Workspace-Id。页面 POST 新建传 page_id/page_metadata_definition/is_draft，PUT 编辑才传 base_revision_id。

这些是参考实现，不证明真实服务认证相同。appid、Cookie、IAM token，以及是否与其他内部工具调用同一协议，均由内部服务方确认；对账要覆盖响应、资源身份、错误和原子条件更新，不能只比较 URL。

## 常见故障

| 结果 | 排查位置 |
|---|---|
| ADAPTERS_NOT_CONFIGURED | factory.py 尚未接线 |
| ADAPTER_LOAD_FAILED | 内部依赖未安装、导入失败或工厂异常；在内部安全调试环境检查原异常 |
| ADAPTER_CONTRACT_MISMATCH | 返回类型或接口版本不匹配 |
| PLATFORM_DEPLOYMENT_NOT_READY / missing | 缺必要方法或页面服务未声明 single_save/current_read |
| CURRENT_TURN_* / CURRENT_PAGE_* | 身份、轮次、基线或页面当前修订不匹配 |
| DATA_CONTEXT_GOVERNANCE_REQUIRED | 先运行 check_data_context，区分 projection 未注入与逐字段缺失，按治理负责人确认的事实补充 |
| ANALYSIS_PLAN_NOT_CONFIRMED | 确认没有绑定精确请求和版本 |
| SAVE_RECONCILIATION_REQUIRED | 保存结果不明，保留记录并人工/内部程序核对；禁止自动重发 |
| RELAY_PREVIEW_MISMATCH | 程序接收回执与 artifactRef/ref 不一致 |
| Public/local conflicts | 公共区有内部修改；先迁到 adapters 或将公共修复反馈到上游 |
