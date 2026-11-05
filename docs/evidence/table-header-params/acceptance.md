# 表头参数初始化本地验收

2026-11-05。实现基线：`cbba8e94f366e0acd6041419ebc19bc1771f0e9d`（当时最新 origin/main，含静态默认值 6.82）。工作树 `/Users/moon/.codex/worktrees/table-header-param-initial/DataDashboard`，未提交、未推送。Schema 6.85；local-authoring 1.23.0。pnpm-lock.yaml SHA256：`d2c2a6ca0a914225ccdac58b2457c9332c3bf7988929c054c1945654e7a8bd73`。

本批只实现 select 表头的页面字符串维度参数初值和显式全选语义；净增 initialParam、allBehavior 两个可选属性，删除零个。参数、TableQueryView、DQE HTTP 和公开 execute(metadata) 接口保持原形状。区域未选时的 execute 门控不属于本批。

```json
{
  "field": "is-valid",
  "enumValues": [{"value":"是","label":"是"},{"value":"否","label":"否"}],
  "filterable": {"mode":"select","initialParam":"is-valid","allBehavior":"unrestricted"}
}
```

页面同时声明 `params.query.dimensions:[{"id":"is-valid","dim_name":"是否有效意见","required":false}]`。初值进入既有 TableQueryView；TableSession 持有后续已提交选择。用户清空后不再消费初值；全选不限归一化发生在组合成员检查前。永久同目标参数控制被拒绝；独立业务条件保留。

## 功能到证据

| 领域 | 实现与验收 |
|---|---|
| Schema/参数 | 版本、互斥、分组维度引用、静态 main、类型、字典、重复控制、消费者与反例向量；普通详情浮层沿用只读限制，拒绝表头初始化，另有精确路径反例；packages/page/tests/table-header-params.test.ts |
| 浏览器本地/远程会话 | runtime/tests/table-header-params.test.ts；首请求、可选缺席、保存值、显式空恢复、全选、清空、待定门控、取消和迟到响应 |
| 组合与快照 | data-execution/tests/table-header-params.test.ts；完整 pagedJoin 全域过滤/导出、查询分页、成员能力拒绝、后续操作成员覆盖、pagedUnion 常量投影、参数变化失效 |
| ordinary initial/回执 | 有能力声明但无值仍保护；无视图证明不复用；Node 不写出普通已筛选 initial；原静态默认值测试保留 |
| 参数提取 | 表头消费者可读，apply 空选择保留既有参数声明；首期不从手动表头提取新参数 |
| Playground | 扩展原 table-header-filter-defaults 与 query 页；新增 table-header-filter-param-source；真实 Chrome、HTTP DQE Sim、实际 XLSX、Tab 和 390px |
| 产品文档 | PAGE-METADATA、PAGE-PARAMETERS、Table/参数正文、reference-map；ADR-0130 并入三个主题 |
| 独立创作 | 产品真源生成 Schema/契约/知识/独立校验器；完整实体仓外复制，三个新能力页面通过，非法保存初值在 initialParam 路径被拒绝 |
| Embed | 完整构建、check:dist、ES/global/完整复制目录/Webpack/公开 API/实际导出的 Chrome 分发套件273项通过；16个JS全部≤1000000字节，最大Excel分块929901字节，归档逐文件与dist一致 |

## 检查记录

原始日志、截图、请求体、实际 Excel 和发布回执位于 [artifacts](../../../artifacts/table-header-param-initial/)。

- `pnpm check` 通过，全仓 TypeScript/Svelte 0错误、0警告。
- 定向6文件192项通过，覆盖新能力、静态默认值、知识预算和旧页升级。
- 产品广泛回归453文件：首次4012项通过、5项原配置跳过，唯一失败是新增内部导出的公开面快照。已用 UPDATE_PUBLIC_API 官方入口更新 internal 子路径的4个名称，8项复测通过；稳定主入口没有新增符号。
- Chrome Playground 的14组场景通过，实际下载10个XLSX；`browser/result.json` 保存请求体与无pageerror结论。全选不限的4条合成数据包含原有null/待定；values全集仅2条。
- `pnpm build`、Embed `check:dist` 与分发Chrome273项通过。`embed-archive.json`记录实际归档及逐文件原始字节检查。
- MC生成一致性与独立分母覆盖检查通过；MC52项通过。Schema升级后的可见夹具和诊断报告均由 mc:content:fixtures 生成，末端检查单独复核。
- 独立Skill完整目录复制至系统临时目录，3个正式页面及1个反例通过；见 `standalone-capability.json`。Skill归档回读和仓外合法/非法校验通过，回执标记来源为未提交工作树，部署未执行。
- 并行分发浏览器/广泛回归时，4个已有安装/参考测试触发原有5秒/30秒门限；未放宽门限，改为 `pnpm skills:check --maxWorkers=1` 串行复测，失败项原门限定向复测已通过，完整命令未再次重复28分钟的全套。详见下方收口记录。

## 复杂度

同版 `metriccanvas-ts-ast/1`、TypeScript 5.9.3；逐函数 selfCC，包含回调、闭包、对象方法和全部新增辅助函数。测量器自身测试通过；完整前后JSON见 artifacts。

| 函数/职责 | 前 | 后 |
|---|---:|---:|
| headerDefaultValues | 3 | 5 |
| columnDefaultErrors | 10 | 12 |
| pageParamErrors | 13 | 13 |
| materializePageParams | 11 | 15 |
| changedParamSourceIds | 16 | 6 |
| changedQueryParamSources（拆出） | — | 12 |
| initialTableViews | 7 | 8 |
| SourceProgram.defaultConditions | 5 | 7 |
| SourceProgram.prepareView | 4 | 5 |
| controller.local | 7 | 7 |
| resolvePageParams | 35 | 35 |
| parsePage | 23 | 23 |

新生产模块 header-params 的函数/闭包最高12，select-values最高8；全部新增生产、测试和浏览器函数均≤15。存量 resolvePageParams35与parsePage23只接独立语义职责、未增加自身分支，为避免改变通用解析及完整有序错误列表而未扩大拆分；未修改的 matchesParamDeclaration19 单独列为存量，不计本批关闭。

## 证据边界与工作区

普通详情浮层的表格在当前真源中禁止全部表头筛选；本批保持该限制，新增 initialParam 也在该位置拒绝，未把规划中的新详情作用域推测当作已开放能力。完整详情页面不受此位置限制。

真实 business-decision-details 与 region-auth-norms-detail 两份精确业务JSON未找到，未用类似文件冒充迁移。真实内网DQE、Relay、权限服务、目标部署、Windows原生构建、远端CI均未执行；Sim与内联合成数据不作真实服务证明。

未提交、push或main交付；保留本任务隔离工作树以便审阅，未清理其他任务的任何工作树/分支。主工作副本只回填本任务唯一规划状态，不混入实现或生成物。最终检查与保留进程见收口记录。

## 最终收口

- 最终产品广泛回归：453文件，4014通过、5项原配置跳过，日志 `product-tests-final.log`。另加的普通详情位置反例12项通过；最终本地草稿修复后runtime26项通过。
- Skill入口检查16项通过；主套件236项通过，唯一包版本再生成用例在90秒子进程门限超时。相同用例、相同门限定向复测1项通过（30项按名称筛选跳过），日志 `skills-regeneration-retry.log`。不将首次完整命令的exit1改写为exit0；按用例覆盖已闭合，未再重复整套。
- 最终MC整链 `mc:content:check` exit0：生成一致性、来源覆盖、52项测试、诊断夹具检查均通过。
- 最终 `build` 与 `build:playground` exit0；最终Embed `check:dist`、Chrome273项 exit0。草稿修复后的分发归档已重新打包核对，SHA与尺寸见 `embed-archive.json`。
- 最终Playground14组、10个实际XLSX、无pageerror；仓外完整Skill3正式页面+1反例再次通过。使用 `local-authoring-1.23.0-final.tar.gz`，其回执及当前目录逐文件比对均通过；同目录旧归档仅为过程证据。
- 基线main的[CI运行](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/41809392718)已重新核对，13个作业全部success。它只证明cbba8e94f基线；本次未提交改动没有新的远端CI、Windows原生构建或部署证明。
- `git diff --check`通过；锁文件、AGENTS、CONTEXT未改。隔离工作树保留未提交代码；主工作区仅回填本任务规划和索引的状态。
- 保留5206 Playground与18405 DQE Sim供审阅，已停止本批多开的5173/5205。独立安装位于系统临时目录，完整路径见 `standalone-capability.json`。

## URL 示例入口修正

用户反馈示例看不出 URL 初始化。原入口最先展示三个静态 defaultValues 表，实际 initialParam 表排在后面，造成错误预期。已将参数表移到首个表格位置，并添加当前页面的显式 URL 导航按钮；旧静态表保留在下方对照。此改动仅调整页面示例和对应测试位置，不改参数或 TableSession 语义。

- 本地页：三个参数表的“是否有效意见”列均 initialParam: is-valid；查询页：“参数初始化区域（合成 DQE）”的“区域”列 initialParam: region-input。
- 原失败断言记录于 example-review-red.log：首表预期参数表，实际为“待审批且编码为1”。修复后 browser-example-review/result.json 的16组通过，含同页 URL 导航“否→是→不限”，10份实际导出和 HTTP Sim。
- 全目录180份页面均合法（表格目录39份），受影响5文件44项测试通过。新增浏览器 entryNavigation 无分支；测试夹具按分区 id 定位的回调 CC=1。测试 target 增加显式表格类型守卫，CC 1→2；其余修改函数 CC不变，完整同版测量见 example-review-complexity-after.json。
- 示例源变化后重新生成 authoring 合同和独立 Skill，一致性检查通过；知识及独立安装43项通过。新包 local-authoring-1.23.0-examples.tar.gz 经仓外回读通过，SHA256 97b089c228c1ce760681e9b649c57ad3c9e9b46d53ecda3da1a71c777a3b752e；旧 final 归档仅代表本次入口修正前快照。

本轮 MC 命令先误用了系统 Python；使用锁定解释器后52项通过，末端诊断快照因示例变化漂移。已通过正式 mc:content:fixtures 重新生成并单独 --check，不将此前整命令退出1写成退出0。页面及引擎测试类型检查通过。

## main 交付基线

2026-11-05 用户授权提交并推送 main。交付在 origin/main ad81479e639f9029bd44aaad5b4b566b5105a047 上重放本批改动，保留其运行时诊断仅控制台呈现修复；冲突只有生成清单、摘要和 Skill 版本，全部由合并后产品真源重新生成，版本使用1.23.0。上面的“未提交”记录描述本地验收时点；实际提交、同 SHA CI 和清理结果见本次交付回执。
