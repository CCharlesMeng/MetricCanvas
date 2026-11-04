# MC 第一批实施：复数工具包与共享安装目录

日期：2026-11-04。基线：`2cd32ee85`。实施位置：`/Users/moon/.codex/worktrees/relay-tools-plural/DataDashboard`。代码和本地产物已形成，未提交/push，CI、原生Windows和真实Relay未验。

## 已完成的行为

- 正式导出`mc-tools/`、`mc-tools.md`，入口为`mc-tools/cli.py`；导出器、私有资源定位、清单、指南、归档、回放和测试同批调整。
- 产品CLI在共享`references/`中只校验四项，保留其他宿主文件；四项内部多项、字节变化、缺项及非法路径继续拒绝。开发侧候选暂存仍严格四项。
- 构建检查器只读识别旧单数发行；旧0.2.2→新发行返回`needs_migration`，明确Interface主版、入口和公开路径的变化。
- 19项操作的输入/输出契约保持；新冻结消费者保留旧0.2.0的全部35条请求和预期结果，未重录行为。旧0.1.0、0.2.0及其审查文件原摘要保留。

## 可运行产物

- [本地ZIP](/Users/moon/Documents/Code/公司项目/DataDashboard/artifacts/mc-tools-plural-20261104/mc-tools-plural-0.3.1.zip)及[来源/兼容回执](/Users/moon/Documents/Code/公司项目/DataDashboard/artifacts/mc-tools-plural-20261104/mc-tools-plural-0.3.1.zip.release.json)。来源回执`dirty:true`，准确标记本次未提交的代码。
- 候选目录：`/tmp/mc-tools-plural-0.3.1-final`；共享根可运行样本：`/tmp/mc-tools-plural-shared-references`。
- release **0.3.1** / Interface **2.0.0** / 页面Schema **6.83**。
- releaseId：`3f41121f55445666865cefa4e9e70f87a3e49d9268dbcd9cbe83a8d6804424d8`。
- ZIP：45,897,862字节；SHA-256：`3b32f1fd2c002723ac36842e29ff8c1dd006c95158d24725eaac6220ec7a04f8`。

```sh
python -B /absolute/references/mc-tools/cli.py check-release
python -B /absolute/references/mc-tools/cli.py self-test
```

首次环境仍为Python3.12+、Node22+及发行声明的六个精确依赖。旧单数根须显式迁移并整批切换；不要仅改现有包目录名。0.3.0保存为更名前缀基线的审查候选；说明文本调整后按不可变规则发布0.3.1，没有覆盖该冻结基线。

## 验证

| 检查 | 结果/证据 |
|---|---|
| 发行、归档、仓外运行及共享目录 | [85项全部通过，零跳过](release-tests.log) |
| 产品核心 | [99项通过](core-tests.log) |
| Skill入口与工具移动检查 | [类型检查及16项通过](skills-repair.log) |
| 同源生成一致性 | [1442 product / 5 authoring / 1 interface current](contracts-check.log) |
| 新正式消费者 | [pack回执](pack.json)：35项通过，旧23项needs_migration精确匹配已审查差异 |
| 旧0.2.2作为实际current | [明确拒绝自动升级](legacy-migration.json)：Interface主版、entrypoint、publicPaths三项迁移原因 |
| 完整重复导出 | [3834文件路径及原始字节完全相同](repeated-export.json) |
| 最终候选共享安装 | [CLI完整性和实际page.project通过](shared-installation.json)，宿主CRLF文件原字节保留，严格候选校验仍拒绝额外根文件 |
| 最终ZIP仓外最小依赖probe | [实际ZIP解包后通过](archive-probe.json)：35条自检、9项负例、35条正式消费通过；旧23条迁移报告保留 |

首次回归发现共享Python资源定位仍用单数路径，已回到作者源`runtime_assets.product_resources`修复；随后完整85项通过。初次未指定锁定Python的生成检查被系统Python缺依赖阻断；指定METRICCANVAS_PYTHON后通过。项目pnpm入口最初触发依赖重装确认，构建使用相同项目脚本；Skill检查通过`pnpm --config.verifyDepsBeforeRun=false skills:repair:check`执行。

## 复杂度与影响边界

Radon6.0.1覆盖本次19个Python变更文件的301个函数、方法和闭包，最高CC12，无超过15项；原始数据见[修改前](complexity-before.json)、[修改后](complexity-after.json)。TypeScript5.9.3 / metriccanvas-ts-ast/1测得`exportRelayReference` selfCC **4→4**，见[前](complexity-ts-before.json)/[后](complexity-ts-after.json)。路径替换涉及的其他函数没有增加分支。

| 函数 | 前→后CC |
|---|---:|
| release.inventory | 5→8 |
| release.file_inventory | 5→6 |
| release.read_interface | 5→6 |
| release.manifest_body / seal / verify | 1→1 / 2→2 / 3→3 |
| compatibility.interface_reasons | 6→7 |
| runtime_assets.product_resources | 3→3 |
| 新增tools_directory / artifact_names | 2 / 1 |

页面Schema字段净增减0，页面引擎与组件行为未改；本次不新增Playground页面，页面知识和独立校验器生成一致性保持，工具移动已运行Skill入口检查。没有采用CRLF摘要归一化、运行时清理缓存或seal--force。

该批关闭M00和M07的本地实施；M01/M05映射与样例、M08 Node路径、M02–M04上下文消费面仍在后续清单。Relay材料用于真实采用及保存/恢复验收，不作为MC开工前置。
