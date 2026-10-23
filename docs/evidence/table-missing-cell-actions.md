# 表格缺省值点击边界验收

2026-10-23。入口：`/pages/table-missing-cell-actions`，页面位于
`pages/capabilities/table/table-missing-cell-actions.json`，使用内联合成数据，无需 DQE。

## 行为与实现

主字段使用缺省文案时不生成选择、导航或详情控件，不带可点击样式或键盘焦点。
格式化器与 Table 共用 `hasDisplayValue`，按原始值判断 null、undefined、NaN 与正负 Infinity；
自定义 missingText 同样生效。真实 0、false、空字符串及恰好等于缺省文案的文本仍是实际值。
次字段有值不会恢复主字段入口。保留既有动作资格、启用条件与 selection 优先级。
未新增页面字段或改变格式化文案。

## 回归

- `pnpm --filter playground exec playwright test table-missing-cell-actions.browser.ts --workers=1`：
  修复前缺省行仍包含 4 个点击控件，断言期望 0、实际 4；修复后 4 项通过，
  覆盖普通、forecastMatrix、embedded、reportCompact，鼠标点击缺省值无动作、无下划线，
  真实横线可键盘选择且导航 href 存在，真实 0 可键盘打开并关闭详情。
  实际浏览器截图经人工式视觉检查，缺省行呈现普通文本，真实值行保留下划线。
- `pnpm test packages/engine/widgets/tests/value-format.test.ts packages/engine/widgets/tests/table-presentation.test.ts packages/engine/widgets/tests/table-rows.test.ts`：89 项通过。
- `pnpm --filter @metriccanvas/engine check`、`pnpm --filter playground check`：均通过，Svelte 0 错误、0 警告。
- `pnpm exec tsc --noEmit -p tests/tsconfig.json`：通过。
- `pnpm validate pages/capabilities/table`：12 个页面通过。
- `pnpm authoring:contracts`：在当前 HEAD 的独立 worktree 生成，仅带入本次文档与页面，随后复制派生物回主工作区。
- `pnpm authoring:contracts:check`：独立 worktree 与主工作区均通过。
- `pnpm authoring:check`：4 个测试文件、73 项通过，覆盖知识路由、仓外安装链接与哈希闭合、独立校验器及导出隔离。
- 将完整 local-authoring 目录复制到仓外临时目录，使用其中的
  `node skill/scripts/validate-page.mjs --expected-layout dashboard table-missing-cell-actions.json`：
  新示例返回 `ok: true, errors: []`，不依赖仓库 node_modules。

页面声明和使用步骤见 `pages/capabilities/table/README.md`、主题入口见 `pages/README.md`。
协议说明同步 `PAGE-METADATA.md`、`docs/page-metadata/components/table.md`，
local-authoring 的表格知识、知识索引与版本哈希已由导出器更新。
派生器同时更新其管理的其他镜像，不手工维护第二份规则。

这些结果证明本地呈现与交互，不涉及真实 DQE、Relay 或模型验收。

## 复杂度

口径：`metriccanvas-ts-ast/1`，TypeScript 5.9.3，独立函数 selfCC。
使用 `node tools/scripts/measure-ts-complexity.mjs` 实测：

| 函数 | 修改前 | 修改后 |
| --- | ---: | ---: |
| formatValue | 32 | 30 |
| hasDisplayValue（新增） | — | 3 |
| 缺省判定测试的 describe / it 回调（新增） | — | 各 1 |
| Playground 浏览器测试回调（新增） | — | 3 |

Table 的实例 script 从 Svelte 源码中单独提取后按相同口径对比，全部函数数值保持不变；
模板四处点击条件增加 hasValue 守卫，未将模板交给 TypeScript 分析器冒充覆盖。
`formatValue` 的存量格式分派仍超过 15，本批仅抽出缺失值职责，复杂度下降；
为避免扩大小范围交互修复，不重构其余格式闭集。后续入口为
`docs/plan/2026-10-22-code-complexity.md`，该项保留未关闭状态。

## main 交付复验

原实施基线为 `3541d5d69d71c0fd81ab05307dbb35183bd3e7d2`。交付前 fetch 后 main 已前进，
在独立 worktree 基于 `ac64e8f6ccefc5ad64b0c70472b921f77c3c3548` 应用本次源文件和文档补丁，
重新运行 `pnpm authoring:contracts`，保留新基线的查询分支及 AI 总结知识。
表格和格式化器源码与前述复杂度测量输入逐字节一致。

交付基线复验：上述 89 项相关单测、4 项实际 Playground 浏览器回归、引擎 check、
12 个表格页面校验及 authoring:contracts:check 均通过；
`pnpm test tests/local-authoring-skill.test.ts tests/page-reference.test.ts` 28 项通过，
再次覆盖当前生成物的仓外安装、链接和哈希闭合、独立校验及文档参考。
用户明确要求 `[skip ci]`，远端 CI 按跳过处理，不宣称 CI 通过。
