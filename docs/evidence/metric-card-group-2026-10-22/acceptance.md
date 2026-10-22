# 指标卡白底无边框内容分区（2026-10-22）

用户确认：外层无边框、保留白底；小标题在上，筛选按钮在其下，统一左对齐；四张 Before 指标卡自适应占满可用宽度。原型已保存于本地分支 `codex/metric-card-group-prototype`，提交 `5d4067995080dcb8a212d7dc95566fddaa356d0d`。实际隔离检出及验证基线为 `df28881af115b02b15947579e124d63520079fac`，已包含同期正式交付的详情浮层；未纳入主工作区其他未提交修改。

## 实现与协议

复用既有 `section.container:card`、`section.title`、独立 `filterGroup` 与 `metricCard.layout.before`；没有新增字段、版本或任意嵌套能力。白底分区拥有容器外观，连接排布盒不重复绘制背景、圆角、内边距；plain 中的独立连接组保留白底与20px内距并移除外边框。小卡保留独立白底、1px灰边、12px圆角；文字双侧8px和窄屏回流不变。

正式场景 `pages/capabilities/layout/metric-card-equation.json` 直接被浏览器测试读取。区域按钮通过 `region-metrics` 的 `filterBindings` 同步更新四卡；第二组 inline 指标作为不受影响的对照。all/east/south 都是固定合成汇总行，all 不代表通用清除条件。DQE Sim 复用现有固定夹具执行器，未知谓词仍拒绝，不新增模拟查询回退。运行页面前启动 `pnpm sim:dqe`，原型链接重定向到正式页面。

## 对应关系

- 页面与浏览器：`/pages/metric-card-equation`，Classic/ESM 测试消费同一页面；布局目录与根 pages README 同步。
- 协议真源：PAGE-METADATA、sections-and-layout、metricCard、filterGroup；ADR-0111追加当前裁定并保留历史。
- local-authoring：真源导出器重新生成知识、完整参考及摘要锁；独立复制安装与页面校验由 local-authoring 测试覆盖。

## 验证

- `pnpm validate`：82/82页面通过。
- `pnpm test packages/engine/runtime-ui/tests/metric-connections.test.ts tests/local-authoring-skill.test.ts tests/page-reference.test.ts tools/dqe-sim/tests/chart-local-filter.test.ts`：4文件34项通过。
- 文档最终修订后再次运行 `pnpm test tests/local-authoring-skill.test.ts tests/page-reference.test.ts`：2文件28项通过。
- `MC_EMBED_EXAMPLE_PORT=4193 pnpm --filter @metriccanvas/embed exec playwright test metric-before.spec.ts`：4项通过；Classic/ESM的筛选联动、白底无边框、标题/筛选/四卡顺序与左对齐、等宽、1980/1024/800px拉伸、局部680px及部分列宽回流、plain独立外壳、390px纵向双侧8px与无横向溢出。
- engine/embed 类型与Svelte检查：0错误0警告；embed构建、Playground构建、`pnpm packages:check`通过。
- `pnpm authoring:contracts:check`：1064 product、4 authoring、1 interface投影一致。
- 5173实际页面：选华东显示720/408/216/96，恢复全部为1200/680/360/160；静态对照不变。外层computed背景白色、border=0，标题与筛选左边缘相同，筛选在标题下、卡片在筛选下，无页面横向溢出。见playground.json与两张截图。

复杂度口径 `metriccanvas-ts-ast/1`、TypeScript 5.9.3，Svelte提取script，模板布局/CSS另行浏览器验证。两处运行时模块函数最高CC均4→4；测试helper cards为2→2，新增筛选回调1；新增重定向load为1；新增浏览器/Sim测试函数最高3，既有测试最高6→6。无本批新增或修改函数超限，逐函数结果见complexity-before/after.json。

本地Sim及合成浏览器证据不证明真实DQE/Relay或DS模型接入。用户明确要求 `[skip ci]`，远端CI为跳过，不计作通过。最终提交及远端SHA在交付回复中核验。
