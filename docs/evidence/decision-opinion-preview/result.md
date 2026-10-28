# 决策意见明细 Playground 预览验收

日期：2026-10-23。入口：`http://localhost:5173/pages/decision-opinion-details`。启动 `pnpm dev:playground` 即可；已核对 5173 服务 cwd 为本仓的 apps/playground。

## 交付范围

- [页面](../../../pages/capabilities/table/decision-opinion-details.json)：Dashboard 筛选清单，复用页头、正式 Table、类型列表头筛选、序号及查询分页。
- [预览适配器](../../../apps/playground/fixtures/decision-opinion/preview.ts)：隔离的本地模拟输入，两个来源各 128 行，每批 16 行读取，归并出全局页；缓存最多 8 页，诊断请求最多 500 条。
- [使用步骤](../../../pages/capabilities/table/README.md#决策意见明细)、[协议说明](../../page-metadata/components/table.md)、[实施计划](../../plan/2026-10-23-paged-union-table.md)。协议说明已从真源生成至产品契约及 local-authoring。

本次没有新增通用 pagedUnion 或 props.defaultSort，产品表格外观保持既有组件；后续表头筛选修正补齐运行时候选会话对 fetchColumnCandidates 的透传，避免包装时丢失端口。首轮降序使用现有查询 order.by，初始列头不额外显示默认方向；真实 DQE 与通用协议建设仍未验收。模拟占比原始为 0—1，经适配器换为现有百分格式所需的 0—100，不根据计数重算。

## 实际浏览器

使用 Codex 浏览器访问实际 5173 页面并操作，非静态 HTML 截图。

| 操作 | 实际结果 |
| --- | --- |
| 初次打开 | 总数 256，每页 20；前两行商务 130 次、合同 120 次，后者占比 63.0% |
| 类型列表头勾选合同 | 总数 128，前三行均合同，次数为 120、100、100；候选回显合同已选且商务仍可选 |
| 类型列表头同时勾选合同和商务 | 总数 256，恢复混排 |
| 筛选合同后跳第 7 页 | 显示 8 行，序号 121—128 |
| 从筛选后末页清除表头筛选 | 回第一页、总数 256、首行商务 130 次；上方无类型按钮组 |
| 全部类型后点击第 13 页 | 显示 16 行，序号 241—256；末行合同记录次数为 0，占比为缺失标记 |
| 页码输入 13 并按 Enter | 同样显示 241—256，共 16 行 |
| 占比升序后切降序 | 排序回第一页；降序前三行 88.0%、87.5%、80.0%，包含两类来源 |
| 有效意见数升序 | 页码回第一页，首行有效意见数为 0 |
| sourceFailure=contract | 页面保留表头并显示暂无数据；控制台输出 DQE_TIMEOUT，没有商务半份结果 |
| 页面目录搜索决策意见明细 | 显示 capabilities/table 下唯一匹配卡片，点击后正常打开预览 |

默认页面截图：[desktop.jpg](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/decision-opinion-preview/desktop.jpg)；表头筛选截图：[header-filter.jpg](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/decision-opinion-preview/header-filter.jpg)。浏览结束保留无失败参数的页面并展开类型列表头筛选。

## 检查与证据

| 检查 | 结果 |
| --- | --- |
| local-authoring 独立校验，expected-layout dashboard | 通过；生成前原始字节见 attempt-1 |
| 仓外复制完整 Skill 后校验本页 | 通过，退出 0，无指向安装目录外的软链接；见 installed-validation.json |
| 页面、目录与框架行为回归 | 4 个文件、18 项通过，包括归并顺序、深页、两类计数、空占比、缓存隔离与淘汰、失败、取消及拒绝未知查询 |
| Playground 类型检查 | svelte-check 0 errors、0 warnings，测试 TS 检查通过 |
| Playground 生产构建 | 通过，静态站点生成成功 |
| authoring:contracts 与 authoring:contracts:check | 通过，产物与真源一致 |
| local-authoring、精确知识读取、参考与导出隔离回归 | 5 个文件、83 项通过；另一次最新页面定向回归包含缓存淘汰用例，共 18 项通过 |
| 表头筛选与运行时会话透传回归 | 3 个文件、42 项通过；覆盖已筛列候选不自限、候选搜索、多选与清空、两个来源取数和实际会话包装 |
| 表头修正后的 Skill 与参考回归 | 2 个文件、28 项通过；更新后的页面另经仓外安装副本校验通过，见 header-installed-validation.json；冻结字节见 attempt-2 |

命令：

```sh
node .agents/skills/metriccanvas-local-authoring/scripts/validate-page.mjs --expected-layout dashboard pages/capabilities/table/decision-opinion-details.json
pnpm test apps/playground/tests/decision-opinion-preview.test.ts apps/playground/tests/page-id-neutrality.test.ts apps/playground/tests/page-directory.test.ts apps/playground/tests/dashboard-frame.test.ts
pnpm --filter playground check
pnpm build:playground
pnpm authoring:contracts
pnpm authoring:contracts:check
pnpm test apps/playground/tests/decision-opinion-preview.test.ts tests/local-authoring-skill.test.ts tests/local-authoring-tools.test.ts tests/page-reference.test.ts tests/authoring-export-isolation.test.ts
```

## 复杂度

测量器 metriccanvas-ts-ast/1，TypeScript 5.9.3；Svelte 提取原有 script 内容为 TS 测量，模板未修改。所有新增闭包、回调和测试函数逐一计入；完整输出见 complexity-before.json、complexity-after.json。

| 函数或范围 | 修改前 selfCC | 修改后 selfCC |
| --- | --- | --- |
| 页面路由 loadPage | 8 | 9 |
| pageExternalInputs | 7 | 8 |
| 新增数据生成与比较函数 | 不适用 | 最大 6 |
| 新增分页模拟源及闭包 | 不适用 | 最大 4 |
| 新增归并函数及闭包 | 不适用 | 最大 5 |
| 新增适配器与查询解析 | 不适用 | 最大 7 |
| 新增测试及辅助函数 | 不适用 | 最大 3 |

表头筛选修正另以 header-filter-complexity-before.json、header-session-complexity-before.json 和 header-filter-complexity-after.json 记录：queryMembers 5→4，createCandidateGatewaySession 3→4，其内部原有 fetchFilterCandidates 保持 8；测试辅助 request 3→4；新增 fetchColumnCandidates 为 3，其新增回调最大 2。所有本批函数均不超过 15，无未关闭项。原有无关源码、未提交工作与生产服务保持独立。
