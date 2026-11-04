# Relay 四项候选：统一集成验收

日期：2026-11-03。本页记录主控实际执行的集成结果；提供方报告分别保存在相邻 A/B/C 证据目录，不混算通过数。产品四项候选已形成，真实 Relay 接入/自动采用、远端 CI 和部署未执行。

## 来源与可重建输入

- 集成工作树：`/Users/moon/.codex/worktrees/relay-reference-integration/DataDashboard`，HEAD `8b1e09ad62da10e86cc07f9494efd5c4a56a5d7e`；未提交修改。
- A/B/C 起跑基线 `485faa0a0f81f0e882e2ff23f1de5ec672884f88`。其后五个 data-execution pagedJoin 引擎文件与本批源文件不重叠。A28/B17/C23 的目标旧 blob 与提供方基线一致，复制前后 SHA 校验见 [carried-sources.json](carried-sources.json)。
- A 场景/协议补充及 I08a 百分比文档/页面由主控按明确范围携入；全部派生契约、Content、Skill、锁和摘要在本树从真源重建，未复制旧产物/手改摘要。
- 本树执行 `pnpm install --offline --frozen-lockfile --ignore-scripts`，下载0；使用本地 node_modules，无共享根依赖回退。pnpm锁摘要及精确平台见 [Embed归档回执](embed-archive.json)。
- 产品构建与Python测试使用已有锁定Python3.12环境；四项目标运行仅要求Python>=3.12、Node>=22及发行内六个精确Python依赖。构建/测试环境的FastMCP等不是四项运行依赖。

## 可用候选和稳定消费面

[发行回执](release-receipt.json)记录两次完整导出、四项归档和SHA。候选 `/tmp/mc-relay-integration-20261103-r6`；归档 `/tmp/mc-relay-reference-0.1.0-55b2c4826170.zip`；Interface1.0.0 / release0.1.0 / 默认页面Schema6.82。

releaseId `55b2c482617005e95c353523b8e8926b8db538e5872bb06362cde28edd00f9ff`。最终r6与r7共3675个文件（含清单），路径和字节逐项相同，归档逐项哈希与候选一致。顶层严格 `mc-content/`、`mc-content.md`、`mc-tool/`、`mc-tool.md`。

稳定入口 `mc-tool/cli.py` 提供describe/check-release/self-test/invoke；实际13操作以Interface为准。[候选发行自检](candidate-self-test-final.json)23条通过，包含预期业务拒绝样本；status=error的负例并非自检失败。产品操作无网络/保存副作用；在线旧MCP参考有明确迁移归属说明。

## 本树验收

| 层 | 本次结果 | 证据 |
|---|---|---|
| 产品包 |五包构建成功 |构建工具回执；最新生成输入为当前源树 |
| 四项发行 |42/42通过；真实产品facade、仓外、禁网、仅声明依赖、-I/-S、缺文件/依赖、冻结消费者、内部移动、更新/显式恢复回放 |[distribution-final.log](distribution-final.log) |
| Python核心 |79/79通过；显式资源、变换/参数/百分比及原Platform V2相关包装 |[python-core.log](python-core.log) |
| TS核心 |3文件47/47通过；扫描/范围、页面五操作和评估上下文 |[typescript-core.log](typescript-core.log) |
| Page类型 |产品/测试tsc通过 |[page-typecheck.log](page-typecheck.log)，会话69038退出0 |
| Content |官方契约一致、来源覆盖、52/52测试及诊断fixture检查全部通过 |[content-final.log](content-final.log) |
| Skill |完整skills:check通过：repair类型/16项；local-authoring及导出隔离6文件234项；耗时1296.66秒 |[skills.log](skills.log) |
| 新页面浏览器 |日期/月输入与文本联动，1280/390；UTC/Honolulu两系统区下显式Shanghai/LA业务区结果完整一致；百分比五行/格式/排序/目录入口通过 |[evaluation-browser](evaluation-browser/browser.json)、[percent-browser](percent-browser/browser.json)，包含截图 |
| Embed |构建/独立check:dist、类型通过，浏览器246/246，实际npm归档逐文件字节一致 |[embed-browser.log](embed-browser.log)、[embed-dist.log](embed-dist.log)、[归档回执](embed-archive.json) |
| ADR/工作区 |索引生成/check通过，git diff --check通过 |只处理本批文件，不提交/清理其他脏工作 |

Embed为macOS原生本地构建：14个JS，最大`chunks/excel~exceljs.min-CSE3Njtv.js`为929901原始字节；两稳定入口、静态/动态依赖闭包和复制目录ES/global浏览器回归通过。归档不是发布，Windows/Linux原生CI未运行。

## 复杂度与行为保持

统一口径：TS为`metriccanvas-ts-ast/1`、TypeScript5.9.3；Python为Radon6.0.1。提供方逐函数/闭包证据已携入相邻目录；本树固定Python门禁373函数，最大15、违规0，见[complexity-gate.log](complexity-gate.log)。

- A时间职责：`validateTimePointValue`14→13、`timeFilterBoundaryError`25→12、`materializePageParams`27→11，新辅助函数均<=15。`parsePage`23→23、`resolvePageParams`35→35仅增加可选上下文透传，保留风险更小的原分支；此例外不视为债务已清零。未改的`parseCalendarValue`22、`changedParamSourceIds`16和checkAnalysis旧匿名函数19继续列为存量。
- B提取：查询33→10、compose42→1（candidate13）、edit34→5（candidate3）、Lifecycle.saved19→9；154个相关函数/闭包均<=15。有序诊断、输入不变、回执冲突/保存未知及原包装委托有专门回归。
- C发行132个函数/lambda最大11，exportRelayReference4；原`buildSkillProjections`52→52属于未改职责。root runtime_assets.bundle_root6→8，新辅助3。
- 主控编码overlay：export.py/relay_content.py只显式UTF-8和LF，没有新增分支；[before](encoding-before.json)/[after](encoding-after.json)逐函数CC相同、最大11。`page-conformance-sources.ts`只加入示例列表，原辅助4→4。[浏览器4个回调](browser-complexity.json)自身CC均1；百分比回调1→1。来源manifest和主控overlay分别记录，未篡改三线冻结清单。Content指南另补14类实际资源路由/模块职责和两种创作路径，样例ID逐项对索引核对，见guide-adjustment.json；纯文档无可执行分支。

## 首轮失败与证据限制

1. 正式生成r1因主控新增H2的语义索引顺序不符被拒；按实际Markdown顺序修复，保留旧顺序一致性守卫后r2/r3成功，日志保留。未放宽生成校验。
2. Content首轮使用系统Python3.14，缺jsonschema，属于运行环境失败；r2切换锁定Python后又与主控r3导出重叠，复制测试读到替换中的文件，该次无效。生成结束后串行执行r3检查以排除环境/并发干扰，原失败日志保留。产品未为这些环境/并发错误修改业务断言。r3的52项通过后，fixture检查发现旧页主题计数231尚未更新为234及证据摘要漂移；官方生成器刷新唯一页面计数与相关证据，未改断言。r4/r5重新生成且字节相同，二次fixture刷新只改证据，全部公开构建输入与source-identity逐项相同。最终命令见content-final.log。r2-r5属于未发布的开发候选，回执独立保留。补全Content指南后，从已验证的同源Content/契约输入调用相同exportRelayReference，分别生成最终r6/r7，不重写共享产品输出；两次字节全同，较r4仅mc-content.md及release.json两项改变，实际工具/Content全部字节未变，候选自检再跑23条。最终ZIP还实际解压到仓外目录，-I/-S、仅六个声明依赖且无本仓wheel/httpx/FastMCP，全部23条自检通过，见archive-standalone.log。
3. 百分比浏览器首轮在首次模块冷加载时5秒内无表格；保留原日志，加入30秒可见性等待后宽窄屏所有行为断言通过；未改期望值或页面渲染逻辑。
4. 提供方旧广域Python回归仍有存量失败，未将其当全绿：B194项191通过，3项在485原源码逐项复现；A旧page_validation有75失败子项及18错误，只独立核对3类代表性旧基线。上述不与本树79项定向通过混算。未宣称全仓Python/全仓类型检查通过。

## 真实采用的剩余任务

MC兼容比较成功仅输出eligibleForSmoke；automaticPromotion固定false。产品级两次兼容/跳跃更新及显式恢复不证明真实Relay已完成原子切换、重启/缓存、在途轮次、CAS、单次保存或unknown恢复。

真实Relay仓需要接固定入口、身份/轮次供给、发现与DQE、状态/CAS、Java单次保存/unknown恢复和前端交接；然后执行包装fixture、最早支持版/最后采用版回放、真实服务与部署证据。旧在线实现暂留，接收清单明确且验收后才按allowlist退役。本树和A/B/C来源工作树均有未提交必要内容，保留；未执行commit/push/CI/部署或工作树清理。
