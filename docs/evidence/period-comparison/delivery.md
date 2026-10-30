# 同比环比交付验证

日期：2026-10-30。交付基线为 `origin/main` 的 `9bad2e81dc32184009b052ffb19ec5802d5b041e`，包含已发布的按需分页关联能力。

## 范围与使用

本批交付自动期间比较、逐度量缺记录策略、百分点格式、失败重试与合成演示。Schema 6.77，local-authoring 1.14.0；main 的6.76分页协议保持原引入版本。生成文件来自合并后的产品真源，未手工拼接分发包。

使用说明：[配置步骤与分页边界](../../../pages/capabilities/data/period-comparison/README.md)；完整页面：[period-comparison-demo.json](../../../pages/capabilities/data/period-comparison/period-comparison-demo.json)。入口 `/pages/period-comparison-demo`；`pnpm dev:playground` 启动。

本次 periodComparison 保持完整读取后计算和本地分页；后端选页、按编号补齐三期再计算的扩展未实现。原有查询分页与 pagedJoin 按需分页功能保持可用。真实DQE、Relay和可信截止事实接入未验收。

## 合并后检查

- `pnpm check`：全工作区类型与Svelte检查通过，Svelte零错误、零警告。
- `pnpm validate`：145个页面通过。
- Page、Data Execution、Runtime、Runtime UI、数值格式与公共API回归：246文件、2104测试通过。
- 同比环比Chrome回放通过：四种期间、完整集合排序筛选、8条完整导出、Excel数值与格式、失败及重试。
- 最新main的按需分页关联Chrome回放：2项通过，包括10条一页、操作成员切换及记录模式不支持为空筛选时保留页面。
- local-authoring工具、行展开、独立安装、升级及参考手册：5文件、197项通过。
- `pnpm mc:content:check`：1317个产品、4个创作、1个接口派生文件一致；MC源覆盖、33项Python测试、诊断与可见夹具全部通过。

首次核心回归的5项失败来自版本升级时尚未生成的契约夹具，生成后2104项全过。首次作者回归的单项ENOENT来自与生成器同时读写，生成结束后顺序复测；不将其当作产品失败。分页浏览器第一次误用5183旧工作区服务导致页面不存在，改为交付工作树5197后两项通过。

## 复杂度

使用 `metriccanvas-ts-ast/1` / TypeScript5.9.3，对交付基线和合并后的31个手写变更文件逐函数测量；Svelte仅提取script，模板另经Svelte与浏览器验证。完整前后结果见 [complexity.json](complexity.json)。

`joinAggregate` 14→8；`formatValue` 30→9；筛选订阅回调22→14；新增函数均≤15。Playground合并时复用main的 `tablePreview`，新增比较场景后3→4，`scenarioEnvironment`保持15。

未关闭存量：`orchestrate/start`26→26，保留启动生命周期以避免扩大异步重构范围；其内部事实失效处理已独立提取。`start/refetch`17、`matchesParamDeclaration`19、`parsePage`31的函数逻辑未改。跟踪入口为 `docs/plan/2026-10-22-code-complexity.md`。

## 远端与清理

提交、远端包含关系和GitHub CI以本批实际push后的精确SHA检查为准；本记录中的本地结果不代表CI或部署通过。5197演示工作树当前仍供此会话预览使用，清理时保留该用途和忽略的本地验收产物。

后续安装消费端CI的宿主与夹具修正、local-authoring 1.14.1补丁及原失败记录见 [兼容性修正](compatibility-correction.md)。
