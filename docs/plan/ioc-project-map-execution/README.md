# 项目地图四页执行记录

2026-09-30。承接[四页优化目标](../2026-09-30-ioc-project-map-optimization.md)。当前状态：项目主页首批确定性问题与项目详情全年预测列缺失已修复；四页尚未完成，与真实实现全量等价仍未验收。

## 已实施

| 消费者 | 根因/修复 | 证据 |
|---|---|---|
| 项目主页·已立项数量 | 原主值绑initiated-amount金额，现改initiated-cnt＋个 | 首批报告project-overview A2；定向页面绑定测试 |
| 项目主页·已立项预签金额 | 原取全部机会点bidding-amount，现取initiated-amount | 同上；与总预签金额分开 |
| 项目主页·TOP行→项目详情 | mtime改取当前页面filter，页面202604与行202603区分；标题取project-initiation-name；TOP立项状态固定已立项 | 报告D7/E3；正式navigationHref及目标resolvePageParams测试 |
| 项目主页·丢单行→项目详情 | 原错误openDetail抽屉改为navigate；mtime取页面filter，标题取opportunity-name，保留行立项状态 | 报告D8/E4；运行时测试＋真实浏览器跳页 |
| 机会点清单·行→项目详情 | 继续取行mtime，没有被项目主页改动覆盖 | 页面202604/行202603定向回归 |

这些是现行协议内的业务绑定/动作纠错，没有改视觉结构、Schema、运行时通用导航语义或DQE。新写测试 `packages/engine/runtime/tests/ioc-project-navigation.test.ts`，更新旧骨架中错误预期，保留文件已有未提交增量。

## 验证

- 新定向测试修复前：4项中3失败（TOP错日期、丢单无navigate、已立项错绑定），清单行日期1项通过。
- 修复后四页原有测试＋新定向测试：5文件28项通过；后续标题/状态补充同一新测试断言。
- `pnpm exec tsc --noEmit -p packages/engine/tsconfig.test.json` 通过。
- `pnpm exec tsx packages/page/src/validate-cli.ts pages`：13页面通过。
- `pnpm --filter @metriccanvas/embed test:browser navigation.spec.ts -g '概览→清单→详情|丢单表跳'`：embed构建成功，2个浏览器场景通过，覆盖原生跳转/返回及丢单目标和参数。
- 仓内repair-page-metadata诊断脚本首跑失败：从public index导入不存在的fileNameErrors。未修改skill；改用现有validate-cli和正式parsePage/运行时测试，仍完成本批对应校验面。

浏览器通过只证明当前匿名数据路径中的动作，不证明详情按项目/月份重新取数或返回完整业务状态。真实接口、来源浏览器、ANA、DS模型、CI、生产集成均not-run。本轮未运行创作契约生成。

## 本轮发现、未掩盖的后续缺口

| 页面/消费者 | 当前事实 | 下一步/状态 |
|---|---|---|
| 项目主页与清单·缺必需导航输入 | navigationHref省略缺值；详情保存演示默认值，可能变成另一个示例项目 | [最小协议评审](navigation-required-inputs.md)：requiredQuery已由用户挂起；不作为核心功能前置，未放入Schema |
| 项目详情·标识与日期查询 | 当前opportunity-code/mtime是display参数；各查询无相应输入绑定 | 按消费者补取数键和匿名A/B响应；不能用标题变化冒充数据切换 |
| 项目详情·销售预测 | 已补齐已有字段的12月×3列；去掉与自适应金额冲突的固定“万”表头 | 绑定与横向访问已验；完整来源视觉/状态还原仍未验。全空汇总已由第三批显式zero策略处理，其他来源格式/状态仍待核对 |
| 项目主页·其他卡/图/三表 | 来源卡/启用槽位和候选不完全一致；跨源键值域缺证明 | 已知数字绑定先修；其他列/图不凭候选造来源 |
| 机会点分析·两态三表与出口 | 候选有两态六个表组件，但报告仅概括且真实来源有清单出口 | 补逐列/字段/动作契约；当前无navigate不是来源无出口 |
| 机会点清单·完整启用主模板 | 36/40列及备用模板矛盾；查询全量搜索未解决 | 保持部分状态，不以13页结构校验通过关闭 |

完整目标侧消费者与字段绑定快照见[evidence/current-consumers.json](evidence/current-consumers.json)；它是首批执行时的实现盘点（预测列补齐之前），不是来源验收分母。内部请求见[按页面/消费者补证](next-source-evidence.md)，不要求整个源码仓。

## PM状态

PM-01数量/金额子项、PM-10日期/目标/标题/状态子项取得本轮证据；二者仍partial。PM-02–09其他未执行细项、PM-11完整视觉/状态、PM-12最终创作分发均未关闭。四页优化目标保持不变；其他IOC页面的原缺口清单完全保留。

## 文件保护

执行前指纹[evidence/before.json](evidence/before.json)冻结当时全部未提交文件及四页。只修改项目主页页面、其既有测试和navigation浏览器用例；新增定向测试和本目录记录。其他会话的平台部署、authoring及已有IOC能力增量不改动。现行accepted ADR不变。无commit、push或PR。

## 第二批：继续核心功能，挂起requiredQuery

用户明确挂起requiredQuery；保留候选材料，不实施Schema或通用导航修改，也不阻塞四页核心工作。

项目详情销售预测补齐已有字段的8—12月客观/提拉/合计列，全年36个金额列全部可见。月份标题移除固定“万”，沿用字段现有cny-adaptive显示，原始金额和汇总计算不变。此批只完成现有字段绑定完整性和单位纠错，未取得完整SDD视觉等价验收。

验证：6个运行时测试文件共42项通过；engine测试类型检查通过；13个页面文档校验通过。embed构建与project-forecast.spec.ts的1280px、375px两场景通过，确认12月可横向访问、列数正确、总计存在。新增计算回归覆盖每月小计/总计不重复累加以及零值、负数、缺失明细；不代表真实取数验收。

定向测试首次使用不存在的packages/engine/vitest.config.ts启动失败，改用仓库根配置后通过。测试编写中的格式预期和联合类型访问已按现行实现修正，没有因此修改通用格式或计算行为。

本批涉及项目详情页面、原有详情测试、forecast运行时与浏览器测试及本目录记录。其他页面缺口、真实取数与完整来源结构证明继续保留；metriccanvas-authoring未修改。未执行commit/push。

## 第三批：已确认决策与核心能力落地

[Q1–Q9确认结果及T1–T9任务状态](confirmed-decisions.md)是本批执行依据。requiredQuery仍挂起。

- T4：小计/总计新增可选allMissing策略，默认null不变；项目详情预测显式使用zero并写6.12。旧6.11禁止声明新字段。空行集不造汇总，缺失明细不改0，负数保留，总计不重复加小计，溢出仍null。
- T5：机会点清单移除通用keyword搜索声明，保留10项可下推查询筛选。全量搜索未实现，不能计为功能取消或还原完成。
- T7：纠正详情说明中的inline和1—7月旧描述，当前是query+initial与12个月。
- 验证：9文件81项测试通过；page源类型检查、engine测试类型检查通过；13页校验通过；embed构建通过，清单搜索入口隐藏、跨页数据排序及时间/布尔/金额筛选的2个浏览器场景通过。首次构建暴露公开算子类型遗漏，已补齐后复验通过。

此批未完成T1真实消费者查询键绑定、T2区域代码映射、T3查询返回增量的原始输入补齐、T6分析来源出口、T8完整返回状态，以及四页共用匿名查询链和整页SDD。现有URL回跳不当作完整交互状态恢复。metriccanvas-authoring和生成契约未改，生产集成/DS模型/CI均未运行。
