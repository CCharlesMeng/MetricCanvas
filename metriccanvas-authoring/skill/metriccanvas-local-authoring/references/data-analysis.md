# 页面元素、指标匹配与查询数据源

输入：页面 JSON、指标/指标表说明 MD，可附修改范围、已验证查询和执行环境。材料可不齐；先输出确定的对应关系和缺口。指标表不等于页面数据源，物理字段名不等于 DQE 标识。权限事实、数据上下文快照与执行证据来自项目真实材料/环境。

## 扫描和检索

命令只读输入，JSON 输出可重定向到用户工作目录。Node.js 22+，skill-dir 为安装目录：

```sh
node "<skill-dir>/scripts/analyze-data.mjs" scan --page page.json
node "<skill-dir>/scripts/analyze-data.mjs" index --md metrics.md
node "<skill-dir>/scripts/analyze-data.mjs" find --md metrics.md --search 签约金额 --search contract_amount --limit 5
node "<skill-dir>/scripts/analyze-data.mjs" draft --page page.json --md metrics.md
```

scan 返回嵌套组件、数据槽、字段、动态文字/条件/关联数据的用数位置与诊断，不打印 inline/initial 行。index 返回章节、块 id 和行号；find 返回字面命中的原文块、检索块数和未展示命中数；draft 给逐字段候选与按源/字段去重的缺口。名称检索不是语义匹配。

先用字段标签、id、queryField、组件上下文检索，核对原数据源。未命中时尝试别名/业务域，再扩大章节范围；只查过部分不能宣称全文没有指标。任意 MD 的语义由模型阅读原文提取；首次可能需要分批覆盖全文，计入冷启动成本。中间产物绑定页面/MD 内容哈希，材料改变重新分析。

## 补全报告

以 draft 为起点编辑 page-data-analysis.json，保留 use 与输入身份。matching 为 unresolved/matched/ambiguous/not-found/conflict，execution 保持 not-run。matched 提供 metricName、reason 与 evidence；证据对象为 `{from:起始行,to:结束行,quote:"原文片段"}`。未解决条目引用 gaps 中问题 id，问题 paths 列出所有影响位置。另写 Markdown 摘要供审阅。

核对业务名/别名、口径、单位/币种、比率刻度、可加性/时间聚合、可用维度、行粒度与查询标识。整理指标、分组维度、时间窗口/粒度、固定条件、筛选/参数绑定、排序分页与完整性要求；每项注明页面/MD 依据、建议或未知。建议不作为事实；同名不同口径并列证据，缺连接键/基数不猜连接，缺可加性不折叠已有行，比率核对分子分母/零分母规则。

缺口按共同原因合并，先问影响全页的时间/组织范围，再问个别指标。无执行环境仍可交匹配报告；补用数时保持布局，不读整页范式。

```sh
node "<skill-dir>/scripts/analyze-data.mjs" check --page page.json --md metrics.md --report page-data-analysis.json
```

check 验证输入哈希、位置覆盖、状态、证据范围/原文和问题引用。它不能自动判定业务解释正确，模型仍需给理由。退出码 0 为结构/引用通过，1 为报告/候选错误，2 为调用/文件错误；不能删除未解决位置制造覆盖率。

## 候选与写回

有真实 DQE 映射和充分条件时，按协议写 proposals.json：键为原有页面数据源 id，值为完整页面数据源声明。受影响条目均须 matched，missing 为空；条件未明确时先停在报告。

```sh
node "<skill-dir>/scripts/read-knowledge.mjs" show --topic data.query --topic query.core --topic fields.core
node "<skill-dir>/scripts/analyze-data.mjs" prepare --page page.json --md metrics.md --report page-data-analysis.json --proposals proposals.json
```

prepare 在内存替换拟改源，运行产品页面校验，输出候选或静态错误；每个 queryField 须在该字段的引用证据范围内出现。execution 仍为 not-run。不写页面、不添加未验证 initial、不直接把表名当 DQE 指标，不改用任意 SQL。新增源/组件走普通页面创作流程。

项目有执行入口时再运行候选，记录请求/响应、条件、字段、粒度与完整性；修复失败候选。真实验证后更新工作页面的 source、fields、queryField 与绑定。initial 只能采用匹配查询和初始条件的真实结果。共享查询需满足指标/维度/时间/条件/范围与消费者限制，分页独占/pagedJoin 规则仍适用。

最后快照、完整校验、预览所涉交互。无环境时交分析 JSON、可读摘要和 query-candidates.json，明确候选未执行，原目标页保持不变。报告是创作期工作产物，不是页面协议字段，不放进 Skill 安装包。
