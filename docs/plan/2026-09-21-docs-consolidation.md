# 过程性文档聚合瘦身方案

2026-09-21。状态：**五步全部结清**——S2、S4、S5、S3 已执行（§4.1–§4.5），S1 裁决为不做（§4.6）。本轮验证见 §7。

本文处理**过程性文档**（计划、交接、grill 记录、验收实证、调研报告）的组织方式，不改任何决策结论，不删任何 ADR 正文。

## 1. 全仓盘点

> 本节是**清理前**的快照，保留原样作为对照，不随执行更新。执行后的形状见 §5。

`docs/` 下 347 个文件（306 份 md），5.6 MB。按性质分三类：

| 类别 | 文件数 | 说明 |
|---|---|---|
| 过程性文档 | **207** | `docs/plan/` 175、`docs/reviews/` 22、`docs/specs/` 2、`docs/superpowers/` 4、根目录 dataset 三件套 3 |
| 有生成关系或工具契约，不动 | 43 | `docs/page-metadata/` 36、`docs/design-facts/` 3、`docs/agents/` 3、`docs/examples/` 1 |
| 正式文档 | 8 | `solution.md`、`host-contract.md`、`runtime-architecture.md`、`frontend-runtime-capabilities.md`、`page-building-process.md`、`schema-metadata.md`(+schema)、`pangu-development.md` |

**过程性文档占 `docs/` 的 68%，且散在六个地方。** 这是比"文件多"更根本的问题——同一类东西没有单一去处，所以谁也不知道该往哪放、什么时候该清。

### 1.1 `docs/plan/`（175 份，2.4 MB）：四类寿命混装

- **在执行中**（24 份）：`2026-09-17` 之后新建、多数尚未提交。`2026-09-20-authoring-*` 五份、`2026-09-18-authoring-mcp-*` 两份、`2026-09-17-*` 两份、`2026-09-20-data-context-*` 三份、`2026-09-20-grouped-page-params.md`、`scenario-guided-authoring/` 9 份、`page-parameter-inlining/` 2 份。
- **已收口批次的交接**（约 140 份）：`wayfinder-*` 9、`ioc-*` 顶层 7 + `ioc-1980-width/` 19、`java-*-handoff` 3、`metriccanvas-agent-*` 4、`authoring-tickets-126/` 75、`2026-09-14/15/16` 统一创作批次约 26。这些文件顶部普遍写着"本文是历史快照""已被 XX 取代"，却仍与活计划同级摆着。
- **机器证据**（35 个 json/txt/py）：`2026-09-20-data-context-semantic-evidence.json` 164 KB、`t04-contract-examples.json` 140 KB、`2026-09-15-unified-authoring-s0-sources.json` 88 KB。是测试夹具和执行留痕，不给人读。
- 已被 ADR 或正式文档吸收的草稿。

### 1.2 `docs/reviews/`（22 份，336 KB）：两种东西，但不是按新旧分

盘完发现它**不能整体归档**，里面混着性质完全不同的两类：

**票据交付实证（14 份）**——`2026-09-07` 到 `09-10`，每份 4–8 KB，标题格式高度统一：`#113 公开面收口验证`、`#114 可发布构建验证`、`#115 仓外产物与最低版本验证`、`#116 契约同版与 rc.1 定版`、`#104 纯前端静态平台实施记录`、`#108 本地页面接收状态切片`、`#125 旧对话清理实证`、`#103 发布与异构集成执行记录`、`#56 创作隔离`、`#109 URL 导航`、`#122/#124 工作台与契约解耦`、`#125 旧链退出首批`、`#122 旧链历史基线`。

这些和 `docs/archive/authoring-tickets-126/t01-evidence.md` … `t20-evidence.md` **是同一种东西**，只是一批放在 `plan/` 一批放在 `reviews/`。目录名没有区分它们的判据。

**被 ADR 正文或代码当论据引用的（5 份）**——这类不是过程件，归档会切断引用链：

| 文件 | 被谁当论据 |
|---|---|
| `2026-08-chat-bi-competitive-research.md`（84 KB） | ADR-0039、ADR-0040 **正文**直接引用，是两份决策的论证依据 |
| `2026-08-frontend-calculation-reconciliation.md` | `ioc-operation-map.md` 三处称其为空值语义的"替代真源" |
| `2026-08-packages-architecture-review.md` | `packages/page/tests/schema-boundaries.test.ts` 注释 |
| `2026-09-08-legacy-baseline.md` | 根 `README.md`；且它是 git tag `legacy/pre-static-platform-2026-09-08` 的唯一索引，丢了就找不回旧链 |
| `2026-08-ioc-harness-capability-review.md` + `-action-pack.md`（72 KB） | 互为索引，IOC 批次的证据档案 |

这引出方案里原先没有的第四种寿命类别，见 §3.1。

### 1.3 另外四处

- **`docs/` 根目录混着过程件**：`dataset-handoff.md`（17 KB）与 `dataset规划.md`（24 KB）是 ADR-0033 **已挂起**（proposed，未实现）的服务端计算数据集的过程文档，最后改动 2026-08-25，却和正式文档同级。例外是 `dataset-reconciliation.md`——`docs/adr/README.md` 的未决事项段引用它作为 ADR-0033 恢复条件的逐条对账，属证据附件。
- **`docs/specs/`（2 份，60 KB）**：`2026-09-14-platform-authoring-lifecycle.md`、`2026-09-15-unified-authoring-skill.md`，和 `docs/plan/` 里同日期的统一创作批次是一套，应随批次走。
- **`docs/archive/superpowers-specs/`（4 份，36 KB）**：外部 skill 留下的设计稿，2026-07/08，全仓无人引用，结论已进 ADR-0017 / 0019 / 0038。纯孤儿。
- **`docs/research/`（5 份，236 KB）**：与竞品研究同性质，需按"是否被 ADR 当论据"逐份判定。

### 1.4 `docs/adr/`（84 份，644 KB）：聚合自己成了新单体

`docs/adr/README.md` 单文件 90 KB / 308 行，装了速查表加 15 个主题结论段，全靠手工同步。83 份 ADR 的"现状"列里只有 49 份是干净的"现行"，其余 34 份是各写各的自由文本（"部分取代 0062""已被 0060 取代""#100 已裁决；发布门禁与目录重组待执行票"）。改一个主题要动 90 KB 文件，diff 不可读。

**单份 ADR 不自洽**：只有极少数有 frontmatter（`0081` 写了 `status: accepted`），要判断一份今天是否生效必须回表——这正是 README 瘦不下来的原因。

## 2. 不能乱动的文件

被代码硬引用，移动必须同步改引用方，否则测试直接红：

| 文件 | 引用方 |
|---|---|
| `docs/archive/unified-authoring/2026-09-15-unified-authoring-s0-sources.json` | `tests/page-reference.test.ts` |
| `docs/archive/authoring-tickets-126/t04-contract-examples.json` | `packages/engine/runtime/tests/execution.test.ts`、`apps/platform/tests/workbench/revision-preview-execution-browser.mjs` |
| `docs/archive/authoring-tickets-126/t18-execution-contract.md` | `packages/embed/README.md` |
| `docs/archive/ioc-operation-map/ioc-legacy-handoff.md` | `packages/engine/widgets/src/assets/README.md` 及两个 svg 注释 |
| `docs/archive/ioc-operation-map/ioc-operation-map.md`、`ioc-project-map-wip-closeout.md` | `docs/adr/README.md` |
| `docs/reviews/` 上表五份 | ADR 正文、根 README、`schema-boundaries.test.ts` |

另有 `PAGE-METADATA.md`、`PAGE-PARAMETERS.md` 若干处链接 `docs/plan/`，执行时一并扫描修正。

`docs/page-metadata/` 是 `tools/scripts/page-reference.ts` 的作者语义输入（生成 `contracts/`），`docs/design-facts/` 是 `pnpm design:facts` 产物且有 `design:facts:check` 门禁——两者都不是文档组织问题，不碰。

## 3. 方案

聚合的实质不是把 200 份合并成一份大文件——那只是换个地方堆。是**把同类东西收到单一去处、把结论抽进正式文档、让过程件降级为可查但不在探索路径上的历史**。

### 3.1 四种寿命，四个去处

判据是**这份文件还会被改吗、还会被当论据引吗**：

```
docs/plan/        在执行中：还有人按它干活，或还有未完成任务
docs/evidence/    证据附件：被 ADR 正文或代码当论据引用，跟决策走，不跟批次走
docs/archive/     已收口批次：只读、不更新、探索时默认不读
tests/fixtures/   机器证据：测试夹具与契约样例，不算文档
```

> 第四层的落点在执行时改了：仓里没有统一的 `tests/fixtures/`，既有约定是**夹具跟着消费者走**。见 §4.6。

`docs/evidence/` 是本轮盘点新增的一层。没有它，`2026-08-chat-bi-competitive-research.md` 这种被两份 ADR 当论证依据的报告只能二选一：留在 reviews 里继续和票据实证混着，或者归档后切断 ADR 的引用链。两个都不对。

按判据划分：

| 去处 | 内容 | 约计 |
|---|---|---|
| `docs/plan/` | `2026-09-17` 之后的在做项 | 24 |
| `docs/evidence/` | reviews 的 5 份（6 个文件）+ `dataset-reconciliation.md` + `docs/research/` 中被 ADR 引用的部分 | 8–12 |
| `docs/archive/<批次>/` | plan 的 140 份 + reviews 的 14 份票据实证 + `docs/specs/` 2 + `docs/superpowers/` 4 + dataset 两份 | 约 160 |
| `tests/fixtures/` | 被测试直接读的机器证据优先，其余随批次入档 | 2 起 |

归档按批次成目录：`archive/wayfinder-95/`、`archive/ioc-operation-map/`、`archive/authoring-tickets-126/`、`archive/unified-authoring/`、`archive/java-page-assets/`、`archive/dataset-runtime/`。**`docs/reviews/` 目录本身消失**——它的 14 份票据实证按票号归入对应批次，5 份证据附件进 `docs/evidence/`。

### 3.2 每个归档批次留一页结论页

每个 `docs/archive/<批次>/README.md` 只写三件事：

1. 这批做了什么、什么时候收口；
2. **最终生效的结论落在哪**——ADR 编号、协议文档章节、或代码位置；
3. 过程中被推翻的方向，以及推翻它的依据。

有了结论页，探索 `authoring-tickets-126` 读 1 页而不是 75 份票据。这是唯一需要新写的内容，其余全是移动。

### 3.3 ADR：状态回填 + README 拆层

1. **回填 frontmatter**（S2，2026-09-21 已完成），让单份 ADR 自洽：

   ```yaml
   ---
   status: accepted | proposed | superseded
   superseded-by: [0060]         # 整份被取代，仅 status: superseded 时出现
   revised-by: [0014, 0017]      # 主体仍生效，列出的 ADR 修订了其中一部分
   date: 2026-09-17              # 原有的保留，不新增
   ---
   ```

   取值逐行迁移自 README 速查表的「现状」列，不新增判断。

   **用两个键而不是一个**：原计划把"部分取代"也写成 `superseded-by`，落地时改了——读者看到 `superseded-by` 会直接认为这份已死，而 83 份里有 18 份属于"主体生效、某个前提被改"。`revised-by` 无歧义。

   **补了反向链接**：README 里"0054 部分修订 0038""0070 部分取代 0062""0067 部分取代 0048""0058 部分修订 0030"都只写在**后出那份**的行上。只迁移正向，单读 0038 仍然不知道自己被改过。因此这四组在被修订方也写了 `revised-by`，这正是"单份自洽"的要点。

   回填脚本 `tools/scripts/adr-frontmatter-backfill.py` 带 `--check`，映射表在脚本内，可重跑对账。

2. **速查表改为生成**（2026-09-21 已完成）。这是一致性的根治手段，而不只是拆文件：原来 83 份 ADR 的状态写在 README 一张手抄表里，ADR 自己不知道自己的状态，两边必然漂移（漂移证据见 §4.1）。现在状态真源是每份 ADR 的 frontmatter，`pnpm adr:index` 生成表，`pnpm adr:index:check` 守门。改状态只改那一份 ADR。

3. **主题段拆到 `docs/adr/topics/`**（2026-09-21 已完成，见 §4.3）。原来 15 个 `##` 主题结论段占 README 三分之二，改一个主题要动整个文件。拆完后 `docs/agents/domain.md` 的"先读基线"从"读一整份"变成"读表 → 读一个主题"。

4. **文末四个单 ADR 附录段并回主题**（2026-09-21 已完成，见 §4.3）。`## 页面试验场的开发工具定位（0075）`、`## Java 页面资产单次提交（0080）`、`## 完整页面的业务章节组织（0082）`、`## 平台证据分析、工作稿与工具内保存（0083）`——这四段是"新 ADR 落盘时往文末追加一段"的产物，而不是并进对应主题。0080 的内容与 `## 页面生命周期与发布治理` 重复，0083 与 `## 产品形态谱系与两速生命周期` 重叠。**这正是过程文档与结论文档不一致的成因：追加比整合省事，于是没人整合。**

5. **`未决事项` 段**（2026-09-21 部分处理）。它记的是没定的事，不是决策记录，放在决策基线里会被误读为结论。本轮按最小动作拆成了 `docs/adr/topics/open-questions.md`，并在主题索引与页首一句话里写明"这里记的是没定的事，不要当成结论读"。是否进一步迁到 GitHub Issues 仍待定——迁走会切断它与 ADR 原文的就近引用，值不值得需要单独判断。

### 3.4 防复发

否则半年后原样重来一遍：

- ~~新建 `docs/plan/README.md`，写清四层判据，以及**批次收口时必须做的三件事**：抽结论进 ADR / 正式文档 → 写结论页 → 整批移入 `docs/archive/`。~~ **已建**，另配 [`docs/evidence/README.md`](../evidence/README.md) 与 [`docs/archive/README.md`](../archive/README.md)，三层各自说清「什么进来、什么不进来」。
- ~~`docs/agents/domain.md` 的"探索前先读"补一句：默认不读 `docs/archive/`，需要历史背景时由结论页导航进入。~~ **已补**，根 `README.md` 的文档导航同步改了。
- 可选门禁：短脚本检查 `docs/plan/` 中超过 30 天未修改的文件，CI 输出 warning，不阻塞。**未做**——判据已经写进 `docs/plan/README.md`，先看规矩本身管不管用，管不住再加机器约束。

## 4. 执行顺序

五步，每步独立可验证，每步跑一次 `pnpm test` 确认引用没断：

| 步骤 | 内容 | 验证 |
|---|---|---|
| ~~S1~~ | ~~机器证据出文档目录，改测试与 README 引用~~ **2026-09-21 关闭为不做** | 理由见 §4.6 |
| ~~S2~~ | ~~ADR frontmatter 回填（83 份，纯增量，不动正文）~~ **2026-09-21 完成** | 见 §4.1 |
| ~~S3~~ | ~~建 `docs/evidence/`，迁入 6 + 1 份证据附件，改 ADR-0039/0040 正文链接、根 README、`schema-boundaries.test.ts` 注释~~ **2026-09-21 完成** | 见 §4.5 |
| ~~S4~~ | ~~ADR README 拆表 + `topics/`，更新 `docs/agents/domain.md`~~ **2026-09-21 完成** | 见 §4.2、§4.3 |
| ~~S5~~ | ~~按批次建 `docs/archive/`、写结论页、整批移动（含 `docs/reviews/` 解散、`docs/specs/`、`docs/superpowers/`、dataset 两份），扫描修正全仓链接~~ **2026-09-21 完成** | 见 §4.4 |

S1 与 S2 互不依赖，可并行。S3 必须在 S5 之前——先把证据附件摘出来，剩下的才能整批移。S5 最重（约 160 份移动 + 6 页结论页），但风险最低，纯移动加链接修正。

**实际执行时 S3 与 S5 合成一次迁移做完**：先按判据把证据附件从待归档集合里摘出来，再一次性生成移动表、改链接、落盘。分两趟做会让同一批文件被扫两遍链接，反而更容易漏。

### 4.1 S2 执行结果（2026-09-21）

26 份 ADR 改动：11 份原本没有 frontmatter（0001–0008、0010、0013、0022）新建；3 份把自由文本 `status: superseded by ADR-0014` 规整为 `status: superseded` + `superseded-by`（0009、0011、0012）；11 份补 `revised-by`；0083 统一了空行。最终 83 份全部有状态：`accepted` 75、`proposed` 5、`superseded` 3，其中 18 份带 `revised-by`。

正文一行未动。全量 diff 的删除行只有 3 条，就是那 3 份被规整的 `status` 自由文本。

`pnpm test` 有 12 项失败（8 个文件），**与本次改动无关**：先把 25 个已跟踪 ADR 文件回退到 HEAD 重跑同样 8 个文件，仍是 `12 failed | 51 passed`，一模一样；且 8 个失败文件全文不含 `adr` 字样。失败来自工作区在飞的 Schema 6.6 与 `docs/page-metadata/` 改动（`page-reference.test.ts` 报 `actions-and-navigation.md` 哈希不符、`public-api.test.ts` 报导出快照漂移、`version-error.test.ts` 报 6.5/6.6 版本区间）。

### 4.2 S4 第一步：速查表改为生成（2026-09-21）

先做这一步而不是先拆文件，因为拆文件不解决漂移，只是把漂移分散到更多文件里。

**做法**：83 份 ADR 各补一条 `note`（速查表「现状」列去掉状态词后的剩余内容，逐字迁移）；新增 `tools/scripts/adr-index.py` 从 frontmatter 生成表，写进 README 的 `adr-index` 标记之间；`pnpm adr:index` 生成、`pnpm adr:index:check` 守门，沿用仓里 `design:facts` / `design:facts:check` 的既有约定。生成器同时校验三件事：`status` 取值合法、`superseded` 必须有 `superseded-by`、关系里引用的编号必须真实存在。

**手抄表的漂移，迁移时逐条撞上来了**：0082 与 0083 压根不在表里（只在文末各有一个 `##` 段）；表头写"83 份"而表里 81 行；0081 的表内标题与 ADR 正文 H1 空格不同；0017 的「已演进到 4.0」早已过期（README 别处写 6.4）。因此**标题也改为直接取 ADR 的 H1**，不再手抄——少一个能漂的地方。

**迁移时逐行核对了内容留存**：把 HEAD 版本的 81 行与新表比对，无一行丢失；实质内容差异逐条看过，修掉两类问题——一类是 note 与结构化关系重复（如 0003 既写 `revised-by: [0014]` 又在 note 里重复一遍），一类是我第一版压缩时丢了细节（0055 的「选用指标改集合、按单元重复的步骤折叠」、0062 的 J1–J4 清单、0065 的「不再等待 #55」），已全部还原。

**一次性回填脚本用完即删**。它的映射表是 83 份状态的副本，留着就是第二个真源，必然漂移——这正是本方案要消灭的模式。

**验证**：`pnpm adr:index:check` 通过；故障注入（把 0046 改成 `proposed`）后 check 如期以退出码 1 失败，恢复后重新通过。`pnpm test` 失败数仍是 12，与改动无关——**全仓没有任何测试读 `docs/adr`**，`tools/scripts` 的测试引用都指向具名文件，`authoring-export-isolation` 的 `versionedFiles` 是静态三项清单。

**README 反而从 90 KB 涨到 93 KB**，因为表里换成了完整 H1 标题和结构化关系链接。这笔是划算的：换来的是零漂移和可守门。真正的瘦身在主题段拆出去那一步，不在表。

### 4.3 S4 第二步：附录段并回主题 + 主题段拆出（2026-09-21）

**先并后拆**，顺序不能反：附录段不先归位，拆出来就会多四个只有一段话的孤儿主题页。

**四段各自的去处**，判据是"这段修订的是哪个主题的现行结论"：

| 附录段 | 并入主题 | 并的时候做了什么 |
|---|---|---|
| 0075 页面试验场 | 领域建模、包边界与部署形态 | 紧跟 0074（同属 #102 的去留裁决）。顺带补一句：本主题页后文按原措辞提到的 `apps/canvas` 就是它 |
| 0080 Java 单次提交 | 页面生命周期与发布治理 | 该主题段本就在转述 0080，附录是第二份副本。只保留副本里多出来的两条：接入前置清单补「幂等操作查询」，「不承诺独立发布副本」改回原文的「不承诺编辑与独立发布副本的隔离」 |
| 0082 业务章节组织 | 问数编排与口径治理 | 接在 0055 段之后，并把关系写实：0055 的自动口径分区**收窄为**普通问数与兼容快速装配的缺省 |
| 0083 平台证据与工作稿 | 产品形态谱系与两速生命周期 | 接在分析会话归属之后。把"部分替代 0064/0079"写清替代的只有"平台不保存与候选选择"这一段，0079 其余结论仍生效 |

**拆出 11 个主题页**（15 段减去并掉的 4 段），`docs/adr/README.md` 只留：导言 + 速查表 + 主题索引，**93 KB → 23 KB**（其中 19 KB 是生成的两张表，手写导言不到 3 KB）。主题页合计 75 KB，最大 19 KB（领域建模），最小 1.5 KB。

**主题索引也是生成的，而且它的"覆盖的 ADR"列不是手写的**——由脚本从主题页正文**实际出现的链接**推出。这样"某份 ADR 的结论落在哪"不可能写错：写错就是链接错，链接错脚本直接报错。

**顺手把生成器变成链接守门人**，新加四条校验（都做了故障注入，每条都如期以退出码 1 失败）：主题页必须登记在 `TOPIC_ORDER`、主题页里的 ADR 链接必须指向真实文件、主题页里不许出现少一级的 `./00NN-*.md`、每个主题页必须有 H1 下的一句话说明。**外加一条防复发**：每份 ADR 的结论至少要落在一个主题页（或 README 导言）里，否则索引末尾会自动列出"结论尚未落进任何主题页"的编号——新 ADR 只写文件不并结论，这一行就会出现。

这条防复发当场就抓到两个：0056 和 0079 的结论都只以纯文本提及、没有链接。0079 已在两处补成真链接并写清哪部分仍生效；0056 的结论就在 README 导言的「术语演进」段，因此生成器也把 README 自身正文算作收录面。

**修掉三处迁移时撞见的旧漂移**：`(见下节)` 与 `(见「页面元数据与布局」段)` 这两个指代在拆文件后必然失效（后者指的段名早就不存在了），改成显式链接；"本索引"改称"本基线"。另外 IOC 主题段标题写 `0045–0051`、导言却说这批是 `0045–0053`，统一为 0045–0053。

**内容留存核对**：把 HEAD 版 README 正文切成 333 个片段，逐个在新结构里找。28 个找不到的逐条看过，全部是本轮有意的改写或搬移（导言重写、四段并入、三处指代修正、`##` 变 `#`），没有一条是丢失。全仓相对链接 437 条、断链 0 条。

**验证**：`pnpm adr:index:check` 通过；上述五条守门逐条故障注入并恢复。`pnpm test` 当前 33 项失败（14 个文件），**与本轮无关**——14 个文件全文不含 `docs/adr`；唯一可能被测试看到的改动是新文件 `tools/scripts/adr-index.py`（该目录会被 `authoring-export-isolation` 整体拷进隔离树），把它移走重跑那两个测试仍是 `15 failed`，放回后一模一样。失败数从 §4.2 的 12 涨到 33，是工作区在飞的 Schema 6.x 改动（样本报错：`supportedVersions()` 返回 9 项而断言 8 项）。

### 4.4 S5 执行结果（2026-09-21）：整批归档

**落点**：175 份过程件进 `docs/archive/` 的 11 个批次目录，`docs/reviews/`、`docs/specs/`、`docs/research/`、`docs/superpowers/` 四个目录消失，`docs/plan/` 从 175 份降到 31 份（20 份顶层 + `page-parameter-inlining/` 2 + `scenario-guided-authoring/` 9），全部是 `2026-09-17` 之后仍在做的。

**批次比方案里多了五个**。方案只点名了六个（wayfinder-95、ioc-operation-map、authoring-tickets-126、unified-authoring、java-page-assets、dataset-runtime），实际执行时多出 `poc-v0/`、`research-2026-08/`、`superpowers-specs/`、`page-time-range-proposal/`、`metriccanvas-agent-migration/`。前四个各只有 1–4 份文件——**宁可建一个只有一份文件、但名字说得清的批次，也不要一个 `misc/`**。杂项目录是这次要消灭的模式本身：东西一旦进了没有判据的桶，就再没人知道什么时候能清。

**链接改写的做法**：不按字符串猜，而是**按旧位置把每条相对链接解析成仓内路径 → 套用移动表 → 按新位置重新相对化**。这样 `../../adr/0062-*.md` 从 `docs/plan/` 移到 `docs/archive/java-page-assets/` 后会自动变成正确深度，不需要人去数 `../` 的层数。

**这个做法有一个盲区，本轮复扫时撞上了**：目标文件当前不存在的链接不会被重定位——解析不到实体，脚本就跳过了。撞上三条，已修：

- `metriccanvas-agent-full-migration.md` 里两条指向 `agent_core.py` / `test_agent_core.py`（这两个 py 被你在飞的改动删掉了，HEAD 里还在），同一文件里其他同类链接因为目标存在所以都对，只有这两条深度少一级；
- `java-page-assets/metriccanvas-page-assets.md` 指向 `metriccanvas-page-assets/README.md`（这个目标从来没存在过，移动前就是断的，但深度也该跟着改）。

**第二个盲区是编码**：`medal.svg` 与 `penalty-card.svg` 的注释里写着 `docs/plan/ioc-legacy-handoff.md`（方案 §2 点名过的引用方），这两个文件**不是合法 UTF-8**，改写脚本解码失败就整份跳过了，静默漏掉。已按**字节级**替换修好——路径串是纯 ASCII，不碰其余字节，文件原有的坏编码原样保留。另外两处目录级引用（`codespec_path=docs/plan/ioc-1980-width`、`authoring-remaining-migration.md` 里的 `docs/plan/authoring-tickets-126/*`）也一并修了：**目录级提及不带文件名，文件级替换表看不见它们**。

**`authoring-tickets-126/README.md` 改名为 `126-implementation-tickets.md`**。它原本是这批的实施票清单，占着 `README.md`；而每个批次的 `README.md` 要统一是结论页，否则「先读结论页」这条规矩就有例外。`baseline-assets.json` 里的路径键跟着改了。

**`git mv` 撞上陈旧的 `.git/index.lock`**（无 git 进程在跑、文件为空，是上一次中断留下的），改用普通文件系统重命名——提交时 git 照样会按内容识别为改名，不需要动索引。

### 4.5 S3 执行结果（2026-09-21）：证据层

`docs/evidence/` 收 11 份，比方案预估的 6+1 多，多出来的四份是逐份判定时查出来的：`architecture-formal-model.md`（ADR-0074/0076 正文引用）、`wayfinder-107-pangu-integration-baseline.md`（ADR-0077 正文引用）、`中间层分析.md` 与`组件分析.md`（`docs/research/` 五份里被 ADR 当论据的两份，其余三份进 `archive/research-2026-08/`——这是 §6 第 3 问的答案）。

**判据在执行时收窄了一次**。方案 §2 把「被代码或文档硬引用」的文件并列成一张表，照那张表 `ioc-operation-map.md`、`ioc-legacy-handoff.md`、`t18-execution-contract.md` 都该进证据层。实际执行时改成：

> **论据**是报告、调研、基线——它支撑的是某个裁决「为什么这么定」；**执行件**是这批活怎么干的记录——它只说明「当时干了什么」。被引用不等于是论据。

按这条，那三份是执行件，随批次进归档，引用方改指新路径即可。否则证据层会慢慢变成第二个 `plan/`：任何被引用过的文件都往里塞，判据就没了。

### 4.6 S1 裁决：不做，理由不是「没空」

S1（机器证据出文档目录）**已关闭为不做**。两条理由，第二条是执行时才查出来的。

**一、它原来的理由已经不成立。** 方案 §1.1 说 S1 要解决的是「35 个 json/txt/py 混在 `docs/plan/` 里，不给人读却和活计划同级」——这批文件现在随批次进了归档，`docs/plan/` 只剩 6 个 json，全部属于在做的项（`data-context` 两份证据、`scenario-guided-authoring/` 四份）。问题本身被 S5 顺带解决了。

**二、剩下那两份夹具迁不动，因为批次内部有同目录假设。** `t04-contract-examples.json` 与 `2026-09-15-unified-authoring-s0-sources.json` 确实被三处测试直接读取，但它们在批次里不是孤立的：

- `t04-verify-examples.py` 用 `Path(__file__).with_name('t04-contract-examples.json')` 按**同级文件名**找它；
- `t02-evidence.md`、`t04-java-relay-proposal.md` 的正文写着「同目录 `t04-contract-examples.json`」；
- `2026-09-15-unified-authoring-s0-s1-evidence.md` 按同级文件名链接那份来源清单。

迁走要么弄断已冻结的 checker，要么去改已冻结的实证正文。**改归档件的正文就改变了这份记录当时说了什么**——归档层唯一的价值就是「当时到底怎么回事」，为了目录整洁去改它是本末倒置。

**三、顺带否掉了 `tests/fixtures/` 这个落点本身**（§6 第 2 问）。仓里根本没有这个目录，既有写法是**夹具跟着消费者走**：`packages/page/fixtures/`、`apps/platform/tests/workbench/fixtures/`、`tools/dqe-sim/fixtures/`、跨包共享的 `tools/fixtures/legacy-contracts/`。为两个文件新造一个全仓级 `tests/fixtures/`，是在既有约定之外再加一条约定。

**代价说清楚**：`docs/archive/` 的定位是「只读、探索时默认不读」，而 CI 真的依赖里面两个文件。这个别扭没有消除，只是**标注出来了**——两处批次结论页和 [`docs/plan/README.md`](./README.md) 都写明它们是 CI 的真实输入、删改前先跑 `pnpm test`。留着的风险是有人清归档导致测试红，那是**响亮的失败**（测试直接挂），不是静默错误，可以接受。新产生的夹具照判据直接放消费者旁边，不走这条例外。

## 5. 预期结果

- ~~`docs/plan/` 从 175 份降到约 24 份，全部是活的。~~ **已完成：175 → 31**（多出来的是 `2026-09-17` 之后新开的几份，以及在做项自带的 6 个 json）。
- ~~`docs/reviews/` 目录消失，14 份票据实证与 `plan/` 里的同类合并按批次归档，5 份证据附件升格为 `docs/evidence/`。~~ **已完成**：`docs/reviews/`、`docs/specs/`、`docs/research/`、`docs/superpowers/` 四个目录全部消失；11 份升格为 `docs/evidence/`。
- ~~`docs/adr/README.md` 从 90 KB 降到约 12 KB，主题结论按需打开。~~ **已完成：93 KB → 23 KB**（比预期大，因为两张生成表占了 19 KB——速查表换成了完整 H1 标题与结构化关系链接。这部分是生成的、不会漂）；11 个主题页按需打开。
- ~~83 份 ADR 全部可独立判断是否生效，不必回表。~~ **已完成。**
- `docs/` 总量基本不变（归档不是删除：378 份，5.8 MB）。~~**探索路径上的文档量从 347 降到约 90**~~ **实际降到 191，预期数漏算了 83 份 ADR 原文**——它们本来就在探索路径上，拆 README 不会让它们消失。真正变的不是数量而是**入口**：以前要读一份 93 KB 的 README 才知道什么生效，现在是速查表定位状态 → 一个主题页读结论 → 需要背景才打开 ADR 原文；过程件则整批退到结论页后面。

| | 清理前 | 现在 |
|---|---|---|
| `docs/plan/` | 175 | 31 |
| `docs/reviews/` `specs/` `research/` `superpowers/` | 33 | 0（目录不存在） |
| `docs/evidence/` | — | 12 |
| `docs/archive/` | — | 187（含 11 页批次结论 + 1 页总索引） |
| 探索路径（`docs/` 减归档） | 347 | 191 |

## 6. 待确认

1. ~~**归档放哪**：留仓内 `docs/archive/`，还是移出去（单独分支 / 单独仓）？~~ **已按留仓内执行。**
2. ~~**机器证据落点**：统一 `tests/fixtures/`，还是各包 `__fixtures__/`？~~ **已定：都不是。夹具跟着消费者走**（仓里既有约定），两份历史夹具留在批次里不迁，理由见 §4.6。
3. ~~**`docs/research/` 5 份**（236 KB）是否逐份判定证据附件 / 归档？~~ **已逐份判定：**`中间层分析.md`、`组件分析.md` 进 `docs/evidence/`，其余三份进 `archive/research-2026-08/`。
4. ~~**`docs/evidence/` 这层要不要**~~ **已建，收 11 份。** 判据在执行时收窄为「论据 ≠ 被引用」，见 §4.5。

本文自身是过程性文档：S1 结清后随该批次移入 `docs/archive/docs-consolidation/`。

## 7. 本轮验证（2026-09-21）

- **链接**：`docs/` 内相对链接 952 条，断链 3 条——两条指向工作区在飞删除的 `.py`（HEAD 里仍在），一条目标从未存在过，均非本轮造成。字节级全仓复扫 2968 个文件，**旧路径残留 0 处**（唯一命中是 `unified-authoring/README.md` 里「（原 `docs/specs/`）」这句说明文字，是有意保留的出处交代）。
- **守门**：`pnpm adr:index:check` 通过。
- **测试**：`pnpm test` 连跑三次分别是 6/5/5 项失败（5/4/4 个文件），数字在跳是因为工作区正在改 Schema；**没有一项与本轮相关**。唯一读 `docs/` 的失败用例是 `page-reference.test.ts`，它报的是哈希不符而不是路径不存在——对不上的那份文件是 `metriccanvas-authoring/contract-snapshot/page/reference/actions-and-navigation.md`，**连 HEAD 版本也对不上 manifest 里冻结的哈希**，早于本轮全部工作；且该 manifest 的 275 条路径在移动后全部解析得到，这恰好反过来证明移动是对的。
