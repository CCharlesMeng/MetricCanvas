# 创作分析关联与普通换源验收

本地来源基线 `2172df5450a09803685773ae5bc65df766168c98`。最终 A owned 来源见 `source-manifest-v2.json`：53 个文件及旧作者目录六项删除。它替代首个 manifest；唯一后续变化是分组字段测试 fixture 去掉 grouped 声明不允许的显式 `role`。B 的呈现与公共字段解析器属于依赖快照，独立记录且不归 A 源码清单。

## 已完成

- 新增无 I/O 的 `page.analyze`、`page.rebind` 与 Node 本地文件入口；完整原始字节、页面 Schema、工作副本、材料及当前用数身份共同约束报告。中间态不写入 PageDocument，字段增减为零。
- 报告保留需求、取数单元、结果引用和页面用数位置的双向关联；阅读选择不缩小全局校验、共享消费者和依赖闭包。无结果行或 `initial` 缓存。
- 普通 inline/query 到普通 query 的原子换源核对完整字段映射、契约、范围、绑定、各对齐槽行键及置顶汇总。保持原组件、字段 ID、列、布局、格式、交互和无关来源；清除受影响初始快照。未知或不支持的计算、成员、分页及按父行上下文显式拒绝。
- 创作专用模块移至 `metriccanvas-authoring/core/page/`，从渲染包源码中移除。泛用时间/参数/校验仍在产品公共规则层。正式安装根 Ajv 构建依赖，无 core/node_modules 回退。
- 新 Dashboard 合成页、README、Node 演示及产品文档已入源码 manifest。共享知识、Skill、四项发行派生物和根依赖/锁由主控串行生成。

## 本地证据

| 检查 | 结果与证据 |
| --- | --- |
| 最终分析/换源/Schema hook | 57/57，`tests-association-final-r2.log`；55 项分析换源，2 项共享 Schema 扫描 |
| 扩大合批回归 | 105/105，`tests-final-r2.log`；旧扫描八向量完整 SHA/有序输出、旧 Node 操作、时间上下文和渲染安装隔离均通过 |
| 最终严格定向类型检查 | `typecheck-final.log`，退出 0 |
| Node 独立运行 | 干净 cwd、deny-network、固定正反自检、完整返回值与本地原始文件字节保持，见对应定向测试 |
| 完整依赖闭包 | 普通结果依赖链保留查询，清除受影响 initial，独立来源保持；计算消费者拒绝，`tests-dependency.log` |
| Playground 实际浏览器 | `browser.log`，1/1；1440×1000 与 390×844、两共享表 10.00/20.00、独立表 999.00，无页面异常或横向溢出 |
| 合成换源演示 | `local-demo-final.json`；生成审查候选，重复行键返回 `document:null`，原文件未改 |
| 旧操作契约 | 冻结首版真实发行的 A 五个描述逐项值相等；全部旧十三项跨发行回放由 C/主控负责 |

首次扩大合跑有两个原时间跨进程用例超默认 5 秒（约 5.95/5.78 秒），单独原预算 17/17 通过，月份边界耗时 4.928 秒；主控全仓还确认同例 6.82 秒超时。仅这两项改为 20 秒预算，断言保持，再合跑 105/105。新增依赖测试曾发现阅读组件列表只列请求，已分别输出请求列表与完整消费者列表。分组结果的最后测试首次使用了非法 grouped fixture，按产品现行契约纠正，未放宽校验。

## 复杂度

`metriccanvas-ts-ast/1`、TypeScript 5.9.3，同口径逐函数、辅助函数和回调测量：`complexity-before.json` 与 `complexity-final.json`。最终本轮相关 370 个函数/回调自身 CC 均 ≤15。

| 函数/职责 | 前 → 后 |
| --- | --- |
| checkAnalysis | 10 → 10 |
| checkAnalysis 原条目回调 | 19 → 6；拆出的 checkEntryEvidence=8、checkEntryGaps=7 |
| visitSchema | 13 → 14；新增展示绑定模式复用同一个 Schema walker |
| scanPageData | 13 → 13 |
| scopePageData / readingClosure | 1 / 2 → 1 / 2；仅迁移位置 |
| prepareCandidates | 14 → 14；仅更新依赖路径 |
| 新 analyzePageData / rebindPageSource | 新增，各 6 |

本轮新增与修改函数无 CC 超限未关闭项。旧 A28 中未再修改的泛用产品和 Python 代码为已验来源携带项，其原验收边界见 `carried-a-baseline.json` 与上一批证据；本轮不将这一份定向测量宣称为全仓复杂度扫描。

真实查询、Relay 权限/queryRef、当前工作副本 CAS、Java 保存及未知保存状态恢复未在此执行。未 commit/push；CI、部署与真实服务成功不能由这些本地证据代替。B 最终呈现依赖和主控最终发行仍需在集成树串行构建、生成与验收。
