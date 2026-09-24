# MetricCanvas Authoring

这是交付到公司内部的完整源码目录。内部接入从 [RELAY-HANDOFF.md](RELAY-HANDOFF.md) 开始，按安装、实现、注册、验收、更新五步完成。

## 谁改哪里

| 范围 | 维护方 | 更新规则 |
|---|---|---|
| `tool/metriccanvas_authoring/adapters/` 全部文件 | 公司内部 | 首次交付参考实现；后续公共同步完整保留，包括内部删除和新增的文件 |
| 其余公共源码、Skill、契约、文档、示例与脚本 | MetricCanvas | 从固定 Git 提交单向更新；有本地修改先停止 |
| 数据库、凭据、运行记录、虚拟环境 | 部署方 | 不属于公共源码清单；运行数据放源码目录外 |

内部主要实现 `adapters/factory.py:create_adapters()`。Java、元数据与 DQE 放 `firstparty/`，Relay 上下文、身份、授权和产物通道放 `relay/`，持久状态放 `storage/`。既有代码只在本地替身环境验证过，不代表公司真实接口已接通。

公共接口归 `data/`、`assets/`、`work/`、`delivery/`，适配器集合归 `bootstrap/adapter_contract.py`。公共平台启动只加载内部工厂，不从环境变量自动拼出身份、确认或 mock。

## 阅读顺序

1. [内部接入操作说明](RELAY-HANDOFF.md)：拿到目录后具体做什么、运行哪些命令。
2. [适配接口](contracts/authored/adapter-interface.md)：每项方法、输入输出、错误和行为约束。
3. [架构](ARCHITECTURE.md)：公共逻辑和内部实现怎样协作。
4. [内部验收](INTERNAL-VALIDATION-0.3.1.md)：真实环境需要提供的证据。
5. [MC 侧优化清单](INTEGRATION-IMPROVEMENTS.md)：本批治理诊断、参考修复及内部采用方式。
6. [源码阅读](tool/README.md)、[契约真源](SOURCES.md)：需要修改公共能力时阅读。

## 交付内容

- `skill/metriccanvas-platform-authoring/`：平台创建、编辑等工作流，与 Python 只通过 MCP 协作。
- `tool/`：Python ≥3.12 包。平台唯一注册命令为 `metriccanvas-platform-content`。
- `contracts/`、`contract-snapshot/`：创作协议与运行所需产品契约；无需内部 Node 环境再生成。
- `examples/adapter_template/`：公共维护的参考实现，测试使用它；不是生产回退。
- `test-harness/`：测试、mock 与本地主流程；不进入生产 wheel。
- `scripts/`：公共校验、内部装配检查、保留适配目录的源码同步。

Bundle 版本仍为 0.3.1；本次接入接口为 `authoring-adapters/1.0`，平台工具协议为 2.0。由于源码在同一 Bundle 版本内发生接入改动，必须固定 Git 提交，不能只凭 0.3.1 判断相容或复用旧产物哈希。实际内部构建记录公共提交、内部提交及产物哈希。

普通问数命令 `metriccanvas-authoring` 只提供发现与临时装配，不替代平台入口；其参考配置在 `examples/relay/`。独立生命周期等兼容入口保留，但不作为这次创建/编辑接入的必需步骤。
