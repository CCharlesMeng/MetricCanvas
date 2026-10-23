# 查询分支纠错与假设审计

原提交：`713586a7017d997fc334bb1394c80d254c99ae1a`。修复首轮基线：`573ee6a9875336bdd525e12179c9e98b139675db`。交付前合入更新的 main，最终版本与复验结果在本记录后续段落列出。

## 发现与处理

| 项目 | 证据与结论 | 处理 |
|---|---|---|
| 普通指标 `{name,alias}` | 本地原始调研 `调查报告/dqe.md` 的 DslQuery 样例（185—211行）只给出字符串指标与 `{formula,alias}` 公式列；没有普通指标重命名证据。报告不是本次真实服务响应。 | 删除演示、正向夹具、文档及派生产物中的错误用法；校验器拒绝普通指标伪别名。公式语法不作为普通指标重命名的替代。 |
| 强制分支输出同名 | 原静态规则把稳定页面字段与原始响应列混为一谈，迫使示例依赖伪别名。 | 各 case 的页面 `fieldMappings` 显式连接不同原始响应列；请求、归一化、排序、列筛选、候选与下游结果过滤共同使用生效映射。该映射不会发送给 DQE。旧的同名输出分支继续兼容。 |
| Sim 自证 | 原 Sim 由同一个错误请求形状编写，HTTP 成功仅证明自定义适配器互相吻合。 | 先增加原始指标字符串断言并记录失败，再修复；HTTP 回归分别检查请求指标形状、原始响应键、归一化结果。 |
| “两张表”的说法 | `sales_contracts` / `sales_opportunities` 只是 JSON 中的独立数组，由本地函数按名称选择，没有查询真实数据库。 | 页面及说明改为“两组独立固定数据”；真实指标到数据对象/物理表的路由未验真。 |
| 指标、维度、月份粒度及人民币 | 签约金额、商机金额、区域名称、2026上半年及 CNY 都由样例预设，没有真实数据目录或业务定义依据。无维度求和由 Sim 实现。 | 全部标为合成样例约定，不能证明真实 DQE 聚合、类型、单位或业务口径可比。 |
| 无分页 `total_count` | 原 Sim 总是返回数组长度；原调研295—303行说明未启用 limit 计数时为0，真实上限值未给出。 | 本场景 Sim 改为0。现有运行时可能报告 `TOTAL_COUNT_MISMATCH`；保留诊断，不以返回六行证明真实服务完整性。真实完整性、上限及导出可用性仍未验真。 |
| 泛化验收结论 | 原演示没有真实 DQE/Relay、权限或业务验证；共用执行代码不能替代分页/组合和全部导出路径验收。 | 收窄文档；新增本地分支映射的排序、远程候选端口、上游 where、组合成员分页和冻结读取回归。完整读取回归不证明真实服务无截断，也不等于所有文件导出格式验收。 |
| 更早的同类夹具 | `filters-page.json` 的 `{name:"订单数",alias:"order_cnt"}` 早于本次提交，校验器过去也宽松接受任意 alias。 | 正向夹具改为“订单数”及原始初始行键；重新生成全部相关派生夹具。旧归档和原验收材料保留历史，不再作为当前协议依据。 |

`metric-shape-audit.json` 记录扫描到的历史归档引用。扫描现行 `pages/`、产品正向夹具及 JSON 工具数据，未发现其他普通指标 name/alias 正向用例；负向用例故意保留以验证拒绝。这不是对整个产品所有后端协议的全面认证。

## 首轮验证

- `red.txt`：修复前，普通指标字符串断言失败，原 HTTP Sim 测试仍成功，重现自证漏洞。
- `product-regression.txt`：170文件、1435项通过，覆盖页面、data-execution、runtime、Sim。
- `authoring.txt`：4文件、141项通过；包含修复后旧页面升级到当前版本的场景。
- `check.txt`：全工作区类型及 Svelte 检查通过。
- `build.txt` / `data-execution-build.txt`：公共包构建与后续执行包重建通过。
- `contracts-check.txt`：生成一致性通过；`standalone.txt`：仓外复制的完整 local-authoring Skill 校验实际页面通过。
- `regression.txt` 为中间批次执行记录：除两个随后修正的测试/版本夹具问题外通过1595项，其中包含导出隔离检查；不把这份日志写成全绿。修复后的相应场景由 `repairs.txt`、`branch-consumers.txt` 和上述最终命令覆盖。

## 浏览器与真实服务边界

Playground仍使用本任务工作区，端口5174，Sim端口18231。页面与HTTP测试使用同一份JSON。

浏览器工具拒绝定位现有HTTP标签页，报告URL安全策略拦截（理由称请求协议不允许，尽管给定地址为http）。未尝试通过其他浏览器或底层接口绕过。已请求用户刷新确认，自动浏览器验收保持未完成。`browser-dqe-exchanges-snapshot.txt` 是服务实际收到的请求/响应记录，不替代页面视觉及交互验收。

没有访问真实 DQE、Relay、数据目录、数据库或生产权限，因此这些项目全部未验真。当前交付是页面端修复与本地合成演示。

## 合入 main 后的最终复验

交付基线：`e6706d4af1c9e8295581b182b62ecc8472c53fca`。完整保留其“数值维度显式作为度量”的6.56能力，本次页面响应映射顺延6.57。补齐两种能力组合时的原始文档能力探测，未改动并行功能的业务行为。派生产物全部由合并后的真源重新导出。

- `integrated-tests.txt`：176文件，1591项全部通过。覆盖页面、执行、运行时、Sim及4组local-authoring检查。
- `integrated-check.txt`：全工作区类型/Svelte检查通过；`integrated-build.txt`：公共包构建通过。
- `integrated-contracts-check.txt`：1138份产品产物及对应authoring/interface生成一致性通过。
- `standalone-integrated.txt`：最终6.57完整Skill复制至仓外后校验同一演示页面通过。
- `measure-integration.txt`：并行数值度量功能的12项专项回归通过。
- `inputs.json`：最终真源与锁文件SHA256、工作区和基线。其他日志中的旧计数/版本属于首轮或中间输入，不替代本节最终结果。

功能对应：Playground `pages/capabilities/filters/query-mode-chart-demo.json`；页面文档 `PAGE-METADATA.md`、`docs/page-metadata/queries-and-bindings.md`；独立创作Skill `metriccanvas-authoring/skill/metriccanvas-local-authoring/`。浏览器被安全策略阻断的状态未因单元/HTTP测试通过而关闭；真实DQE相关项目继续未验真。

## 复杂度

使用同一 `metriccanvas-ts-ast/1`、TypeScript5.9.3逐函数计数，包含新增闭包、回调、生成器；以最终交付基线对比，详见before/after JSON。

| 函数 | before → after selfCC |
|---|---|
| selectQuerySource | 新增 → 3 |
| mappingErrors | 新增 → 13 |
| appliedInputSources | 新增 → 4 |
| SourceProgram.appliedSource | 新增 → 2 |
| branchDimensionMeasure | 新增 → 5 |
| hasNumericDimensionMeasure | 2 → 3 |
| composeEffectiveQuery | 10 → 10 |
| queryContractErrors | 10 → 12 |
| caseErrors | 5 → 6 |
| SourceProgram.execute | 15 → 15 |
| SourceProgram.finishQueryRead | 13 → 14 |
| compilePagedJoin | 18 → 18 |
| ColumnCandidatesReader内部读取回调 | 48 → 48 |

新增函数和新增回调均≤15。最后两项为存量超限，未关闭：本次只改生效字段映射的取用，继续拆解全局排序决策或候选生命周期将扩大异步与查询行为风险，因此保持自身复杂度不增长；后续入口为这两个原函数及现有复杂度治理计划。`validate.ts`中未修改的parsePage仍为31，不作为本批新问题或关闭项。

按用户已给出的交付要求使用 `[skip ci]`。本地检查通过不等于CI通过；远端提交验证与CI状态另在交付回复报告。
