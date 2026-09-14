# T10 / #136 容器与动态总结验收

最终作者 `29d708f76af7b304ef3d4db840f289d68cf1a062`，基于正式 `3286efc91b0535e0ef839838b0985e338c3f5623`，保留 #135/#141/#144 与四包 rc.4 / Schema 6.2。S2 生成源 `5b0f95617ae98f954d72e395d58bc7fcce8a913b`，本树 `5bfbc84`，仅三份 Bundle 锁/manifest；195 product / 4 authoring / 1 interface 无漂移，**507 摘要校验通过**。

最终分支 `codex/s3-136-containers-summary-final`，工作树 `/private/tmp/metriccanvas-s3-136-final`。旧 d593df/rc.3 作者 `8b8c6ab` 仅为历史，旧生成 cc982d 未消费。

## 范围与行为

- `add_tab_container` 创建非空 Tab 子树，每项只接受 table 子 recipe；`add_composite_card` 只接受 metricCard/pieChart/gauge/keyValuePanel/categoryBreakdown。子组件复用现有构造器、受控数据源与行证据，不接受原始 JSON 子树、查询或 rows。
- 全局组件 ID、defaultTab、源/字段引用及子类型均整页校验，失败回滚。`remove_component` 删除容器完整子树或 aiSummary；不删除共享数据源，并拒绝破坏后继 connectPrevious 依赖。
- aiSummary 必须显式 generation=runtime_sse，具备非空 promptTemplate、relatedData 字段白名单及可信部署方提供的既有 AiSummaryConfig。模型不能提供端点；配置不写入页面或摘要，缺配置明确失败，普通 text 不因标题含 AI 而升级。
- 生产入口读取 `METRICCANVAS_CONTENT_AI_SUMMARY_CONFIG`；配置检查不向服务发请求。集成应用负责与渲染端配置保持一致，真实服务连通性和授权不由字符串格式检查冒充。

## 证据

- 全量 Python unittest **207/207 通过**；新增领域 8 项及公开 stdio 2 项，保留既有兼容工具、版本、布局、数据和 #134/#135 回归。
- 公开 stdio 构造本票完整子树与 #135 三类内容，再通过既有 #134 受控类型修改覆盖十类数据组件；收集结果与产品 component-catalog **17 类闭集完全相等**，所有输出经整页验证。不是仅检查目录数量。
- 公开生产 stdio 创建 report/dashboard 两份页面后由产品 validate-cli **2/2 通过**。
- 当前工作树 Embed 构建后，`test-harness/container_browser.mjs` 在真实 Chrome 验证两形态：组合卡真实指标 12 与地域占比、Tab 概览→明细切换且表格显示上海市 42、动态总结通过实际本地 HTTP/SSE 两段生成至“上海市金额为 42”。按捕获请求断言只发 region/amount 声明列；普通 text 不额外请求 SSE。公开工具删除整个容器/summary 后再次挂载，仅保留普通正文；零 pageerror。已查看报告截图。
- 最终 rc.4 组合再次运行 **207/207 全部 Python 测试**、产品 CLI 两份公开产物校验，以及当前 rc.4 Embed 构建和两形态完整 Chrome/SSE/删除流程，均通过。
- 由最终作者+生成物离线重建 sdist 并隔离安装，生产 content stdio 验证完整容器、可信配置下的动态总结定义、缺配置部分成功、删除、原文 hash 和模型摘要隔离通过；创作期未请求总结端点。
- `git diff --check` 通过。最终证据目录 `/private/tmp/s3-136-evidence/rc4`（final-python-tests.log、installed-stdio.log、pages、两形态截图）；旧目录证据只作历史。

## 边界

本地 SSE 服务是明确的外部协议测试边界，证明现有 runtime 消费及出站字段白名单，**不代表真实总结服务已连通或已按用户授权**。无假端点写进产品或默认配置；未配置生产入口不会创建 aiSummary。没有新增页面 Schema、组件渲染算法、保存/发布能力或助手侧边栏；#137 筛选/绑定/跳转尚未实施。
