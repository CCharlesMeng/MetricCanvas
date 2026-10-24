# 多查询表格实施与验收

本批完成 P0–P5；页面协议为 6.22。P6 已执行真实环境预检，回执为 NOT_RUN，缺可信 DQE/Relay 端点、授权执行上下文与已验真业务元数据。未提交、推送、部署或发布。

普通查询定义由成员引用复用，组合查询源独立发布当前页。SourceProgram.read 统一普通/固定级联/raw/compute、组合和完整导出；QueryRunner 拥有共享请求、最大并发 5、缓存作用域与独立取消。纯 compute 与 TableView 迁入共享包，原入口兼容委托。TableSession 持有已提交视图；主表和详情表通过 table-controller 投影，export-controller 持任务状态。UI 草稿不参与取数与导出。

默认金额第一页上海/北京/广州；切换召开率后为上海/深圳/北京，独立召开率图仍保有 8 行。第二页杭州/成都/广州且序号 4/5/6。金额门槛及跨源条件在完整行域求值，总数分别 3 与 1。空域、缺行、重复/额外键、截断、网关失败、超限、旧响应和越界纠偏分别受控，失败不发布半张表。完整导出保留静态业务 TopN、权限/业务条件，冻结已提交视图，最多 10000 行/60 秒。

Python 的新组合/数值范围语义通过 Bundle 内产品 TS Node Bridge，校验器字节和协议版本受锁核对。MCP 工具输入 Schema 从产品生成定义结构化内联，不手写语义。普通成员保留，独立组件与组合可以引用同一 source ID；实际 sdist/wheel 内包含 Bridge、许可证、锁和契约。新知识没有真实 DS 模型业务验收。

## 验证记录

| 层级 | 结果与边界 |
|---|---|
| 全仓静态/类型 | `pnpm check` 通过，TypeScript/Svelte 无错误；ADR 索引检查通过 |
| 全量 TS 测试 | 最终源码 `pnpm test` 226 文件、1994 测试通过，包含最终状态所有者、初始快照资格与契约/隔离检查；见 [ts-suite.txt](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/multi-query-table/ts-suite.txt) |
| 执行与兼容 | 普通、固定级联、TopN、导出、取消、计算、参数、跨源组合均回归；请求集合归一及最终配方检查通过 |
| 协议/独立 Skill | 最新协议与独立校验器 57 文件、517 测试通过；旧版本拒绝、初始行资格、非法引用/字段、来源参数失效、1200 项普通本地选择集合兼容 |
| Python | 全量 541 测试通过；最新规则/交付 467 测试复测通过，含无真实模型的确定性 stdio/HTTP 主流程 |
| 浏览器 | 最终 Chrome 10 项回归覆盖组合、搜索/导出、where、共享执行与详情表；切换排序、第二页、跨源范围、非法草稿与完整 Excel 下载通过；见 [browser.txt](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/multi-query-table/browser.txt) |
| HTTP Sim | 原生 DQE 编码、选页/补列、跨源数值范围、总数和完整导出通过；真实验收 CLI 机制在 Sim 中通过。Sim 不解释 pagedJoin、不证明真实能力 |
| 契约/Bundle | `authoring:contracts:check` 当前；629 product、4 authoring、1 interface 文件；Bundle 2346 摘要核对通过；公开面与共享执行依赖门禁通过 |
| 安装/构建 | 产品包构建与 packages:check 通过；实际 sdist→wheel 构建成功，仓库外解包验证两种 6.22 分支，非法字段拒绝；独立 Skill 无仓库依赖验收通过 |
| 真实 DQE/Relay | NOT_RUN；见[预检回执](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/multi-query-table/real-preflight.json)和[真实验收步骤](real-acceptance.md)，目标引擎须支持 6.22 |

完整隔离生成检查 19 项通过。曾并发修改锁时两项复制测试出现 stale；冻结输入后两项复测和 19 项完整检查均通过，未放宽门禁。`git diff --check` 的生成空白模式未手改派生副本；详情见[范围保护](scope.md)。

最终状态所有者调整后，执行与运行时 40 文件、275 测试通过；引擎 TypeScript/Svelte 检查、embed 构建和上述 10 项浏览器回归通过。Python Bridge 的合法/非法契约、Node 缺失回执与组合保留独立成员 3 项定点测试通过。

## A01–A15 对照

| 项目 | 证据 |
|---|---|
| A01 | page paged-join 与 table-number-range 合法/非法契约向量；产品/Bridge 同源 |
| A02–A04 | data-execution、runtime、HTTP Sim、Chrome 的默认/切换/翻页/序号/纠偏 |
| A05 | 乱序成员按键投影；完整路径同值补键升序，升降序 null 排尾 |
| A06 | 跨源金额/召开率 AND、过滤后总数、搜索后完整行域 |
| A07 | 两组合源共用定义且独立视图；独立普通源始终完整，浏览器 8 行图/探针 |
| A08 | QueryRunner 完全相同/规范化集合请求去重、消费者独立取消、排队取消与总并发 |
| A09 | 迟到选页结果与错误、翻页、新代次纠偏隔离；既有取消/where 级联回归 |
| A10 | 空域不扇出、缺行 null、重复/额外键、范围截断、网关失败及超限 |
| A11–A12 | 组合默认 initial 免查与缺普通 initial 隔离；参数清除、非默认不提供可写回 initial；Node/default read 同源 |
| A13 | 冻结完整导出/全部页、总数变化失败、业务 TopN、取消不下载部分文件、非法草稿不影响已提交导出 |
| A14 | TS/Bridge 契约、Bundle、独立 Skill、实际 sdist/wheel、公开面与依赖门禁 |
| A15 | NOT_RUN，不以仿真或真实模型密钥代替真实 DQE/Relay 能力 |

[历史截图：召开率排序后深圳进入第一页，独立图仍为 8 行](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/multi-query-table/browser.png)

大规模跨源条件仍受 fallback.maxRows（最大 1000）限制；没有上游事务快照令牌时，同总数内容变化无法完全检测。延期的无关校验、旧 Python 语义、详情/导航进一步拆分已登记到原方案第 16 节。

## 2026-10-15：补齐 pages 验收场景与必选要求

新增 [multi-query-table.json](../../../pages/multi-query-table.json)，注册到页面试验场「验收样例」。[场景说明](../../../pages/README.md)记录启动方式、排序/分页/跨源范围/搜索/导出操作和准确预期；页面自带工具区与独立完整表。浏览器和 HTTP Sim 测试直接读取该文件，不再临时向契约夹具添加交互或探针。页面只保留 Sim 支持的统计月份，移除尚未提供候选数据的区域控件；没有用 inline 替代组合查询。

[AGENTS.md](../../../AGENTS.md) 将[新功能验收要求](../../agents/feature-acceptance.md)设为所有新功能的完成条件：同批维护 pages 场景及目录、页面元数据语义模块、local-authoring Skill。规则由该文档单处维护。页面协议总入口与模块已同步，Skill 入口补充多查询表格路由，维护说明及生成知识/清单/Bundle 锁已同步。

新增跨源 AND 操作暴露筛选面板的裁切问题：匹配 1 行时，按钮位于滚动区底部之外，DOM 中心命中分页栏。改为原 DOM 根内的顶层 popover，保留滚动表格；单行场景中按钮中心命中自身，清除筛选回到 3 行。原生外部点击/Escape 关闭与 details 同步；监听及观察器随弹层关闭或组件销毁释放。

本轮验证：20/20 pages 校验、目录与 HTTP Sim 7 项测试、组合/普通表格/where 浏览器 8 项测试、协议参考/Skill/生成隔离 30 项测试通过；引擎检查 0 错误/0 警告、测试类型检查及 embed 构建通过；契约检查当前，Bundle 2346 摘要通过。实际页面通过 `pnpm dev:dqe` 加载，跨源条件得到 1 行、独立图和完整表保持 8 行。前述全仓 1994 项测试、Python 与 wheel 是前一实施快照的证据，本轮按新增页面、文档、弹层及分发范围回归。真实 DQE/Relay 仍未验收。

[历史截图：实际试验场的一行跨源结果与独立完整行集](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/multi-query-table/pages-scene.jpg)

## 2026-10-15：当前序号与固定预签金额排名双表

`multi-query-table` 现在同时展示两张表，独占 `office-overview` 和 `office-overview-fixed-rank` 组合源，共用普通查询定义。第一张将原来的「排名」准确标为「序号」，仍由 `ordinalField` 生成。第二张的 `bidding-rank` 是普通预签查询返回的 `bidding_rank`，通过业务键投影，不指定为 ordinal；没有新增排名 Schema 或在当前页重排生成名次。

本地 DQE Sim 在完整 2026-09 行域中按预签金额降序、编码升序计算业务排名，之后才应用取键、排序、条件和分页。表格列头条件和搜索保留原名次。两个场景中的上游指标、排名与能力都是仿真输入，真实接入仍须提供经过验真的排名字段、行域和并列规则。

实际页面与自动浏览器均验证：召开率降序后两表同为上海/深圳/北京；第一张序号 1/2/3，第二张金额排名 1/4/2。第二张下一页为杭州/成都/广州，排名 5/6/3；召开率下限 85 后为上海/深圳，排名 1/4，Excel 同样保留 1/4；搜索天津保留第 8 名。另一张表及独立图/完整表保持独立。

页面、操作说明、协议总入口及语义模块、本地 Skill 读取路由已同步；新增 `paged-join-fixed-rank-page` 完整契约示例并随生成参考和 Skill 分发。新一轮 HTTP Sim/目录 7 项、双场景浏览器 2 项、20 个 pages 校验通过；Sim 与测试 TypeScript 检查通过。契约导出为 631 product / 4 authoring / 1 interface，Bundle 2352 摘要核对通过。契约、独立 Skill 与生成隔离结果见本轮日志。

协议/独立 Skill/参考/生成隔离 4 文件 38 项通过；订正独立固定排名示例的描述后，重新生成并核对契约与 Bundle，参考及独立 Skill 的 11 项定点复测通过。

[历史截图：两张表在召开率降序下分别呈现1/2/3和1/4/2](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/multi-query-table/two-ranking-comparison.jpg)
