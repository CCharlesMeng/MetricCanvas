---
name: metriccanvas-local-authoring
description: 在本地创建、继续开发旧版本或修复 MetricCanvas 页面 JSON，将旧页头迁移为 iocHeader；也可结合指标说明 MD 识别用数与查询缺口。附协议知识、升级工具和独立校验器；用于看板、报表和 IOC，线上工具编排不属于此入口。
metadata:
  version: "1.11.4"
---

# 本地页面创作

直接编辑用户指定文件。知识与脚本只用本 Skill 目录；用户页面、设计源、指标说明和数据契约可在项目内。无需其他 Skill、仓库源码、在线 MCP 或 npm 安装，脚本需要 Node.js 22+。

已有页面在编辑前先运行 `node "<skill-dir>/scripts/upgrade-page.mjs" "<page-file>"`。`unchanged` 继续原任务；`ready` 按[旧页面继续开发](references/page-upgrade.md)保留原件、升级并接回工作文件；`blocked` 先按该说明校验原页，原版有效且本次能力已支持时保留原版本继续局部开发，否则处理明确缺口。旧版本不必由用户手动改成最新版，也不因可迁移的版本报错中止原任务。

## 选择任务路径

| 本次任务 | 读取与动作 |
|---|---|
| 旧 header 换成 iocHeader | 读[页头迁移](references/ioc-header-migration.md)，从原始页面元数据盘点功能、默认行为与依赖，按映射最小替换并双向对账；沿用原布局形态。 |
| 局部呈现或已有可信字段绑定修改 | 定位相关对象，沿用原形态、数据和查询，直接改最小对象；只查受影响属性。大页面按对象提取，不打印全部数据行。 |
| 指标表、详情表、级联或多来源等逻辑选型 | 按[场景索引](references/scenario-index.md)选择操作与数据逻辑，只读命中的主题和示例。 |
| 新增口径、指标匹配或查询修改 | 读[数据识别与接数](references/data-analysis.md)，先确认数据依据和项目已提供的执行入口，再分析受影响范围。完整报告按需生成。 |
| 新建、整页重组、切换形态 | 读[形态识别与确认](references/page-form.md)，确认本目标页 Dashboard/Report 后，只选[看板](references/dashboard-patterns.md)或[报表](references/report-patterns.md)的一张范式卡与摘要。 |
| 已确认Report的区域划分、背景或卡片布局调整 | 读[报表范式](references/report-patterns.md)指向的PC章节组合，先判断表达与卡面边界，再查相关组件属性；沿用已确认形态和数据。 |
| 删除列、组件、数据源或筛选 | 按[场景索引](references/scenario-index.md)核对完整引用与共享依赖，删除目标后完整校验。 |
| debug：报错、没数据、数不对或交互失效 | 按[场景索引](references/scenario-index.md)从症状定位失败层，再检查相应数据逻辑。 |

用户已明确指定形态或已有有效确认且无冲突时引用选择后继续；实质冲突按形态说明针对性确认。未确认时只交识别摘要和问题，不生成 JSON、模板或章节骨架。局部修改沿用原形态；新页面显式写 layout，省略会默认 report。

## 精确查阅

普通使用直接运行脚本、读取 JSON 回执；接口疑问先查目录内对应说明；声明支持 --help 的脚本可先取帮助。压缩 .mjs 是执行产物，仅排查脚本自身故障时读取。

从版本命令取 schemaVersion，不读取完整哈希清单。将 skill-dir 替换为实际安装目录：

```sh
node "<skill-dir>/scripts/validate-page.mjs" --version
node "<skill-dir>/scripts/read-knowledge.mjs" list --module table
node "<skill-dir>/scripts/read-knowledge.mjs" show --topic table.width
```

已知主题直接 show，可重复 --topic 合并查阅。常用入口：page.core、layout.core、data.inline/query/pagedJoin/pagedUnion/recovery、fields.core/format、query.core、table.columns/width/search/pagination/export、metricCard.core/title、text.core、filters.time、reportHeader.export。斜杠表示分别独立的主题，如 data.query。

脚本返回语义原文、局部约束、未展开引用和完整参考路径；需要引用类型时继续检索所属模块。其他能力从[专题查阅](references/protocol-routing.md)或[协议索引](references/page-metadata/README.md)定位。完整示例按实际变体读取；概览需要时读[布局](references/overview-layouts.md)和[短写法](references/component-recipes.md)，涉及地图再读[地图绑定](references/map-bindings.md)。主题不存在/工具失败时深查完整参考，说明精确读取未执行，不能当成没有约束。运行时不兼容时说明差异，不降版本绕过能力下限。

## 数据与验证

生成 DQE 查询遵循[数据识别与接数中的中文业务标识规则](references/data-analysis.md)。

新增/修改查询需可信数据上下文，真实执行后才写回目标页。无执行环境时保留未执行候选，继续完成可验证部分。演示用 inline 并说明性质；名称匹配、静态通过、用户确认或演示行不证明真实取数。

局部任务改最小对象；整页生成先总结原始需求覆盖，再组织章节、组件、数据源与交互。验收期望来自原始输入，不从生成结果反推。明确要求运行时 SSE 才用 aiSummary。业务数值、百分刻度、完整性、initial、日期与交互按[本地创作与验收](references/local-workflow.md)命中的章节核对。

每次完整生成后、校验前按[尝试快照](references/local-workflow.md)冻结原始字节，保留失败样本；随后完整校验：

```sh
node "<skill-dir>/scripts/validate-page.mjs" --expected-layout dashboard "<page-file>"
```

expected-layout 来自有效用户确认；Report 使用 report。局部修改可只传文件。退出码 0/1/2 为通过/文档错误/调用错误；保留 type/path/message，修复后重跑。目录模式递归读取子目录的 .json；单页任务传精确文件，快照放扫描范围外。不得放宽规则或删合法配置掩盖错误。Node 不可用时说明自动校验未执行。

有目标运行时则按[本地流程的预览与修复](references/local-workflow.md)自行预览精确文件和所涉交互；在自身页面范围内修复并复验呈现问题，每轮保留快照。Report按章节组合先明确卡面归属，再检查实际卡面与主辅信息。设计还原附截图对照，查询变动保留真实请求/响应证据。缺环境时继续完成可验证部分，静态、浏览器、真实取数分别报告。

## 交付与分发

报告文件位置、校验结果和缺口；新建/整页修改补充形态依据、范式与需求覆盖。纯数据识别只交所需匹配与缺口。本地文件不等于线上保存或发布。

安装与回退复制完整目录，含 references、assets、scripts，知识与校验器同版替换。流程由作者维护，知识及脚本从产品真源生成，安装副本只消费。仅维护/升级时读[知识维护](references/maintenance.md)。
