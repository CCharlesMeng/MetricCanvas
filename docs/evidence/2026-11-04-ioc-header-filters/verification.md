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
| scenarioEnvironment | 15 | 14 |
| tablePreview | 8 | 10 |
| Playground loadPage | 9 | 11 |
| parsePage | 23 | 23 |
| 新增 prepareIocHeaderFilters | — | 5 |
| 新增成员校验 validMember/memberNames | — | 8/7 |
| 新增 requestCandidates/propagateBlockedFilters | — | 13/6 |

全部新增函数自身≤15。`blocked`保留25分，原有必选、结构树、候选回执及交集确认逻辑未扩大重构；其余存量超限函数自身保持，包括 parsePage23、selection22、validFilterCandidates17、gatewayNormalizationError16、createFilterState17、commit42、validShape18、matchesDeclaration17、parseCalendarValue22、buildSkillProjections52和原有测试回调。交付阶段补齐的演示 Adapter 函数一并测量，未增加存量超限函数复杂度。完整报告及原件随任务验收证据归档。

## 证据边界

本地测试、浏览器、合成 Adapter、归档及独立 Skill为本仓证据；未验收真实 Operation Map、HeaderOptionService、DQE/Relay、组织名单、权限或部署。CI仅以远端本次提交的实际完成结果为准。
