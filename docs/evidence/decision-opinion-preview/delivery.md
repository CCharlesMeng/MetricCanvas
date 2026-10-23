# main 提交前复验

日期：2026-10-23。独立交付 checkout：`/Users/moon/.codex/worktrees/decision-opinion-delivery/DataDashboard`，基线 `4e30dece1a4117d13ccbbb867b96e7d003908cdf`，分支 `codex/decision-opinion-details`。锁文件 SHA-256：`1a33c68c0755b6d9bf6d05bbf45438b9b5e2b9bc574a6f41908944dfe5fc2f4f`；本次不修改锁文件。

仅转入决策意见明细页面、专用分页模拟适配器及测试、列候选会话端口透传、筛选自适应样式、相关文档/设计夹具/证据与重新生成的契约和Skill产物。原工作区 `.gitignore`、`AGENTS.md`、其他计划/页面/评测/IOC原型改动保持原状。计划索引只转入本主题一行；保留最新main的6.52协议说明。

复验结果：

- 8文件77项定向测试通过：decision-opinion-preview、page-id-neutrality、page-directory、dashboard-frame、column-candidates、business-filter-execution、local-authoring-skill、page-reference。
- Playground、data-execution、engine检查通过；两个Svelte检查均0错误0警告。
- `pnpm build:playground`通过，未增加构建参数。
- `pnpm authoring:contracts`与`:check`通过，当前产品1098项；页面由生成的独立校验器校验通过。Skill测试包含仓外安装副本闭合与校验。
- 浏览器复验此checkout的5183服务：默认256条，首行为商务130、次行为合同120且占比63.0%；类型弹层160px无横向溢出；选择合同后128条，跳第7页显示末行128及缺失占比；清除后回第1页256条。该交付checkout记录DOM与布局读数；视觉截图沿用原5173同版表格的`compact-filter.jpg`。该临时服务验后停止，原5173预览保留。
- `metriccanvas-ts-ast/1`、TypeScript5.9.3对本批TS、路由提取脚本及全部新增测试回调重新实测，见`delivery-complexity.json`，所有扫描函数selfCC≤15；函数前后值沿用`result.md`对照，本次交付不改执行分支。筛选宽度的纯呈现改动不新增函数，无复杂度未关闭项。

本记录是提交前本地复验，不代表真实DQE/Relay/生产数据接入，也不替代推送后CI结论。
