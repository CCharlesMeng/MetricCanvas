# 指标卡前置连接文字验收

本批按用户批准方案实现 layout.before。验收页面为 pages/metric-card-equation.json，使用 inline 合成数据；当前无需 DQE、Relay 或真实模型。Skill 验证只验收 local-authoring，默认范围已落盘到 AGENTS.md、维护文档、authoring:check 与 CI。

## 可观察结果

- 5173 原入口：`http://localhost:5173/pages/metric-card-equation`。预览服务运行在本批独立工作区，原混合主目录的并行代码保留。
- geometry.json 记录各档请求宽度、浏览器实际 CSS 宽度、卡片宽度和间距。桌面四卡同行且等宽；760px 及以下单列；所有测量值与 8px 的差不超过 0.5 CSS px，没有页面横向溢出。浏览器80%缩放导致个别请求宽度有1px取整差，回执保留实际值。
- boundaries.json 记录五种间距档位、占部分列的窄组合、6/3/3比例与长文字省略。五档分别符合声明，窄组合单列，比例约2:1:1，长文字有界。
- production.json 来自生产构建 global.js 与同一页面，双侧实测均为8px，四卡等宽。
- 搭建画布实测点击等号选择 product-card，正式运行视图没有连接文字按钮；查询调用计数保持0。

## 本地检查

- 产品相关125个测试文件、1135项通过；补充的搭建草稿连接测试2项通过。
- local-authoring验收3个文件、46项通过，包括知识、链接闭合、仓外复制及独立页面校验。未追加其他 Skill 或真实模型验收。
- pnpm check：通过，全部包类型检查与Svelte诊断无错误或警告。
- pnpm build：通过；pnpm packages:check：通过。
- pnpm authoring:contracts:check：800份产品、4份创作、1份接口投影一致。
- 首次全仓测试中两个旧断言尚未接纳新增版本/指标卡布局字段，已按Schema真源更新并通过定向复验；同轮导出隔离子进程一次30秒超时，独立local-authoring完整复验46项已通过。最终远端全仓结论以提交对应CI为准。

## 边界

before仅支持Dashboard顶层plain/card默认12列相邻指标卡；隐藏仅判断原相邻端点，不增加可见性系统。不支持的容器、跨度、间距、版本有产品契约向量和单元覆盖。移动/删除断边清理、字段编辑、保存重开和原文不变由workbench及搭建草稿测试覆盖。npm/ESM与更广泛浏览器回归由对应CI继续执行；本地生产浏览器记录仅证明global构建。

输入摘要见 inputs.json。CI链接与远端提交由本批交付回复提供。
