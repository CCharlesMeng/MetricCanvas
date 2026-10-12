# IOC 内容切换与锚点 · Alpha Tests

## AC ↔ 证据映射
| AT | 状态 | 执行环境 | 证据记录 | 新鲜度 | 说明 |
|---|---|---|---|---|---|
| AT-01 | PASS | deterministic | page/tests/section-navigation.test.ts | 当前代码 | 拒绝未知/重复/默认/锚点引用；入口参数消费者 |
| AT-02 | PASS | mock browser | embed/tests/browser/section-navigation.spec.ts | 当前代码 | 25行切组页码/排序/局部筛选保留；双实例与入口组 |
| AT-03 | PASS | mock browser + deterministic | section-navigation.spec.ts；table-state.test.ts | 当前代码 | 隐藏组搜索重置，第21行命中，总数1 |
| AT-04 | PASS | mock browser | section-navigation.spec.ts | 当前代码 | 键盘定位、焦点、history/URL不变、query调用保持2 |

证据级别仅为所列匿名功能场景。没有21入口等价证明、像素还原或真实集成。SDD完整RED/GREEN追溯与最终独立评审另记，不由PASS功能断言反推历史RED。

计划外承接：RuntimeSection/composition-types增加hidden以保持挂载；page-param增加sectionGroupParam消费者识别；浏览器入口复用embed，替代原计划中不存在的playground测试设施。均属于T1～T3已授权行为的实现接缝。
