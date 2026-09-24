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

## 3. 配置 Relay 并启动

将同一公共提交的 `skill/metriccanvas-platform-authoring/` 整目录安装到 Relay 的 Skill 目录。将 `examples/relay/mcp_configs/metriccanvas-platform-content.json` 复制到内部 `adapters/config/`，替换命令绝对路径，再登记到 Relay 实际 MCP 配置。服务名必须是 `metriccanvas-platform-content`。

```sh
.venv/bin/python scripts/check_adapters.py
.venv/bin/python scripts/check_adapters.py --context-ref '<真实可信轮次引用>'
.venv/bin/metriccanvas-platform-content
```

第一条只检查装配，不要求启动时已有用户轮次，不做公共网络探测或页面写入；工厂应仅构造对象，不主动查询。第二条会调用内部轮次提供方。最后一条运行 stdio MCP，等待 Relay 输入；正常启动不应向 stdout 打日志。

每次调用的用户身份由 Relay 已认证上下文注入。可使用调用专属子进程配置或内部安全通道，不能修改 Relay 父进程共享 os.environ 来切换并发用户。不要把 token 放入提交的 JSON、工具参数、日志或模型上下文。数据库与程序通道目录放源码之外。

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

## 常见故障

| 结果 | 排查位置 |
|---|---|
| ADAPTERS_NOT_CONFIGURED | factory.py 尚未接线 |
| ADAPTER_LOAD_FAILED | 内部依赖未安装、导入失败或工厂异常；在内部安全调试环境检查原异常 |
| ADAPTER_CONTRACT_MISMATCH | 返回类型或接口版本不匹配 |
| PLATFORM_DEPLOYMENT_NOT_READY / missing | 缺必要方法或页面服务未声明 single_save/current_read |
| CURRENT_TURN_* / CURRENT_PAGE_* | 身份、轮次、基线或页面当前修订不匹配 |
| ANALYSIS_PLAN_NOT_CONFIRMED | 确认没有绑定精确请求和版本 |
| SAVE_RECONCILIATION_REQUIRED | 保存结果不明，保留记录并人工/内部程序核对；禁止自动重发 |
| RELAY_PREVIEW_MISMATCH | 程序接收回执与 artifactRef/ref 不一致 |
| Public/local conflicts | 公共区有内部修改；先迁到 adapters 或将公共修复反馈到上游 |
