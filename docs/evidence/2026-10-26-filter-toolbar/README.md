# 左侧按钮组与右侧双下拉

2026-10-26。用户澄清目标为“左边一个选择按钮组，右边两个右对齐的下拉框”。之前把两个下拉各放半幅栅格的示例没有满足这个目标。本批保留原按钮加单下拉示例，修正 `/pages/filter-group-parallel-selects`。

## 结果与声明

- 左侧为营业收入/订单量按钮组，右侧为区域、渠道两个下拉；两下拉各 160px、间距 12px，整体贴齐卡内容右边界。
- Schema 6.52 增加组合卡的显式 `props.filterLayout:"toolbar"`。统一运行时只提取开头连续的 filterGroup，按既有 align 分成左右两组；剩余组件仍沿用 12 列栅格。未声明时保持原有布局，不按页面 id 或控件文字猜测布局。
- 三个独立 filterGroup、筛选状态、URL、查询 filterBindings 与静态导出继续使用现有路径；分组辅助函数不创建业务状态或改变查询范围。
- 渠道使用独立的 `toolbar_parallel_*` 合成数据集，直营逐月取约 60%，合作伙伴取剩余部分，月度与总计闭合。原 `toolbar_*` 夹具与旧示例结果保持。

目录入口：`/catalog/data/conditions?scene=local-filter&example=filter-group-parallel-selects&layout=dashboard&feature=local-query-filter`。

## 浏览器验收

| 视口（CSS px） | 实际结果 |
| --- | --- |
| 宽屏及 1200 | 左组左边距 0、右组右边距 0；两个下拉各 160px、间距约 11.99px，与左侧按钮同排 |
| 600 | 右组整体移到下一行，两个下拉仍同排、间距约 11.99px，右边距 0 |
| 390 | 组内两个下拉换行，各保留 160px；右组右边界与工具栏右边界均约 330.02px，右边距 0 |

截图：[1200px](toolbar-1200.jpg)、[600px](toolbar-600.jpg)、[390px](toolbar-390.jpg)。原始测量见 [layout.json](layout.json)。

实际操作合计：默认营业收入/全部区域/全部渠道为 1,710；选华东为 951，渠道选直营为 571，保留华东与直营切订单量为 1,857。独立页面 `?metric=orders&region=east&channel=direct` 恢复全部三项选择，显示 1,857。重载本地 DQE Sim 使新增夹具生效；未调整 Platform 服务。

## 验证与复杂度

- 页面协议、版本边界、筛选状态、组合卡自动流、运行时工具栏分组及 Sim：7 文件、41 项通过，见 [regression.log](regression.log)。新页面及查询测试直接读取实际页面文件。
- local-authoring 独立知识、工具与参考：3 文件、50 项通过，见 [authoring-check.log](authoring-check.log)。没有追加其他 Skill 或真实模型验收。
- Engine、Page、Playground 类型检查通过；Engine 与 Playground 的 Svelte 检查零错误、零警告。
- 独立副本生成并与主工作区逐字节核对 534 个变化/新增的派生文件；其他任务已有源文件和派生内容保留。`pnpm authoring:contracts:check` 通过，见 [contracts-check.log](contracts-check.log)。
- 当前 local-authoring 校验器校验新页面通过；完整 Skill 复制到仓外后再次通过，未发现断链。完整页面已保存生成前快照。

复杂度使用 `metriccanvas-ts-ast/1`、TypeScript 5.9.3。新 `compositeFilterToolbar` 自身 CC 为 5；新增能力检测 usedAt 为 1、其谓词为 2；新增测试回调为 1、2、3，Sim 求和回调为 1。CompositeCard 和 ComponentRenderer 的既有脚本函数复杂度序列前后完全一致，版本测试只更新固定能力表与版本预期、函数复杂度不变。模板按实际 Svelte 处理链检查，未伪装为 TypeScript 函数。相关新函数均低于 15，无本批新增复杂度未关闭项；测量见 [complexity.json](complexity.json)。

## 边界

页面元数据总入口、组合卡与筛选模块、参考映射、合法契约夹具、local-authoring 知识和校验器同步。本批本地 UI、协议、合成查询与 Skill 验收通过；真实 DQE、Relay、生产接入、真实模型及 CI 未运行。没有重新运行包含历史入口兼容与版本再生成的完整分发隔离套件，上一批的两个超时结果仍保留在原记录中。本批未提交、未推送。
