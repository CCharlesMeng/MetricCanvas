# MetricCanvas → Relay 初步对接可用性报告

评估日期：2026-11-04。范围：本仓离线产品能力、四项分发、同源知识与本地测试。来源工作树为 `/Users/moon/.codex/worktrees/relay-reference-final/DataDashboard`，产品源码基线 `e31ccd6c6465d8afd2e618923fbd68c60f60a8c2` 加本任务清单内改动；用户原工作目录中的并行修改不属于本结论。

## 结论

**可以交给 Relay 做初步对接和分析，并开始离线进程调用、资源读取和候选页面流程验证。** 产品能力及稳定入口已经实现，本地完整回归通过，四项可独立运行；不需要 Relay 安装本仓 wheel、构建前端或读取仓库其他目录。

**目前不以此报告宣布真实业务联调或生产采用完成。** MCP 装配、可信身份/轮次、真实发现与 DQE、结果查找、工作状态/CAS、Java 保存、unknown 恢复和前端交接由 Relay 实现。需要真实 Relay 包装冒烟及其采用/回退证据之后，才能关闭这些项目。

用户已确认首次正式基线使用 **Schema 6.83**。这是第一次采用的新基线，不是将旧6.82候选伪装成无差异升级。旧0.1/6.82的固定消费样本保留：对6.83实际23调用有8条完整回执变化，比较器正确给出 `needs_migration`，禁止静默覆盖已有采用批次。

## 交给 Relay 的内容

运行目录顶层固定为以下四项，普通更新整批替换：

| 内容 | 用途 |
|---|---|
| `mc-content/` | 页面协议、组件、查询和创作知识、模板、示例、错误索引及机器契约 |
| `mc-content.md` | 资源路由、模块职责、页面先行/数据先行的读取指导、边界说明 |
| `mc-tool/` | 预构建Node程序、封闭Python实现、实际Interface、发行清单与固定CLI |
| `mc-tool.md` | 调用方法、输入/输出、退出码、任务路由与Relay职责 |

所有实际操作以 `mc-tool/interface.json` 为准。统一调用 `mc-tool/cli.py`，不要导入私有Python模块或执行私有JS文件。旧 `tool:*`/9个MCP来源图属于迁移参考；当前离线能力通过 `runtime:offline-interface` 查找。

归档与同名 `.release.json` 是交付和验真的载体；运行时只需解包后的四项。可用性报告、构建侧测试与消费样本不作为第五项运行依赖。

交付包为 `metriccanvas-relay-reference-0.2.2.zip` 与同名 `.release.json`，SHA/字节数/源码提交身份均以同批来源回执为准。首次6.83评审样本固定在0.2.0，冻结预期不改。首轮0.2.1的macOS与Linux producer归档完全同字节，Linux原生消费通过，但Windows消费暴露默认编码问题；0.2.2在实际Python闭包的13处资源读取与6处Node文本通道显式指定UTF-8，新增实际四项在CP1252默认环境下的隔离回归，先红后绿。没有使用PYTHONUTF8变量掩盖隔离模式问题。

当前交付版本：release0.2.2、Interface1.1.0、Schema6.83。正式候选四项位于 `/tmp/mc-relay-reference-0.2.2-final`，对接交付目录为 `/Users/moon/Documents/Code/公司项目/DataDashboard/deliverables/relay-reference-0.2.2/references`，releaseId `6d7b466b5bd49ce9ff4ed8b5d07be26123ea927c438bd0bb6619017d1b89e915`；3834文件。实际19个操作如下。

| 任务 | 操作与限制 |
|---|---|
| 读取知识/契约 | `content.read`；按topic/key取原子或参考，保留超预算/续读信息 |
| 页面读取/校验/升级/参数 | `page.project`、`page.scan`、`page.validate`、`page.upgrade`、`page.parameters`；时间敏感输入必须有明确evaluation |
| 查询与供给结果 | `query.prepare`、`results.normalize`、`results.normalize.v2`、`results.check`；仅处理显式材料/已供给证据，不查DQE |
| 页面装配/编辑 | `page.compose`、`page.edit`及两项`.v2`；新任务优先v2，保留旧操作默认行为基线的历史证据 |
| 关联/普通换源/呈现 | `page.analyze`、`page.rebind`、`page.presentation`；完整基线、共享消费者核对，拒绝半改或不可证明等价的替换 |
| 工作/回执规则 | `work.check`、`receipt.check`；一致性判定，不执行权限、CAS或保存 |

受控多槽支持显式来源/字段/行键/期间/完整性；主槽部分结果只在证明第一查询窗口等条件下启用查询分页。辅助空结果0/0合法，缺匹配留空；重复/空/错误类型键、失败/未知完整性和不匹配期间明确拒绝。普通换源先支持inline/单分支query到query；复杂计算、动态分支、按父行执行等无法证明等价的依赖明确拒绝，不宣称所有合法页面均可自动装配/换源。

Tokens百万与最终字段绑定检查属于创作政策；原始数值保持，合法金额百万仍受引擎支持。检查仅有data-only证据，真实轴、标签、Tooltip和页面交互仍需运行时预览。

## 已取得的证据

全仓TypeScript、类型和浏览器证据基于3846ba52c；0.2.2仅改Python编码边界，所有6个预构建Node文件及完整Interface与0.2.1逐字节相同，因此复用上述相同输入证据。受影响Python、发行、Skill和同源知识重新验收。测试数量存在覆盖重叠，不相加作为独立覆盖率。

| 层次 | 实际结果 |
|---|---|
| 全仓TypeScript测试 | `pnpm test --maxWorkers=2`：453文件通过，4184项通过，5项跳过，无失败 |
| 全仓类型 | `pnpm check`通过；Svelte零错误/警告；后续测试修复另行noEmit通过 |
| 受影响产品/时间/表格/隔离/CI结构 | 10文件118项通过；完整有序错误、输入不变、原子拒绝、仓外Node等覆盖 |
| 本地Skill | 204项通过；独立完整目录/知识/脚本/页面校验；Skill1.21.1官方打包与仓外回验通过 |
| 常规repair入口 | 16项通过，未追加真实模型专项验收 |
| Python产品核心 | 99项通过，含新呈现与多槽回归 |
| 发行工程 | 带实际0.2.2候选运行81项全部通过、零跳过；首次采用与真实current迁移门禁均实际运行；新增实际四项CP1252隔离回归；CI结构8项前批复验通过 |
| Playground新场景 | 3项Chrome通过；宽窄屏、共享消费者、同名跨槽列、百万Canvas/真实Tooltip |
| Embed浏览器 | 261项通过，含ES/global、完整目录复制及Webpack接入 |
| Embed构建/实际归档 | 14个JS，最大929901未压缩字节，全部≤1000000；公共入口和分块闭合门禁通过 |
| 四项确定性 | 两次实际导出3834个文件路径及原始字节完全相同，releaseId一致 |
| 目标环境隔离 | 仅6个声明依赖、仓外cwd、`-I -S`实际35自检和9项负例通过；未安装本仓wheel/HTTP客户端/MCP服务 |
| 旧消费保护 | 固定0.1样本SHA不变；6.82开发候选23调用全通过；6.83对旧样本真实返回needs_migration，未将差异改写为通过 |

原始日志、JSON和截图保存在本批本地证据目录；仓库按约定只交付精简结论和必要决策材料。远端CI的原生Linux/Windows结果、最终源码提交及交付归档身份由本次发布回执/提交检查记录提供，本报告不把CI接线当作CI通过。

## Relay本地起步流程

### 1. 首次准备环境

需要Python3.12+、Node22+；本机已在锁定Python3.12环境和Node24运行验证，最低Node22/Windows/Linux以原生CI为独立证据。六个Python依赖版本由包内 `mc-tool/requirements.txt` 声明。

```sh
python3.12 -m venv /tmp/mc-relay-runtime
/tmp/mc-relay-runtime/bin/python -m pip install -r /absolute/relay-reference/mc-tool/requirements.txt
export PATH="/tmp/mc-relay-runtime/bin:$PATH"
cd /absolute/relay-reference
```

Windows使用虚拟环境的 `Scripts/python.exe`，Node加入PATH。首次安装依赖是环境准备；普通更新不重新安装，只在声明的运行要求变化时另做环境升级。

### 2. 检查四项、实际能力与自检

```sh
python -B mc-tool/cli.py check-release
python -B mc-tool/cli.py describe
python -B mc-tool/cli.py self-test
```

三项均应退出0。`check-release`只证明结构和摘要；必须继续运行self-test。`describe`返回真实19项操作及Schema，不从旧MCP列表猜工具名。任意缺文件/篡改/缺Node或依赖均应被拒绝。

### 3. 测一次真实资源读取

```sh
python -B mc-tool/cli.py invoke content.read <<'JSON'
{"format":"metriccanvas-mc-request/1","requestId":"relay-read-1","input":{"topic":"runtime","key":"offline-interface"}}
JSON
```

JSON回执应保留同一requestId；再按任务读 `knowledge` 的 `authoring.analysis`、`authoring.rebind`、`authoring.presentation`、`authoring.multislot` 等主题。只改标题/列宽不要求全量数据报告。

### 4. 测一次页面校验

下面这份实际调用已在当前四项候选上执行通过，不需要业务接口：

```sh
python -B mc-tool/cli.py invoke page.validate <<'JSON'
{"format":"metriccanvas-mc-request/1","requestId":"relay-initial-validate-1","input":{"document":{"schemaVersion":"6.83","id":"relay-local-smoke","layout":"dashboard","dataSources":{},"sections":[{"id":"main","components":[{"id":"note","type":"text","layout":{"span":12},"props":{"body":"本地合成验收"}}]}]}}}
JSON
```

预期 `status:"ok"`、`data.ok:true`、`diagnostics:[]`、退出0。将document改为null应退出2并有诊断；移除Node后self-test应退出3。产品 `partial` 也可能退出0，所以调用方必须看JSON状态与诊断，不能只看退出码。Interface的inputSchema校验请求input，outputSchema校验ok/partial的data；error以稳定信封及诊断处理，不能假定存在成功候选字段。

### 5. 接入第一个Relay流程

先接“读知识→校验现有页”与“供给合成结果→v2装配候选”两个无保存流程，再接真实结果。Relay程序负责提供完整文档/可信结果、轮次和evaluation；所有候选中的 `execution:not-run` / `saveStatus:not_requested` 均不得当作查询或保存成功。MCP注册与真实保存最后接入，unknown状态不由模型自行重试。

## MC维护者的完整本地测试

目前可直接使用最终工作树和已经准备好的锁定Python环境：

```sh
cd /Users/moon/.codex/worktrees/relay-reference-final/DataDashboard
export METRICCANVAS_PYTHON=/Users/moon/Documents/Code/公司项目/DataDashboard/metriccanvas-authoring/tool/.venv/bin/python
export PYTHONDONTWRITEBYTECODE=1
export METRICCANVAS_RELAY_CANDIDATE=/Users/moon/Documents/Code/公司项目/DataDashboard/deliverables/relay-reference-0.2.2/references
pnpm relay:test
pnpm relay:core:test
pnpm test --maxWorkers=2
pnpm check
pnpm mc:content:check
```

新机器先按仓库锁文件准备Node/pnpm与Python构建依赖，构建侧使用完整 `requirements.lock`；目标端仍只要前述六依赖。页面浏览器另运行：

```sh
pnpm build:packages
pnpm --filter playground exec svelte-kit sync
pnpm --filter playground exec playwright test tests/authoring-analysis-rebind.browser.ts tests/authoring-multislot-presentation.browser.ts tests/relay-multislot-presentation.browser.ts
pnpm test:embed
```

Playground入口 `/pages/authoring-analysis-rebind`、`/pages/relay-multislot-presentation`，均为合成数据。普通换源产生的query候选需真实取数环境才能验其业务数据，不能用原inline页面的呈现替它背书。手工预览可运行 `pnpm dev:playground`，打开终端实际打印的本地地址。

构建一个全新候选、打包和仓外回验：

```sh
pnpm relay:build --output /tmp/mc-relay-local-candidate
pnpm relay:replay --candidate /tmp/mc-relay-local-candidate
pnpm relay:pack --candidate /tmp/mc-relay-local-candidate --output /tmp/mc-relay-local.zip
pnpm relay:verify --archive /tmp/mc-relay-local.zip --probe
```

目录和归档路径必须尚不存在。正式/历史基线由版本化配置区分；历史6.82的needs_migration会如实保留在发行证据中。对已采用版本应另外提供 `--current /absolute/current`，任何实际当前批次不兼容都必须拒绝，不受首次采用记录豁免。两次构建比较全部路径/字节；不允许修改原冻结预期、手改清单哈希或用force绕过。

## 初步对接验收清单

Relay可以在本地先完成：读取两份指南；登记19项实际Interface；check-release/self-test；消费资源与完整有序诊断；无保存的页面先行/数据先行候选流程；明确部分/空/失败结果；验证局部编辑保留人工配置和非法换源原子失败。

正式联调还需逐项补证据：真实MCP注册、可信身份/轮次和权限、真实DQE请求/响应、结果归属核验、版本竞争/CAS、Java单次保存/unknown恢复、精确产物前端呈现；最后是完整批次原子采用、缓存刷新、重启/在途轮次与显式回退。未取得接收/采用清单前不提前删除旧在线实现。

## 复杂度及保留项

使用metriccanvas-ts-ast/1（TypeScript5.9.3）与Radon6.0.1逐函数自身CC计量，含辅助函数/回调。A关联入口6/换源6；原checkAnalysis19→6并拆helper8/7；共享resolver6→6；列身份3→3；主控buildAuthoringOutputs7→7/buildInputSources6→6；固定Python376函数max15；发行聚合增量共259函数/lambda，max12，replay_all4→1、verify_or_extract11→6、新inspect_product5。新增函数均≤15；除下列明确登记的存量例外，修改函数均≤15。

存量 `buildSkillProjections` 52→52未关闭：此次只扩展同类固定生成列表，未新增分支；更大注册器重构另行处理。未改validate_plan24仍属原存量。完整口径及来源见本批complexity-summary。未取得真实模型/真实服务证据，报告不据此推断业务正确率或模型token收益。

## Windows修复与版本追溯

0.2.1首轮CI不能作为跨平台通过：Windows消费失败，其余未完成任务已取消。0.2.2保留19项接口和全部冻结预期，仅修正UTF-8传输/资源读取；固定0.2.0消费与真实0.2.1 current仍须通过，历史6.82仍明确needs_migration。仓库中的[UTF-8证据](../2026-11-04-relay-windows-utf8/README.md)记录先红后绿、精确错误与测量。新增隔离回归CC2、bootstrap lambda CC1，既有相关函数CC均不变，Schema字段净增减0。完整源码身份、原生CI与最终归档探测结论以同批交付资料补充。

本次编码边界存量例外：`text_map_building.add_map_chart` CC21→21，仅将地图JSON资源读取显式为UTF-8，未改组件装配和校验分支；为避免扩展这一跨平台修复的行为面，本次不拆分，后续在该函数承接地图资源/组件装配职责分离时关闭。Node桥 `_checked_program` 4→4、`validate_with_resources` 10→10、`validate_with_node` 11→11、`edit_presentation_with_node` 8→8；新增隔离回归2、bootstrap lambda1。之前buildSkillProjections52→52仍按原记录保留。
