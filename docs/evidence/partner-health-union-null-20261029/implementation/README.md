# partner-health 组织并集、总分与缺项呈现实施验收

日期：2026-10-29。源码基线 `d24a417210041a3c057e06dd0012e07d0bcc6c76`，本批修改保留在本地主工作区，未提交/推送。实施前证据保留在上级目录，现行结果以本页为准。

## 实施结果

- Schema 6.74 新增显式 `unionKeys`，空 inline 仅作为无静态行的计算入口；从全部完整依赖投影组织键并集。来源内重复、非法键、未知引用、依赖循环、非完整查询及分页窗口明确拒绝。
- 正式 `pages/temporary/partner-health.json` 新增 `health-scores-region` / `health-scores-representative`，各依赖11项已有得分查询。并集后 unique 左关联原始单项，先算四项分类、再求总分。真实0、负数保留；缺项单项保留null、分类/总分补零，全缺总分0；没有重新乘权重。
- 两种粒度的表格 main、总分列与分类图表统一消费计算结果。表格保留本地排序/分页能力，其行集合不再受声音闭环单一查询限制。原有按伙伴查看的详情数据源与接口保持独立，避免把组织行冒充伙伴行。
- 查询数值度量的空/空白字符串转为null，不再保存会绕过missingText的空文本原文回退。正式组织表格单项统一配置`missingText: "--"`。非空非法文本的原文证据与告警继续保留；属性省略保持字段映射错误。
- **24条正式查询定义逐项比对未改**（`original-queries.json`）；正式页面不接模拟网关，不在JSON中填入模拟业务行。Mock适配器仅由`partner-health-union-null-probe`独立入口启用。

顶部 `health-overview` 仍没有整体粒度查询；本批实现的是地区部、代表处逐组织得分及图表，没有将不同组织的分数相加伪装为整体分。真实整体分需要相应查询和业务粒度依据。

## Mock 与浏览器

规范响应夹具：`apps/playground/fixtures/organization-union/mock.json`，与上级诊断夹具业务数据一致。`gateway.ts`经实际DQE网关归一化响应，页面本身使用现行协议实时计算；不再展示脚本预先构造的15行结果快照。

| 场景 | 实际结果与证据 |
|---|---|
| 1 / 10 / 13 行交叉集合 | 地区部、代表处均为15个组织；`region-ready.ax.txt`、`representative-ready.ax.txt` |
| 主查询无行 | 其他两组仍形成14行；`empty-main.ax.txt` |
| 所有查询无行 | 0行，不制造零分组织；`empty.ax.txt` |
| 单项全缺但组织存在 | ORG-03单项`--`、总分0.0；截图及行为回归 |
| 空字符串/空白 | ORG-04/ORG-05客户评价显示`--`；数值字符串0显示0.0 |
| 真实0/负分 | ORG-01声音闭环0；ORG-06为8+(-2)=6；第二页保留ORG-15总分10 |
| 来源失败/已知计数不完整/来源重复键 | 内部快照error，不输出部分总分。失败和截断浏览器证据：`error.ax.txt`、`truncated.ax.txt` |
| 筛选切换/迟到结果 | 新批次等待全部依赖；旧请求取消，迟到组织及999旧得分不会进入新结果 |
| 通用场景 | `/pages/union-keys-demo` 展示3个组织、真实0、全缺总分0、负数与`--`；`capability.ax.txt` |

入口：`http://localhost:5173/pages/partner-health-union-null-probe`。参数`state=emptyMain|empty|error|truncated|duplicate`；默认ready。Mock浏览器正常状态无console error。表格默认每页10条，下一页可见辅助查询独有的ORG-15及真实0的ORG-01。

沿用现行统一呈现策略：查询/计算错误保留在内部快照与诊断，组件界面投影为空数据。本轮没有改变全局错误呈现策略，也没有把错误当成合法缺项或输出零分。以上为合成响应、实际本仓执行与浏览器证据，未验真实DQE/集成应用/部署。

## 检查

- `final-related-tests.log`：137个测试文件、1383项通过，覆盖page、data-execution、计算编排、组织批次、伙伴健康度、原文容错、完整性及API边界。
- `final-focused-tests.log`：7文件62项通过，精确覆盖本批新能力及相关接口。
- `local-authoring-tests.log`：独立Skill34项通过，包括仓外安装与哈希/知识链接闭合；另已将完整Skill复制至仓外并校验正式页面，见`independent-skill.json`、`skill-validation.json`。
- 页面目录137/137通过；Playground类型检查0错误/0告警，生产构建通过；`git diff --check`通过。
- `mc-content-check.log`：MC完整检查链通过，来源覆盖一致、33项Python测试通过、诊断可见夹具一致。Schema升级引起的MC诊断页面及报告已用官方生成器同步。
- `contracts-check.log`：官方生成产物一致性通过（1295 product、4 authoring、1 interface）。Schema、协议正文、完整示例、版本/哈希/独立校验器及MC内容同源生成；Skill1.10.0。新增派生内容不是手写第二份协议。

生成在本任务独立临时检出完成；期间并行任务更新了根package.json的Skill脚本，作为当前工作区的只读公共输入快照同步到生成检出以保持源摘要一致；未修改该manifest或repair Skill，本批范围交付时须按交付检出的输入重新生成。保留原有sum-fields-zero本地示例作为冻结输入，不修改用户原有AGENTS.md、platform README或该示例。生成前3个已有派生文件的字节备份在`/Users/moon/.codex/backups/partner-health-union-before-20261029/`。

扩展全仓测试未宣称全绿：原先本地未跟踪的`sum-fields-zero.json`页面id与既有同名能力标识字符串碰撞，使page-id-neutrality扫描失败，HEAD中的version.ts已含该字符串；本轮不改用户该示例。最初全仓尝试还发现当前版本示例/API快照需同步，已更新并由定向回归验证。全仓/扩展authoring执行中有生成子进程等待stdin EOF，已停止该次长时间执行，改用精确回归及独立校验留证。

MC注册读取的本机stdin传输问题使用临时Python启动器，将完整JSON图校验后交给文件stdin提供确定EOF；仍调用原始mc-contracts.py和项目venv，不改变产品/校验规则。系统python3缺jsonschema时，使用项目venv的PATH执行Python检查；相关日志保留。这是本地校验环境处理，不属于页面协议或运行时。

## 复杂度

固定口径：TypeScript5.9.3、`metriccanvas-ts-ast/1`，selfCC逐函数计数，含全部新增辅助函数/回调。Svelte只抽取script测量，不把模板当TS解析。原始报告见`complexity-before.json`、`complexity-after.json`、`preview-complexity.json`。

| 修改函数 | 前→后 |
|---|---|
| 计算快照visit | 27→5，拆分依赖收集、状态处理及行求值，各新辅助函数≤9 |
| computeOutputFields | 13→15 |
| sourceComputeErrors | 9→10 |
| normalizeScalar | 11→14 |
| applyComputation | 5→6 |
| 页面loadPage脚本 | 13→14 |
| pageExternalInputs / scenarioEnvironment | 13→14 / 10→11 |

新增unionKeys自身6、键投影回调8，Mock fetchData10。修改及新增函数均≤15，无本批超限未关闭项；扫描到的未修改parsePage自身31为既有债务，不据此扩大本批重构。

临时生成检出通过Codex归档流程保存可恢复快照；主工作区与用户原有本地修改保留。无本批新分支、远端提交或CI任务。
