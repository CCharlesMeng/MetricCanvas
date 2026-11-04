# MC 第二批：按操作读取、公开请求与 Node 路径

日期：2026-11-04。实施工作树：`/Users/moon/.codex/worktrees/relay-tools-plural/DataDashboard`。代码未提交/push，来源回执 `dirty:true`；CI、原生 Windows、真实 Relay/DQE/Java 保存和模型 token 未验。

## 已实现

- 作者源统一通过 `shutil.which` 解析 Node，版本检查和执行均使用实际路径；缺失保持结构化环境错误。产品禁网参数、UTF-8、超时和状态语义保持。
- 从实际 Interface 为全部 19 项操作生成独立输入概览，以 `runtime:operation.<操作名>` 通过既有 `content.read` 读取。概览包含必填项、字段指针和行为边界；完整 Schema 仍由程序校验，不复制为模型工具定义。
- 公开 `mc-tools/examples/index.json` 及 35 个请求文件，与既有冻结消费样本同源；没有重录预期，也没有扩大注册操作支持面。
- [Relay 接入映射](../../plan/2026-11-02-product-relay-evolution/relay-adapter-mapping-20261104.md)明确旧 query 到公开读取入口的适配，以及旧 compile/inspect 没有等价公开操作的缺口。禁止用 compose/validate 直接替换并丢失旧模板/关联检查。

## 可运行产物

[ZIP](/Users/moon/Documents/Code/公司项目/DataDashboard/artifacts/mc-tools-consumption-20261104-final/mc-tools-consumption-0.3.2.zip)；[来源与兼容回执](/Users/moon/Documents/Code/公司项目/DataDashboard/artifacts/mc-tools-consumption-20261104-final/mc-tools-consumption-0.3.2.zip.release.json)。

- release 0.3.2 / Interface 2.0.0 / 页面 Schema 6.83。
- releaseId：`4eb72f505b552bab5a52b1dbc7d6f4b5e525a93a32ae03d60fe87af6efc91b43`。
- ZIP：45,991,083 B；SHA-256：`99ec0e7d977f90df9cf2a9844724b9d44117896d850c94da61a3ed02e761546e`。
- 候选目录 `/tmp/mc-tools-consumption-0.3.2-final`，入口 `mc-tools/cli.py`。旧单数 0.2.2 仍须显式迁移，不能仅重命名目录。

## 实测与证据

| 检查 | 结果 |
|---|---|
| 发行、归档、仓外运行、共享目录和冻结消费回归 | [93 项通过，零跳过](release-tests.log) |
| Content 分发、Node 缺失/超时/编码等 | [18 项通过](content-tests.log) |
| Skill repair 类型与入口回归 | [复跑 16 项通过](skills-repair.log) |
| 同源生成一致性 | [1442 product / 5 authoring / 1 interface current](contracts-check.log) |
| ZIP仓外最小依赖运行 | [实际解包probe](archive-probe.json)：35项自检、9项负例和35条正式消费通过；旧23条保留已审查迁移差异 |
| 最终来源回执与完整性 | [最终归档检查](final-archive-check.json)通过；补齐源码README版本说明后重封装，ZIP原字节和releaseId不变，来源回执重新采集 |
| 包装/冻结消费 | [pack 回执](pack.json) |
| 与 0.3.1 的实际兼容预检查 | [ok](previous-release-compatibility.json)；19 项描述和 35 条产品样本字节保持 |
| 空/未知/失败/期间/行键/部分/缺或非法 evaluation | [8 项公开 CLI 探针全部通过](boundary-probes.json)，[重放请求](requests) |
| 上下文读取 | [19 项真实 CLI 回执](context-bytes.json)，1,437–2,448 B；编辑 v2 为 2,035 B；两份根指南合计 9,762 B |

根指南满足 10 KiB、单项发现满足 8 KiB 的初始目标。完整 Interface 仍为 749,143 B，由程序持有；全量目录保留供明确需要时读取。这不等于六类真实 Relay 任务、多轮累计材料、模型工具定义或 token 成本已达标；包体积去重另行评估，不作为本轮接入阻塞。

初次测量将 maxBytes 放在 input 根被严格契约拒绝；已按正式契约改为 `input.options.maxBytes`，最终 19 项全部经公开入口实测。初次 Skill 检查在并发运行多组重型回归时有一个现有 5 秒用例超时，15 项通过；保留[原始失败记录](skills-initial-timeout.log)，原命令复跑 16 项全部通过，见 [Skill 记录](skills-repair.log)，未放宽用例时限。

## 复杂度和验收范围

Radon 6.0.1，独立统计函数、对象方法及嵌套闭包，排除类平均值。全部 21 个 Python 变更源文件共 326 个函数/方法/闭包，最高 CC 12，无超过 15 项；见[基线](complexity-base.json)、[第一批结束时四个相关文件基线](complexity-before.json)、[当前](complexity-after.json)。

| 第二批相关函数 | 前→后 CC |
|---|---:|
| mc_runtime.run_node / node_check | 11→12 / 4→5 |
| product_runtime.runtime_check / node_operation | 2→2 / 1→1 |
| 新增 node_executable | 1 |
| 新增 operation_guide / add_operation_guides | 2 / 2 |
| interface_resources.publish_interface | 1→1 |
| 新增 write_examples | 2 |
| export.finish | 3→3 |

其余第一批变更及 TypeScript AST 口径见[第一批验收](../2026-11-04-relay-tools-plural/README.md)。没有修改页面协议字段、引擎/组件执行和页面创作语义；Schema 字段净增减 0。本次是分发、工具入口和渐进读取变化，页面文档/Playground 无新增语义；local-authoring 同源产物保持，工具入口执行 Skill repair 检查。Windows 空格路径检查属于 mock 进程边界，编码仿真和仓外 macOS 实跑分别保留，不声明原生 Windows 通过。

本批形成 M01/M02/M05/M08 的 MC 实现和接入材料。M03/M04/V01 的真实注册、模型材料分流及累计成本须在 Relay 实际包装中验收；保存与恢复能力也仍归 Relay。旧模板 compile/inspect 若继续需要，应单列正式能力支持，不把非等价替换算作完成。Git 提交、push 和 CI 未进行。
