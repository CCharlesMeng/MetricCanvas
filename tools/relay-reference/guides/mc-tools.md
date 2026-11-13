# MC 产品工具

固定入口为 `mc-tools/cli.py`，操作描述从 [Interface](mc-tools/interface.json) 读取，运行环境与全部文件摘要从 [发行清单](mc-tools/release.json) 读取。私有 Python/Node 文件位置不属于消费接口。

```sh
python -B /absolute/references/mc-tools/cli.py check-release
python -B /absolute/references/mc-tools/cli.py describe
python -B /absolute/references/mc-tools/cli.py self-test
python -B /absolute/references/mc-tools/cli.py invoke content.read <<'JSON'
{"format":"metriccanvas-mc-request/1","requestId":"read-1","input":{"topic":"index","key":"knowledge"}}
JSON
```

首次准备 Python 3.12+、Node.js 22+ 及清单声明的精确 Python 依赖。普通更新只同步四项，不安装本仓 wheel、不构建、不读取仓库源码、不联网补依赖。`check-release` 可以在缺少产品依赖时检查字节，但它不证明产品能够运行；`self-test` 执行随发行冻结的实际操作样本。

安装根可包含 Relay 自有 references；产品入口只核对四项及其全部内部文件，保留其他文件。发行候选暂存根仍严格只有四项。`mc-tools` 是 Interface2 的正式路径，旧 `mc-tool` 批次须显式迁移并整批切换。

`invoke` 的输入只有 `format`、非空 `requestId`、对象 `input`。stdout 为一份 UTF-8 JSON：`format`、`requestId`、`operation`、`status`、`data`、`diagnostics`。按顺序保留业务诊断；`ok`/`partial` 退出 0、产品拒绝退出 2、运行环境或发行损坏退出 3。环境故障可能无法关联请求，回执使用空 requestId。stderr 供进程诊断。不要根据退出 0 推断真实查询、保存或发布成功。

各能力的输入和支持范围以实际 Interface 为准；没有注册的能力不能通过私有模块调用替代。页面与证据不足时返回候选或明确拒绝；禁止产品工具用网络、在线回调或临时安装来补齐输入。禁网防护用于暴露意外调用，不提供针对恶意代码的操作系统隔离。

装配失败或 partial 时按 `runtime:error-repair` 的产品工具分支消费完整有序诊断；结合 `pathScope` 与 `blockId` 区分输入块和候选页面位置。保留有效结果与成功候选，真实工作状态、保存恢复和产物交接仍由 Relay 执行。

模型按下表选择操作后，仅用 `content.read` 读取 `topic:"runtime",key:"operation.<操作名>"` 的输入概览；完整 Interface 由程序持有和校验。标题/列宽局改只读编辑概览与实际受影响属性，知识超预算时根据本次任务分页或展开所需规则。完整页面与执行记录留在程序侧，模型只消费本轮必要摘要和原始有序诊断。

| 操作 | 显式输入与结果边界 |
|---|---|
| `content.read` | topic/key/预算 → 同源资源或完整保留的超预算原子 |
| `page.project` / `page.scan` | 完整页面 → 只读结构、用数和诊断；scan 可限定组件读取范围 |
| `page.validate` / `page.upgrade` | 完整页面 → 产品诊断或升级候选；默认目标与发行默认页面版本相同 |
| `page.parameters` | extract/prepare/resolve 的完整输入 → 参数候选或诊断，不执行 DQE |
| `query.prepare` | 取数单元、数据上下文与策略 → 查询候选；`execution:not-run` |
| `results.normalize.v2` | 已有显式执行证据 → 页面数据源、覆盖和新创作呈现建议；Tokens 基础刻度与完整性不足时保留未知 |
| `page.analyze` / `page.rebind` | 完整原始字节及显式需求/结果关联 → 稳定用数报告或原子普通换源候选；共享消费者全量核对，不保存 |
| `page.presentation` | 完整候选、可选 baseline/原值意图 → 本次实际字段绑定的 data-only 呈现诊断；不重写格式 |
| `page.compose.v2` / `page.edit.v2` | 完整规格/工作副本及结果记录 → 单源或受控多槽候选、有序结果及最终呈现检查；不保存 |
| `results.check` / `work.check` | 关联、版本、策略或工作状态 → 纯前置判定；不授权、不执行 CAS |
| `receipt.check` | 原命令及已有响应 → 供给回执的一致性判定；不发起保存 |

新建任务优先使用表中的 v2 装配/归一化接口；已采用的旧 `results.normalize`、`page.compose` 和 `page.edit` 继续按原描述与默认行为运行。关联与换源读知识 `authoring.analysis` / `authoring.rebind`，数值绑定变化读 `authoring.presentation`，多槽选型读 `authoring.multislot`。标题、列宽等局部呈现任务沿用已有来源，只查受影响属性；不要求完整数据分析报告。

程序调用样例见 `mc-tools/examples/index.json`：按操作选择一个请求文件，将其原始UTF-8内容作为stdin传给对应`invoke`操作。索引标明预期状态/诊断；样例包含显式合成结果和固定评估时间，供离线接入回放使用。

此表是任务路由；真实收录的操作、输入必填项及错误闭集由 Interface 决定。合法页面协议不等于所有组件均可自动装配，装配和编辑仍沿用已有受控操作支持面。部分结果、空结果、缺证据、版本过期和失败分别消费，不能把缺证据改写成执行成功。

时间敏感运算使用 `input.evaluation = {"instant":"2026-12-31T16:30:00Z","timeZone":"Asia/Shanghai"}`。Relay 程序按轮次冻结并供给瞬时值和 IANA 业务时区，模型不能覆盖它，也不能用分析期间或数据抓取时间替代。缺上下文返回 `EVALUATION_CONTEXT_REQUIRED`，已给但非法返回 `INVALID_EVALUATION_CONTEXT`；非时间旧请求不额外增加必填。产品不从机器时钟和默认时区补齐。

Relay 程序负责可信身份/轮次、真实 MCP/DQE、状态存储/CAS、Java 保存与 unknown 恢复、精确产物交接，以及完整批次采用/回退和缓存重载。兼容预检查只决定是否进入实际 Relay 冒烟，不能自动宣布采用；在途轮次及 unknown 状态保持原批次语义。
