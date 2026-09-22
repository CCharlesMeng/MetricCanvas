# Authoring Tool 阅读指南

这里是一个 Python 服务包，不是一组按顺序执行的脚本。平台创作从一个 MCP 入口进入，其他模块由业务用例调用。先读平台主链，再按问题进入分支；无需逐个阅读所有文件。

## 第一遍：跟踪一次标题修改

按以下顺序阅读，括号中是这一层回答的问题：

1. [platform_server.py](metriccanvas_authoring/platform_server.py) 与 [bootstrap/platform.py](metriccanvas_authoring/bootstrap/platform.py)：服务如何启动、哪些提供方必须由可信集成程序注入？独立启动没有提供方时明确不可用。
2. [entrypoints/mcp/platform_mcp.py](metriccanvas_authoring/entrypoints/mcp/platform_mcp.py)：模型可见的九个工具、参数 Schema 和结果分流。`edit_page` 要求 context_ref、page_id、expected_version、request；MCP 不拥有业务实现。
3. [work/authoring_turns.py](metriccanvas_authoring/work/authoring_turns.py)：身份、页、轮次、原文摘要和基线如何校验？context_ref 不接受模型自造的完整页面。
4. [pages/platform_authoring.py](metriccanvas_authoring/pages/platform_authoring.py)：read/mutate 的主控制流，工作稿、编辑、保存与产物如何衔接？这是平台任务的编排入口。
5. [assets/drafts.py](metriccanvas_authoring/assets/drafts.py) 的 verify_current 与 [adapters/firstparty/lifecycle_http.py](metriccanvas_authoring/adapters/firstparty/lifecycle_http.py) 的 current_match：如何向 Java 读取当前资源，比较 ref 和定义，拒绝过期基线？
6. [work/state.py](metriccanvas_authoring/work/state.py)：expected_version、原子竞争、共享预算与重复请求如何处理？
7. [pages/referenced.py](metriccanvas_authoring/pages/referenced.py) 与 [pages/editing/edit_page.py](metriccanvas_authoring/pages/editing/edit_page.py)：如何应用受控操作、保持无关内容、逐项回滚并验证页面？
8. 回到 [assets/drafts.py](metriccanvas_authoring/assets/drafts.py) 的 save：如何冻结原提交、携带基线修订单次保存、保留未知结果？Java 负责原子的 base_revision_id 竞争检查。
9. [delivery/preview.py](metriccanvas_authoring/delivery/preview.py)：保存定义为何去掉 query initial？如何仅交付精确 artifactRef，而不再次保存？

对应测试：[test_platform_v2.py](../test-harness/tests/test_platform_v2.py)。文件名中的 v2 标识平台工具协议 2.0；不代表另一套运行流程，也不是页面 Schema 版本。

## 第二遍：按功能分支阅读

| 想理解或修改什么 | 从哪里开始 | 后续定位 |
|---|---|---|
| Java 原始指标元数据查询 | [adapters/firstparty/dataset_metadata_http.py](metriccanvas_authoring/adapters/firstparty/dataset_metadata_http.py) | 批量 POST、元素状态、身份核对；同时为执行提供同版本 DataContext |
| 指标发现、精确口径补读 | [data/semantic_catalog.py](metriccanvas_authoring/data/semantic_catalog.py) | data/discover_data_context.py、data/data_context.py |
| 计划确认、查询复用、有界证据 | [data/results.py](metriccanvas_authoring/data/results.py) | data/query.py、data/execution.py、data/source_mapping.py |
| 从证据组织新页面 | [pages/referenced.py](metriccanvas_authoring/pages/referenced.py) 的 compose | pages/composition/、pages/components/ |
| 局部修改、章节与组件操作 | [pages/referenced.py](metriccanvas_authoring/pages/referenced.py) 的 edit | pages/editing/；按操作 type 搜索 |
| 页面协议与跨引用验真 | [pages/validation/page_validation.py](metriccanvas_authoring/pages/validation/page_validation.py) | 随包 contract-snapshot/page/schema.json 及 conformance |
| 参数提取、无值模板、临时实例 | [pages/parameters/page_parameters.py](metriccanvas_authoring/pages/parameters/page_parameters.py) | 参数引用、失效与程序通道；不自动保存 |
| 草稿、发布与恢复的职责 | [assets/drafts.py](metriccanvas_authoring/assets/drafts.py)、[assets/lifecycle.py](metriccanvas_authoring/assets/lifecycle.py) | lifecycle_ports.py；发布见 lifecycle_publish.py，不由计划确认触发 |
| SQLite 状态与进程重启 | [adapters/storage/platform_state.py](metriccanvas_authoring/adapters/storage/platform_state.py) | work/state.py；区分 work、budget、result、submission |
| 普通问数的临时页面 | [ask/rules.py](metriccanvas_authoring/ask/rules.py) | bootstrap/compatibility.py、pages/composition/compose_page.py；与平台草稿路径独立 |

## 文件命名与目录职责

- `entrypoints/` 接收外部调用；`bootstrap/` 选择并注入实现。入口不应复制业务算法。
- `pages/` 组织页面；`data/` 发现、查询与证据；`work/` 管理本轮权限和状态；`assets/` 管理持久资产；`delivery/` 交付预览。
- `*_ports.py` 声明由外部提供的能力；`adapters/firstparty/*_http.py` 实现真实 HTTP；`adapters/relay/` 接收可信程序产物；`adapters/storage/` 实现本地持久化。
- `ask/` 是普通问数规则。`entrypoints/compat/` 是隔离的其他消费入口，平台部署只注册 platform_mcp.py；缺提供方不得路由到别的入口。
- `canonical.py`、`runtime_assets.py`、`bundle_info.py` 是共享基础能力。`hatch_build.py` 只负责打包时内嵌契约，`requirements.lock` 固定依赖。
- `contracts/authored/` 是手写交互契约；`contract-snapshot/` 和 Skill 的 page-metadata 参考是生成物。修改产品事实后从仓根运行 `pnpm authoring:contracts`，不要手改快照。

新增文件按业务动作命名并放到所属目录，例如修改标题属于 pages/editing，Java 读取属于 adapters/firstparty；不要新增笼统的 utils、manager 或第二份主编排。不同层出现同名 compose/edit 表示入口与领域操作，阅读时先看完整目录。

## 验证与发布

从仓根，在安装了 tool/requirements.lock 和测试依赖的 Python 环境执行：

```sh
python metriccanvas-authoring/test-harness/run_tests.py
pnpm authoring:contracts:check
python metriccanvas-authoring/scripts/check_bundle.py
```

测试分层见 [test-harness/README.md](../test-harness/README.md)。排查单个场景可以运行对应 unittest 模块；发布前运行完整清单。真实接线检查见 [RELAY-HANDOFF.md](../RELAY-HANDOFF.md)。检查通过证明本地分发和规则一致，不能把 Java/Relay 替身结果称为生产联调成功。
