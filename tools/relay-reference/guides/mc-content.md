# MC 产品资源

当前离线操作从 `runtime:offline-interface` 查找，Schema 指针统一指向 `mc-tool/interface.json`。操作或稳定入口返回的诊断按 `error:CODE` 查阅；新增条目从实际操作声明与入口源码生成，原有条目保留。未列入静态索引的动态诊断仍以真实回执为准，不表示操作未实现。

`runtime:coverage` 是原公共 MC 来源图，包含旧 MCP 契约，不能证明当前离线操作覆盖或部署完成；其原始内容保持不变。当前声明见 `runtime:offline-interface`，实际行为分别运行固定自检及冻结消费者回放。

从 [资源索引](mc-content/index.json) 按 `topic:key` 查找协议知识、模板和示例。ID 与正文摘要无关；先读取所需原子，再按引用展开完整约束。

通过稳定产品入口读取：

```sh
python -B /absolute/references/mc-tool/cli.py invoke content.read <<'JSON'
{"format":"metriccanvas-mc-request/1","requestId":"read-1","input":{"topic":"index","key":"knowledge"}}
JSON
```

按任务选择资源，先读取对应 topic 的索引，再使用当前索引中的 key：

| topic | 模块职责与常用入口 |
|---|---|
| `knowledge` | 有界语义知识；如 `table.width`、`fields.format`、`authoring.evaluation`。先读原子，再展开其依赖 |
| `reference` | 完整页面协议章节和示例；如 `filters`、`components/table`。用于核对完整规则 |
| `protocol` | 页面版本、数据上下文与查询协议；先看 `version-policy`，再按任务选协议 |
| `product` | 产品导出的机器契约和正反例；如 `page/schema`、`page/component-catalog` |
| `authoring` | 创作计划、轮次、操作与产物的中间协议；这些字段不直接写入页面文档 |
| `component` | 组件能力、输入与约束；如 `table`。合法页面能力与自动装配支持范围分别核对 |
| `scenario` | 业务场景的章节和组合要求；如 `business-report`、`usage-report` |
| `layout` | 布局规则和场景模板；从 `catalog` 定位，再按指定模板读取 |
| `example` | 完整示例与调用样本；从索引选择，不用示例数据冒充查询证据 |
| `runtime` | 执行边界、字段呈现、参数、覆盖及修复指导；如 `numeric-format`、`error-repair` |
| `error` | 按诊断码查规则与处理建议；如 `PRESENTATION_FORMAT_ADJUSTED`，同时保留原诊断路径与顺序 |
| `tool` | 旧线上 MCP 的迁移参考。工具注册及真实接口由 Relay 维护，不能据此调用未收录的离线操作 |
| `snapshot` | 同批协议快照与版本核对材料；大对象按需要读取 |
| `guide` | 包内说明和交接导航；从 `index` 定位后继续按引用读取 |

页面先行：`reference` / `component` 核对既有页面意图 → `knowledge` 核对局部约束 → 产品工具投影、扫描和校验 → Relay 补齐用数证据后形成候选。数据先行：`protocol` 核对显式数据材料 → `scenario` / `layout` 选择结构 → 产品工具准备查询、归一化已供给结果并装配候选。遇到失败按原诊断码读 `error` / `runtime:error-repair`，不跳过失败修改页面版本。

`data.truncated` 为 true 时，原子整体保留，按 `continuation` 增大预算或分页；不能把缺省正文当作完整规则。资源含旧线上工具的迁移参考时，实际可用的离线操作仍以 [Interface](mc-tool/interface.json) 为准。

页面先行从完整工作副本核对结构、用数和绑定；数据先行从显式数据上下文、取数单元和已有执行证据形成页面候选。两种创作逻辑共用产品规则。真实发现、授权、DQE、状态和保存由 Relay 程序提供。

普通更新完整替换 `mc-content/`、`mc-content.md`、`mc-tool/`、`mc-tool.md`。资源版本、工具 Interface、页面版本、运行环境分别记录。索引或清单通过只证明结构与字节相配；实际 Relay 接入、权限和部署另验。
