# MC 内容与布局能力：交付说明

日期：2026-10-24。面向 Relay 开发、Skill 维护者和集成验收负责人。

MC 已提供可整体替换的内容包、确定性脚本及本地验证结果。Relay 接线与真实部署验收尚未完成。本文解释交付内容和责任；具体实施与确认项见 [Relay 对接 handoff](MC-CONTENT-RELAY-HANDOFF.md)。现有平台身份、查询、保存和预览 Adapter 的接入仍遵循 [RELAY-HANDOFF.md](RELAY-HANDOFF.md)，本次不替换该接入契约。

## 1. 要解决的问题

把 Skill 中与 MC 产品紧耦合的协议、工具行为、错误说明、组件能力和布局标准集中到 MC 维护的内容包。产品升级后，MC 从产品真源重新生成整包；Skill 消费新内容，无须维护另一套枚举、布局编译或旧文件迁移逻辑。

MC 提供事实和计算结论。Skill 负责理解业务需求、声明用户要求、组织流程并决定采用哪些结果。Relay 提供执行环境和程序通道。保存与交付沿用集成应用现有机制。

## 2. 交付单位与目录

首次平台接入或同步本次公共源码时，交付完整 `metriccanvas-authoring/` 公共目录；更新保留内部自有的 `tool/metriccanvas_authoring/adapters/`，遵循 [ownership.json](ownership.json) 和既有同步流程。数据库、凭据、虚拟环境及运行产物留在公共源码目录外。

其中 `mc-content/` 是供 Skill 整体安装、替换的独立 MC 内容单位：

```text
metriccanvas-authoring/
  MC-CONTENT-OVERVIEW.md             本说明
  MC-CONTENT-RELAY-HANDOFF.md         对接步骤、确认表和回执格式
  bundle.json / bundle.lock.json      公共分发声明与摘要
  mc-content/
    mc-content.version.json          内容身份、资源摘要、契约对齐信息
    index.json                      按 topic/key 定位原子内容
    protocols/                      协议、页面 Schema 与版本策略
    tool-contracts/ / errors/        工具参考与错误原子
    runtime/                        工具行为、保存/交接事实、修复建议
    layouts/                        场景目录、标准与模板格式
    mc-closed-sets/                  活动结构计划契约及组件能力快照
    scripts/                        Python 接口、产品检查和升级程序
    eval/fixtures/                  示例能力矩阵
  skill/                            既有 Skill 入口及知识投影
  tool/                             既有平台 Python 服务
```

内容包可在 MC 开发仓以外运行。要求 Python ≥3.12、Node.js ≥22，并显式安装 `mc-content/scripts/requirements.txt`。Node 不需要 npm 安装产品源码依赖。

仅复制 `SKILL.md`、仅安装 Python wheel，均不会获得完整 `mc-content/`。当前 wheel 承载平台 Python 服务及其既有快照；MC 内容包需要单独随完整目录交付。不要把虚拟环境、业务输入或报告写入 `mc-content/`：完整性检查会核对实际文件集合和摘要。

## 3. MC 提供的接口

这些名称是 Python 函数及 CLI 操作，不是已经在 Relay 注册的 MCP 工具。

| Python 接口 | CLI | 作用与边界 |
|---|---|---|
| `query_content` | `query` | 按 topic/key 返回完整原子、来源及摘要；超预算时不返回残缺契约 |
| `compile_layout` | `compile` | 对完整页面结构计划补缺省、核对合法性与明确声明，返回 plan、调整、缺口、inspectionSpec |
| `inspect_assembly` | `inspect` | 对指定完整页面元数据检查组件类型、分区、数据源及实际字段选择；检查覆盖范围明确列出 |
| `inspect_schema` | `schema` | 检查旧页的读取合法性、能力下限、迁移可能性和语义缺口 |
| `upgrade_page` | `upgrade` | 复用产品迁移规则；默认只检查，显式新目录写出并保留原始字节和摘要 |
| `evaluate` | `evaluate` | 执行调用方矩阵中的本地 compile/inspect 用例；返回逐项结论及计数 |
| `verify_package`（位于 mc_resources） | `verify` | 检查资源集合、摘要、快照和契约对齐元数据 |

当前可执行布局场景为 `business-report`（compact / standard / rich）和 `usage-report`（standard）。`ioc-overview` 在目录中标为 `executable:false`，调用会返回原因，不能作为可执行模板交付。

页面结构计划按完整输入解释：缺失节点表示本页不包含；仅对已存在节点补缺省，显式值优先。模板不携带业务示例数据、真实字段名或固定数据源 ID。Skill 提供真实数据绑定及 `userRequirements`；程序能检查声明是否保留，不能证明声明完整反映了用户原话。

## 4. 与现有平台链路协作

```text
Skill 理解业务需求、选择模板并准备完整页面结构计划
  → Relay 调用 MC compile_layout
  → Skill 处理调整、缺口，决定是否使用返回 plan
  → 沿既有 compose_page 入口装配并尝试保存
  → Relay 在程序通道取得该次完整页面元数据
  → 使用该次 inspectionSpec 调用 inspect_assembly
  → 模型接收有界检查摘要及独立的保存/交接回执
  → Skill 决定修复、说明缺口或继续交付
```

`inspectionSpec` 随编译产生，由 Relay 关联到对应装配请求和精确产物；它不进入页面 Schema 或 compose request。MC 不存“最近一次编译”的会话状态。跨请求的关联、隔离与恢复由 Relay 实现。

现有 compose 会在返回前尝试保存。后置检查发现缺口，不代表页面没有保存，也不会撤销保存。检查报告、保存回执和预览交接回执须分别记录。

现有 MCP 模型摘要不含完整页面元数据。Relay 必须确认能在程序通道取得完整产物；拿不到时报告未验，不用摘要重建页面，也不把完整页面和原始数据送入模型以绕过该限制。

## 5. 责任分工

| 事项 | MC | Skill / Relay / 集成应用 |
|---|---|---|
| 产品事实与契约 | 维护真源、导出、摘要与同步检查 | 按需查询；实际工具参数以部署 `list_tools` 为准 |
| 编译、检查与旧页升级 | 提供脚本、规则及确定性回归 | 运行脚本并处理报告；不重写另一套实现 |
| 工具暴露与执行环境 | 提供函数签名和 CLI | 决定注册通道、安装依赖、挂载资源和隔离权限 |
| 用户要求 | 核对显式声明与指定产物 | 理解原话、声明要求和选择方案 |
| 完整产物 | 检查显式传入 document | 取得并关联精确 document；控制模型摘要预算 |
| 评测与采用 | 输出被测内容身份、逐项结果及未验范围 | 维护正式矩阵、收集真实回执、定义采用规则 |
| 保存与交付 | 描述真实工具行为，不新增内容包准入机制 | 沿现有权限和回执决定下一步 |
| 整包更新 | 交付新整包与兼容结论 | 完整替换、重载脚本、清理或隔离旧缓存 |

MC 不新增 evalStatus 准入状态，不替 Skill 豁免，不安装或回退包。CLI 成功退出也不等于检查通过，调用方须解析 JSON 业务结果。

## 6. 版本、兼容与旧文件流程

以下版本各有含义，不能互相代替：

| 标识 | 含义与真源 |
|---|---|
| `contentVersion` / `contentSha256` | 整包内容身份，来自 `mc-content.version.json` |
| `interfaceVersion` | MC 内容包接口格式，本次为 1.0 |
| `templateVersion` | 指定场景变体的模板版本，本次为字符串 `"1"` |
| 页面 `schemaVersion` | 页面文档使用的产品协议版本，读写范围来自产品版本策略 |
| `alignedWith` | 构建时对齐的产品、创作契约及平台工具协议版本与摘要 |
| Bundle 版本 / Git 提交 | 公共源码身份；同一 Bundle 版本不能替代固定提交和产物摘要 |

编译可传 `targetVersions` 核对真实部署事实。当前实现对传入字段逐项做精确相等比较；不自动推断版本区间。未提供时 `deploymentAlignment=not_run`；只提供部分字段时，`checkedVersionFields` 只列那些字段，不能宣称全部部署版本对齐。

旧文件流程：先 `schema` 检查 → 若仍合法且仅用旧版本能力，可保留原版本 → 需要升级则先运行默认只检查的 `upgrade` → 明确指定全新输出目录 → 核对 original、page、migration.json → 在目标运行时预览并由 Skill 决定采用。已有输出目录拒绝覆盖，不支持降级，不改写历史修订，不靠改版本号放行未知语义。

未来 Schema 升级由 MC 补充产品迁移规则、重生成整包并跑旧输入回归。当前演练证明了版本发布与旧文件处理链路，不能保证尚未设计的未来语义迁移会自动成功。

更新时整体替换资源，并新建执行进程或完整重载脚本。调用缓存和 inspectionSpec 按内容摘要隔离；不能把旧进程代码与新磁盘资源混用。MC 不提供热更新管理器。

## 7. 本次身份与验证范围

以下为 2026-10-24 本地交付快照；接收时重新执行 verify，以随包清单为准：

| 项目 | 当前值 |
|---|---|
| Bundle / 创作契约 | 0.3.1 |
| 产品契约 | 1.0.0-rc.4 |
| 页面写出版本 | 6.58 |
| 平台工具协议 | 2.0 |
| MC 内容版本 | `1-e9aba00bba96353d` |
| MC 内容摘要 | `e9aba00bba96353d204bb30549fe3c0b395f290474842dd1b1487cc420662295` |
| 已执行 | 171 项 authoring 检查、51 项相关 Python 回归、仓外内容运行与 wheel 加载、生成一致性、三个实际页面检查 |
| 尚未执行 | 真实 Relay 接线、真实 DQE、Java 保存、预览交接、发布、远端 CI |
| 源码交付身份 | 采用取得本目录的完整公共 Git 提交号及交付归档摘要，写入内部构建记录；不能使用本地开发基线冒充交付提交 |

静态检查与产物检查不证明视觉质量、真实取数、保存状态或用户意图理解。`evaluate` 当前只执行 compile/inspect；示例中的 deployment 项返回 `not_run`，不会自动消费真实部署回执。真实验收使用 handoff 中的回执格式另行记录。

## 8. 接收方阅读顺序

1. 本文：确认交付范围与责任。
2. [MC-CONTENT-RELAY-HANDOFF.md](MC-CONTENT-RELAY-HANDOFF.md)：完成安装、接线、确认表与验收回执。
3. [mc-content/README.md](mc-content/README.md)：脚本使用与整包更新；按 index 查询所需内容。
4. [RELAY-HANDOFF.md](RELAY-HANDOFF.md)：既有平台服务与 Adapter 对接。
5. [SOURCES.md](SOURCES.md)：公共维护真源与生成流程。
