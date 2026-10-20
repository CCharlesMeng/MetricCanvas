# B4冻结验收基线

用户已批准唯一主计划§17，并在本轮明确“B4继续推进”。沿用已确认Dashboard验收形态与文字视觉基线，不重新调查、不索内部材料、不重复确认既定方向。此文件投影已批准范围，不改变主计划。冻结状态：已冻结 ✅。

## 执行起点（环境）

- 隔离工作树：`/Users/moon/.codex/worktrees/ioc-header-b0-b1/DataDashboard`，detached HEAD `952b3a273f0f4f8be5820f5af1bb76c2f5afa513`。B4真起点为未提交6.34的670文件快照，已逐hash验证并备份，见evidence/start-manifest.json。
- 原工作区27项并行修改、HEAD及暂存空状态已核对，不覆盖、不清理、不提交推送。B3指纹`1fe02a2761bb5f97141e16c76f21bbf1ce0f3206e049e4cac32128629ccdddeb`。
- B3历史命令：264文件2300通过5跳过的前驱全量；39定向（含4重复用例）、check/build、548 Python1跳过、46分发、37页、源码23+最终金额2、安装17。仅作为起点失败集合为空的既有证据，不升级为B4验证。
- 采用PATTERN-STRUCT-1/2、API-1/2/3、DATA-2/3/4、ROUTE-2/4、STYLE-1/5、TEST-1/2。app真源apps/playground/frontend-baselines；同一深Module提供所有静态查询叶子与当前合法模式两种纯操作。

## QA基线

| 编号 | 冻结期望 |
| --- | --- |
| F3-41 | day日期/month月份/ISO周完整周一至周日、ISO所属年；mode/from/to一次提交，非法整组拒绝；每模式记忆最近合法范围，缺失用合法默认；URL完整且优先；旧详情单月、period自然年季月/近一年、datetime不变；modes互斥普通range/period/initialParam |
| F3-42 | query.timeModes与普通body/filterBindings互斥，穷尽静态case且所有输出字段/别名/类型/货币同契约；所有case均验证。有效查询、SourceProgram、Node/Relay公共入口、去重/缓存、initial/seed、pagedJoin及导出选同case，无首项兜底；导出冻结模式 |
| F3-43 | 快捷范围/default/window同次操作共享时钟；近N天含锚点日，起点减N-1；月份按日历月且includeCurrent明确；原近一年仍为之前12完整月；显式anchor不偷换now；取消/半区间不提交 |
| F3-44 | 具名DataPeriodFact快照及订阅，Page/URL/参数不得覆盖；日期/带时区时间戳及集成时区校验；latest与latestComplete分开，缺complete不回退；initial互斥default/initialParam，合法URL优先但max独立校验；完整年季周越界不截短；未就绪/过期/错误阻断相关查询/seed/initial/导出，无关源继续；同身份事实刷新不重置选择，身份修订停用旧实例 |
| F3-45 | candidateWindow由V2携带规范月份闭区间与完整维度/时间（含mode）；请求键含全部约束、窗口/事实版本，迟到成功失败均隔离，retry用当前请求；缺V2不降legacy；1/3月是两个真实dimension值、不补2月；intersection只用当前完整候选，空交集待确认，只有dtime的多区间仍不支持 |
| F3-46 | 日期max/blockedRanges/min/disableFuture交集，空交集不可选；旧调用不变，年季range拒绝；缺数默认可查询空，仅显式策略禁选；只读保留合法值，折叠/只读关闭弹层；中立日期/周控件与ShadowRoot可用，错误可定位，摘要只显示已应用值 |
| F3-47 | 实际日期/模式/离散月/时间模型pages直接消费声明及合成HTTP；请求、结果、XLSX和静态呈现一致，冻结导出，门禁不被旧数据绕过，B0–B3回归；标明合成性质 |
| F3-48 | 6.35类型/Schema/语义/能力/正反例/文档一致；模式case、预设、事实引用和候选窗口可受控创作/编辑/回滚/保存重开；Skill/Bundle/仓外安装闭合；不顺带实现Condition、任意对象路径、私有周码、B5/B6 |
| R6-41 | 1440、1024、390观察宽度下，B4日期/周/模式控件、已应用摘要、提示和弹层自然回流，无非预期横向溢出、相互重叠或必要操作裁断；覆盖默认/展开/弹层/只读/错误/缺能力，普通根及ShadowRoot |

事实接缝限主计划DataPeriodFact具名分支，沿displayInputs不可变快照/订阅；没有实际架构冲突，不开放待审Condition。事实中filterRevision只在该事实依赖当前筛选时携带；独立数据域事实可不携带。身份修订统一隔离，不能从URL覆盖。真实DQE/Relay/CloudIOC/DS/门户/私有周编码未验真，无真实材料时仍完成本地契约与负向场景。
