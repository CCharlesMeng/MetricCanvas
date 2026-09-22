# IOC 三页还原检视 — restore lens(2026-08-24)

> **怎么用这份文档**:§1 说明本次 restore lens 在「无冻结契约」下退化成了什么,以及本包规定的正式回传是什么;§2 是我一次性手工搭的判据来源表(design_fact);§3 是逐条判定;§4 是对「7 处刻意未做」的复核;§5 是我自己取的证据;§6 是要你拍板的。
>
> **本文只报告,不修改。** 没有改任何实现代码、页面 JSON、ADR、CONTEXT.md、AGENTS.md,没有 commit。检视范围不含 `.agents/skills/**`、`AGENTS.md`、`.gitignore`(另一条线的 skill 软链收敛)。

---

## 0 先说一件会推翻既有自测的环境事实

**5173 上跑着的开发服务器在给出陈旧的页面文档。** 它启动于 19:23:06,而三份页面 JSON 分别在 20:01 / 20:03 / 20:10 才落盘;`apps/canvas/src/lib/page-repository.ts:8` 用 `import.meta.glob('$pages/*.json')` 读的是仓库根 `pages/`,在 Vite 的 root(`apps/canvas`)之外,文件变更没有被 watcher 捕获。

实测(同一时刻、同一份磁盘文件、两个端口):

| 观测点 | 5173(长驻) | 5188(我新起的,用完已收) |
|---|---|---|
| `data-page-layout-form` | `report` | `dashboard` |
| 「机会点概况 / 项目分层分级管理 / 复盘总结 / 年度管道支撑率」 | 0 处 | 各 1 处 |
| 「查看机会点清单」 | 2 处 | 0 处(全仓 grep 也已无此文案) |

也就是说:**5173 渲染出来的还是「六张独立指标卡 + 报表外框 + 查看机会点清单链接」的旧版**,而磁盘上的页面早就不是那样了。`/tmp/ioc-shots/after-*.png` 如果是在 5173 上取的,它证明的不是本轮改动。本文所有截图与 DOM 事实都取自 5188。

我没有重启或杀掉 5173。

---

## 1 restore lens 在本仓退化成了什么

### 1.1 本包对 restore lens 的输入是硬性的

| 规定 | 出处 | 本仓实况 |
|---|---|---|
| restore lens 的适用条件是「变更区块有冻结 R 契约与设计事实」 | `SKILL.md` §五格 表格 | 只有设计事实,没有冻结 R 契约 |
| 该格 `deliverables` = `restore_contract` / `restore_report` / `qa_baseline` | `roles/restore-lens/ROLE.md` `checklist_sets[0].deliverables` | 三者全缺 |
| 该格 `reads` 只有 `restore_contract` / `restore_report` / `qa_baseline` / `exemptions` / `design_facts` | 同上 `reads` | 只有 `design_facts` 可读 |
| 「**restore 的机器执行器在调用方那一侧**(契约编译与三色报告)。本包的 restore-lens 判的是同一套 R1–R6 的级别与处置,**不重做比对**」 | `SKILL.md` 开头第 4 段 | 调用方一侧的机器执行器**本轮根本没有运行过** |
| 「缺终止级输入时回传 `前置缺失:<清单>`,不猜测补齐」 | `SKILL.md` §派发 第 3 条 | 命中 |
| 「缺终止级前置时改为纯文本 `前置缺失:<清单>`」 | `references/role-result.md` 第 5 行 | 命中 |
| R1–R6 每条的 `skip_when` 都是「冻结契约未生成该 Rn 规则时记 `skipped`」 | `frontend-code-checklists/restore.md` 各节 | 六条全部命中 `skip_when` |
| 「基线未生成的 R 分类直接 `skipped`,不造 N/A 空壳 Finding」 | `ROLE.md` §全局禁止 | — |

### 1.2 结论:正式回传是「前置缺失」,不是「GREEN」

按上表,**这一格在本仓的合规输出只有一个**:

```
前置缺失:restore_contract、restore_report、qa_baseline
```

对应的 `RoleResult@v2` 是 `status: "unexecuted"`,coverage / skipped / findings / judged_files 全空,只用 `known_gaps` 解释(`role-result.md` §覆盖与发现 第 3 条)。原分配的 R1–R6 由调用方标为**未验证**,而不是通过。

```json
{
  "schema_version": 1,
  "role": "restore-lens",
  "evidence_epoch": "review-1",
  "status": "unexecuted",
  "judged_files": [],
  "coverage": [],
  "findings": [],
  "skipped": [],
  "open_questions": [],
  "deferred_candidates": [],
  "evidence_reused": [],
  "evidence_added": [],
  "known_gaps": [
    "restore_contract 缺失:本轮未走 sdd-dev-frontend,未冻结 R1-R6 契约",
    "restore_report 缺失:调用方侧的契约编译与三色比对未运行",
    "qa_baseline 缺失:无 R1-R6 冻结声明与 EX-n 豁免表",
    "R1-R6 六条检查项全部命中各自 skip_when(冻结契约未生成对应规则)"
  ]
}
```

**这条必须说清楚:`meta.description` 里写的「本轮不发明数据形状,故未呈现」不是 `EX-n`。** 冻结豁免是 `qa_baseline` 的「冻结豁免」节里、在开工前定下、有 ID 的东西;事后在页面 JSON 的描述字段里自述的取舍,在本格规则下**不抑制 Finding**(`ROLE.md`:「命中已冻结 `EX-n` 的偏差不出 Finding」——前提是**已冻结**)。所以下文 §4 里那些「刻意未做」,该记的照记。

### 1.3 那我实际做了什么

为了让这次检视有产出,我**替调用方手工做了一次比对**——也就是本包明确说「在调用方那一侧」、restore-lens「不重做」的那件事:从设计稿与规格里读出期望值,与实现的结构化事实和新鲜截图逐条对齐。

因此下文 §3/§4 的判定:

- **不是 restore lens 的 Finding**,不能进 `dev-review.md` 的 CODE-RESTORE 格,也不能算作 R1–R6 已判;
- 用的是 restore.md 的同一套词(RED / YELLOW / GREEN + P 级),但**颜色是我手工得出的,不是比对器给的**,`restore.md` 开头「你拿到的是颜色,本清单给的是级别」这层分工在这里塌成了一个人;
- P 级只走 `SKILL.md` §定级 的第 2 条(「确证错误结果:具体操作序列或客观静态反例」)与第 4 条,**不走第 1 条**(违反冻结 R/F/AC)——没有冻结声明可违反;
- 每条都标 `design_fact_source`,指回设计稿或规格的具体位置。**没有一条期望值来自当前实现**。

YELLOW 按 `restore.md` §YELLOW 分流 处理:拿得到的证据我补了(见 §5),拿不到的记 `UNVERIFIED`,不改写成 GREEN。

### 1.4 事实源本身是冲突的,这点比缺契约更麻烦

设计稿(`参考/项目地图/设计稿/*.html`,Figma 导出)与规格(`参考/项目地图/00x-*.md`,对既有 Angular 实现的复刻规格)**描述的不是同一版页面**:

- 概览页概览表:设计稿 8 列(排名/代表处/区域/预签金额/管道支撑率/项目分析会召开率/本月新签单/立项率),规格 001 §3.1 4 列;
- 清单页主体:设计稿是三张分组透视表(机会点总览 / 按BG类型看机会点 / 机会点销售预测),规格 002 §3 是 32 列平铺明细表 + 搜索 + 分页;
- 详情页长文本:设计稿 6 块(合并了主题/时间/结论、合并了风险与求助),规格 003 §2 8 个字段。

冻结基线的作用之一就是在开工前把这种冲突裁掉。没有基线,实现只能一处一处自己选边——本轮实际上是**结构跟规格、观感跟设计稿**。这个选法本身可能是对的,但它没有被记录成决定,复核时只能一条条重新问。

补充一条证据缺口:设计稿引用的 `assets/*.svg|png` 在仓里不存在(`参考/项目地图/设计稿/` 下只有三个 HTML)。图标、底图与卡片背景图渲染为空,所以我能判的是**结构、文案、几何、分组**,判不了图标与底图观感。这部分记 `UNVERIFIED`。

---

## 2 design_fact 来源表(我这次读出来的期望值)

| ID | 期望值 | 出处 |
|---|---|---|
| DF-1 | 概览页卡片行 `组合 10` 宽 1632,内含**三张卡**:`组合 3`「机会点概况」580×280、`组合 14`「项目分层分级管理」580×280、`组合 15`「复盘总结」440×280 | 设计稿 project-overview.html,`data-node-name="组合 10"` 及其三个子节点的 `w-[…] h-[280px]` |
| DF-2 | 「年度管道支撑率 98.2%」的仪表**在「机会点概况」卡内部**,是 `组合 3` 的最后一个元素 | 同上,文本序 `…核心 46个 40亿 \| 98.2 \| % \| 年度管道支撑率 \| 项目分层分级管理…` |
| DF-3 | 「及时奖惩」(金牌/银牌/红牌/黄牌)在「复盘总结」卡内,与上半部用虚线分隔 | 设计稿 `组合 15` 内 `直线 16`(`border:1px dashed #dcdbdb`)之后的 `组合 14366` |
| DF-4 | 地图是**绝对定位在 left 884 / top 462 / 980×474 的独立区块**,与卡片行(x 23–1655)无重叠;它与左侧 580×524 的 Tab 卡**左右并排** | 设计稿 `编组 13`(img)与 `矩形 1 container`;规格 001 §2 结构图「地图和表格左右并排,地图左侧占大部分宽度」 |
| DF-5 | 地图全球视图上的实体是**中文地区部名**:欧洲/亚太/北部非洲/中东中亚/中国/拉美/南部非洲/俄罗斯(8 个散点标签) | 设计稿 `组合 14349` 内 8 个 `编组 32备份*`;规格 001 §4.13「将地区部名称映射为地图名称(如 "欧洲地区部"→"欧洲")」 |
| DF-6 | 地图有分档图例:标题「管道支持率」,四档 `80%以上 / 51%~80% / 1%~50% / 0` | 设计稿 `编组 7`(absolute left 884 top 762);规格 001 §2.3 `legendArr: "0\|1%~50%\|51%~80%\|80%以上"`、`colorArr` |
| DF-7 | 散点 tooltip 含区域名称、管道支撑率、机会点数、预签金额、年度费用 | 设计稿「中国 / 管道支持率 98.2% / 年度销售预测 46亿」浮层;规格 001 §2.3 |
| DF-8 | 概览 Tab 三个标签:`概览 / TOP预签项目 / 丢单项目`(设计稿)——规格 001 §2.4 作 `概览 / TOP已立项项目 / 丢单项目` | 设计稿 `矩形 1 container` 内 tab 行;规格 001 §2.4 表 |
| DF-9 | 清单页顶部**三张卡**:440×176(机会点个数/管道支撑率/预签金额/本年度销售预测,2×2 虚线分格)、580×176(华为云/政企/运营商 × 机会点数+管道支撑率)、580×176(即将超期/超期/未更新 × 机会点数+预签金额);**三张卡都没有标题** | 设计稿 opportunity-lits.html `组合 14400` 的三个 `组合 3` |
| DF-10 | 清单页主体是**一张 1632×1128 的白卡**,内含「地区部/代表处」Tab + 机会点总览 + 按BG类型看机会点 + 机会点销售预测 三张分组透视表 | 设计稿 `组合 10`(w-1632 h-1128) |
| DF-11 | 详情页信息区是**两张卡并排**:450×360「项目基本信息」+ 1168×360「项目规范性」(内含项目运作规范性与客户关系规范性两段,虚线分隔) | 设计稿 porject-detail.html `row 2`(w-1634 justify-between)的两个子节点 |
| DF-12 | 详情页长文本块:1632 全宽白卡 + 内层灰底内容区 `bg-[rgba(0,0,0,0.03)] rounded-[8px]`,正文 14px / `leading-[28px]`,标题 16px / `font-medium` / `#191919` | 设计稿 `组合 14411`、`组合 14416` 等的 `矩形 2 container` 与内层 div |
| DF-13 | 概览页筛选栏 5 个控件:全部产业 / 全球 / **全部项目等级** / 2026/03/26 / 仅看重点国代 | 设计稿顶部行;规格 001 §2.1 `headerOpt` 只有 4 项(无项目等级) |
| DF-14 | 详情页销售预测表:12 月 × 客观/提拉/合计 三子列 + 每组小计行 + 全局合计行,首列跨行合并 | 规格 003 §5.3、§6.5;设计稿 `组合 14374` |
| DF-15 | 详情页长文本按规格是 **8 个字段**(项目背景/项目目标/困难求助/竞对动态/项目风险/项目进展/最近分析会主题/最近分析会结论) | 规格 003 §2 结构图、§4.1 字段表 |

---

## 3 逐条判定:6 条声称

判定词:**GREEN** 期望值成立 / **RED** 期望值被证伪 / **YELLOW** 判不了(按 `restore.md` §YELLOW 分流 落到 `UNVERIFIED`)。P 级只由 §定级 第 2、4 条得出。

### 声称 1 — 顶层 `layoutForm`(report 缺省 / dashboard),宿主放开 1440,旧报表页观感不变

| 子项 | 判定 | 依据 |
|---|---|---|
| 新增 `layoutForm` 两档闭集、缺省 report | **GREEN** | `packages/page/src/schema/page.ts:43` `pageLayoutFormZ`;同文件 `:67` `layoutForm` 为 optional |
| 宿主外框放开 | **GREEN** | `(viewer)/+layout.svelte` `main{width:100%}`;三条路由各自补 `.page-frame` |
| dashboard 生效 | **GREEN** | 5188 实测 `data-page-layout-form="dashboard"`,满宽 + 中性画布 `#f8f8f8` |
| **「旧报表页观感不变」** | **RED / P1** | 见下 |

`main` 原来是 `max-width:1440px; padding:24px`,**没有** `box-sizing:border-box`(全仓 `apps/canvas/src` 只有本次新增的四处 `box-sizing`,无全局 reset),所以旧值是 **内容宽 1440 + 左右各 24 = 外框 1488**。新的 `.page-frame` 写了 `box-sizing:border-box; max-width:1440px; padding:24px`,即 **外框 1440 + 内容 1392**。

→ 视口 ≥1488px 时,**所有报表形态页面的内容宽度净减 48px**。这是客观静态反例,不需要跑图。三条路由(`+page.svelte`、`preview/+page.svelte`、`pages/[pageId]/+page.svelte`)都是同一写法,所以是全量报表页。
`design_fact_source`:无设计事实——这条判的是声称本身(「观感不变」)与代码不符,不是与设计稿不符。

### 声称 2 — 组件级 `layout.layer: "backdrop"`,概览页卡片浮在地图之上;≤760px 退化,地图 320px 下限

| 子项 | 判定 | 依据 |
|---|---|---|
| 机制落地 | **GREEN** | `schema/primitives.ts:283` `componentLayerZ`(闭集只有 `backdrop`);`RuntimeSection.svelte:398-412` 绝对定位 + `z-index:0` + `min-height:560px` |
| ≤760px 退化为普通流 | **GREEN** | `RuntimeSection.svelte:696` `@media (max-width:760px)`,`:713` `position:static`;5188 实测 700px / 760px 下地图回到流内 |
| 地图 320px 高度下限 | **GREEN** | `RuntimeSection.svelte:715` `min-height:320px` |
| **「概览页指标卡/仪表/Tab 浮在地图之上」这个目标本身** | **RED / P1** | DF-4 |
| **叠放后的可用性** | **RED / P0** | 见下 |

**RED-1(P1,布局关系无事实来源)**:设计稿里地图是 `left 884 / top 462 / 980×474` 的独立区块,与卡片行(x 23–1655,在其上方)**不重叠**,与左侧 580 宽的 Tab 卡**左右并排**;规格 001 §2 的结构图同样画的是「地图区域 │ Tab表格区域」左右并排。两个事实源都没有「卡片浮在地图上」这层关系。`design_fact_source`:DF-4。

**RED-2(P0,确证错误结果)**:实测 1920×1080,`map-board` 分区里地图铺满 560px 高、被上方**不透明**卡片行与左侧 Tab 卡压住,再叠加世界底图按宽度适配后的纵向裁切,结果是 **13 条 geo 行里只有 Brazil、South Africa、Australia 三条可见**,China / Japan / United States / Germany / France / Russia / India / Saudi Arabia / Egypt / Mexico 十条既看不见也点不到。

规格 001 §6.1 的地图三级下钻(全球→地区部→代表处→清单页)是这页的核心交互,而它的入口就是点散点/点区域。缺省视口下对十个区域**不可完成**——按 `SKILL.md` §定级 第 2 条「核心流程不可完成 → P0」。
证据:`/tmp/ioc-review-restore/crop-top.png`(1920×750 裁切,肉眼可数)。`design_fact_source`:DF-4 + 规格 001 §6.1。

### 声称 3 — 概览页补三张复合卡、六个比率指标、地图 geo 行补到 13 条、移除「查看机会点清单」

先说方法上的限制:`pages/ioc-*.json` 三份都是 **untracked 新文件**,git 里没有 before,所有「补了 / 改了」都**无法用 diff 核实**,我只能判成品。

| 子项 | 判定 | 依据 |
|---|---|---|
| 三张复合卡 | **GREEN** | `kpi-opportunity-outline`「机会点概况」/ `kpi-initiation-management`「项目分层分级管理」/ `kpi-review`「复盘总结」,与 DF-1 的三张卡同名同分组 |
| 仪表的归属 | **RED / P2** | DF-2:设计稿里仪表在「机会点概况」卡内;实现是独立 cell(`gauge` span 2),插在机会点概况与项目分层分级管理之间 |
| 「六个比率指标」 | **YELLOW → `UNVERIFIED`** | 成品上数得出的比率型指标是 **5 个**(管道支撑率/立项率/项目分析会召开率/赢单率/复盘率);设计稿对应的也是 5 个(DF-1/DF-2)。「六」在成品与设计稿两侧都对不上,又无 before 可比,判不了 |
| geo 行 13 条 | **数量 GREEN / 实体 RED / P1** | `map-regions` 确为 `geo` 13 行。但 13 行是**英文国家名**(China/Japan/United States/…),而 DF-5 要求全球视图上的实体是**中文地区部**(欧洲/亚太/北部非洲/中东中亚/中国/拉美/南部非洲/俄罗斯,8 个)。下一级 `region-dept` 填的是 北京/上海/广东,也不是地区部。层级实体整体错位一档 |
| 移除「查看机会点清单」 | **GREEN** | 页面 JSON 无此组件;全仓 `rg 查看机会点清单` 零命中(5173 上还看得到它,那是 §0 的陈旧渲染) |

`design_fact_source`:DF-1、DF-2、DF-5。

### 声称 4 — 清单页补三张指标卡;panel → plain + card;标题改「机会点明细」

| 子项 | 判定 | 依据 |
|---|---|---|
| 顶部三张卡 | **GREEN** | `kpi-list-outline` / `kpi-list-by-bg` / `kpi-list-overdue`,分组与 DF-9 的 440 / 580 / 580 三张卡逐项对应(4 项 / 3×2 项 / 3×2 项) |
| panel → plain + card | **GREEN** | `sections[].container`:header=plain、list-summary=plain、list=card;无 `panel` |
| 三张卡的**标题** | **RED / P2** | DF-9:设计稿这三张卡**没有标题**;实现新造了「机会点概况」「按 BG 归属看机会点」「超期与刷新概况」三条文案 |
| 分区标题「机会点明细」 | **RED / P2** | 设计稿对应位置是「机会点总览」,且指的是另一张分组透视表(DF-10);规格 002 全篇无分区标题、页面标题是「机会点清单」。「机会点明细」两侧都查无此文案 |

补充(不单列 Finding,合并进 §6 OQ):清单页主体在设计稿是三张分组透视表,实现是规格 002 的 32 列平铺明细表——这是 §1.4 的事实源冲突,不是实现错误。

### 声称 5 — 详情页三张信息卡改并排;长文本改 8 张全宽模块卡加灰底内容区

| 子项 | 判定 | 依据 |
|---|---|---|
| 并排 | **GREEN(方向对)** | `project-profile` 分区三个组件 span 各 4,实测并排 |
| 分组与宽度比 | **RED / P2** | DF-11:设计稿是**两张卡** 450 : 1168(≈1 : 2.6),「项目运作规范性」与「客户关系规范性」同在一张「项目规范性」卡里;实现是三张等宽卡,「项目规范性」这个标题在成品里消失了 |
| 8 张全宽模块卡 | **GREEN** | 8 个 `fieldText`,span 12,与 DF-15 的 8 个规格字段逐一对应 |
| 灰底内容区 | **GREEN** | `--mc-field-text-body-surface: rgb(0 0 0 / 0.03)`、`--mc-field-text-body-radius: 8px`、`padding 14px 17px` — 与 DF-12 的 `bg-[rgba(0,0,0,0.03)] rounded-[8px]` / `pt-[14px] pl-[17px]` 对得上 |
| 正文与标题排版 | **RED / P2** | DF-12:正文设计稿 `leading-[28px]`,实现 `line-height:24px`;标题设计稿 `font-medium`(500)`#191919`,实现 `font-weight:600` `#121e3b` |

页面 `meta.description` 自述「这里是并排的两张模块卡」,而成品并排的是三张(基本信息 + 两张规范性表)——描述与成品也不一致。

### 声称 6 — 7 处「刻意未做」

见 §4。

---

## 4 复核:7 处「刻意未做」里,哪些其实做得了

前置:`meta.description` 里的自述**不是冻结豁免**(§1.2)。下表的「判定」回答的是用户的问题——**这条被记成「刻意」是否站得住**。

| # | 声称未做 | 判定 | 依据 |
|---|---|---|---|
| 1 | mapChart 分档图例 | **成立(受协议闭集所限),但必须记为未还原缺口** | `schema/components/map-chart.ts` 的 `props` 是 `.strict()`,闭集里没有图例位,要做得先改协议。但 DF-6 在设计稿与规格 001 §2.3 双向坐实,这是**缺口**不是「不需要」 |
| 2 | 散点 tooltip 扩展字段 | **同上** | 同一个 `.strict()` 闭集无 tooltip 位;DF-7 双向坐实 |
| 3 | 卡内环形构成(卓越/战略/核心;公司特级/公司级/地区部级/代表处级) | **理由不成立** | 自述理由是「规格的 14 个数据源里没有对应取数」。规格里确实没有——但**本页 5 个数据源全是 inline 合成数据**,其余每一行同样是编的。「没有取数」对一个 inline 页不构成障碍,真正的约束是自设的「不发明数据形状」规则,而这条规则没有被记录成决定 |
| 4 | 及时奖惩金银红黄牌 | **理由不成立(同 3)** | DF-3 在设计稿里是「复盘总结」卡的下半部,位置明确 |
| 5 | 管道支撑率真实计算 | **不成立——做得了** | 自述理由是「不在本页实现 joinAggregate」。但 ADR-0046 的受控计算算子闭集里 `ratio` 与 `delta` **在本批改动里已经落地并接通运行时**(`schema/compute.ts:21-40`、`packages/page/src/compute.ts:95-96`、`packages/runtime/src/compute/index.ts:33,42`),同一批的详情页已经实际用上 `pivot`/`groupSubtotal`/`grandTotal`。把 target / stock / realized / effective 四个字段放进同一个 inline 源,`delta`→`delta`→`ratio` 即可,**不需要 joinAggregate**。现在的做法是把百分比预先算好写进行里,口径不可审计 |
| 6 | 清单页三张分组透视表 | **不成立——能力是有的** | `compute` 有 `pivot` 算子;ADR-0049 自己写着「列节点是递归结构,因此**多级表头已经支持**」`fixed` 冻结列也支持。挡住的仍然只是第 3 条那条自设的数据形状规则,不是能力 |
| 7 | 查询分页下服务端排序/列头筛选 | **成立,但与本轮还原无关** | `validate.ts:1362,1365` 仍在拒绝;ADR-0049 是 `status: proposed`,未落地。而三张页面的数据源全是 `inline`,根本进不到查询分页分支。这条列进「刻意未做」清单属于凑数 |

**小结**:7 条里 2 条(#1 #2)理由成立但应记为缺口,1 条(#7)与本轮无关,**4 条(#3 #4 #5 #6)是「做得了却记成刻意」**,其中 #5 最实质——口径计算能力刚建好却没在最该用的地方用。

---

## 5 我自己取的证据

**环境**:5173 未动;我在 5188 另起 vite(`pnpm --filter canvas exec vite dev --port 5188 --strictPort`),取完证已收掉。Chrome headless 来自 `/Applications/Google Chrome.app`。

| ID | 证据 | 路径 / 命令 |
|---|---|---|
| BE-1 | 设计稿 project-overview 渲染图(assets 缺失,图标与底图为空) | `/tmp/ioc-review-restore/design-overview.png` |
| BE-2 | 概览页 1920 全页(5188,当前磁盘状态) | `/tmp/ioc-review-restore/fresh-ioc-project-overview-1920.png` |
| BE-3 | **概览页顶部 1920×750 裁切:地图遮挡的直接证据** | `/tmp/ioc-review-restore/crop-top.png` |
| BE-4 | 清单页 1920 | `/tmp/ioc-review-restore/fresh-ioc-opportunity-list-1920.png` |
| BE-5 | 详情页 1920 | `/tmp/ioc-review-restore/fresh-ioc-project-detail-1920.png` |
| BE-6 | 概览页 700 / 760(backdrop 退化) | `/tmp/ioc-review-restore/fresh-overview-700.png`、`fresh-overview-760.png` |
| BE-7 | 5173 与 5188 的 DOM 对照(§0 的陈旧证据) | `/tmp/ioc-review-restore/dom-overview.html`、`dom-overview-5188.html` |
| BE-8 | 三份页面 JSON 的结构化事实(分区/容器/组件/props/数据源行数/compute) | 见本文 §3 各表,由 `python3` 直读 JSON 得出 |
| BE-9 | 设计稿的几何与文案事实(节点宽高、绝对坐标、文本序) | 直读三份 HTML 的 `data-node-name` 与 tailwind 任意值类 |
| BE-10 | 5173 陈旧性:进程启动 19:23:06 vs 页面 JSON 落盘 20:01/20:03/20:10 | `ps -o lstart -p 23189` + `stat -f %Sm pages/ioc-*.json` |

**未取到的证据(`known_gaps`)**:

- 设计稿 `assets/` 目录不存在 → 图标、地图底图、卡片背景图无法核对,相关观感一律 `UNVERIFIED`;
- 无 before 版本(页面 JSON 是 untracked 新文件)→ 所有「补了 / 改了 / 移除了」只能判成品,判不了增量;
- 未跑 `pnpm validate`、未跑任何测试:那属于 test-lens,本次未派。

---

## 6 需要你拍板的

1. **P0 先修哪个**:概览页的地图叠放。两条出路——(a) 按 DF-4 回到「地图与 Tab 卡左右并排、卡片行在上」的设计原貌,`layer: "backdrop"` 这次不用;(b) 保留 backdrop,但把压在地图上的卡片改成半透明/让出地图主体区。**(a) 有设计事实支撑,(b) 需要你给一个新的设计决定**——按 `restore.md` R6 的规矩,「需要改变布局结构才能适应的缺口回上游,不自行断点设计」,所以我不替你选。

2. **事实源冲突谁优先**(§1.4):设计稿 vs 规格 001/002/003 至少在概览表列集(8 列 vs 4 列)、Tab 文案(TOP预签项目 vs TOP已立项项目)、清单页主体(三张透视表 vs 32 列明细)、详情页长文本(6 块 vs 8 块)、概览筛选栏(有无「全部项目等级」)五处不一致。本轮的实际选法是「结构跟规格、观感跟设计稿」,但没被记成决定。请拍一条规则,否则下一轮还得重问一遍。

3. **inline 合成数据能不能超出规格字段清单**(§4 的 #3 #4 #6):这条自设规则直接决定设计稿里的环形构成、及时奖惩、三张分组透视表做不做。它现在只存在于 `meta.description` 的自述里。

4. **管道支撑率要不要改成 `ratio`/`delta` 声明**(§4 的 #5):能力已就位,现在是预烘焙百分比。改了口径就可审计,不改就得接受这页的比率都是不可复核的常数。

5. **地图层级实体错位**(声称 3):geo 层现在是 13 个英文国家名,设计稿与规格要的是 8 个中文地区部。这是补数据前该先定的事——继续按国家补,和改成地区部,是两条不同的路。

6. **报表页 -48px**(声称 1):是接受(把 `.page-frame` 认作新基准),还是恢复原几何(`max-width: 1488px` 或去掉 `box-sizing`)。

7. **要不要补冻结基线**:如果这三页还要继续迭代,现在没有 `restore-contract.json` 就意味着**下一轮检视还是只能像这次一样手工重来一遍**,而且每次的期望值都可能不一样。这是本次最大的结构性成本,不是某一条 Finding。
