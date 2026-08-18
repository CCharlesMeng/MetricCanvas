# dsh-plugin-ioc-data-dev — IOC 数据开发垂直领域插件

> 版本:0.1.0 · 2026-08-18
> 把 **DeepSeek Harness (DSH)** 变成 IOC 数据开发的专用工作台:阶段门禁、SQL/设计/指标校验器、行为守卫、领域技能与知识底座,实现《IOC 数据开发全流程与周边依赖》v1.0。

## 安装

```bash
# 从本地目录安装(推荐开发期)
dsh plugin --profile <profile> add /path/to/ioc-data-dev

# 或从 git 安装(发布到 GitHub 后;建议 pin commit)
dsh plugin --profile <profile> add github:you/ioc-data-dev#<sha>

# 卸载
dsh plugin --profile <profile> remove dsh-plugin-ioc-data-dev
```

安装后**重启 dsh**,插件即生效(工具、守卫、技能全局注册)。

## 安装后获得什么

| 能力 | 说明 |
|------|------|
| 工具 `ioc_stage_gate` | 阶段出口门禁(CORE-AX9 Fail-Closed):按 schema.yaml blocks_when 检查 gate 置位/产物等级/契约存在性,BLOCKED 即停工 |
| 工具 `ioc_validate` | 结构校验器统一入口:sql-ddl / sql-etl / domain-patterns / lifecycle-columns / ads-clarification / gate-change / deliverable-level |
| 工具 `ioc_init_workspace` | 在项目工作区落地领域骨架(codespec/harness/knowledge-base/.cac/AGENTS.md + codespec/changes/) |
| 行为守卫 | `tools/pre-execute`:写前硬约束 deny(AI 关闭澄清 CORE-AX8、非法 gate 值 CORE-AX9);`tools/post-execute`:写后自动跑结构校验,FAIL → guard-report.md |
| 8 个领域技能 | ioc-vertical(总纲)/ ioc-stage-gate / ioc-data-design / ioc-ads-design / sql-generator / sql-validator / sdd-archive-workspace / ioc-clarification |
| 知识底座 | knowledge-base/(语义层六层规则、规范约束、维度注册表、特性树) |

## 快速上手

```text
1. 会话中调用 ioc_init_workspace(target=<项目目录>) 落地骨架
2. 在 codespec/changes/{version}/{feature-id}/ 创建 change-manifest.yaml(模板在 codespec/schemas/ioc-workflow/templates/)
3. 每阶段推进前: ioc_stage_gate(feature=<目录>, stage=<阶段>)
4. 写产物后:     ioc_validate(validator=<...>, path=<文件>)
```

## 推荐搭配:companion Agent 预设

插件提供全局能力;再装 companion 预设获得 IOC persona + 主流程/公理/门禁/策略 prompt:

```bash
# preset/ 目录即预设内容,安装到用户预设根:
mkdir -p ~/.dsh/.agent-presets/ioc-data-dev
cp preset/agent.cordis.yml preset/preset.yml ~/.dsh/.agent-presets/ioc-data-dev/
```

然后在 Web 界面新建会话选择 **IOC 数据开发** 预设(基于 standard,含全部编码 Agent 能力)。

## 包结构

```
ioc-data-dev/                     ← bundle 根(可整体发布为 npm/git)
├── package.json                  # dsh.bundle 清单(patch 入口)
├── cordis.patch.yml              # 组合层:注入 ioc-data-dev 行
├── dsh/
│   ├── index.js                  # host 半:3 个工具 + skills Provider + 守卫挂载(零依赖)
│   ├── guards.js                 # 行为守卫(pre/post-execute)
│   └── lib.js                    # 共享工具(python 调用等)
├── skills/                       # 8 个领域技能(SKILL.md)
├── codespec/
│   ├── schemas/ioc-workflow/     # schema.yaml(11 产物 DAG + 58 skills 白名单 + 12 gates)+ templates + qa
│   └── guidelines/ioc-kernel/    # 公理/契约/活动注册表/策略/领域模式/门禁词汇/守卫/模板约束/profiles
├── harness/
│   ├── stages/                   # 阶段薄卡片(data 15 + subject 13 + 并行轨道)
│   └── tools/                    # 零依赖 Python 校验器(mini_yaml 内置,无需 PyYAML)
├── knowledge-base/               # 知识底座(ontology/specification/architecture/feature-tree)
├── preset/                       # companion agent 预设(agent.cordis.yml + preset.yml)
├── examples/0.1.0/fw-2026-0818-001/  # 端到端示例 feature(门禁/校验全链路演示)
└── .cac/README.md                # 原体系 hooks → DSH 守卫的映射说明
```

## 校验器(harness/tools/,零依赖)

| 脚本 | 校验 | 公理/策略 |
|------|------|-----------|
| sdd_stage_gate.py | 阶段出口门禁(Fail-Closed) | CORE-AX9 |
| blocks_when.py | gate/min_level/missing_contract 机读执行 | CORE-AX9 |
| validate_gate_change.py | manifest gates.* 合法性、防伪造 | CORE-AX9 |
| validate_sql_ddl.py | DDL 结构(SerDe/DROP/表名/库/分区) | POL-SQL-DDL-* |
| validate_sql_etl_patterns.py | ETL 模式(CTE/分区/别名/聚合/除法) | KW-AX3, POL-SQL-ETL/QRY-* |
| validate_domain_patterns.py | 领域模式必选过滤 | KW-AX5, PAT-DOM-* |
| validate_lifecycle_columns.py | 指标生命周期列定义 | CORE-AX6 |
| validate_ads_clarification.py | 澄清项闭环(AI 不得 closed P0) | CORE-AX8, POL-DESIGN-010 |
| deliverable_level.py | 产物等级 L1/L2/L3 | — |

命令行直接运行:`python3 harness/tools/sdd_stage_gate.py --feature <dir> --stage <stage>`(需 python3;YAML 解析内置,无需安装任何依赖)。

## 实现状态

- ✅ 全量注册表(schema.yaml:11 产物 DAG、58 skills、12 gates、validation)
- ✅ ioc-kernel 规范目录 + 知识底座 + 阶段卡片
- ✅ 可运行工具链(门禁 + 8 个校验器,端到端测试通过)
- ✅ 行为守卫 + 8 个技能 + companion 预设
- ⏳ 待补:其余 ~40 个工具脚本、其余 ~50 个 skill 按注册表逐个落地(schema.yaml 已全量登记)
