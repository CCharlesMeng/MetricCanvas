# IOC Header 验收与交付

实施原基线为 `552ef5c1228ce292ad9a2ec66673fa82e1c67ba4`；交付工作树 `ioc-header-main-delivery-8768` 承接远端 main `383364b40`。原工作区的并行修改未改动。两个审批页已与 main 的原件逐字核对一致，另外两个审批页承接冻结原件。

## 交付范围

- 8个已有 IOC Header 页、37个查询分支绑定中文 `地区部` / `代表处`，6页28处客户筛选（含 NA 类型）统一绑定 `客户级别`；全球层级沿原字段和值契约。
- 重点国代勾选后覆盖 Region 的执行投影，完整授权名单不受当前 Region 限制；取消后恢复保存的 Region。未接名单时拒绝查询，完整空名单正常返回空结果，失败、拒绝和取消阻断初始化。
- 接入示例通过既有候选端口装载完整中文名单并填充各查询分支，不增加 embed 公共 API；真实上游数据格式仍由接入方确定。名单准备、候选门禁、查询、列候选、初始行、缓存和完整导出保持同一范围。
- main 已占用 6.81–6.83，故本批声明使用 **Schema 6.84**；净增 `boolean.overridesFilters`，既有 `whenTrue:[]` 表达完整空名单。内部 `matchNone` 不进入 DQE 请求体。local-authoring 同步为 **1.22.0**，契约及知识从合并后的产品真源生成。
- 查询体、响应字段、initial 行保持；商务明细的代表处参数用于 Region 初始化。概览表跳清单时 Region 改传已有的代表处名称字段；除此之外正文保持。无公共页头的项目详情未迁移。
- 旧演示宿主补齐中文区域/客户字段的合成后端映射、完整重点名单接线及初始化错误展示；这些不代表真实业务数据源支持。

## 验证

- 最新基线的运行时、页面协议和数据执行覆盖221文件、1996项；首轮1989项通过，7项因版本断言/生成快照更新后，所在4文件重跑通过。
- local-authoring、升级、参考及 embed 分块专项合计298项通过；另验收独立公开面快照。新增当前首分区 IOC Header 外壳的桥接回归通过（桥接与公开面合计17项），完整111项 DQE Sim 回归通过。
- 浏览器：embed完整266项通过，覆盖ES/global、复制目录、Webpack development/production和重点国代；桥接兼容首分区页头后5项重点场景再次通过。Playground实际运行5项重点场景通过。Skill整目录复制到仓库外，以Schema6.84校验两份完整页面通过。
- 生成一致性、MC完整来源覆盖与52项MC Python测试通过；完整 `mc:content:check` 使用锁定venv及禁止写字节码的环境。
- embed 构建、独立 `check:dist`、类型检查通过。16个 JS，最大 `chunks/excel~exceljs.min-CSE3Njtv.js` 为 **929901字节**；ES入口3081字节、global入口1059字节。实际 npm归档 `/tmp/ioc-header-embed-release/metriccanvas-embed-1.0.0-rc.4.tgz` 包含完整16个 JS、图片及模块声明，逐文件均≤1000000字节。
- embed 与 Playground Svelte检查无错误/警告，测试 TypeScript检查通过；178个页面文档全部校验通过。仓外 Skill、生成契约和 MC证据不替代真实服务验收。

## 复杂度

用 `metriccanvas-ts-ast/1`、TypeScript5.9.3逐函数 selfCC，闭包和回调分别计数；HTML/Svelte抽取真实script段。最终合并源码相对交付main基线实测：

| 函数 | 前 | 后 |
| --- | ---: | ---: |
| composeEffectiveQuery | 10 | 14 |
| createCandidateValidator.verifyFilter | 30 | 15 |
| createFilterState.blocked | 29 | 25 |
| SourceProgram.defaultConditions | 3 | 5 |
| SourceProgram.untrustedSeed（外层自身） | 1 | 1 |
| scenarioEnvironment | 15 | 15 |
| tablePreview | 8 | 10 |
| Playground loadPage | 9 | 11 |
| parsePage | 23 | 23 |
| 新增 prepareIocHeaderFilters | — | 5 |
| 新增成员校验 validMember/memberNames | — | 8/7 |
| 新增 requestCandidates/propagateBlockedFilters | — | 13/6 |

全部新增函数自身≤15。`blocked`保留25分，原有必选、结构树、候选回执及交集确认逻辑未扩大重构；其余存量超限函数自身保持，包括 parsePage23、selection22、validFilterCandidates17、gatewayNormalizationError16、createFilterState17、commit42、validShape18、matchesDeclaration17、parseCalendarValue22、buildSkillProjections52和原有测试回调。交付阶段补齐的演示 Adapter 函数一并测量，未增加存量超限函数复杂度。完整报告及原件随任务验收证据归档。

## 证据边界

本地测试、浏览器、合成 Adapter、归档及独立 Skill为本仓证据；未验收真实 Operation Map、HeaderOptionService、DQE/Relay、组织名单、权限或部署。CI仅以远端本次提交的实际完成结果为准。

## CI 修复回验

首轮提交 `3db1694c3` 的类型门禁发现新增参数化测试把数组展开成了位置参数；改为对象用例，分别验证缺失、非维度与重复引用，11项通过。整仓 `pnpm check` 通过。仓外消费者缺少本批新增的合成后端模块，已补入完整复制清单并执行真实内容服务闭合回归。两处修复不改变产品执行行为；测试回调 selfCC 1→2，复制函数 selfCC 2→2。最终CI以修复提交回执为准。

第二轮CI确认类型、构建、两平台embed分发及完整仓外消费者验证通过；全量测试4216项通过、5项跳过，另两项Playground断言/页面中立性检查失败。已更新新增审批页数量，并将Region预览的层级差异移至夹具类别，产品源码不再按业务页面ID分支；两文件7项回归及Playground类型检查通过。该修复 `scenarioEnvironment` selfCC 14→15，`queryTableGateway` 9→11，`previewDataGateway` 15→14。

Relay发行仍由Schema6.83冻结消费者拒绝本批Schema6.84：`needs_migration`，正式35条回放中13条差异，`eligibleForSmoke:false`。这是未关闭的消费者升级评审/适配边界，未改写旧冻结样本、批准记录或放宽门禁。真实Relay激活未验收。

交付前再次承接main `0757e83f3` 的并行复杂度治理，未覆盖其72个文件改动。合并后91文件589项受影响回归通过，契约导出仍一致，全项目复杂度门禁通过。上表保留本批原实施基线的历史测量；当前filterState的 createFilterState / blocked / commit 已随main治理降为2 / 7 / 6，不再把原blocked25列为当前剩余项。其他存量以main复杂度台账及门禁实测为准。

最新main基线的embed重新构建及28项接入/导航/重点国代浏览器场景通过；实际归档 `/tmp/ioc-header-embed-merged-release/metriccanvas-embed-1.0.0-rc.4.tgz` 复核16个JS、最大929901字节。

## “全球”补充口径与最终合并验证

用户补充确认：**仅名为“全球”的节点不限；中国/海外等节点仍按选择过滤**。IOC Region 的规范值为 `全球`，装载示例将上游 `WORLD/全球` 及对应父引用归一；旧编码 URL 仍须接入方用真实字典转换。未归一的全球候选编码在业务查询前阻断。屏幕、下游候选约束、初始快照、缓存种子和完整导出共享该规则；月份、客户级别、固定条件和权限继续生效。未增加 Schema 字段；Schema 仍为6.84，local-authoring升为1.22.2。

本轮承接main `d63a6ce93` 后运行：

- 245文件、2126项页面协议/执行/运行时/Sim回归通过；70文件、369项Runtime UI和Playground回归通过。
- 整仓 `pnpm check` 通过；新增浏览器测试对应的embed与Playground测试TypeScript检查通过。
- 45项embed接入回归通过，覆盖ES/global、复制目录、Webpack开发/生产及旧交集和重点优先场景。
- 新增3项embed浏览器场景通过：全球+月份+客户的查询/XLSX及重点覆盖；业务清单原生HTTP无Region谓词且保留月份，首屏5行、完整XLSX10行；中国R99与亚太TBD-APAC仍发送各自geo谓词。业务原页没有导出按钮，导出探针仅在测试装载文档中启用现有table.toolbar.export，未改业务页交互声明。
- Playground新增1项浏览器场景通过：全球+月份+客户显示上海/广州，重点勾选仅上海、取消恢复；实际下载XLSX。
- 独立复制local-authoring1.22.2至仓库外，两份完整演示页均用Schema6.84校验通过。
- 重新构建、分发门禁及实际tar包检查通过：16个JS，最大929901字节，归档 `/tmp/ioc-global-embed-release/metriccanvas-embed-1.0.0-rc.4.tgz`。

本轮AST口径仍为metriccanvas-ts-ast/1、TS5.9.3，新增回调逐一测量。composeEffectiveQuery14→15，overridesSource2→3，preparedQuery6→7，legacyConstraints5→6，cascadeConstraints6→7，candidateTimeContext1→1、新增filterCandidateContext2，iocRegionCandidates5→7；新增isUnrestrictedIocRegion6、validateGlobalRegionNames4、normalizeIocRegionCandidates1（内部canonical2，其余回调≤2）。全部新增函数≤15；同文件未修改的存量超限保持，全项目复杂度门禁通过。完整逐函数前后记录随任务证据归档。

此前CI的MC诊断夹具漂移及Relay6.83冻结消费边界，已由后续main中的独立修复与已评审6.84消费基线承接。本批没有重写其批准记录。最终CI以本轮push后的SHA回执为准；本地一次MC检查因生成的Python字节码缓存被正确阻断，清除本任务缓存后使用PYTHONDONTWRITEBYTECODE=1重跑。

最终又承接main `3cf712bb5` 的Relay消费者断言及MC夹具修复，重新生成当前来源回执。完整embed浏览器检查发现页头候选上下文中的Svelte页面代理误入表格候选复制，已将时间上下文与页头上下文分开；原有表头候选、双实例导航与全球相关9项回归通过，随后执行完整浏览器复测。

修复后的完整embed浏览器273项全部通过，Playground全球场景再次通过，Runtime UI49文件239项回归通过，整仓类型和最终复杂度门禁通过。最终embed归档 `/tmp/ioc-global-embed-final/metriccanvas-embed-1.0.0-rc.4.tgz` 复核16个JS、最大929901字节。

提交47b56e202的CI中，types、全量测试、build、两平台embed分发、Relay发行/两平台分发及authoring均通过。仓外消费者578项中576项通过，Chrome/Edge的同一新增导出测试因工作目录变化读取不到夹具失败（ENOENT）；改用import.meta.url相对测试文件定位，避免依赖进程cwd。从仓库根目录启动同一组3项浏览器测试通过，测试类型通过；原生HTTP和XLSX断言保留，测试回调selfCC4→4，不涉及产品源码或Schema变更。修复后的完整CI以新提交回执为准。
