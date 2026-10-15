# Dashboard 图表独立筛选验收

2026-10-15。以下为早期页面协议 6.26 过程记录；最终 Schema 6.29 与 main 交付输入、复验和边界见[交付验收](delivery/README.md)。

## 行为与范围

Dashboard 正文的柱状图、折线图、饼图和地图可以在左上角配置一个紧凑单选筛选。`props.filter` 引用独立维度筛选器并声明 `{label,value}` 候选项，页面筛选声明提供默认项，查询定义提供 filterBindings。不同图表可以筛选同一维度并选择不同值。没有配置的图表保留现有行为。

协议校验检查独立所有权、合法默认项、唯一候选值、普通查询绑定、跨源依赖及其他组件消费。共享源、其他筛选器级联和其他位置的筛选文字引用不能打破局部范围。Python 创作入口通过 Bundle Node Bridge 复用产品规则，独立本地创作 Skill 包含相同校验器。

## 场景、文档与分发对应

- 直接加载页面：`pages/chart-local-filter-page.json`，注册在试验场「验收样例」；同名协议夹具用于契约分发。五张图中四张有独立选择器，一张是全区域对照。
- 元数据：`PAGE-METADATA.md`、`docs/page-metadata/filters.md`、四类图表文档及 reference-map。
- 产品校验：`packages/page/src/chart-filter.ts`、`schema/chart-filter.ts`、版本门禁和 conformance 向量。
- 本地创作 Skill：从产品真源生成 references、独立 Node 校验器、知识清单及 Bundle 哈希；仓外完整复制目录校验同一页面成功。
- 数据：`tools/dqe-sim/fixtures/chart-local-filter.json` 是固定合成数据。演示入口 `http://127.0.0.1:4175/pages/chart-local-filter-page`；常规试验场使用 `pnpm dev:dqe`。

## 已执行的验证

- `pnpm exec vitest run packages/page/tests/chart-local-filter.test.ts packages/engine/runtime/tests/chart-filter-state.test.ts tools/dqe-sim/tests/chart-local-filter.test.ts`：最终20项通过，含版本、默认项、共享源、结果依赖、计算依赖、文字引用、非法写入与 Sim 请求。
- 筛选状态和 Dashboard 筛选分组既有定向回归通过；与本功能合并运行时41项通过，随后补充的计算依赖所有权反例也通过。
- `pnpm --filter @metriccanvas/embed build`：通过。
- `pnpm --filter @metriccanvas/embed exec playwright test tests/browser/chart-local-filter.spec.ts`：3项通过。1440与390像素宽度直接加载同一页面，检查各图初值、单图请求、候选查询缺席、其他图保持、空结果、URL恢复、静态导出和控件位置；另验证加载时继续切换、失败恢复、取消及迟到响应。已检查浏览器截图。
- `pnpm --filter @metriccanvas/page check`、`pnpm exec tsc --noEmit -p tests/tsconfig.json`、`pnpm exec tsc --noEmit -p tools/dqe-sim`：通过。
- 在隔离检出从工作区快照分别生成基线与功能产物，按增量同步派生文件；`pnpm authoring:contracts:check`、`python3 metriccanvas-authoring/scripts/check_bundle.py`：通过，2514项摘要检查。
- 文档/分发三组测试共31项通过；最终产物再次验证文档6项和仓外安装/链接闭合2项通过。
- 将完整 Skill 复制到 `/tmp/metriccanvas-chart-local-filter-install`，执行其 `scripts/validate-page.mjs` 校验新页面：`ok=true`。

## 工作区与证据边界

`pnpm validate pages` 中本页面通过；现有 `business-sdt-report.json` 的文件名与页面id不一致，导致全目录命令失败。

`pnpm --filter @metriccanvas/embed check` 的 Svelte 检查为0错误、0警告；后续测试 TypeScript 检查在既有 `tests/browser/paged-join.spec.ts:20` 因 `Record<string,number>` 与实际混合行类型不一致失败。本批未修改该测试。

系统 Python 缺少 authoring 依赖，不能将其导入失败视为产品结论；完整回归使用已有 `/tmp/metriccanvas-query-result-where-venv/bin/python`。在隔离检出构建 data-execution 后，完整 authoring 回归运行543项、跳过1项，0失败。确定性脚本流程不调用真实模型。

真实 DQE、Relay、DS 模型和部署未执行。本批无提交、push或CI结论；演示数据不代表业务数据。
