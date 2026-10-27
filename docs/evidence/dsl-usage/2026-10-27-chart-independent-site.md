# DSL-20261027-chart-independent-site：同维度图表独立切换

- 来源与日期：2026-10-27，用户提供“行权效率”页面，要求落盘并分析所有图表左上“中国区 / 海外”按钮；随后明确每张图独立切换。
- 操作与场景：修改 Dashboard，四张柱线混合图按站点独立筛选。
- 环境：主工作区 HEAD `ea40f6641`，有大量并行未提交修改；源码和 local-authoring 当前 6.52。用户页面及兼容验证器为 6.59；浏览器使用本地 `chart-constant-values` 工作树的 6.59 运行时，不改主工作区产品版本。
- 原始问题：一个 `apply-norm-site` 被四个查询共同绑定，只有一个 filterGroup；切换会共同影响四图。直接复制控件不能实现独立状态，且同一筛选器多次声明 filterGroup 被现行协议禁止。
- 版本问题：6.52 校验输入先报 `/schemaVersion`“文档格式版本 6.59 高于运行时当前次版本 6.52”，并对常量系列产生联合分支错误。不能据此断定原页面结构非法；未经改动的原输入由 6.59 校验器验证通过。
- 修复：把筛选声明拆为 `sdt-duration-site`、`sdt-count-site`、`biz-decision-site`、`contract-decision-site`，每个绑定一个原查询；各图前放一个 filterGroup。共享期间、区域及业务查询体、字段、基线系列、内联表保持原值。label 中国区仍写入 value 国内。
- 原样本：`../governance-compliance-20261027/original.json`；本地失败回执 `local-authoring-validation.json`、`product-validation.txt`，兼容回执 `compatible-validation.json`，浏览器请求 `browser.json`。
- 已验证：原输入和最终页面均通过 6.59 local-authoring 校验；真实浏览器对精确文件渲染，1440px/390px 共四组按钮、四张图；每次切海外只新增一条对应指标查询且带 `国内或海外 = 海外`；其他图的按钮选择不变；URL 刷新恢复；无 pageerror。响应来自 Playwright 合成桩，不证明真实 DQE 取数。
- Skill 回灌：作者维护的 `references/data-analysis.md`“候选与写回”补充独立切换的状态/查询对应关系、实际请求检查和校验器版本先验。没有新增协议字段、Schema 或产品分支，不需重新生成协议知识。仓外复制、链接闭合和合法 6.52 相邻场景验证见 `skill-verification.json`。
- 状态：已回灌；真实 DQE 和业务口径未验证。主工作区 6.52 不兼容输入的原有 6.59 常量系列，需在兼容运行时使用，未在此任务升级主工作区。
