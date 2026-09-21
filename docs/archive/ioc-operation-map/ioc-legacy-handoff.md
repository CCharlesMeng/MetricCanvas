# IOC 作战地图 — 现有系统寻源清单

## 0. 这是什么

我们团队正在另一套前端框架上重建 IOC 作战地图的三个页面：项目地图首页（`project-overview`）、机会点清单（`opportunity-list`）、项目详情（`project-detail`）。我们已经从源码逆向出了页面结构、字段清单和前端计算口径，但还缺两类东西——现有应用与后端之间**到底怎么通信**（真实发出去的 HTTP 请求长什么样），以及若干只有看原始定义才能确定的**数据契约细节**（枚举全集、字段类型、金额单位、日期格式）。本清单里的每一项都能通过读代码回答，不需要你运行系统、抓包或查数据库。

### 怎么用这份清单

清单分三层，按优先级从高到低：

| 层 | 内容 | 你要做的事 |
|---|---|---|
| **A** | 已知存在的文件 | **原样贴回**，不用总结 |
| **B** | 请求编译层（最关键的未知） | 按检索策略定位，**原样贴回** |
| **C** | 判断题 | 读代码后给结论，附上依据的代码片段 |
| **D** | 业务题 | 读码能答的先读码，读不到再问业务方 |

三条约定，能大幅提高这份东西的价值：

1. **原样贴回优于总结。** 我们要的是代码和文档原文。你概括一遍，中间就多了一次信息损耗，而我们恰恰是在追那些容易在概括中丢掉的细节（引号、类型、大小写、边界值）。文件太长就贴相关小节，并注明省略了哪部分。
2. **找不到也是答案。** 请写「未找到」，并列出你搜过的关键词和目录。这能帮我们判断是"东西不在这个仓"还是"关键词不对"，比留空有用得多。
3. **不确定就标注不确定。** 猜测请显式标为猜测。一个标注了"不确定"的答案我们会去验证；一个看起来确定但其实是猜的答案会把我们带进沟里。

### 已知的源码位置

| 内容 | 路径 |
|---|---|
| 仓库 | `CDIOperationMapWebsite` |
| 三个页面的源码根 | `website-src/src/app/component/operation-map/` |
| 已有文档目录 | `docs/init/` |
| 技术栈 | Angular 17.3.12 + TypeScript 5.4 + DataV LowCode + ECharts 5.5.1 + Tiny3/TinyPlus3 |

### 检索工具建议

推荐用 `ripgrep`（`rg`），比 IDE 全局搜索快且能搜进 `node_modules`：

```bash
# 在源码里搜
rg -n "graphQLDataSourceConfig" --type ts

# 搜进被 gitignore 的目录（node_modules 默认被跳过，必须加 --no-ignore）
rg -n "graphQLDataSourceConfig" --no-ignore -g '!*.map' node_modules/

# 只想知道命中在哪些文件
rg -l "orderDesc" --no-ignore
```

---

## A. 第一优先级：原样贴回的文件

这一批文件大概率能一次性覆盖表结构、字段类型和枚举字典，**贴回它们的收益远高于逐条回答后面的判断题**。请优先处理这一段。

### A.1 已有文档（A1–A4 已确认存在于 `docs/init/`）

| # | 文件 | 位置 | 为什么要 |
|---|---|---|---|
| A1 | `DB_SCHEMA.md` | `docs/init/` | 数据表与字段总览、7 个数据模型定义、组织层级关系。这是 C 段大部分判断题的直接答案来源 |
| A2 | `API_REFERENCE.md` | `docs/init/` | 后端端点与主要数据表的字段摘要 |
| A3 | `datasource-config-guide.md` | `docs/init/` | 数据源配置、`fitFunction` 写法、排序条件模板的完整说明。**这份是 B 段的最佳替代品**，如果它把请求形态写清楚了，B 段可以省掉一半 |
| A4 | `dv-indicator-component-guide.md` | `docs/init/` | 指标卡组件的 `fitContent`、`prefix`、`unit`、`linkAddress` 配置说明 |
| A5 | `frontend-calculation-cases.md` | 路径不详，按文件名全仓搜 | 全仓前端计算场景汇总（95+ 个）。**只需要场景 77~99**：77~95 是项目地图首页的管道支撑率与格式化，96~99 是经营流水环比 |

> A5 如果找不到，用 `rg -l "frontend-calculation-cases"` 或 `find . -name "frontend-calculation-cases.md"` 试一次即可，找不到就跳过。

### A.2 三个页面的源码

括号里是我们逆向时记录的行数，可用来确认找的是同一个文件（行数对不上不影响，说明版本有差异，照贴即可，并请注明）。

**项目地图首页** — `component/operation-map/project-map/project-home-page/`

| # | 文件 | 行数 | 关键内容 |
|---|---|---|---|
| A6 | `project-home-page.datasource.ts` | ~988 | 11 个数据源定义、全部 WHERE 模板、全部 `fitFunction` |
| A7 | `project-home-page.component.ts` | ~714 | 地图三级下钻、Tab 切换、概览表前端计算 |
| A8 | `config.ts`（同目录） | ~698 | 表格列定义、指标卡配置、地图配置 |

**机会点清单** — `component/operation-map/opportunity-list/`

| # | 文件 | 行数 | 关键内容 |
|---|---|---|---|
| A9 | `data-source-config.ts` | ~277 | 两个数据源（列表 + 总条数）、45 个查询字段、排序条件模板 |
| A10 | `opportunity-list.config.ts` | ~284 | 32 列定义、WHERE 拼装、列头筛选与日期范围拼 SQL |
| A11 | `opportunity-list.component.ts` | ~594 | 搜索、分页、排序、行点击下钻 |
| A12 | `opportunity-list.component.config.ts` | ~15 | 小文件，顺手一起贴 |

**项目详情** — `component/operation-map/project-detail/`

| # | 文件 | 行数 | 关键内容 |
|---|---|---|---|
| A13 | `project-detail.datasource.ts` | ~163 | 4 个数据源 |
| A14 | `project-detail.config.ts` | ~196 | 表格列定义，以及跳转详情页的传参函数 `jumpOpportunityDetail` |
| A15 | `project-detail.component.ts` | ~270 | 销售预测表分组小计合计、客户活动行转列 |
| A16 | `project-detail.component.config.ts` | ~17 | 小文件，顺手一起贴 |

### A.3 公共模块

| # | 文件 / 目标 | 怎么找 | 为什么要 |
|---|---|---|---|
| A17 | `common/operation-map-header/config.ts` | 路径已知 | **枚举字典的主要落点**。已知含 `projectLevelItems`（应立项级别）数组，很可能还有机会点阶段、NA 类型、超期状态、产业、行业等筛选器的候选项 |
| A18 | 顶部筛选栏的服务实现（`HeaderOptionService`） | `rg -l "getRegionQueryStr\|getMaxTimeByKey\|getRegionType"`，大概率在 `common/operation-map-header/` 下的 `*.service.ts` | **三个页面所有 WHERE 片段的真正来源**。`getRegionQueryStr()` 决定区域条件怎么拼，`getRegionType()` 决定地图层级，`getMaxTimeByKey()` 决定默认查询月份。这个文件的重要性仅次于 B 段 |
| A19 | 顶部筛选栏组件本身 | `common/operation-map-header/` 目录下其余文件 | 各筛选器的候选项从哪来（硬编码 / 接口） |
| A20 | 区域树数据 | `rg -n "region_dept_code_fin" --type ts` 里找候选项数组；或搜 `regionTree`、`regionList`、`地区部` | 完整的地区部与代表处清单（code、中文名、从属关系）。如果是接口拉的，贴接口调用那段 |
| A21 | 日期配置表 `IOC_OPERATION_MAP_DATEINFO_CONFIG` | `rg -n "IOC_OPERATION_MAP_DATEINFO_CONFIG"` | 页面默认月份不是"当前月"而是"数据已就绪的最新月"，这张表是来源。我们要复刻这个行为 |
| A22 | 数值格式化实现 `DataFilter` / `DataFilterType` | `rg -n "OPERATION_BILLION\|enum DataFilterType"` | 需要 `OPERATION_BILLION`、`OPERATION_BILLION_NO_YUAN`、`POINT_ONE`、`THOUSAND_SIGN`、`COCKPIT_ZERO_RATE_NO_PERCENT` 这五种的**实现原文**。这些直接决定屏幕上的数字，靠描述复刻必然对不上 |
| A23 | 三个空值判断工具 | `rg -n "isNull\|IndicatorCalculate\|isNotEmpty" --type ts` | `CommonUtil.isNull`、`IndicatorCalculate.validate`、`StringUtil.isNotEmpty` 三者语义不同（其中一个把 `0` 也当成空），我们需要三份实现原文 |
| A24 | 地图组件与底图资源 | `rg -n "registerMap\|geoJson\|\.geojson"`；以及 `assets/` 下的 `.json` 底图文件名 | 见 D.2 |
| A25 | 路由定义 | `rg -l "operation-map" --type ts \| rg "routing"` | 确认三个页面的路由路径与是否有路由守卫 |
| A26 | 环境配置 | `src/environments/environment*.ts` | 后端端点地址、baseUrl |
| A27 | 开发代理配置 | 仓库根的 `proxy.conf.json` / `proxy.config.json`，以及 `angular.json` 里 `proxyConfig` 那行 | 端点的真实路径与转发目标。这两个文件通常很小，且直接暴露真实 URL |
| A28 | HTTP 拦截器 | `rg -n "HttpInterceptor\|intercept("` | 认证凭据怎么带、错误怎么统一处理。见 C.9、C.10 |

---

## B. 第二优先级：请求编译层（**最关键的一项**）

### B.1 问题是什么

页面源码里的数据源是这样声明的（示意）：

```ts
{
  id: 'opportunityListTable',
  type: 'graphql',
  resultType: 'mapArray',
  graphQLDataSourceConfig: {
    tableName: 'PROJECT_MAP_OPPORTUNITY_DETAILS_M',
    where: "mtime = '{{externalObject_opportunity_outline_end}}' and is_lost_order = 1",
    limit: '{{externalObject_limit}}',
    offset: '{{externalObject_offset}}',
    fields: [
      {
        name: 'bidding_amount',
        orderDesc: {
          condition: "{{externalObject_is_asc === false && externalObject_sorting_field === 'bidding_amount'}}",
          priority: '1',
        },
      },
    ],
  },
  fitFunction: (data, outputFields, globalVars) => { /* ... */ },
}
```

这是 DataV LowCode 框架的**抽象层**，不是网络上真正传输的东西。我们要找的是：**框架把这段配置编译成什么样的 HTTP 请求？**

具体地说，唯一必须回答的问题是——

> **`where` 那个字符串，是不是原样作为一个参数发给了服务端？**

如果**是**：服务端收到的就是一段 SQL 片段，那么转义与注入防护由调用方承担，我们的重建方案要按 SQL 语义来设计，并且要认真对待这份安全责任。

如果**不是**（框架把它解析成了结构化的过滤条件对象）：我们要知道解析成什么形状、支持哪些运算符，注入风险由服务端承担。

这两种情况下我们的实现差别极大，**这一问不确定我们没法动工**。这也是为什么它单独占一段。

### B.2 怎么找

这个模块大概率不在应用源码里，而在 DataV LowCode 库内部（`node_modules/` 下，或者是一个兄弟仓）。给几条并行的检索路径，哪条先中都行：

**路径一：先定位 DataV 库本身**

```bash
# 在 package.json 里找包名
rg -n "datav|lowcode|dv-|@cdi|@his" package.json

# 拿到包名后进去搜
rg -n "graphQLDataSourceConfig" --no-ignore node_modules/<包名>/
```

**路径二：按配置里的字段名反查**（这些名字很独特，命中率高）

```bash
rg -n "graphQLDataSourceConfig|resultType|mapArray|orderDesc|orderAsc|fitFunctionDependencies|DVCanvasConfig|dataSourceConfig" --no-ignore -g '!*.map'
```

**路径三：按发请求的动作找**

```bash
rg -n "HttpClient|httpClient\.post|\.post\(|\.request\(|XMLHttpRequest|fetch\(" --no-ignore -g '!*.map' node_modules/<包名>/
```

**路径四：按端点特征找**

```bash
rg -n "graphql|/gql|query \{|variables|operationName" --no-ignore -g '!*.map'
```

**路径五：兄弟仓**

如果 DataV LowCode 是内部库且源码另有仓库，在 `codebase/` 同级目录下找目录名含 `datav` / `dv` / `lowcode` / `canvas` 的仓库。

### B.3 找到之后贴什么

按这个顺序，能贴几项贴几项：

1. **把配置编译成请求体的那个函数整段**（从接收 `graphQLDataSourceConfig` 到组装出 payload）。
2. **实际发请求的那几行**：HTTP method、URL、请求头设置、body 怎么传。
3. **请求体的类型定义**（`interface XxxRequest` / `type XxxPayload` 之类）。
4. **响应处理那段**：怎么从响应里取出数据、`resultType: 'mapArray'` 在这里起什么作用。

**关于编译后的代码：如果你只找得到打包压缩后的 `.js`（一行几万字符那种），照贴不误，我们能读。** 压缩过的代码虽然变量名没了，但请求组装的结构是保留的，对我们同样有用。如果同时存在 `.d.ts` 类型声明文件，请一并贴上——那个更好读。

### B.4 如果实在找不到

请至少给这三样，我们能据此另想办法：

- DataV LowCode 的**包名与版本号**（`package.json` 里那一行原文）。
- 任何配置了后端端点地址的文件（A26、A27）。
- 应用里有没有绕开框架、直接发请求的地方（`rg -n "HttpClient" --type ts` 在应用源码内的命中）——哪怕是别的页面的，也能让我们看到请求形态。

### B.5 顺带能从同一个模块回答的问题

如果 B.3 的代码贴回来了，下面这几问大概率同时有了答案；如果你在读那段代码时能顺手确认，请直接写结论：

| # | 问题 |
|---|---|
| B5-1 | **排序怎么传。** 配置里的 `orderDesc.condition` 是个模板表达式，求值为 `true` 才生效。求值之后剩下什么进入请求？字段名、方向、优先级各自的参数名是什么？ |
| B5-2 | **`priority` 是数字还是字符串。** 源码里写的是 `'1'`（带引号）。多字段排序时，数字小的优先还是大的优先？ |
| B5-3 | **分页参数。** `limit` / `offset` 在请求里叫什么名字、放在哪里？`limit` 有上限吗（我们看到的默认值都是 10）？ |
| B5-4 | **总条数怎么取。** 清单页有一个独立数据源，查同一张表、同样的 WHERE、无 `limit`/`offset`，只查一个字段 `cnt`。`cnt` 是服务端认识的聚合关键字，还是表上真有这么一列？ |
| B5-5 | **`resultType` 的取值集合。** 除了 `mapArray` 还有哪些？各自对响应的处理有什么不同？ |
| B5-6 | **响应体形状。** 前端引用数据的路径形如 `{数据源id}.{TABLE_NAME}.{字段名}`（表名全大写、字段名全小写下划线）。这层嵌套是服务端返回的，还是框架自己套上去的？服务端原始响应长什么样？ |
| B5-7 | **REST 类型的数据源。** 表 `AP_DM_CCC_IOC_PL_EXP_AR_ABF_R2` 的数据源类型标的是 `rest` 而非 `graphql`，参数是 `PERIOD_ID_INPUT`、`REGION_LEVEL`、`REPORT_ITEM_CODE_INPUT` 这种大写下划线风格。它走的是同一个端点还是另一个？参数放在 body 还是 query string？ |

---

## C. 需要读代码作答的判断题

每题都标了「去哪找」。答案形式：**结论 + 依据的代码片段**。片段可以短，但请是原文。

### C.1 枚举字典的完整性

这些值同时是**列的显示文本**和**筛选器的候选项**，两处都要。我们需要完整的 `code → 中文名` 映射。

**主要落点：`common/operation-map-header/config.ts`（A17）。如果这个文件贴回来了，下面很多项就直接有答案了。**

| # | 字段 | 我们已知的 | 还缺什么 | 检索关键词 |
|---|---|---|---|---|
| C1-1 | `ati_status`（立项状态） | 4 项：`Not_Initiated`→无需立项、`Waiting_Ati`→达标待立项、`In_Project_Initiation`→立项中、`Initiated`→已立项 | 是否还有其他取值？前端映射里"其他"分支返回空字符串或 `--`，说明可能存在未覆盖的值 | `ProjectStatus`、`Waiting_Ati`、`ati_status` |
| C1-2 | `project_initiation_status` | 只见过 `'Issued'` | 完整取值集合。注意它和 `ati_status` 是**两个不同字段**，我们不确定二者关系 | `project_initiation_status`、`'Issued'` |
| C1-3 | `opportunity_step`（机会点阶段） | 设计稿上出现 CSS1–CSS5、CSSA、CSSB、CSSC | 完整列表与中文名。另有一个 `opportunity_step_name` 字段，是同一维度的中文列吗？ | `CSS1`、`opportunityStage`、`opportunity_step` |
| C1-4 | 应立项级别 | 数组名 `projectLevelItems`，在 `common/operation-map-header/config.ts`。设计稿上是"公司特级 / 公司级 / 地区部级 / 代表处级" | **这里有矛盾**：清单页的 `should_project_level_name` 示例值是 `"L1"`，与设计稿的中文档位对不上。请贴回 `projectLevelItems` 原文，并说明 `project_level`、`project_initiation_level`、`should_project_level_name` **三个字段**的关系与各自取值 | `projectLevelItems`、`should_project_level_name`、`project_initiation_level` |
| C1-5 | `overdue_status_code`（超期状态） | 显示列 `overdue_status` 是中文（如"已超期"），筛选用的是 `_code` | code 全集与对应中文 | `overdueStatus`、`overdue_status_code` |
| C1-6 | `public_cloud_na_level`（NA 类型 / 客户级别） | 显示列是 `public_cloud_na_level_name`（如"战略客户"），筛选条件用的是不带 `_name` 的 `public_cloud_na_level` | code 全集与对应中文 | `naType`、`public_cloud_na_level` |
| C1-7 | `cloud_class_code`（产业） | 筛选器变量名叫 `lv2ProdRdTeam`（产业二级团队），显示列叫 `cloud_class` | code 全集与对应中文；以及"产业二级团队"和 `cloud_class` 是不是同一套编码 | `lv2ProdRdTeam`、`cloud_class_code` |
| C1-8 | 行业 `sub_industry_level1_code` / `sub_industry_level2_code` | 清单页的行业筛选是**级联**（选了一级才能选二级），WHERE 里两级分别 `IN` | **完整的两级树**：一级 code → 中文名 → 其下属的二级 code 列表。从属关系是这一项的重点 | `showIndustrySelect`、`sub_industry_level1_code`、`industry` |
| C1-9 | `bg_type_code` / `bg_type` | 出现在清单页的查询字段里，但没有对应的展示列 | 取值集合，以及这个字段现在到底有没有在用 | `bg_type_code` |
| C1-10 | 机会点三档构成（概览页顶部卡） | 类别名取自设计稿逐字值：`卓越` / `战略` / `核心`。`opportunity-tiers` 内联页面数据源用合成的 `tier-name` / `tier-cnt` / `bidding-amount` 行占位 | **这三档在四份规格里零命中**。请给出真实的字段名、数量和预签金额口径、code→中文映射，以及它和 `public_cloud_na_level`（C1-6）是不是同一套编码 | `卓越`、`战略`、`核心`、`naType` |
| C1-11 | 项目分层分级四档（概览页顶部卡） | 类别名取自设计稿逐字值：`公司特级` / `公司级` / `地区部级` / `代表处级`。`project-levels` 内联页面数据源用合成的 `level-name` / `level-cnt` / `bidding-amount` 行占位 | 真实字段名、数量和预签金额口径及取值。**与 C1-4 直接相关**：那一项里 `should_project_level_name` 的示例值是 `"L1"`，与这四个中文档位对不上，请一并说明 | `projectLevelItems`、`project_initiation_level` |
| C1-12 | 复盘奖惩四档（概览页顶部卡） | 类别名取自设计稿逐字值：`金牌` / `银牌` / `红牌` / `黄牌`。我们已用合成字段 `medal-gold-cnt` / `medal-silver-cnt` / `medal-red-cnt` / `medal-yellow-cnt` 占位 | 真实字段名与判定口径（是复盘结果的评级，还是另一套奖惩流程？）。**四份规格里同样零命中** | `金牌`、`is_review_completed` |
| C1-13 | 管道支撑率 | 概览页暂用预计算的 `pipeline-support-rate` 和地图行 `support-rate` 合成值，不在页面中反推公式 | **真实口径**：服务端最终返回哪个字段、0–100 还是 0–1、各聚合层级如何计算、零分母显示什么 | `管道支撑率`、`pipeline` |
| C1-14 | 立项率 / 分析会召开率 / 赢单率 / 复盘率 | 页面用 `ratio.scale: 100` 分别计算 `initiated-cnt / should-initiate-cnt`、`actual-analysis-meeting-cnt / planned-analysis-meeting-cnt`、`won-opportunity-cnt / resulted-opportunity-cnt`、`reviewed-cnt / should-review-cnt`，零分母返回空值；分子分母均为合成演示值 | 确认四组分子/分母的真实字段、聚合粒度和业务口径 | `立项率`、`分析会召开率`、`赢单率`、`复盘率` |
| C1-15 | 地图年度费用与概览八列表字段 | `map-regions.yearly-fee`、`overview-by-office.rank` / `region-dept-name` / `analysis-meeting-rate` / `current-month-new-signed-amount` 是为设计展示补入的合成演示字段 | 给出真实字段名、金额单位、排名口径与分析会统计范围 | `年度费用`、`本月新增签单`、`排名` |
| C1-16 | 详情六块叙事的两个合成展示字段 | `latest-analysis-meeting-display` 由主题/时间/结论合并，`risk-management-display` 由项目风险/求助事项合并；仅存在于当前内联页面数据源，不是未来 GraphQL 结果字段契约 | 确认真实 GraphQL 是否返回原有八个业务字段；若要由服务端提供展示文本，另行确定契约 | `latest_analysis_meeting_topic`、`project_risks`、`project_help_required` |

> C1-10～C1-16 覆盖 IOC-S1 / IOC-S2 使用的合成演示字段。它们只服务当前内联页面数据源；接入 GraphQL 时应从真实结果字段契约重新映射，不能把这些占位字段当作后端既定接口。

**另外请说明这些候选项是怎么来的**：硬编码常量数组、字典表、还是某个接口返回。如果是接口，请贴调用那段代码。这决定我们的筛选器候选项要怎么实现。

### C.2 布尔类字段的取值形态

这一批字段是 `1/0` 数字、`'1'/'0'` 字符串、`'Y'/'N'` 还是 `true/false`？

`is_key_poffice`、`is_key_rep_office`、`is_valid`、`is_lost_order`、`is_unupdated_opportunity`、`is_five_one_activity`、`is_timely_projected`、`is_actual_project_analysis_meeting`、`is_analysis_meeting_held_current_month`、`is_owner_attended_analysis`、`is_review_completed`、`is_operating_to_be_issued`、`is_operating_issued`、`participable`、`is_state_funded`、`is_parent_company_name`、`is_breakthrough_customer`

**我们的推断**（请确认或推翻）：是数字。依据有两处——WHERE 模板里写的是 `and is_lost_order = 1`（不带引号），前端格式化函数用的是 `value === 1` 严格相等。

**去哪找**：`DB_SCHEMA.md` 的字段类型；三页 `*.datasource.ts` 里的 WHERE 模板原文；`formatBoolean` 的实现（`rg -n "formatBoolean"`）。

**三个附带问题**：

- `is_key_poffice`（用在机会点相关的表）与 `is_key_rep_office`（用在销售收入目标表）是同一语义不同名吗？两个都对应界面上的"重点国代"复选框。
- `is_operating_to_be_issued` 和 `is_operating_issued` 出现在 WHERE 里，但不在清单页的查询字段列表中。确认它们确实是 `PROJECT_MAP_OPPORTUNITY_DETAILS_M` 上的列。
- `is_parent_company_name` 这个名字看起来像字符串字段却带 `is_` 前缀，它到底是布尔还是名称？

### C.3 金额字段的原始单位

所有金额字段的原始单位是**元**还是**分**？

涉及字段：`bidding_amount`、`bidding_amount_sum`、`last_bidding_amount_sum`、`amount_estimated`、`amount_estimated_sum`、`product_yearly_fee_sum`、`edproject_opportunity_amount_sum`、`effective_opportunity_remaining_amount_current_sum`、`stock_forecast_revenue_amt_sum`、`target_revenue_amt_cny`、`target_revenue_amt_usd`、`ytd_amt`、`forecast_jan`~`forecast_dec`、`object_forecast_*` / `lift_forecast_*` / `total_forecast_*`

**我们的推断**：是元。依据有两处——详情页的 `formatAmount` 先 `value / 10000` 再当作"万"显示；指标卡的单位表达式用 `Math.abs(value) >= 100000000` 判"亿"。两处都指向元。

**为什么必须确认**：单位错会让整页数字差 100 倍，而且因为格式化后带单位，肉眼很难发现。

**去哪找**：`DB_SCHEMA.md` 的字段说明或建表注释。

**附带一问**：销售收入目标表同时有 `target_revenue_amt_cny` 和 `target_revenue_amt_usd` 两个币种列，但前端计算只用了 cny，页面变量里又有一个 `currency: 'RMB'`。这个变量有没有真的切换过币种？还是恒为 RMB？

### C.4 `mtime` 的类型

`mtime` 是数据月份，形如 `202604`（yyyyMM）。它在库里是字符串还是整数？

**为什么问**：WHERE 里写的是 `mtime = '202604'`（带引号）。如果库里是整数，说明服务端做了隐式转换，我们在构造等值条件时需要知道这一点。

**去哪找**：`DB_SCHEMA.md`；以及 `getMaxTimeByKey()` 返回对象里 `period_no` 的类型（A18）。

### C.5 各日期字段的格式

逐个确认这些字段的真实存储形态：`create_time`、`update_time`、`order_date_estimated`、`latest_analysis_meeting_time`、`target_year`。

**这里有一处明确的矛盾，请重点澄清**：清单页的列说明写的是"格式 `yyyy-MM`"，但同一页的日期范围筛选拼出来的条件是

```
and create_time between '2026-01-01 00:00:00' and '2026-03-31 23:59:59'
```

带完整时分秒。这说明底层多半是 datetime 而不是 `yyyy-MM` 字符串，页面上看到的短格式是显示时截断的。到底是哪种？

其余观察到的不一致：`order_date_estimated` 的示例值是 `"2026-06"`，`latest_analysis_meeting_time` 的示例值是 `"2026-04-10"`——两个字段格式不同，请分别确认。`target_year` 是 `'2026'` 字符串还是 `2026` 整数？

**去哪找**：`opportunity-list.config.ts` 里日期范围筛选拼 SQL 那段（函数名大概是 `onSelect`），**请把这段原样贴回**；再对照 `DB_SCHEMA.md` 的字段类型。

### C.6 `party_number` 是不是同一套编码

`PROJECT_MAP_OPPORTUNITY_DETAILS_M.party_number` 与 `CUSTOMER_MAP_CUSTOMER_ACTIVITY_SUMMARY.party_number` 是同一个编码体系、可以直接等值匹配吗？

**我们的推断**：是。依据是详情页把前一张表查出来的 `party_number` 直接拿去当后一张表的查询条件用了。所以从运行时行为看它们是同一套。

**要确认的是口径**：这两个字段是同源的（同一个主数据），还是碰巧格式相同？`DB_SCHEMA.md` 里有没有描述这两张表之间的关联关系？

**为什么问**：我们打算复刻这条"先查详情拿到客户编号、再用它查客户活动"的依赖链。如果两边编码体系不同、需要中间转换，我们的取数链路要重新设计。

### C.7 区域层级链的完整形态

区域筛选之后，代码里会算出一个 `regionType`，有四个取值：

| `regionType` | 含义 |
|---|---|
| `''` | 全球 |
| `'region_dept_code_fin'` | 地区部 |
| `'rep_office_code_fin'` | 代表处 |
| `'geo_pc_code'` | 区域责任中心 |

前三个是清楚的三级链（全球 → 地区部 → 代表处）。**`geo_pc_code` 在哪一级？** 它是代表处的下级，还是与代表处并列的另一条切分维度？

同时，收入数据的请求参数 `REGION_LEVEL` 有五个取值：`GLOBAL`、`REPOFFICE`、`OFFICE`、`GEO_PC`、`DO`。这五个和上面四个怎么对应？特别是：

- `REPOFFICE` 和 `OFFICE` 的区别是什么？
- `DO` 是什么层级？

**去哪找**：`rg -n "getRegionType|regionType|regionLevel|geo_pc_code|REGION_LEVEL"`。请把计算 `regionType`、`regionLevel` 和 `getRegionQueryStr()` 的那几个函数**原样贴回**（它们应该都在 A18 那个服务里）。

**同时要**：完整的地区部与代表处清单（code、中文名、从属关系）。我们已知的样本只有 `R05`→欧洲地区部、`R051`→德国代表处、以及一个特殊值 `R99`→中国区。如果这份清单是硬编码的就贴数组，是接口拉的就贴接口调用那段。

**六个占位编码待替换（IOC-S1 新增）。** 概览页的地图现在有 8 个地区部散点，其中只有两个编码有出处，另外六个是我们编的占位值，形如 `TBD-*`：

| 地区部 | 我们用的编码 | 出处 |
|---|---|---|
| 欧洲 | `R05` | 有出处（本节上文） |
| 中国 | `R99` | 有出处（规格 001 §6.1 的特殊处理） |
| 亚太 | `TBD-APAC` | **占位** |
| 北部非洲 | `TBD-NAF` | **占位** |
| 中东中亚 | `TBD-MECA` | **占位** |
| 拉美 | `TBD-LATAM` | **占位** |
| 南部非洲 | `TBD-SAF` | **占位** |
| 俄罗斯 | `TBD-RU` | **占位** |

这六个值只出现在 `pages/ioc-project-overview.json` 的 `map-regions` 数据源里（`region-code` 列，以及下级行的 `parent-code`）。真实编码到手后替换那一处即可，前缀 `TBD-` 可以直接用来定位。

### C.8 收入表的字段名对不上

管道支撑率的分母来自三张表，前端按 `地区部代码 + '_' + 代表处代码` 拼成 key 做对齐。但其中一张表（`AP_DM_CCC_IOC_PL_EXP_AR_ABF_R2`）的字段名和另外两张不一样：

| 表 | 地区部字段 | 代表处字段 |
|---|---|---|
| `PROJECT_MAP_OPPORTUNITY_INDEX_SUMMARY` | `region_dept_code_fin` | `rep_office_code_fin` |
| `PROJECT_MAP_CUSTOMER_REVENUE_FORECAST_M` | `region_dept_code_fin` | `rep_office_code_fin` |
| `PROJECT_MAP_REVENUE_BUSINESS_TARGET` | `region_dept_code_fin` | `rep_office_code_fin` |
| `AP_DM_CCC_IOC_PL_EXP_AR_ABF_R2` | `region_code` | `repoffice_code` |

**问题**：这两组字段是同一编码体系、值可以直接相等比较吗？还是需要转换？

**去哪找**：`DB_SCHEMA.md`；以及 `project-home-page.datasource.ts` 里那个按 `region_code + "_" + repoffice_code` 聚合的 `fitFunction` 原文（数据源 id 形如 `queryRealizedRevenueSum`）。

### C.9 错误响应的形态

下面几种情况，服务端各返回什么？要 **HTTP 状态码 + 响应体形状 + 错误码字段名**：

- 查询本身失败（比如条件写错、表不存在）
- 无权限
- 会话过期 / 未登录
- 超时
- 被限流

**去哪找**（都能读代码得到）：

```bash
rg -n "HttpErrorResponse|catchError|interceptor|401|403|errorCode|retCode|resultCode"
```

看两个地方：全局 HTTP 拦截器（A28）里的错误分支，以及 DataV 数据源加载失败时的处理分支。**如果有错误码到提示文案的映射表，请原样贴回**——那张表能一次性告诉我们服务端会返回哪些错误码。

### C.10 认证与用户身份

| # | 问题 |
|---|---|
| C10-1 | 请求怎么带凭据？Cookie（`withCredentials: true`）、`Authorization` 头、还是自定义请求头？ |
| C10-2 | 凭据从哪来？登录页、单点登录重定向、还是网关注入？ |
| C10-3 | **请求体或请求头里有没有显式携带用户标识**（工号、uid、账号）？ |
| C10-4 | 会话过期时前端怎么处理？跳登录页、弹窗、还是静默重试？ |

**去哪找**：

```bash
rg -n "HttpInterceptor|intercept\(|withCredentials|Authorization|Bearer|setHeaders|login|sso"
```

**请把拦截器整个文件贴回**（通常不长）。

C10-3 是这一组里最要紧的一问：如果请求里完全没有用户相关的字段，那说明身份识别全靠凭据、由服务端完成——这正是我们需要确认的事，也直接关系到 D.3。

---

## D. 需要问人的业务题

这一段里 D.1 和 D.2 的大部分其实能读码作答，**请先试着读码**，读不到再去问业务方或设计。D.3 基本必须问人。

**D.6～D.8 是另一类**：它们的收件人是**设计侧**，不是读旧仓代码的人。设计稿（`参考/项目地图/设计稿/*.html`，Figma 导出）引用的 `assets/` 目录整个不存在，图标、底图与品牌资源全部渲染为空，这三项就是那批缺口里必须由外部补的部分。旧仓代码里大概率找不到答案，D.7 是唯一可能的例外（见该节的读码线索）。

### D.1 预签金额筛选：自由输入还是预设档位？

**矛盾在这里**：源码里这个筛选值是一个区间 `[start, end]`，拼出来的条件是

```
and bidding_amount >= ${start} and bidding_amount <= ${end}
```

看起来像自由输入两个数字。但设计稿上"请选择预签金额"画的是一个**下拉框**，不是两个数字输入框。

**我们的推断**：是**预设档位**（比如「1 亿以下」「1–5 亿」「5 亿以上」），每个档位在前端映射到一个固定区间。

**需要的答案**：

- 如果是预设档位：给出**完整档位清单**与每档的边界值，并说明边界是开区间还是闭区间、数值单位是元还是亿。
- 如果是自由输入：直接告诉我们，我们的推断就是错的。

**先读码**：`rg -n "presignedAmount|showPresignedAmountSelect|preSignAmount"`。候选项数组很可能就在 `common/operation-map-header/config.ts`（A17）里。

### D.2 地图：底图与区域名映射

首页的地图按区域着色 + 叠加散点，散点点击可三级下钻。我们需要：

| # | 问题 | 读码线索 |
|---|---|---|
| D2-1 | **底图用的是哪份 GeoJSON？** 是标准世界地图 + 中国地图，还是一份自定义的"地区部"底图？设计稿上的散点是「欧洲 / 亚太 / 北部非洲 / 中东中亚 / 拉美 / 南部非洲 / 俄罗斯 / 中国」——这是公司的地区部划分，不是标准世界地图的行政区 | `rg -n "registerMap\|geoJson\|\.geojson"`；`assets/` 目录下的 `.json` 文件名 |
| D2-2 | **地区部名 → 地图区域名的映射表。** 代码里有"欧洲地区部"→"欧洲"这类转换，还有一处"中国区"被特殊处理为 `R99`。请把这个映射**原样贴回**，并说明还有没有其他特例 | `rg -n "R99\|地区部"` |
| D2-7 | **8 个地区部的散点落点是我们编的（IOC-S1 新增）。** 我们用的是标准 world GeoJSON（`packages/widgets/src/components/map-chart/maps/world.json`，177 个带中心点的区域），它没有"地区部"这一级，所以每个地区部借用了一个代表国家的中心点作锚：欧洲→`Germany`、亚太→`Indonesia`、北部非洲→`Egypt`、中东中亚→`Saudi Arabia`、中国→`China`、拉美→`Brazil`、南部非洲→`South Africa`、俄罗斯→`Russia`。映射写在页面文档 `region-map` 组件的 `props.nameMap` 一处。**这八个锚点没有业务依据**，请给出真实的地区部底图（D2-1）或真实的地区部中心点经纬度 | `nameMap`；`maps/world.json` 的 `properties.cp` |
| D2-3 | 图例分档 `0 / 1%~50% / 51%~80% / 80%以上` 是**写死的**还是按数据动态算的？ | `rg -n "legendArr"` |
| D2-4 | 散点大小映射参数 `symbolSizeVal: "1\|51\|80"` —— 这三个数分别是什么含义？ | `rg -n "symbolSizeVal"` |
| D2-5 | 色阶 `colorArr: "#F0F0F0\|#E3EEFD\|#91BEFF\|#5096F9"` 是和 D2-3 的四个图例档位一一对应吗？ | `rg -n "colorArr"` |
| D2-6 | 地图配置项 `onlyChinaOversea: true` 是什么行为？ | `rg -n "onlyChinaOversea"` |

D2-1 和 D2-2 是这一组里最要紧的两项——底图资源如果拿不到，我们的地图就没法复刻区域划分。**如果底图是一个静态资源文件，请直接把文件给我们**（不用贴进文档，附件即可）。

### D.3 行级数据权限归谁

设计稿的侧边栏显示当前用户是「Region 经理」，说明这个应用天然是按区域授权的。

**需要一个方向性的回答**：

> 用户看到的数据范围，是**服务端按调用者身份自动过滤**的，还是**前端必须在查询条件里自带区域限制**？

**读码线索**（这一问有一半能读码判断）：看区域筛选器的**初始值**是怎么来的。

- 如果初始值是硬编码的"全球"或空值 → 说明前端不参与范围限定，过滤在服务端。
- 如果初始值是从某个"当前用户信息"接口拿到的默认地区部 → 说明前端参与了范围限定，那我们需要知道那个接口。

```bash
rg -n "userInfo|currentUser|getUserInfo|permission|defaultRegion|authRegion"
```

**要问业务方的部分**：不同角色（比如地区部经理 vs 总部）看到的数据范围规则是什么？有没有"只能看本区域"这类硬约束？

**为什么必须问**：如果范围限定要由调用方承担，我们的页面就需要表达"当前用户可见的区域范围"——那是一类我们现在完全没有的输入（用户改不了它，它也不来自 URL）。这一项不明确，我们做出来的东西只能在受控环境里演示。

### D.4 丢单口径：`is_lost_order` 和 `CSSC` 是一回事吗？

首页的"丢单项目"表用的条件是 `is_lost_order = 1`。但从这个表下钻到清单页时，代码设置的默认筛选却是机会点阶段 `opportunity_step = 'CSSC'`。

**问题**：这两个口径等价吗？如果不等价，用户从"丢单项目"表点下钻，看到的清单和上一页的表就对不上——这是有意为之还是一个已知缺陷？

**读码线索**：`rg -n "is_lost_order|CSSC"`。

### D.5 默认查询月份从哪来

三个页面的默认月份不是"当前月"，而是从一张配置表（`IOC_OPERATION_MAP_DATEINFO_CONFIG`）里取的 `maxTime.period_no`，而且**每个数据源有不同的 `maxTime` 键**。

需要知道：

- 这张配置表由谁维护、多久更新一次？
- "每个数据源有不同的 `maxTime` 键"是什么意思——不同的表数据就绪时间不同？
- 用户能选到的月份范围是怎么定的（最早到哪个月）？

我们需要复刻"打开页面看到的是数据已就绪的最新月"这个行为，硬编码成当前月会出错。

**读码线索**：A21，加 `rg -n "getMaxTimeByKey|period_no|maxTime"`。

### D.6 及时奖惩四个牌的色值

设计稿「复盘总结」卡下半部的「及时奖惩」有四个 12×12 的图形，各紧跟一个中文标签：`449:7628`（金牌）、`449:7632`（银牌）、`449:7639`（红牌）、`449:7656`（黄牌）。

**要什么**：这四个牌的十六进制色值；以及它们到底是什么图形——两种形态（奖牌 + 罚牌）还是四个同形色块。

**为什么要**：这四个色封在缺失的资源文件内部，从设计稿的类名里读不出来。整页能静态读到的色值里**没有红色**，唯一的琥珀色 `#fec72a` 属于「核心 / 地区部级」那条图例（`椭圆形` 207:7975、207:9646），是另一个维度的系列色，不能挪用。

**拿不到会怎样**：我们已经自定了一套占位色顶着——金 `#D6AF36` / 银 `#A7A7AD`（通行奖牌金属色阶）、红 `#D92D20` / 黄 `#F5C518`（足球罚牌通行色），写在 `packages/widgets/src/assets/medal.svg` 与 `penalty-card.svg`，两个文件的头部注释都标明了是占位。页面能出图，但**这四个色是我们编的，不能当成还原结果验收**。真值到手后只改那两个文件的 `color` 属性和同目录 README 的对照表。

**顺带一问**：这四档是复盘结果的评级，还是另一套独立的奖惩流程？这与 C1-12 同源——那一项问的是字段名与判定口径，这一项问的是视觉表达，两处最好一起回答。

### D.7 `207_7882` 这个 14×17 的图形是什么

**要什么**：设计稿 `project-overview.html` 里 `data-node-id="207:7882"`（`src="assets/207_7882.svg"`）对应的原始图形，或者一句话说明它是什么。

**我们掌握的全部线索**：

| 项 | 值 |
|---|---|
| 节点 id / name | `207:7882` / `graph`——泛化名，不带语义 |
| 标注尺寸 | 14 × 17，宽高比 0.824 |
| 位置 | 绝对定位在地图组 `组合 14349`（207:7803）内，`left-[460px] top-[114px]` |
| 附加样式 | `[border:1px_solid_#333333]` |
| 与定位针的关系 | 同组里 8 个地区部标签的定位针（`形状结合`）宽高比是 0.7755，与它不同，**不是同一个图形** |
| 相邻文字 | 无。它孤立存在，没有可反推语义的上下文 |

**为什么要**：这是概览页 87 个资源引用里**唯一一个我们连归类都做不了**的。它可能是另一种地图标记（那要画成 SVG），也可能是散点或图例的一部分（那由 `mapChart` 渲染，根本不需要资源文件）。两条路的做法完全不同，猜错就是白做。

**拿不到会怎样**：地图上少一个图形。我们不会瞎补——没有相邻文字、没有语义化节点名，编出来的东西对错无从判断。

**读码线索**（这一问有可能读码作答）：如果旧仓的地图配置里有额外的 `symbol` / `markPoint` / 自定义图标声明，贴回来即可回答。在 A8 那个 `config.ts` 里 `rg -n "symbol|markPoint|customIcon|iconUrl"`。

### D.8 品牌标识、文字标与头像资源

**要什么**（都是原始矢量文件，不用贴进文档，附件即可）：

| # | 资源 | 设计稿引用 | 标注尺寸 |
|---|---|---|---|
| D8-1 | 华为标志 | `形状结合` 207:8464 | 45.15 × 36 |
| D8-2 | 文字标，逐字外框共 8 个字形 | 207:8481、207:8468、207:8469、207:8472、207:8473、207:8476、207:8477、207:8480 | 宽 2.54~14.35、高 10.76~15.18，排在 95.26px 宽的 `编组 44` 里，第 6 个字形前有 10px 词间距 |
| D8-3 | 用户头像 | `编组 4` 207:8444 | 32 × 32，顶栏最右、「中文」之后 |

**为什么要**：D8-1 与 D8-2 是商标，标志与文字标的字形有精确的 CI 规范，描摹出来的赝品既不合规、也一定对不上。D8-3 是头像位，真人照片还是占位头像得由设计定义，同样编不出来。这三项合计 10 个资源引用。

**拿不到会怎样**：顶栏左侧的标志区与右侧的头像位留空。功能不受影响，但顶栏观感无法验收。

**先确认归属再找文件**：这三项都落在顶栏（`编组 12` 207:8441）上，而按 `docs/host-contract.md`，顶栏与左侧导航属应用外壳、不属页面内容。如果最终由门户方自带这批资源，本项可以直接作废。

---

## E. 回复模板

复制下面这段，逐项填空即可。**不用改格式，也不用润色**，我们能处理原始内容。填不了的写「未找到」加你搜过的关键词。

````markdown
# 回复 — IOC 作战地图寻源

填写人：
日期：
仓库版本 / 分支 / commit：

## A. 文件

- [ ] A1 DB_SCHEMA.md — 状态：（已贴 / 未找到 / 部分）
  <在此贴入原文，或注明附件文件名>

- [ ] A2 API_REFERENCE.md — 状态：
- [ ] A3 datasource-config-guide.md — 状态：
- [ ] A4 dv-indicator-component-guide.md — 状态：
- [ ] A5 frontend-calculation-cases.md（场景 77~99） — 状态：
- [ ] A6 project-home-page.datasource.ts — 状态：
- [ ] A7 project-home-page.component.ts — 状态：
- [ ] A8 project-home-page/config.ts — 状态：
- [ ] A9 opportunity-list/data-source-config.ts — 状态：
- [ ] A10 opportunity-list.config.ts — 状态：
- [ ] A11 opportunity-list.component.ts — 状态：
- [ ] A12 opportunity-list.component.config.ts — 状态：
- [ ] A13 project-detail.datasource.ts — 状态：
- [ ] A14 project-detail.config.ts — 状态：
- [ ] A15 project-detail.component.ts — 状态：
- [ ] A16 project-detail.component.config.ts — 状态：
- [ ] A17 common/operation-map-header/config.ts — 状态：
- [ ] A18 顶部筛选栏服务（HeaderOptionService） — 实际路径：            状态：
- [ ] A19 顶部筛选栏组件 — 实际路径：            状态：
- [ ] A20 区域树数据 — 来源（硬编码 / 接口）：            状态：
- [ ] A21 IOC_OPERATION_MAP_DATEINFO_CONFIG — 实际路径：            状态：
- [ ] A22 DataFilter / DataFilterType — 实际路径：            状态：
- [ ] A23 isNull / validate / isNotEmpty — 实际路径：            状态：
- [ ] A24 地图组件与底图资源 — 底图文件名：            状态：
- [ ] A25 路由定义 — 状态：
- [ ] A26 environment.ts — 状态：
- [ ] A27 代理配置 — 状态：
- [ ] A28 HTTP 拦截器 — 实际路径：            状态：

## B. 请求编译层

找到了吗：（是 / 否 / 部分）
所在包名与版本：
所在文件路径：
代码形态：（源码 / 打包压缩后 / .d.ts）

**B-核心问题：`where` 是不是原样作为一个字符串参数发出去的？**
答：

编译入口函数原文：
```
<在此粘贴>
```

发起请求那几行原文：
```
<在此粘贴>
```

请求体类型定义：
```
<在此粘贴>
```

响应处理那段：
```
<在此粘贴>
```

B5-1 排序怎么传：
B5-2 priority 是数字还是字符串 / 谁优先：
B5-3 分页参数名与 limit 上限：
B5-4 cnt 是聚合关键字还是真实列：
B5-5 resultType 的取值集合：
B5-6 响应体形状（嵌套是谁造的）：
B5-7 REST 类型数据源怎么发：

## C. 判断题

C1-1 ati_status 全集：                     依据：
C1-2 project_initiation_status 全集：      依据：
C1-3 opportunity_step 全集与中文名：       依据：
C1-4 三个"级别"字段的关系与取值：          依据：
C1-5 overdue_status_code 全集：            依据：
C1-6 public_cloud_na_level 全集：          依据：
C1-7 cloud_class_code 全集：               依据：
C1-8 行业两级树（含从属关系）：            依据：
C1-9 bg_type_code 取值与是否在用：         依据：
C1-* 候选项来源（硬编码 / 字典表 / 接口）：

C2 布尔字段取值形态：                      依据：
C2 附问 1（is_key_poffice vs is_key_rep_office）：
C2 附问 2（is_operating_* 是否存在）：
C2 附问 3（is_parent_company_name 是布尔还是名称）：

C3 金额单位（元 / 分）：                   依据：
C3 附问（cny/usd 与 currency 变量）：

C4 mtime 类型：                            依据：
C5 各日期字段格式（逐个）：
   create_time：
   update_time：
   order_date_estimated：
   latest_analysis_meeting_time：
   target_year：
   日期范围筛选拼 SQL 那段原文：
```
<在此粘贴>
```

C6 party_number 是否同一编码体系：         依据：
C7 geo_pc_code 在层级链的位置：
C7 REGION_LEVEL 五个取值的对应关系：
C7 地区部/代表处完整清单：                 来源：
C7 regionType / regionLevel / getRegionQueryStr 原文：
```
<在此粘贴>
```

C8 region_code 与 region_dept_code_fin 是否同一编码：  依据：
C9 错误响应形态（含错误码映射表）：
C10-1 凭据怎么带：
C10-2 凭据从哪来：
C10-3 请求里有没有用户标识：
C10-4 会话过期怎么处理：
C10 拦截器原文：
```
<在此粘贴>
```

## D. 业务题

D1 预签金额筛选：（预设档位 / 自由输入）
   档位清单与边界（若为档位）：
D2-1 底图用的是什么：
D2-2 地区部名→地图区域名映射原文：
D2-3 图例分档固定还是动态：
D2-4 symbolSizeVal 三个数的含义：
D2-5 色阶与图例是否一一对应：
D2-6 onlyChinaOversea 的行为：
D3 行级权限归属：（服务端过滤 / 调用方自带条件）
   区域筛选器初始值来源：
   不同角色的范围规则：
D4 is_lost_order 与 CSSC 是否等价：
D5 日期配置表由谁维护 / 更新频率 / 可选月份范围：
D6 四个牌的色值：金        银        红        黄
   四个牌的图形形态：（奖牌+罚牌 / 四个同形色块 / 其他）
   四档的来源：（复盘结果评级 / 独立奖惩流程）
D7 207:7882 是什么：
   原始图形：（已附件 / 未找到 / 用文字说明代替）
D8-1 华为标志矢量：（已附件 / 未找到 / 由门户方自带）
D8-2 文字标矢量：（已附件 / 未找到 / 由门户方自带）
D8-3 用户头像占位图：（已附件 / 未找到 / 由门户方自带）

## 其他

你在读代码过程中发现的、我们没问到但你觉得我们会踩坑的地方：
````

---

## F. 如果时间只够做一件事

**贴回 B 段那个请求编译模块，外加 `docs/init/datasource-config-guide.md`（A3）。**

理由：这两样合起来能回答"`where` 到底是不是一个 SQL 字符串"。这一问决定我们整套取数适配层的设计，是唯一一个**不确定就没法动工**的问题。C 段和 D 段的所有内容，即使暂时没有答案，我们也能先按推断往下做、后面再校正；唯独这一问不行。

如果还有余力，第二件事是 `docs/init/DB_SCHEMA.md`（A1）——它一份就能覆盖掉 C.1 到 C.5 的大部分判断题。
