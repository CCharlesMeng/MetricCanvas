# MetricCanvas 独立创作 Bundle 实施计划

> 状态：S2 已完成，S3 迁移中
>
> 决策：[ADR-0061](../adr/0061-self-contained-authoring-bundle-and-neutral-contract-export.md)
> 交付根：`metriccanvas-authoring/`

## 目标

在不访问真实 Relay、Java 和 DQE 的条件下，交付一个可独立复制、启动、测试和验收的
创作 Bundle，逐步把当前 TypeScript 创作期确定性行为迁入 Python。Bundle 是 Skill、
Tool、Interface contracts 和锁定产品契约快照的原子发布容器，不把它们混成一个 Module。

## 冻结边界

- Skill 负责自然语言理解、消歧、用户确认和结果呈现；不导入 Python。
- Python Tool 负责 Page Build Spec 校验、查询与字段派生、验真、执行、组件选择、装配、
  当前 Page Schema 校验与通过 Java Port 保存；不读取 Skill。
- Skill 与 Tool 只通过 MCP Tool Interface 协作。FastMCP 是 Adapter，内部算法不是 tools。
- Page Build Spec 是模型与确定性算法的边界，不含 DQE 查询体、字段契约、组件 JSON、
  布局或页面协议版本。
- `pageId` 与幂等键属于 `build_page` command envelope，不进入 Page Build Spec；精确基线修订
  仍随修订场景放在 Page Build Spec 中。
- Python 不持久化 Relay Run，不直连 MySQL，不复制 Java 页面资产事务或 DQE 内部逻辑。
- Bundle 使用 Python 3.12+ 脚本目录交付，不构建 wheel；依赖版本锁定。
- 产品规则由仓根中立契约导出物承载，Bundle 只消费锁定快照，不手抄第二份规则清单。
- 内网鉴权与身份接入由后续内网对接方案承担，不进入本 Bundle 的设计与排期。

## 目录与所有权

```text
contracts/
└── metriccanvas/                         # 生成的产品中立契约；跨运行时共享
    ├── manifest.json
    ├── page/
    │   ├── schema.json
    │   ├── component-catalog.json
    │   ├── error-types.json
    │   └── conformance/{valid,invalid}/
    ├── query/error-codes.json
    └── data-context/schema.json

metriccanvas-authoring/                   # 一个原子发布 Bundle
├── bundle.json                           # Bundle 版本与两个 Module 入口
├── bundle.lock.json                      # Bundle 全内容摘要
├── contract-lock.json                    # 产品快照和 Authoring contracts 版本钉住
├── skill/
│   └── metriccanvas-page-builder/
│       └── SKILL.md                      # Relay/Agent Module
├── contracts/
│   ├── authored/page-build-spec.schema.json
│   ├── exported/analysis-intents.json
│   └── manifest.json                     # Skill↔Tool Interface contracts
├── contract-snapshot/                    # contracts/metriccanvas 的只读生成快照
├── tool/
│   ├── server.py                         # FastMCP stdio 进程入口
│   ├── requirements.in
│   ├── requirements.lock
│   └── metriccanvas_authoring/
│       ├── domain/                       # 确定性业务规则
│       ├── application/                  # 粗粒度用例与外部 Port
│       └── adapters/inbound/             # FastMCP 等入站 Adapter
├── test-harness/
│   ├── adapters/                         # 仅测试使用的 Fake
│   ├── fixtures/
│   └── tests/                            # 进程内 + 真实 stdio 黑盒
└── scripts/check_bundle.py
```

所有权判据：产品协议放仓根 `contracts/`；Skill↔Tool 接口放 Bundle `contracts/`；生产
算法只在 `tool/`；Fake/fixture/测试调用者只在 `test-harness/`。真实出站 Adapter 在接口
可见前不预造目录和 HTTP 信封。

## 契约同步

```text
TS/Zod/registry 作者真源
        │ 单向生成
        ▼
contracts/metriccanvas ──完全复制──▶ metriccanvas-authoring/contract-snapshot
        │                                    │
        └──────── manifest digest ───────────┘ contract-lock.json

Page Build Spec 作者文件 ───────▶ metriccanvas-authoring/contracts/manifest.json
分析意图 TS 闭集 ──单向导出─────┘
```

根 CI 以 `--check` 只读重算并检查四层漂移：产品导出、Bundle 快照、Authoring
contracts、Bundle/contract locks。跨引用和能力不变式不能只靠 JSON Schema，必须保留
共享分类向量，并在迁移期由 TypeScript 与 Python 共同验证。

## 实施切片

当前进度（2026-09-02）：S0、S1 已完成并接入 CI，目录边界已按 ADR-0061 重构；
S2 已完成，Harness 可从 Page Build Spec 经粗粒度 application seam 调用数据上下文、DQE、
Java 页面资产三个 Port，并验证结构化调用、稳定错误 `code/path` 和当前页面协议产物。
S3 已开始迁移别名归一、DQE/结果字段契约派生、formula 与首个柱状图页面装配垂直切片。

### S0：自包含骨架

- 创建 Bundle manifest、锁定依赖、Skill 与脚本入口。
- 加入真实 FastMCP stdio 子进程黑盒测试。
- 提供一条独立 `check` 命令并接入根 CI。

完成条件：新 checkout 安装锁定依赖后，可独立验证 manifest、契约摘要和 stdio MCP 往返。

### S1：产品中立契约导出

- 从 TypeScript 真源导出 Page Schema、组件能力目录、错误分类和数据上下文 Schema 到仓根。
- 导出有效页面 fixture 与最小无效分类向量。
- 为 Bundle 生成完全相同的只读快照和 manifest 摘要锁；`--check` 不写文件。

完成条件：修改 Page Schema、组件目录或快照而未重生成时，本地与 CI 明确失败。

### S2：Page Build Spec 与语义 Port

- Page Build Spec 只表达业务语义，并由 Bundle Authoring contracts 拥有。
- 定义数据上下文、DQE 执行与 Java 页面资产的语义 Port。
- Fake 只存在于 Test Harness，记录结构化调用，不假设真实 HTTP 路径或响应信封。

完成条件：Harness 能用 fixture 提交 Page Build Spec，并观察每个 Port 的结构化调用记录。

### S3：确定性核心迁移

按行为依赖顺序迁移：数据上下文投影与检索 → 取数单元清单校验与验真 → 组件硬闸与
意图排序 → 口径分区、页头、字段绑定和比例装箱 → 完整页面校验。

完成条件：冻结输入下，Python 与 TypeScript 的 canonical Page JSON 和稳定错误
`code/path` 等价。

### S4：Skill 与粗粒度工具

- Skill 使用逻辑能力名，不携环境路径、部署参数或算法实现细节。
- FastMCP 仅暴露 `discover_data_context` 与 `build_page` 两个粗粒度工具。
- Bundle/contract identity 通过 Resource/health/CLI 诊断，不作为模型工具。
- 工具返回结构化阶段进度、脱敏摘要和精确修订标识，不返回完整模型轨迹。

完成条件：真实 MCP 子进程能用 Fake Port 走通黄金场景，产生已保存修订标识和通过契约的页面。

### S5：迁移切换

- 冻结等价向量和差分报告。
- 宣布 Python 为页面装配真源，停止 TypeScript 装配实现演进。
- 删除双实现，保留产品中立契约导出和跨语言验收。

完成条件：目标创作链不执行 TypeScript/Node 服务端代码，冻结向量仍能在 CI 复现。

## 不阻塞开工的后续输入

- 真实 Relay 的项目结构、Skill 注册、进度事件和取消能力。
- Java 页面资产 Interface 的线上传输契约。
- DQE 真实数据上下文与执行接口。
- 内网鉴权与身份接入方案。

这些输入只解锁对应 Adapter 与集成验收，不改变 Skill↔Tool Interface、确定性核心或产品
契约责任。
