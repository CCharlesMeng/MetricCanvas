---
name: metriccanvas-local-authoring
description: 在本地创建或修改 MetricCanvas 页面 JSON；也可用页面 JSON 和指标说明 MD 识别用数、匹配指标、整理查询条件与缺口。附协议知识和独立校验器；用于看板、报表和 IOC，线上工具编排不属于此入口。
---

# 本地页面创作

直接编辑用户指定文件。知识与脚本只用本 Skill 目录；用户页面、设计源、指标说明和数据契约可在项目内。无需其他 Skill、仓库源码、在线 MCP 或 npm 安装，脚本需要 Node.js 22+。

## 选择任务路径

| 本次任务 | 读取与动作 |
|---|---|
| 局部呈现修改 | 定位原页面相关对象，保留原形态、数据与查询；只查受影响属性。大页面用脚本提取结构，不打印全部数据行。 |
| 数据源生成、指标匹配、查询或交互修改 | 读[数据识别与接数](references/data-analysis.md)，先交付有来源的匹配、取数条件和缺口；只查所涉协议主题。 |
| 新建、整页重组、切换形态 | 读[形态识别与确认](references/page-form.md)，确认本目标页 Dashboard/Report 后，只选[看板](references/dashboard-patterns.md)或[报表](references/report-patterns.md)的一张范式卡与摘要。 |
| 校验修复 | 按 type/path/message 定位最上游声明，查相关主题；跨引用核对两端，修复后完整校验。 |

用户已明确指定形态或已有有效确认且无冲突时引用选择后继续；实质冲突按形态说明针对性确认。未确认时只交识别摘要和问题，不生成 JSON、模板或章节骨架。局部修改沿用原形态；新页面显式写 layout，省略会默认 report。

## 精确查阅

普通使用直接运行脚本、读取 JSON 回执；接口疑问先用 --help 和目录内说明。压缩 .mjs 是执行产物，仅排查脚本自身故障时读取。

从版本命令取 schemaVersion，不读取完整哈希清单。将 skill-dir 替换为实际安装目录：

```sh
node "<skill-dir>/scripts/validate-page.mjs" --version
node "<skill-dir>/scripts/read-knowledge.mjs" list --module table
node "<skill-dir>/scripts/read-knowledge.mjs" show --topic table.width
```

已知主题直接 show，可重复 --topic 合并查阅。常用入口：page.core、layout.core、data.inline/query/pagedJoin、fields.core/format、query.core、table.columns/width/search/pagination/export、metricCard.core/title、text.core、filters.time、reportHeader.export。斜杠表示分别独立的主题，如 data.query。

脚本返回语义原文、局部约束、未展开引用和完整参考路径；需要引用类型时继续检索所属模块。其他能力从[专题查阅](references/protocol-routing.md)或[协议索引](references/page-metadata/README.md)定位。完整示例按实际变体读取；概览需要时读[布局](references/overview-layouts.md)和[短写法](references/component-recipes.md)，涉及地图再读[地图绑定](references/map-bindings.md)。主题不存在/工具失败时深查完整参考，说明精确读取未执行，不能当成没有约束。运行时不兼容时说明差异，不降版本绕过能力下限。

## 数据与验证

原页面、指标说明可支持需求分析和查询候选；新增/修改真实查询还需可信数据上下文与实际执行依据。页面字段 id、筛选器 dimension、DQE 字段显式映射。名称匹配、静态通过、用户确认或演示行不证明真实取数。演示用 inline 并说明性质；未知时间、口径、单位、比率分母或连接关系列为缺口。

局部任务改最小对象；整页生成先总结原始需求覆盖，再组织章节、组件、数据源与交互。验收期望来自原始输入，不从生成结果反推。明确要求运行时 SSE 才用 aiSummary。业务数值、百分刻度、完整性、initial、日期与交互按[本地创作与验收](references/local-workflow.md)命中的章节核对。

每次完整生成后、校验前按本地流程运行[快照脚本](scripts/snapshot-attempt.mjs)，用新 attempt-N 冻结原始字节；修复只改工作文件，不覆盖或重建失败样本。运行：

```sh
node "<skill-dir>/scripts/validate-page.mjs" --expected-layout dashboard "<page-file>"
```

expected-layout 来自有效用户确认，不从产物反推；Report 使用 report。无新增形态确认的局部修复可只传文件。退出码 0/1/2 为通过/文档错误/调用错误；保留 type/path/message，修复后重跑。目录模式只读该层 .json，避免混合目录。不得放宽规则或删合法配置掩盖错误。Node 不可用时可按参考生成，说明自动校验未执行。

有目标运行时则预览精确文件和所涉交互；设计还原附截图对照，查询变动保留真实请求/响应证据。缺环境时继续完成可验证部分，静态、浏览器、真实取数分别报告。

## 交付与分发

报告文件位置、形态及确认依据、整页所用范式/需求覆盖、校验结果和缺口。纯数据识别只交匹配/条件/问题报告，不必先生成页面；候选或本地文件不等于真实查询、线上保存或发布。

安装与回退复制完整目录，含 references、assets、scripts，知识与校验器同版替换。流程由作者维护，知识及脚本从产品真源生成，安装副本只消费。仅维护/升级时读[知识维护](references/maintenance.md)。
