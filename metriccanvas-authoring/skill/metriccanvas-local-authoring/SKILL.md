---
name: metriccanvas-local-authoring
description: 在本地开发 MetricCanvas 看板、报表和 IOC：新建页面、对接数据与查询、调试页面问题、调整已有页面。附协议知识、数据分析与升级工具、独立校验器；线上保存和发布使用项目提供的接口。
metadata:
  version: "1.59.0"
---

# 本地页面创作

直接编辑指定文件。知识与脚本只用本目录，用户页面、设计源、指标说明可在项目内。需要Node.js 22+，不依赖仓库源码、其他Skill或在线服务。

## 按任务开始

| 任务 | 入口与交付 |
|---|---|
| 新页面开发 | 按下方“新建与结构调整”从需求和真实输入装配完整页面；核对需求涉及的字段、组件及交互，再执行完整校验。数据未接通时明确区分演示页面与待执行候选。 |
| 数据对接 | 读[数据识别与接数](references/data-analysis.md)，核对查询依据、结果契约与绑定；有执行入口则验真，无入口按该文交候选和缺口。换源核对共享消费者；保持页面意图的关联按需读[受控换源](references/data-association.md)。 |
| bug调试 | 读[页面调试](references/page-debugging.md)，从实际错误或复现现象定位失败层，完成原因、修改、复验及未验条件的闭环。 |
| 页面调整 | 走下方局部修改；结构调整、删除依赖、页头迁移和升级按[专项路由](references/task-routing.md)选择对应分支。 |

任务可组合：先完成阻塞页面的取数或错误定位，再进行受影响的装配或调整。以用户要求的页面文件、查询候选或诊断结论为产物，不要求每类任务都创建分析报告。交付分别说明配置校验、真实取数和运行时行为的已验范围。

## 已有页面的局部修改

已有页面在编辑前先运行 `node "<skill-dir>/scripts/upgrade-page.mjs" "<page-file>"`。`unchanged` 继续原任务；`ready` 按[旧页面继续开发](references/page-upgrade.md)保留原件、升级并接回工作文件；`blocked` 按该说明处理语义缺口。新增特性先完成其中的“新增特性的版本闭环”，由 Skill 自动升级到安装包当前协议并复验，不把版本选择交给用户；仅原版有效且本次能力已支持时才保留旧版本局部开发。新建页面也从版本命令取当前版本。

局部修改沿用原形态、数据和查询。定位目标后，读取当前配置和所涉字段契约；配置中的绑定、format及missingText用于确定最小差异，字段类型/defaultFormat及刻度用于判断适用性：

```sh
node "<skill-dir>/scripts/read-knowledge.mjs" find --kind component --document "<target.json>" --query "<标题或id>"
node "<skill-dir>/scripts/analyze-data.mjs" scan --page "<target.json>" --at "<返回documentAt或其内属性>" --select config
node "<skill-dir>/scripts/analyze-data.mjs" scan --page "<target.json>" --at "<返回documentAt>" --select fields --field "<field-id>" [--field "<另一目标field-id>"]
```

同组件多个字段可重复--field合并读取，仍分别核对契约。位置已知就跳过发现。回执page含版本/形态；只有槽与来源对应关系不清时才补bindings。改变共享字段契约或来源时读取consumers；仅修改组件局部绑定时，以差异检查确认共享声明与其他组件保持，无需枚举消费者。大对象按回执收窄/续查，重复id用准确路径。需要样本或读取受限时看[局部读取](references/target-reading.md)。默认不读数据行/查询体；自由投影用明确字段白名单，编辑只输出路径、哈希和差异断言。

既有列/指标只改精度、正负号、时间或展示单位，走下方关联契约后直接修改、快照和完整校验。

改变IOC页头、来源/查询体、关联逻辑、期间策略、删除依赖、Report布局或定位运行错误，读[专项路由](references/task-routing.md)对应行；旧IOC页头先盘点功能、默认行为和依赖再迁移。保留已有查询不触发查询创作；URL/导航参数按实际Schema上下文识别，已有同型绑定只核对新字段和差异。新增口径/换源先有数据依据；新增/改绑数值、改变刻度或单位冲突才做[有效绑定检查](references/authoring-presentation.md#numeric-binding)。

## 新建与结构调整

新建/跨页复用找匹配合法示例并保留结构；只查实际差异。形态不明或冲突时读[形态识别](references/page-form.md)，重新组织内容才选[看板](references/dashboard-patterns.md)或[报表](references/report-patterns.md)范式。新页面显式layout；省略默认report，局部任务保留原形态。

目标文件尚不存在时，从 `read-knowledge.mjs find --kind example --owner <组件类型> --query <能力词>` 发现示例；component目录定位的是已有目标页中的组件，待页面存在后才使用。先取示例outline，用返回的对象path读取snippet，不猜根路径或示例内部位置。按[渐进读取](references/knowledge-consumption.md)补齐实际移植依赖。

页面外壳复用包内完整合法页面，或用 `read-knowledge.mjs show --topic page.core` 核对根结构；新增字段只沿实际Schema上下文确认。新建或重命名页面、数据源、组件等标识时分别核对所属契约，不能把某一命名空间的规则套到其他位置。页面标题和组件页头分别使用各自声明位置；保留示例已合法的结构，不凭通用JSON习惯增加根属性。

## 知识与停止条件

当前事实用scan。修改字段绑定的数字精度/百分比、带符号数值、UTC+8时间或列/系列单位时，用实际绑定位置直接读取关联契约：

```sh
node "<skill-dir>/scripts/read-knowledge.mjs" resolve --document "<target.json>" --at "<字段绑定的documentAt>" --aspect numeric-format
```

按本次变化选择一个方面：普通精度/百分比用 `numeric-format`；带正负号用 `signed-number`（已含普通数值基础规则）；时间用 `time-format`；添加单位用 `display-unit`。只改精度不读取单位专题。单位方面使用绑定所属列/系列位置，其他方面使用field/valueField等实际绑定位置。

结果组合合法结构和产品行为原文；有next时在同一命令追加 `--cursor "<next的值>"` 补齐所选契约（续页替换cursor）。同版、相同Schema上下文及方面复用规则；每个目标独立核对配置、类型/defaultFormat和刻度。不同组件分支、版本或条件绑定再resolve，不能复用适用性。coverage只代表已登记范围，acceptance不是运行验收；unregistered/partial只补回执指出的具体缺口。已覆盖的规则不再通过示例、专题或逐属性Schema重复确认。

其他合法结构和行为用read-knowledge的find/show。已知id直接show，语义可按已选example限域，原样保留的结构不逐属性复查。属性结构疑问优先 `find --document <file> --at <准确对象> --query <属性>` 沿当前上下文解析引用，不猜Schema owner名或逐层手追已可解析的引用。只有具体疑点再读[渐进读取](references/knowledge-consumption.md)相关段落。已知命令不取help，不读压缩脚本或机器知识包。

每轮只补位置、差异、输入前提或行为边界的具体缺口；needs-expand继续收窄，空目录不证明能力不存在。不得降低需求换校验通过。

位置、配置、输入类型及本次行为/约束明确后，停止知识查询并做最小修改。显示和导出分别核对；界面默认值不能证明导出行为，要求一致时确认必要显式声明。验收期望来自原始输入，不从结果反推。

## 修改与验证

新页面用 `node "<skill-dir>/scripts/validate-page.mjs" --version` 取当前版本。已有页局部核对原schemaVersion；能力下限不足或含可迁移旧形状时，按[旧页升级](references/page-upgrade.md)运行upgrade-page，不因增加现行已支持属性而例行升级。

已有页局部修改：在编辑前用 `snapshot-attempt` 冻结原件，保留回执file和sha256；根据需求确定允许修改的准确JSON Pointer（例如目标列的field，不扩大到整个组件或页面）。

```sh
node "<skill-dir>/scripts/snapshot-attempt.mjs" "<page-file>"
```

编辑完成后只需一次局部验收，允许范围可重复--allow；形态已确认时带--expected-layout：

```sh
node "<skill-dir>/scripts/finish-edit.mjs" --page "<page-file>" --baseline "<原件快照file>" --baseline-sha256 "<原件sha256>" --allow "<目标绑定pointer>" --expected-layout dashboard
```

回执包含候选快照、实际变更路径、范围外不变检查和完整页面校验。非目标内容按JSON值比较；对象键顺序与125000.0/125000的数字写法不影响结果，数组顺序和类型仍严格检查。static-verified后，复用回执完成静态报告，无需再次scan、diff、cmp或重复快照/校验；业务意图与屏幕/导出仍按需求分别验收。退出0/1/2分别为静态通过/候选被拒绝/调用错误；拒绝时保留快照与错误，只修复实际缺口再运行，原件基线保持。

新建、升级另存或尚无准确变更范围的任务，沿用 `snapshot-attempt.mjs <page-file>` 后对回执file运行 `validate-page.mjs <snapshot-file>`；不要为使用局部验收而放宽允许范围。快照细节仅按需读[尝试快照](references/local-workflow.md#尝试快照)。

保留原始数据、查询、筛选、权限、分页、导航和非目标内容。局部读取不缩小完整校验范围。新建/重组核对需求覆盖，实际新差异再读[本地验收](references/local-workflow.md)对应章节，Report核对卡面归属。明确要求运行时SSE才用aiSummary。

有目标运行时就预览精确文件和受影响交互/导出，按[预览修复](references/local-workflow.md#预览与修复)修复自身呈现问题。缺环境继续可验证部分，结构、浏览器、导出、真实取数分别报告；inline演示不冒充服务成功。报告产物位置、依据、检查和缺口；新建/重组补形态依据。清理仅按[临时产物](references/local-workflow.md#临时产物生命周期)实际情况执行，失败留最小恢复现场，本地文件不等于线上发布。

安装/回退复制完整目录，同版替换知识与校验器；维护升级才读[维护说明](references/maintenance.md)。
