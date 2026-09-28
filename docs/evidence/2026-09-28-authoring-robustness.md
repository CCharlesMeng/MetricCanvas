# Authoring 容错整改与 DS 小范围验证

日期：2026-09-28。基线：`d84ebaa4`。本轮改动保留在工作区，未提交、推送或部署。

## 实际交付

- 页面创建兼容可选展示偏差：缺少 pattern 使用 custom，无效 container/layout/width/purpose 使用已有默认，空可选展示项按未提供处理。已知表格样式选项支持局部默认；未知组件在没有行选择条件时可回落为同字段表格。回执保留 adjustments。
- 页面外层身份、数量和结构仍校验；内容块逐项校验，坏块只产生该块的失败说明，其他块继续保存。查询批同样隔离格式错误项，不删除未知筛选参数。新增数据组件编辑复用展示兼容。
- 维度卡片新增 queryBinding，说明 groupBy 与 filterDimension 的规范输入；补齐增强发现的维度覆盖信息。现有名称/别名规范化仍使用来源证据。
- 公共 metadata_session/read_turn_metadata 与参考 Java Adapter 实现同轮完整元数据共享，支持跨应用实例、MCP 子进程和 CAS。新轮、来源范围或配置变化重新读取；partial 或超限元数据不缓存为完整。
- RESULT_SCOPE_MISMATCH 保持身份隔离，增加准确 /sources/<id> 路径、安全解释和集成核对动作。正确 resultRef 字符串直接用于组装；不存在“必须再注入引用映射”的要求。
- 保存前失败不再永久缓存同请求；保存未知仍保留原提交，不重发。只读瞬断自动重试一次；可重试失败或失联执行可有界重新认领，成功结果不可变。pending 与失败分开，迟到 owner 不返回与持久引用不一致的结果。
- 更新 Skill、工具描述、参考模板、迁移说明、ADR-0092、契约导出锁和测试清单。未覆盖内部自有 adapters 目录。

## 首批验证结果

| 层次 | 范围与结果 | 证据 |
|---|---|---|
| 无模型预检 | pass；9 工具，0 模型请求 | `/tmp/metriccanvas-robustness-20260928-preflight.json` |
| 定向回归 | pass；最终源码 79 项，其中新增容错文件 16 项 | `/tmp/metriccanvas-robustness-focused-final.log` |
| 全量 Authoring 回归 | pass；478 项；其后新增迟到 owner 保护及 pending 分类由上述最终定向回归覆盖 | `/tmp/metriccanvas-robustness-tests-final.log` |
| 确定性故障注入 | pass；创建前注入展示偏差，最终页面及业务断言通过，0 模型调用 | `/tmp/metriccanvas-robustness-20260928-scripted-1/report.json` |
| 真实 DS 正常创建 | pass；deepseek-v4-flash，5 次模型请求、5 次工具调用 | `/tmp/metriccanvas-robustness-20260928-ds-normal-1/report.json` |
| 真实 DS 展示偏差 | pass；deepseek-v4-flash，5 次模型请求、5 次工具调用；8 处偏差由程序吸收 | `/tmp/metriccanvas-robustness-20260928-ds-tolerance-1/report.json` |
| 页面产物 | pass；Schema、期间、指标、单位、精确行数据、图表与表格、保存引用及预览一致性均通过 runner 断言 | 各 case 的 `document.json`、`artifact.json`、`trajectory.json` |
| Platform 类型检查 | pass；svelte-check 0 errors / 0 warnings，tsc 退出 0 | `/tmp/metriccanvas-robustness-platform-check.log` |
| 契约/Bundle/测试清单 | pass；510 product / 4 authoring / 1 interface 导出自洽；1665 digest checks；56 个测试文件恰好分类一次 | 导出器及检查命令输出 |
| 浏览器 | out-of-scope；本次按用户要求做简单 DS 验证，未扩大为视觉与重开取数验收 | 无 |
| 公司 Relay/Java/DQE/撤权联调 | not-run；本地替身不能证明生产接通 | 无 |
| 原线上 RESULT_SCOPE_MISMATCH 根因 | blocked；没有原始部署轨迹，未宣布故障关闭 | 需内部工具回执、稳定轮次和共享存储证据 |

首批 DS 在最终迟到 owner 保护及 pending 分类调整前执行；这些并发分支由最终定向测试验证，本轮没有为了重复正常路径再调用模型。Skill 与 DS 故障注入规则在该调整中没有改变。

## DS 调用与实际 HTTP

| 用例 | 模型调用 | 工具调用 | 元数据 HTTP | DQE HTTP | 保存 HTTP | 耗时 | 总 token |
|---|---:|---:|---:|---:|---:|---:|---:|
| 正常创建 | 5 | 5 | 1 | 1 | 1 | 11.624 s | 115265 |
| 展示偏差 | 5 | 5 | 1 | 1 | 1 | 11.473 s | 115668 |

两个用例都完成了 read_page_context → discover_data_context → query_data → compose_page → page_metadata_emit_preview。两份页面包含 2026-08 各区域 Tokens 请求量：华东 18、华南 12，单位为次；图表和明细共用原查询结果，没有新增 DQE 或引用注册步骤。

故障注入对模型已提出的 compose 参数作受控改动：两个 section 分别去掉 pattern、设置不支持的 container，并将两个数据块的 width 改为 100%、purpose 改为 null。轨迹同时保存 modelArguments、实际 arguments、injectedFaultPaths 与 adjustments；这不是声称模型自然产生了这些错误，也未把预期页面 JSON 提供给模型。

模型本轮没有自然触发 RESULT_SCOPE_MISMATCH。该错误的诊断与同轮直接引用、重启恢复、跨范围拒绝以本地测试为证据，不能把 DS 正常创建通过误称为线上该故障已修复。

## 用例覆盖与剩余工作

新增测试覆盖：展示错误经 MCP 完成、单坏块 partial、引用诊断路径、单坏查询项隔离、完整元数据跨实例复用、不同维度 name/label/id、瞬断重试与成功复用、永久业务拒绝不重试、未知业务属性不忽略、保存前失败后原请求可重试、并发同请求复用、未知组件同字段表格回落、partial 元数据补全及新轮刷新、跨实例失败恢复、过期认领接管、迟到 owner 不暴露本地未提交结果。

续批已实现首次发布前按失败 dataset 补取一次，成功来源不重读。接口只有按 dataset 的最终一致性，合并明确标注 per-dataset，采用内容哈希且不宣称跨 dataset 原子一致。仍有缺口时按本轮固定可用 partial，查询成功域并返回 DATA_CONTEXT_PARTIAL warning；进一步刷新需建立新轮。全失败、超限和缺少覆盖证明的快照不缓存。普通自定义 Adapter 未接入公共快照包装时也继续原读取方式。旧 pending 记录没有 expiresAt 时不自动抢占。

内部部署须吸收 [迁移说明](../../metriccanvas-authoring/AUTHORING-TOLERANCE-MIGRATION.md) 的参考 Adapter 改动，并保证可信取消、访问范围与实时撤权检查有效。公共源码更新本身不会覆盖公司 adapters，更不能证明生产重复读取已消失。

首批按简单验证范围执行两个真实模型用例，续批增加一次组合故障用例，未跑完整 DS 套件、浏览器或生产联调；不能据此给出“完整 DS 模型验收通过”或“生产就绪”结论。后续内部联调应针对原始失败轨迹验收，无需为了本次小范围结论重复运行无关测试。

[容错页面 JSON](/tmp/metriccanvas-robustness-20260928-ds-tolerance-1/create-report/document.json) · [模型与工具轨迹](/tmp/metriccanvas-robustness-20260928-ds-tolerance-1/create-report/trajectory.json) · [正常页面 JSON](/tmp/metriccanvas-robustness-20260928-ds-normal-1/create-report/document.json)

## 续批：仓库可开发项与最终证据

- 实现仅补取失败 dataset、持续缺失时复用可用部分、精确详情继续读取、成功域继续查询/保存、新轮刷新。neutral current() 保持完整要求；私有查询视图只增加覆盖提示，不修改最终页面 Schema。
- 补取传输故障保留成功来源；身份/权限/范围异常不得被局部容错吞掉。查询每次实际执行/重试与执行返回时重新核对授权。
- Skill、ADR、架构与内部迁移清单同步完成。check_data_context 现有自检会输出 partial warnings；不会增加必须通过的新门禁。静态装配检查不能证明内部稳定 binding 和共享存储，采用方仍需实际跨进程验证。
- 确定性全部 6 个创建/编辑用例通过：`/tmp/mc-remaining-scripted-full-1/report.json`。新增 partial＋展示偏差组合故障通过：`/tmp/mc-remaining-scripted-partial-1/report.json`。
- 真实 DS 组合故障通过：`/tmp/mc-remaining-ds-partial-1/report.json`；deepseek-v4-flash，5 次模型/5 次工具、11.745 秒、116388 token。元数据 HTTP=2（补取仅 unavailable-dataset）、DQE=1、保存=1；页面产物与原业务断言通过，查询携带缺口 warning。无模型预检：`/tmp/mc-remaining-preflight.json`。
- DS 后补强的执行授权复核由最终本地回归覆盖；未为此重复模型调用。最初增量补取测试有一处夹具断言错误（不存在的 version 字段），已改为比较完整原成功模型；授权复核测试曾发现底层通用异常封装，已增加返回前复核使拒绝保持明确。失败记录保留在 `/tmp/mc-tolerance-remaining-tests.log` 的先前工具输出及 `/tmp/mc-remaining-focused-final.log`，不作为通过证据。

内部 Adapter 采用、原始生产轨迹复验、真实权限撤销联调仍需要公司环境。代码保持本地未提交/未推送；未运行远端 CI，也未部署。没有将这些事项算作本地测试通过。

最终回归曾与契约重建并行，产生 81 个暂时缺文件的子用例错误（`/tmp/mc-remaining-full-final.log`）。该执行作废；契约生成完成后固定文件树重新执行，使用 `/tmp/mc-remaining-full-final-stable.log` 作为回归证据。

最终验证：全量 Authoring 回归 **482 项通过**（`/tmp/mc-remaining-full-final-stable.log`）；其后修正 coverage.returnedDatasets 不计入实际未返回的 dataset，并补断言，最终定向 **82 项通过**（`/tmp/mc-remaining-focused-stable.log`）。契约与 Bundle 再生成后分别检查，测试清单 56 个文件分类完整，git diff --check 无空白错误。
