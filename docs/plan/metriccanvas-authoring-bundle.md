# MetricCanvas 独立创作 Bundle 实施计划

> 状态：已冻结架构基线，可实施
>
> 决策：[ADR-0061](../adr/0061-self-contained-authoring-bundle-and-neutral-contract-export.md)
> 交付根：`metriccanvas-authoring/`

## 目标

在不访问真实 Relay、Java 和 DQE 的条件下，交付一个可独立复制、启动、测试和验收的创作 Bundle，逐步把当前 TypeScript 创作期行为迁入 Python。首个可验收切片是「Bundle 骨架 + 中立契约导出 + 真实 FastMCP stdio 子进程黑盒」，不宣称页面装配已迁移。

## 冻结边界

- Bundle 是仓根自包含模块，不进入 pnpm workspace，不在运行时加载 Node/TypeScript 包。
- Python 使用 3.12+，以脚本目录交付，不构建 wheel；依赖版本必须锁定。
- Bundle 只包含一份 Skill；环境接线通过薄 Adapter 完成。
- 页面构建规格是模型与确定性算法的分界；模型不提供 DQE 查询体、字段契约、组件 JSON、布局或页面协议版本。
- Python 不持久化 Run，不直连 MySQL，不复制 Java 页面资产事务或 DQE 内部逻辑。
- 创作工具只产出当前页面协议版本；旧修订编辑产生新的当前版本修订。
- 内网鉴权与身份接入由后续提供的内网对接方案承担，不进入本 Bundle 的设计与排期。

## 目标结构

```text
metriccanvas-authoring/
├── bundle.json                 # Bundle SemVer 与入口
├── bundle.lock.json            # 生成的内容摘要
├── SKILL.md                    # 唯一创作 Skill
├── requirements.in/.lock       # 运行时依赖与锁定结果
├── contracts/                  # 中立契约导出物与验收向量
├── core/                       # 无 FastMCP 依赖的确定性核心
├── interfaces/                 # FastMCP/CLI 入口
├── infrastructure/             # Java/DQE Port Adapter，首批只有 fake
├── fixtures/                   # 本地场景与黄金向量
└── tests/                      # 进程内与 stdio 子进程验收
```

目录名可在实施中机械调整，但「核心不依赖 FastMCP」、「真实外部系统只在 Adapter」和「Bundle 自己能验收」是结构验收条件。

## 契约同步

```text
packages/page 的 TS/Zod/registry
        │ 单向生成
        ▼
metriccanvas-authoring/contracts
        ├── Page JSON Schema
        ├── 组件能力目录
        ├── 错误闭集
        ├── 数据上下文 Schema
        └── 正反例与黄金向量
```

根 CI 负责重新生成并检查漂移；Bundle 内部测试只消费已提交的导出物，因此复制到独立目录后仍可运行。跨引用和能力不变式不能只靠 JSON Schema，必须有共享的分类期望向量。

## 实施切片

当前进度（2026-09-02）：S0、S1 已完成并接入 CI；S2 已落盘页面构建规格、契约消费层和三个语义 Port/Fake，进程内 Harness 的完整规格提交路径待继续实现。

### S0：自包含骨架

- 创建 Bundle manifest、锁定依赖、Skill 与脚本入口。
- 加入真实 FastMCP stdio 子进程黑盒测试。
- 提供一条独立 `check` 命令并接入根 CI。

完成条件：一个新 checkout 在安装锁定依赖后，可独立验证 manifest、契约摘要和 stdio MCP 往返。

### S1：中立契约导出

- 从当前 TypeScript 真源导出 Page Schema、组件能力目录、错误分类和数据上下文 Schema。
- 导出当前有效页面 fixture 与最小无效分类向量。
- 生成文件摘要，`--check` 模式不写文件且在漂移时失败。

完成条件：修改 Page Schema 或组件目录而未重生成 contracts 时，本地与 CI 都明确失败。

### S2：页面构建规格与假 Port

- 把页面构建规格定义为中立 JSON Schema，内容保持业务语义层。
- 定义数据上下文、DQE 执行与 Java 页面资产的语义 Port。
- 加入可编程 fake，不假设真实 HTTP 路径或响应信封。

完成条件：Harness 能用 fixture 提交页面构建规格，并观察每个 Port 的结构化调用记录。

### S3：确定性核心迁移

按行为依赖顺序迁移：数据上下文投影与检索 → 取数单元清单校验与验真 → 组件硬闸与意图排序 → 口径分区、页头、字段绑定和比例装箱 → 完整页面校验。

完成条件：冻结输入下，Python 与 TypeScript 的 canonical Page JSON 和稳定错误 `code/path` 等价。

### S4：Skill 与粗粒度工具

- Skill 使用逻辑阶段名，不携环境路径或部署参数。
- FastMCP Adapter 暴露数据上下文发现与粗粒度页面构建/保存阶段，算法内部纯函数不成为工具。
- 工具返回结构化步骤进度、脱敏摘要和精确修订标识，不返回完整模型轨迹。

完成条件：真实 MCP 子进程能用假 Port 走通一个黄金场景，产生已保存修订标识和通过契约的页面。

### S5：迁移切换

- 冻结等价向量和差分报告。
- 宣布 Python 为页面装配真源，停止 TypeScript 装配实现演进。
- 按迁移依赖删除双实现，保留中立契约导出和跨语言验收。

完成条件：目标创作链不执行 TypeScript/Node 服务端代码，冻结向量仍能在 CI 复现。

## 不阻塞开工的后续输入

- 真实 Relay 的项目结构、工具注册、进度事件和取消能力。
- Java 页面资产 Interface 的线上传输契约。
- DQE 真实数据上下文与执行接口。
- 内网鉴权与身份接入方案。

这些输入只解锁对应 Adapter 与集成验收，不改变 Bundle 的确定性核心和中立契约责任。
