# partner-health 并集与缺项 Mock 诊断

本页保留实施前的诊断结论。**当前已修复**，正式页面、本地验收与剩余边界以[实施验收](implementation/README.md)为准。历史 probe 现读取冻结的 baseline-page.json；现行回归执行 `pnpm test tests/partner-health-union.test.ts`，不再以旧断言 actual=1 作为现行结果。

日期：2026-10-29。当前源码基线见 `result.json`。本轮仅构造诊断数据、调用现有产品代码、提供候选结果快照和整改方案；没有实施新协议，没有修改正式 `pages/temporary/partner-health.json` 或其网关。

## 结果

| 场景 | 期望 | 现有行为 |
|---|---|---|
| 三组查询返回 1 / 10 / 13 行，组织并集 15 | 展示 15 行 | 区域、代表处两个表格均只展示主查询的 1 行 |
| 主查询返回 0 行，另两组并集 14 | 展示 14 行 | 展示 0 行 |
| 真实数值 0 | 显示 0，参与相加 | 正常 |
| 数值 null | 单项 `--`，求和按 0 | DQE 归一化后配合 `sumFields.onMissing: "zero"` 正常 |
| 数值字段返回空字符串/空白字符串 | 单项 `--`，求和按 0 | 归一化为 null，求和正常；单元格回退原文，显示空字符串/空格 |
| 数字字符串 `"0"` | 按数值 0 | DQE 归一化后正常 |
| 负数 -2 与另一项 5 | 总分 3 | 正常 |
| 已返回的行完全省略声明的得分属性 | 明确区分协议错误与业务空值 | `DQE_FIELD_MAPPING_ERROR`，当前表格整体进入 error |
| 正式表格总分列 | 按组织计算总分 | 绑定空的 `health-detail-*` / `pending`，当前显示 `—`，尚未接入总分计算 |

总分测试给每个数字场景添加另一项 5，因此 0/null/空字符串/空白/字符串0 均得 5，负数场景得 3。直接把原始字符串送入计算算子则不会得到相同结果，DQE 归一化是必要前置步骤。该诊断使用的合成响应不代表真实 DQE 服务验收。

## Mock 与候选

- `mock.json`：ORG-01 至 ORG-15；三组集合有交叉，行数分别为 1、10、13，其并集是 15。包含 0、null、空字符串、空白、数字字符串和负数。
- `probe.ts`：直接使用正式页面定义和实际 DQE 归一化、source program、表格对齐、joinAggregate、sumFields、组件状态计算代码。HTTP 响应在测试脚本内部替换，没有给正式页面注册模拟网关。
- `result.json` / `probe.log`：默认命令断言已知现状、数字处理和候选计算；成功不表示业务需求已实现。
- `expected-failure.log`：按用户期望断言当前页面应展示 15 行，实际 1 行，退出码 1，稳定复现能力缺口。
- `preview.json` / `browser.png`：独立 Mock 页与浏览器截图。浏览器看到基线 1 行、候选 15 行和“总条数：15”，console error 为 0。
- `complexity.json`：TypeScript 5.9.3，`metriccanvas-ts-ast/1`；新增诊断脚本全部 42 个函数（含回调）selfCC 最大 6，无超过 15；无产品函数修改，无存量函数前后变化。

候选先由测试脚本取组织键并集，再调用现有 `joinAggregate` 与 `sumFields`，得到 15 行及全部预期总分。**当前引擎没有因此获得并集行域能力。** 浏览器展示的是计算后序列化快照，单元格原文回退元数据不会随 JSON 保留；它不能证明现有空字符串呈现问题已修复。

可核对的例子：ORG-03 单项均缺失，候选总分 0；ORG-06 为 8 + (-2) = 6；ORG-07 为字符串0归一化后 + 2 = 2；仅第三组存在的 ORG-15 总分 10。

## 复现

在仓库根目录执行：

```sh
PROBE_BASE_SHA=$(git rev-parse HEAD) pnpm exec tsx docs/evidence/partner-health-union-null-20261029/probe.ts
# 上一条应成功；下一条应失败，报告 actual: 1 / expected: 15。
PROBE_BASE_SHA=$(git rev-parse HEAD) pnpm exec tsx docs/evidence/partner-health-union-null-20261029/probe.ts --expect-union
node tools/scripts/measure-ts-complexity.mjs docs/evidence/partner-health-union-null-20261029/probe.ts
node .agents/skills/metriccanvas-local-authoring/scripts/validate-page.mjs --expected-layout dashboard pages/temporary/partner-health-union-null-probe/partner-health-union-null-probe.json
pnpm dev:playground --host 127.0.0.1 --port 5173
```

页面：[http://localhost:5173/pages/partner-health-union-null-probe](http://localhost:5173/pages/partner-health-union-null-probe)。Mock 页面 JSON 位于 `pages/temporary/partner-health-union-null-probe/partner-health-union-null-probe.json`，已通过 local-authoring 独立校验。

## 根因位置

- `packages/engine/widgets/src/components/table/rows.ts`：`alignTableRows` 只用 main 的行集合，其他槽按 rowKey 左对齐；`alignedCellText` 优先使用原文回退，空字符串绕过 missingText。
- `packages/data-execution/src/compute/join-aggregate.ts`：对主行集合做左关联，不扩充主行集合。
- `packages/page/src/query-rows.ts`：数值空字符串转 null 并保留原文回退；省略声明属性是字段映射错误。
- `packages/engine/runtime-ui/src/widget-host-state.ts`：任一依赖槽 error 会使组件进入 error。
- `pages/temporary/partner-health.json`：两个表格 main 指向 voice-closure-score；总分列 pending 指向空 health-detail。

整改建议见 [实施方案](../../plan/2026-10-29-partner-health-union-and-missing-scores.md)。
