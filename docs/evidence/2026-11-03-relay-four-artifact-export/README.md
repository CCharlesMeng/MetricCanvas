# Relay 四项导出与稳定入口候选

日期：2026-11-03。C 线维护源码位于 `/Users/moon/.codex/worktrees/relay-four-artifact-export/DataDashboard`。基线 `485faa0a0f81f0e882e2ff23f1de5ec672884f88`；A 28 文件、B 17 文件按提供方冻结清单逐字节 SHA-256 核对后携带。最终观察远端 `8b1e09ad62da10e86cc07f9494efd5c4a56a5d7e`，新可选补充空键修复未混入本切片，由主控最终集成对账。

本目录记录可审阅的 C 实施与真实四项候选，不表示正式发行、实际 Relay 采用或部署完成。

## 来源与交付范围

- [C 作者源码清单](source-manifest.json)：精确 23 文件、逐文件 SHA；包括首批 S03 五文件、四项导出器、固定 facade、导入闭包、Content 迁移投影、两指南作者源、分发/构建测试和三个冻结消费者输入。
- [携带切片](carried-inputs.json)：A/B 的来源目录、文件、摘要；与 C 作者源码分开。
- 本工作树 `metriccanvas-authoring/` 下 Content/Skill/锁为候选生成物，不按本树整包覆盖主目录；正式生成由主控采用统一引擎基线串行执行。
- Spec、ADR、主台账未由 C 修改；未提交、push、部署或清理其他工作树。

最终候选：`/tmp/mc-four-frozen-20261103-c9`，仅 `mc-content/`、`mc-content.md`、`mc-tool/`、`mc-tool.md` 四项。精确身份、绑定来源及资源投影见 [候选报告](candidate-report.json)，实际固定入口回执见 [自检](candidate-self-test.json)。发行 ID：`12827e6d10736574642957f98eacd230a4cfec7ff5bb18d2be90f8fc156ad3a5`。Node 程序 850425 字节，SHA-256 `f6afd7ef904509dfd3dbe7bae798c5e9e105a0994c50a4ccada9d28b4e14374e`。

## 实际消费契约

固定入口支持 `describe`、`check-release`、`self-test`、`invoke <operation>`，业务请求/结果及退出码沿 Spec。stdout 一份 UTF-8 JSON；成功/部分成功 0、产品拒绝 2、环境或发行故障 3。业务输入与完整有序诊断由原产品 handler 维护；成功 data 按输出 Schema 校验，失败不套成功 Schema。输入保持检查覆盖实际 dispatch。

| 已组装操作 | 实际来源和边界 |
|---|---|
| content.read | 既有 Content reader；真实 topic/key/预算语义 |
| page.project / scan | A 同源读取/扫描；公开请求不能替换 Schema |
| page.validate / upgrade | A 真实 Node 产品；默认升级目标与 release.defaultPageSchema=6.82 一致 |
| page.parameters | A 提取/准备/解析；预构建，不要求目标端 pnpm/tsx |
| query.prepare / results.normalize | B 纯派生和供给结果处理；execution:not-run，保留原值与覆盖语义 |
| page.compose / edit | B 显式结果记录/完整基线生成候选；不查询、不保存 |
| results.check / work.check / receipt.check | B 纯前置/回执核对；不授予权限、不执行存储/CAS/保存 |

Python 资源与 Node 路径/摘要/Schema 由已验证发行解析。Content 读取诊断码从真实 reader/transport 源码调用点生成，未知 Node 知识指针的实际回执纳入契约回归。B 的 `SCHEMA_BINDINGS` 从 A 唯一的 `evaluation-schema.json` 内联，缺项、未知绑定、零命中拒绝；来源和摘要写入 `mc-tool/_impl/schema-bindings.json`。所有显式 evaluation 的 Python 操作委托 A 私有 `internal.evaluation.validate` 检查结构、ISO 瞬时值和 IANA 时区；私有 route 不进入 Interface。时间敏感缺上下文与显式非法上下文分别返回专用码，非时间旧请求继续接受。

旧 MCP 的 9 个工具目录及“内部保存”等描述在四项构建侧投影为迁移参考；29 个实际资源加静态归属说明。旧 ID、公开路径及无关字节不改，内层 Content 清单由生成器从实际字节重建并先后验证，记录原内容摘要。不更改常规 MC/local 安装副本，真实在线包装归 Relay。

## 运行环境与隔离

实际测试 Python 3.12.13、Node 24.11.1；发行要求 Python >=3.12、Node >=22。运行依赖从实际导入及传递元数据审计，并核对锁定环境：attrs 26.1.0、jsonschema 4.26.0、jsonschema-specifications 2025.9.1、referencing 0.37.0、rpds-py 2026.6.3、typing-extensions 4.16.0。

初次准备这些依赖；普通更新不安装 wheel、不读其他源码、不构建、不联网。测试以仓外无关 cwd、`-I -B` 清除 PYTHONPATH/NODE_PATH/NODE_OPTIONS 回退，并用 `-I -S` 与只复制上述六个依赖的目录实际执行自检；无 MetricCanvas wheel、fastmcp 或 httpx。Python audit hook、Node guard 和子进程继承设置拦截真实网络连接尝试；这不是恶意代码的 OS 沙箱。

## 验证与尚未关闭项

最终分发测试 **42/42 通过**（最终 c9：81.808s），准确结果见 [日志](distribution-tests.log)。范围包含继承的 19 项结构测试、5 项绑定/导入构建负例，以及真实四项运行：正负输入、冻结消费者、共享 Schema、跨进程 TZ、最小初始依赖、缺文件/缺 Node/缺依赖、禁网、成功输出契约、内部目录迁移、双次路径/字节一致、两次兼容更新/跳跃与显式恢复旧四项。更新/回退是产品消费层夹具，不是 Relay 原子切换程序。

`node node_modules/typescript/bin/tsc --noEmit -p tools/tsconfig.skills.json` 已通过；直接执行 repair 的两个 Vitest 文件 16/16 通过。`pnpm skills:repair:check` 被 pnpm 11 的自动依赖准备/无 TTY 检查中止，未把该包装命令或 CI 报绿。完整 local/export 检查初轮 249/260 通过，11 项隔离导出失败的首因为启动时漏设锁定 Python，系统 Python 3.14 缺 fastmcp；使用明确锁定环境仅重跑这 11 项后，11/11 通过（20 项明确跳过，576.36s），见 [复跑日志](isolation-rerun.log)。这是初轮结果与失败项复跑的组合证据，不表示整个 pnpm 包装命令或 CI 已运行通过。A 显式 Node 资源 6/6 初轮通过；最终 A2 与 B 核心回归由各线证据记录，C 实际发行入口另行验证。

B 对 c8 的独立复核（c9 只修正 Content 诊断码生成，不改变这些操作）：page.edit/receipt.check 的 null、空对象、非法 zone 共 6/6 拒绝；两类合法上下文下业务失败的完整有序诊断和 data 与 B 冻结源码逐值一致。其证据位于 B 的 `docs/evidence/2026-11-03-relay-core-page-transform/runtime-binding-c8.json`，主控已收到。

复杂度口径：Radon 6.0.1 与 metriccanvas-ts-ast/1、TypeScript 5.9.3。C Python/测试及继承 lambda 共 132 项，最大 CC 11；bundle_root 6→8，新增 product_resources 3。exportRelayReference 4；mc-content-page main 5→5，旧 inspectSchema 13 改为 A 同源实现别名；全局导出只新增顶层接线。未改的 buildSkillProjections 存量 52→52 不在本次函数范围。详细前后值见 [Python](python-complexity.json)、[TS 前](ts-before.json)、[TS 后](ts-after.json)。

正式首版仍需：以主控最新引擎基线串行集成/生成、local-authoring 最终独立安装/页面试验场浏览器验收、受支持消费版本的实际 Relay 包装回放、原子采用/回退及真实身份/DQE/Java/状态/unknown/前端产物交接。未验层级不从结构检查、自检或源码测试推断通过。当前没有真实 Relay、真实服务、真实模型、CI 或部署证据。
