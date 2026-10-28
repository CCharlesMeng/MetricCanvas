# 主指标与多行次级指标验收

日期：2026-10-26。实施位于独立工作树 `metric-primary-details`。初始实现基线为`ea40f664`（协议6.53）；交付集成按最新main将新能力登记为6.65，远端与CI结论由交付回执记录。

## 声明和实现

- `metricCard.props.variant: "primaryDetail"`，`rows`恰好一个主指标，`secondaryRows`省略或声明一到多行。
- 每行次级指标上方8px、名称与值之间8px；名称14px/20px、黑色50%，值14px/17px、黑色80%且带下划线；PingFang SC、normal、400、字距0、左对齐。
- 同排卡片由既有Grid拉伸至最高自然内容高度，窄屏堆叠后各取自然高度；没有固定高度或行数截断。
- 复用字段格式、缺失值、命名数据槽、链接与动作。下划线本身不产生点击行为。
- 复用现有卡面变量，组合卡内由已有变量压平内层卡面。

对应关系：产品声明在 `packages/page/src/schema/components/metric-card.ts`，基数校验在 `packages/page/src/metric-card.ts`，呈现在 `packages/engine/widgets/src/components/metric-card/MetricCard.svelte`。文档在 `PAGE-METADATA.md` 和 `docs/page-metadata/components/metricCard.md`；生成产物包含产品契约、反例与独立local-authoring知识/校验器。

## Playground

入口：[主指标与多行次级指标](http://localhost:5178/pages/metric-card-primary-detail)。命令：`pnpm --filter playground exec vite dev --port 5178`。正式场景文件：`pages/capabilities/layout/metric-card-primary-detail.json`，显式Dashboard、仅内联合成数据。

- 第一排四卡为0/1/3/6行次级指标，最新main复验外框高度均为257.91015625 CSS px，顶边和底边一致。
- 浏览器计算样式核对字号、行高、颜色、字重、字体、8px上间距和下划线；最新集成详见 [browser-main.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/browser-main.json)，初始实现记录见[browser.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/browser.json)。浏览器将零字距的计算值序列化为normal。
- 实测390 CSS px视口，各卡逐张堆叠且高度随行数变化，无页面横向溢出；长名称换行、真实零和缺失值保留。
- 鼠标点击及键盘Enter均可通过显式link打开明细，表格显示已回款960万元；普通下划线数值仍为文本。
- [桌面截图](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/desktop.png)、[窄屏截图](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/mobile.png)。

## 初始实现检查结果（ea40f664基线）

- `pnpm test packages/page/tests tests/local-authoring-tools.test.ts tests/local-authoring-skill.test.ts tests/page-reference.test.ts packages/engine/widgets/tests/responsive-contract.test.ts`：85个文件、885项测试通过。
- `pnpm --filter @metriccanvas/page check`：通过。
- `pnpm --filter @metriccanvas/engine check`：通过，Svelte零错误、零警告。
- `pnpm exec tsc --noEmit -p tests/tsconfig.json`：通过。
- `pnpm validate pages/capabilities/layout`：9个页面通过。
- `pnpm authoring:contracts`及`pnpm authoring:contracts:check`：通过，1101项产品、4项创作、1项接口输出一致。
- 复制完整local-authoring到仓库外，以独立工作目录验证新页面和`metricCard.core`知识：通过，见 [standalone.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/standalone.json)。相关测试亦覆盖知识链接闭合与全部契约向量一致性。
- 页面与契约合法夹具逐字一致；`git diff --check`通过。

## 复杂度

口径：`metriccanvas-ts-ast/1`，TypeScript5.9.3，逐函数selfCC，排除嵌套函数体后另行计量。明细见 [complexity.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/complexity.json)。

| 函数或回调 | 修改前 | 修改后 |
| --- | --- | --- |
| metricCardShapeErrors | 新增 | 3 |
| componentErrors/checkMetricCard | 5 | 5 |
| componentErrors | 4 | 4 |
| 新能力usedAt / predicate | 新增 | 1 / 2 |
| 四个新契约反例mutate | 新增 | 均为1 |
| 新测试全部函数与回调 | 新增 | 最大2 |
| 版本测试回调（文件最大） | 3 | 3 |
| 响应式契约测试回调（文件最大） | 2 | 2 |

Svelte仅增加变体class与CSS，没有修改脚本函数或模板分支结构；响应式目录只增加枚举成员。本次新增/修改函数没有CC超过15的遗留；同文件其他未修改存量超限不属于本批范围。

本场景无查询变化，未运行真实DQE、Relay或DS模型；线上部署未执行。

## main集成交付复验（6.65）

- 保留main上的6.64饼图图例、6.63组合卡筛选工具栏及其他既有能力；本次仅增量登记6.65的`metric-primary-details`能力和`primaryDetail`呈现，不依据页面ID分支。
- 以冻结6.0输入通过已分发的upgrade-page.mjs重新生成升级示例，再保留原约定的两个标题修改；示例最终仅版本从6.64变为6.65。MC诊断页与报告也通过原生成命令同步。
- 修正饼图能力测试：引入下限保持64，不随当前最新版本增长；修正表面测试的CSS选择范围，精确检查通用.metric-panel声明，避免误选主次指标的后代覆盖。两项均保留原有行为断言。
- 广泛回归：`pnpm test --exclude tests/authoring-export-isolation.test.ts`，353文件、3124项通过、4项既有跳过。耗时的冷导出隔离文件由精确提交SHA的CI继续执行。
- `pnpm check`、`pnpm build`、`pnpm mc:content:check`通过。MC检查含1247项产品输出一致性、独立来源覆盖、30项Python测试和诊断夹具检查。
- Python使用已安装的3.12 Tool环境，通过METRICCANVAS_PYTHON指定注册探查；没有放宽依赖检查。
- 最新浏览器复验：0/1/3/6行同排等高，390 CSS px逐卡自然高度且无横向溢出；Enter打开原有明细并显示960。证据见[browser-main.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/browser-main.json)。
- 完整Skill仓外复制后，新页面校验与metricCard.core知识读取均通过，见[standalone-main.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/standalone-main.json)。
- 复杂度复验：`metriccanvas-ts-ast/1` / TypeScript5.9.3，新校验3；`checkMetricCard`5→5，`componentErrors`4→4；新能力回调1/2，新契约回调均1，新测试最大2。饼图及表面测试只修正断言/正则，函数决策数不增加。见[complexity-main.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/complexity-main.json)。本批无新增超限遗留。
