# 人民币/美元自适应金额格式（2026-11-05）

用户已确认：新增格式而不改旧格式；同时支持人民币 A/B 与美元；业务规则优先于旧系统实现偶然行为；人民币 A/B 都按原始绝对值选档，只在小额“元”后缀上不同；对绝对值四舍五入后恢复负号，舍入后的零无负号，不重新选档。

## 声明与范围

- Schema 字段净增减 **0**；现有 format/defaultFormat 枚举新增 **3** 项：`cny-adaptive-trimmed`（B）、`cny-adaptive-trimmed-no-yuan`（A）、`usd-adaptive-km`。
- 能力下限 6.88。交付基线为 `01d4ca6d2aeaaec8a919f93c8a2e2082f0ff7344`，保留 main 已交付的季度查询（6.86）与同比 P（6.87）；local-authoring 同版知识与独立校验器版本 1.27.0。
- 引擎集中拥有选档、对称舍入、去尾零、千分位和负零处理。默认格式、直接字段绑定、byFilter 非默认 case、图表常量共用金额格式与静态货币的校验规则。
- 金额字段仍使用元/美元基本单位。不会换汇；上游万元/K 预缩放数据须明确还原，不从字段名推断缩放。
- 旧 cny-adaptive/usd-adaptive、原始数据、计算、排序与 XLSX 基本单位数值保持。

最小完整绑定（main 槽关联的页面数据源分别声明 amount-cny 为 money/CNY、amount-usd 为 money/USD）：

```json
{
  "valueField": {
    "byFilter": {
      "filterId": "currency",
      "cases": {
        "RMB": {"data": "main", "field": "amount-cny", "format": "cny-adaptive-trimmed"},
        "USD": {"data": "main", "field": "amount-usd", "format": "usd-adaptive-km"}
      }
    }
  }
}
```

currency 为 required 单选封闭枚举；不会对未知币种猜默认值。人民币 A 格式显式选择 no-yuan 预设，与组件类型无隐式绑定。规则详见[格式语义](../../page-metadata/field-bindings-and-formats.md#金额去尾零与美元km688)。

## 场景与浏览器

[完整页面](../../../pages/capabilities/data/operation-money-formats.json)显式使用 dashboard 和首 section 首组件 iocHeader；内联合成数据。启动 Playground 后直接访问 `/pages/operation-money-formats`，币种选择同步驱动卡片、表格、图表标签/tooltip。操作和预期见[页面目录](../../../pages/capabilities/data/README.md#金额单位与舍入688)。

Chrome 自动验收命令：`node apps/playground/tests/operation-money-formats-browser.mjs /tmp/mc-money-browser`。实际入口 `http://127.0.0.1:5267/pages/operation-money-formats`。

- 人民币 A/B、美元分档、千分位、尾零、负数半值、负零、缺失及旧格式对照通过。
- 默认人民币显示 2.5亿，切美元后三个消费者显示 250M，再切回恢复。
- 两个币种均实际下载 XLSX，金额单元格为数值 250000000，标题分别带元/美元。
- 1440px 与 390px 操作通过；无 pageerror/console error，无 DQE HTTP 请求。原始 JSON、截图和导出文件保存在本地验收产物中。

## 复杂度

仓内 `metriccanvas-ts-ast/1`、TypeScript 5.9.3；逐函数 selfCC，闭包分别测量。全仓 Python 使用 Radon 6.0.1。未改变扫描器或豁免规则。

| 修改函数 | 修改前 | 修改后 |
|---|---:|---:|
| formatStandardNumber | 11 | 14 |
| moneyComputeErrors | 18 | 15 |
| resolveBinding | 11 | 8 |
| projectComponentFields/project | 30 | 13 |
| fieldSelectionErrors 内层回调 | 15 | 12 |

新增函数：moneyFormatCurrency 6、moneyFormatMatchesCurrency 2、fieldUnit 5、projectSelectedMetadata 13、cnyBand 6、usdBand 4、formatAdaptiveMoney 4；新增测试及浏览器回调均 ≤5。关闭 amount-validation 与 field-selection 两项相关存量债务，精确移除对应台账条目，未重建或放宽其他额度。相关修改函数与新增函数无 CC>15 未关闭项；仓库其他既存热点仍由原台账维护。

## 开发阶段验证记录（旧基线 6.85 / 新能力暂定 6.87）

- `pnpm exec vitest run packages/page/tests packages/engine/widgets/tests --maxWorkers=2`：147 文件 / 1,554 项通过。
- `pnpm --filter @metriccanvas/page check`、`pnpm --filter @metriccanvas/engine check`、`pnpm --filter @metriccanvas/embed check`、`pnpm --filter playground check`、`pnpm exec tsc --noEmit -p tests/tsconfig.json`：通过，Svelte 0 errors / 0 warnings。
- `pnpm --filter @metriccanvas/embed build` 与独立 `check:dist`：16 JS，最大 `chunks/excel~exceljs.min-CSE3Njtv.js` 为 929,901 字节；ES 入口 3,092 字节，global 入口 1,059 字节。完整复制目录 ES/global 以及 Webpack 5 development/production 的分发浏览器用例通过。
- Embed 完整浏览器运行：272 项通过，1 项表格像素用例因等待 `.scroll` 达 30 秒超时；保持原用例与超时不变单独复跑，1 项通过（3.3秒）。没有改表格样式或放宽断言；不将第一次整轮记为全绿。
- 实际 `npm pack --ignore-scripts` 归档核对：完整 16 个 JS，逐文件均 ≤1,000,000 字节。
- 使用实际 built dist 的 ES/global 两种公开入口挂载本页，新格式、币种切换与负数半值通过，机器结果保存在本地验收产物中。
- local-authoring 1.25.0 / Schema 6.87：完整归档与回执生成，通过包内独立回读校验；另将归档解压到仓外目录，仅使用 Node 检查本页（exit 0）、错误静态币种（exit 1）及 fields.format 新知识，机器结果保存在本地验收产物中。归档为本地未提交产物，无部署声明。
- `pnpm complexity:check`：通过；TS/JS 维护平均 2.2215757707574357、全扫描平均 2.559223776092153；Python 对应 4.216541353383459 与 4.273560689402274，均严格＜5。存量热点与生成副本仍单列。
- 本次涉及的升级演示同步当前写出版本，定向升级回归 121 项通过。
- 稳定产物的 `authoring:contracts:check` 通过（1482 product / 5 authoring / 1 interface），MC 来源覆盖检查通过；MC 内容回归 52 项全部通过。
- MC 诊断夹具在版本与来源摘要更新后重新生成；`python3 tools/scripts/mc-content-fixtures.py --check` 定向通过。此前组合命令末步发现旧 diagnostics.json 漂移，已按生成流程修复，未修改期望值或放宽检查；同批 52 项内容回归无代码变动，无需重复。
- 按用户提供的 AGENTS.md，Skill 默认验收仅覆盖 local-authoring。完整 `pnpm skills:check` 的 repair/发行入口检查 16 项通过；其额外历史 Bundle 导出隔离场景停止，不记作完整脚本通过。
- 定向执行 `vitest run tests/local-authoring-tools.test.ts tests/local-authoring-row-expansion.test.ts tests/local-authoring-skill.test.ts tests/local-authoring-upgrade.test.ts tests/page-reference.test.ts --maxWorkers=2`：5 文件 / 208 项全部通过，覆盖知识生成一致性、链接闭合、全部契约向量与仓外校验、旧页升级及用数工具。无真实模型专项验收。
- 以上为开发阶段证据，基线为 `09a7815c965bce921c2ef50202fa727ba9a8e705`，不作为最新 main 集成后的整轮复验结论。

## main 集成后的最小复验（6.88 / 1.27.0）

按用户“提交并 push main，仅测试最小化必要内容”交付；不重复开发阶段全量回归。

- 金额新旧格式、同比 P、货币选择、图表常量和版本注册：7 文件 / 197 项通过。
- `pnpm --filter @metriccanvas/page check` 与 `pnpm --filter @metriccanvas/embed build` 通过；分发门禁 3 项通过，16 JS，最大 929,901 字节。
- 金额页面 Chrome 定向验收通过：A/B 与 USD 边界、币种切换、图表 tooltip、两份 XLSX 原始数值和 390px 窄屏。
- 从合并后真源重新生成 contracts、MC 内容夹具与 local-authoring；`authoring:contracts:check`、MC 夹具一致性与本页独立校验均通过。
- 对合并后修改函数与全部新增辅助函数重测 selfCC；上述复杂度表保持有效，相关函数均 ≤15。
- 依用户最小测试要求，提交使用 `[skip ci]`，远端 CI 跳过，不记作通过。
- 原始截图、下载、开发阶段分发归档与复验日志留存于本地 `MetricCanvas-local-backups/operation-money-formats-20261105/`，不强行提交仓库忽略的二进制产物。

## 证据边界

本地源码、合成数据、Chrome、类型、分发与仓外独立 Skill 验证不等于真实 Operation Map、@cloud/ana 逐值等价、真实 DQE/Relay、DS 模型、远端 CI、安装或部署验收。这里实现的是用户确认的规范化规则，明确不同于旧系统位数判断与负数 Math.round 的偶然行为。

本次仅交付金额格式实现、协议与演示、定向验收和真源生成副本。主工作区并行修改保持原状；推送和清理结果以本次交付回复为准。
