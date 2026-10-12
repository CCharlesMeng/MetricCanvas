# 本轮证据与剩余验收

2026-09-30。只报告本轮实际执行，不把历史828项与本轮数量相加。

| 层 | 命令/对象 | 本轮结论 | 能证明什么 |
|---|---|---|---|
| 设计参考夹具 | node docs/plan/ioc-m0-m1-2026-09-30/verify-review.mjs | pass，32断言 | 三返回集正常基数/两负例、三时间语义、数字预期、A关后B打开的参考状态轨迹内在一致 |
| 目标确定性计算 | pnpm exec vitest run packages/engine/runtime/tests/ioc-customer-finance.test.ts | pass，1文件3测试 | 正常、负收入、客户×月缺匹配；使用现有applyComputation正式Interface |
| 文档/范围 | 本包链接、JSON解析、git diff --check、baseline文件SHA-256比对 | 见checks.json | 材料可定位、已有文件未被本轮覆盖；不是业务通过 |
| 来源提取脚本 | 第一批verify-report.mjs历史记录 | 本轮not-run | 既有48/48/15结论不重标为本轮 |
| Schema/运行时新增能力 | M1新增声明 | not-run | 仅设计，没有实现或通过证据 |
| 页面/浏览器/ANA | 五业务页 | not-run | 无页面重建、视觉还原或精确字符串结论 |
| 真实模型/CI/生产集成 | DS、Relay/Java/DQE/门户 | not-run | 无上线就绪声明 |

设计夹具是匿名归一化输入，云服务三返回集不证明内部列式数组同序同长，也不证明DQE能提供相同Count。参考状态机不调用真实编排器、不发请求、不测试取消/焦点；正常数字oracle不覆盖TOP完整空值/空名排序。所有这些仍需M2/M3产品测试。

## AC逐项基线

| AC | 本轮状态 | 已有或下一步准确落点 |
|---|---|---|
| AC-01 | not-run | 版本读取、越级能力拒绝定向page测试；M1批准后扩展 |
| AC-02 | not-run（参考oracle有4例） | runtime直接减法正式Interface参数化测试 |
| AC-03 | not-run（参考oracle有3例） | 概览/客户比率消费者独立策略产品用例 |
| AC-04 | not-run（参考oracle有全空/部分空） | 机会点12月全null/全0/含负/缺字段/非法值产品用例 |
| AC-05 | partial | 财经3场景本轮通过；源失败传播/主客户辅助缺行不止一个消费者，仍需正式编排器用例 |
| AC-06 | not-run | 键并集、同指标有序择取；稳定序证据未闭合 |
| AC-07 | not-run（参考oracle有3语义） | 注入时钟、实际查询窗口与展示参考年；非法期/重复期/空集产品用例 |
| AC-08 | not-run（参考oracle仅数字排序） | 空名/空值/同值稳定排序、尾和、份额守恒 |
| AC-09 | not-run | 完整25行第21行搜索、Tab保留、隐藏表重置；不能外推query全量搜索 |
| AC-10 | not-run（参考oracle有三返回集） | 正式编排器offset10、total25、汇总不占明细10行 |
| AC-11 | not-run（参考oracle有状态轨迹） | 真实会话取消/代次，必要浏览器焦点 |
| AC-12 | not-run | Token局部日期隔离及请求计数；待详情会话实现 |
| AC-13 | not-run | snapshot打开0次请求、主快照数值相等 |
| AC-14 | not-run | 控制gateway返回顺序，两scope/汇总失败/重试产品测试 |
| AC-15 | blocked：内部分页单位/完整组证据 | Token完整客户组与客户数；不能把数据行数当客户数 |
| AC-16 | not-run；客户详情机会点标识缺口 | 已启用动作行日期/页面日期与缺标识拒绝；禁用链接不恢复 |
| AC-17 | partial source knowledge，目标not-run | ANA/枚举43/1待补；原始数值和展示分别断言 |
| AC-18 | not-run | M4按实际来源结构走SDD及必要宽窄屏检查 |
| AC-19 | not-run | M2/M3修改后按影响范围回归既有普通页/行详情 |
| AC-20 | not-run | M6维护会话交接后创建→保存→新进程编辑→重开 |
| AC-21 | not-run | M6最终树生成/检查契约和bundle；取消历史测试排除 |

“partial”只表示列明的子项证据，不代表AC通过。其他16入口尚待第二批来源；查询分页全量搜索保持范围约束blocked。

## 后续产品负例清单

- 详情：snapshot带局部筛选/查询分页；缺客户输入；局部ID冲突/跨作用域消费；非法日期；未知模式；关闭后回调；排序或筛选变化旧窗口回调；重复dispose。
- 汇总：0/2行；类型/币种不匹配；跨筛选指纹；summary失败；明细先返回或后返回；Count缺失/负数/小于明细行数；query窗口标complete。
- 计算：全null/缺字段/字符串/非有限；不可折叠度量；重复序号；复合键碰撞；0与负基期；空数据参考年；窗口非完整；未知模式。

这些用例在本轮只作为可审阅门槛，没有加入contract-valid或修改生产校验器。
