# 父子表零总数展示兼容验收

交付基线：`279ab136afabd55d85f2721cc43eb848b0b500ff`。该基线已包含父表零总数显示修复，本批补充父、子查询同时返回非空行且 `total_count=0` 的场景与回归，不修改既有运行时或未知总数分页协议。

## 最终变化

- 合成子查询也返回 `total_count=0`，父查询保持原有两行、总数0；原始总数不改写。
- 集成回归覆盖实际 SourceProgram、层级控制器、独立展开查询，验证子行、告警和折叠释放；原有父表本地翻页、父级筛选、行键与完整导出边界继续通过。
- 新增可重复浏览器脚本 `apps/playground/tests/hierarchy-zero-total-browser.mjs`，直接读取 `/pages/query-zero-total-hierarchy`。验证父行、本地父表翻页、子行、展开/收起、地区选择及总数告警，无 pageerror。子表仍显示上游总数0，不推断下一页。
- 更新页面说明和 `docs/page-metadata/components/table.md`，生成本地创作 Skill 及 MC 同源知识；local-authoring 版本 `1.14.5 → 1.14.6`。

## 最新基线验证

| 检查 | 结果 |
|---|---|
| `pnpm test tests/hierarchy-zero-total-rendering.test.ts tests/zero-total-rendering.test.ts packages/engine/runtime/tests/row-expansion.test.ts packages/engine/runtime/tests/hierarchy-selection.test.ts packages/engine/runtime-ui/tests/hierarchy-export.test.ts` | 5文件45项通过 |
| `pnpm exec tsc --noEmit -p tests/tsconfig.json` | 通过 |
| local-authoring tools / row-expansion / skill / upgrade / page-reference 专项 | 5文件197项通过，含仓外独立目录检查 |
| `pnpm authoring:contracts:check` | 1317产品、4创作、1接口文件一致 |
| `pnpm validate` | 148/148 页面通过 |
| `pnpm mc:content:fixtures`、`python3 tools/scripts/mc-content-fixtures.py --check` | 派生诊断及页面夹具一致 |
| `PLAYGROUND_BASE_URL=http://127.0.0.1:5194 node apps/playground/tests/hierarchy-zero-total-browser.mjs` | 所有浏览器断言通过 |

Python 生成使用已安装的 Bundle 依赖环境，通过 `METRICCANVAS_PYTHON` 指定；未修改产品生成器。测试、截图和复杂度原始报告保留在本机同目录，默认不提交忽略的验收原始产物。

## 复杂度

测量工具 `metriccanvas-ts-ast/1`，TypeScript 5.9.3，逐函数 selfCC，嵌套回调单列。修改的合成响应函数 `replayResult` 为 6 → 6；新增子表测试及回调 selfCC均为1，新增浏览器回调最大2，全部 ≤15，无本批未关闭项。既有运行时显示函数没有新增差异。

## 证据边界与清理

本地合成 HTTP → DQE 适配器 → 查询执行 → 统一运行时及浏览器已验证；真实 DQE/Relay 和部署未运行。远端提交与精确 SHA 的 CI 结论由交付结果另行记录。

工作树仍服务 `http://127.0.0.1:5194/pages/query-zero-total-hierarchy`，保留供当前浏览器验收使用；未创建本任务 GitHub 分支。主工作区并行改动未纳入本批。
