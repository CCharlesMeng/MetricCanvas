# #145 / T19 发布 UI 与工具整票汇合回执（S1）

S1 task `01a09f69-8346-7e91-9c66-9e091d3f6e77`，工作树 `/private/tmp/metriccanvas-126-s1`，分支 `codex/authoring-126-s1-next`。共享契约开工基线 `b3261ae94888775efaeb4420b8a953507f57c78a`；UI 作者 `b277c3327fdb8b05a79a3a481b57bcde8d6772b8`。合入 S0 工具正式树 `cc1cec8b96979a4d0a505ea0c3d50cca63dafad7` 后，组合为 `a6d7bb8a376649e5368b4f7e809111ec791686c3`；最终 UI/测试修正代码 **`201b0857839a907ca3f8d2aa5c338ea856b189f0`**。本证据单独提交。

S4 最终工具/生成/安装来源为 `fc92c5cdfdd422a08f2009f54e493ced6560ecca`，S2 最终锁 `da1f29bac50a032301618af012a9afc973c9299d`；详细来源及包 hash 见 [t19-tool-evidence.md](t19-tool-evidence.md)。S1 没有修改共同契约、生成锁、页面协议、客户端或 RevisionPreview，UI **无生成提交**。

## 实现边界

- `authoring-publication.ts` 消费唯一 `metriccanvas-authoring/contracts/authored/publication-contract.ts` 的类型及结构、候选、修正、确认和结果关联验证。没有另造 Candidate DTO。
- 所有候选都先读取已鉴权、精确引用与原文完整性已验证的 source，再验证完整 Page 和参数声明/绑定；不仅 null 既有参数分支如此。完整评审面、原文 hash、算法身份、权限、服务时间、租约、证明真实性由显式可信端口核验，前端不签 proof 或实现提取算法。
- PublicationPort 明确声明 available；默认 false，准备操作是已知未发送错误，不会误置 unknown 锁死手工编辑。没有生产 HTTP 地址、SDK 映射或可强开外部能力的配置。
- 工作台的发布评审置于可滚动画布区域。展示精确来源/候选版本、差异及可用原值/候选值、作用数据源、参数选择/类型/必填/默认值或缺值、阻断/提示。参数修正调用服务，旧预览与确认资格失效；改页面内容回草稿保存后重新准备。
- 预览复用 #144 的 `loadExecution` 候选目标和完整执行校验，核对规范文档不被替换；RuntimeView 接入与既有预览一致的数据网关。修改预览输入清除预览资格。必填参数缺值时替身也拒绝执行，不能将未填值当默认。
- 用户预览当前候选、勾选核对来源及保留值后，才可点击“人工确认并发布”。独立 HumanConfirmationPort 在该动作下获取 token/confirmation；共享关联和可信证明验证均通过后提交。自然语言肯定、程序 token 和任意 proof 字符串不生成此证明。
- 写入结果未知只查完整原请求，不重建操作；unsafe not-applied 保持未知。取消释放本地异步请求所有权，忽略 abort 的旧请求不会阻止原操作查询，也不能在迟到收尾时覆盖新状态。取消、失效、已知拒绝及卸载按场景请求释放租约；未确认释放时不宣称服务已完成。
- 发布后模板引用保持不可变，后续草稿编辑不改变发布版本；源/身份变化使旧候选与预览失效。原操作与证明的持久化、跨刷新恢复由真实可信服务适配承担，本 UI 只验证本次挂载内的原操作查询；未将浏览器手工草稿队列冒称发布事务恢复。

## 两入口共同验收

| 验收行为 | UI 实际证据 | 工具实际证据 |
| --- | --- | --- |
| 准备、读取、修正、预览、确认 | 单元与浏览器：多值/单值候选、部分共享、取消 Segment、保留值改为 false、再次预览及确认 | S4 公开 MCP prepare→read→H1→revise→旧 H1 拒绝→H2→publish/replay |
| 维度范围受控 | 直接使用 S2 结构/关联验证；eq/in 两个基数方向负例，未知修正拒绝 | 相同69结构/48关联向量；unsupported extraction/targets/values拒绝 |
| 非维度参数保留 | 无 null 摘要时改/删/新增 heading 类参数，候选页面自身仍合法，UI source 关联校验拒绝 | S0 复核修正后，独立验真 source；合法且重签候选改/删/新增均拒绝 |
| 真实人工确认和失效 | 预览前、未勾选、修正后不能确认；proof 字段错配、身份在途变化、过期/租约/权限拒绝 | 工具不能制造人工事件；伪 proof/跨身份/旧候选/算法降级/审阅变化拒绝 |
| 完整预览和缺值 | 实际 RuntimeView 渲染 Regional sales 及三个查询源空结果；缺必填值先拒绝，显式填 APAC 后成功 | 发布不替代执行；候选 Page 与共同声明验证，真实执行沿 #144 |
| 未知、取消、重放 | 发布丢回执原请求查询，仅1次 human/1次 publish；unsafe not-applied不重发；取消后 ignored-abort不阻塞查询 | 三类 mutation 丢回执、spool失败、pending/unknown、幂等冲突、原成功重放 |
| 不可变模板/旧响应 | 草稿改变后原 TemplateRef 不变，候选与确认失效；迟到 prepare不重新打开评审 | 已完成结果在草稿前进/候选过期后不重发布，读取仍鉴权 |
| 默认不可用与生产门禁 | 实际工作台默认 CAPABILITY_UNAVAILABLE、零外部写，关闭面板后仍可手工编辑；生产 /publication无可执行替身 | 生产CLI固定九工具，五发布工具默认关闭；无测试服务分发 |

UI 的 Java/人工事件模拟在 `publication-fixture.ts`，由 dev 路由动态加载；其候选来自共同向量，修正和签名只是显式边界模拟，未进入生产算法。工具替身为 S4 `publish_stdio_server.py`，只在 test-harness。两套消费者都沿同一共享契约，未声称浏览器实际连接到生产 Java 或通过 Python 工具做生产发布。

## 实际运行记录

- 最终代码 201b085：`PUBLICATION_PYTHON=/private/tmp/metriccanvas-126-delivery-python/bin/python pnpm test` → **144 文件，1201 通过，5 既有跳过**，日志 `/private/tmp/s1-t19-201b085-test.log`。
- UI 专项 **29 项**；与共享 publication 72 项一起 **101 项通过**。全部共享69向量的结构/关联作者检查在共同测试内执行，UI另有真实控制器路径反例，不把单纯结构通过当可信发布。
- 在汇合树独立运行 `test_lifecycle_publish.py` **19 项**、`test_publish_stdio.py` **3 项**，含69结构/48关联 parity和公开 MCP/stdio。日志 `/private/tmp/s1-t19-tool-application.log`、`s1-t19-tool-combination.log`。未重跑 S4 的281全量/隔离安装，采用已验收固定证据并明确归属。
- tests tsc 通过，Svelte check **0错0警告**；最终201b085 Vite build通过，日志 `/private/tmp/s1-t19-201b085-build.log`。
- `authoring-publication-browser.mjs` 通过：独立评审与实际工作台嵌入、长预览滚动确认可达、参数修正/缺值/执行/确认、旧源/过期/租约/权限/伪证明、丢回执查询、默认不可用保留编辑。设置 `S1_PRODUCTION_URL` 的最终201b085浏览器运行确认生产说明页、无准备按钮、零fixture模块请求；退出码0，日志 `/private/tmp/s1-t19-final-browser.log`。
- 原 `authoring-browser.mjs` T01/T02/T13 通过；工作台新增发布控制未破坏原独立对话、挂载/卸载、已有手工编辑与精确预览边界。
- 截图 `/private/tmp/metriccanvas-s1-evidence/t19-review.png`、`t19-published.png` 已生成；已查看评审截图，确认真实预览内容而非配置错误占位。候选数据使用空查询结果，不声称真实 DQE 数据正确。
- 首次完整测试默认 Python 缺 jsonschema，改用已锁定依赖环境后完整通过；没有安装新依赖或跳过失败。首次截图发现缺数据网关，补齐实际渲染并收紧内容断言。旧 preview 进程在构建替换后引用已删除 manifest 文件，最终先停止旧进程、完成构建后重新启动验证，未将该失败当产品通过。

复现：在 `apps/platform` 启动 Vite dev `--host 127.0.0.1 --port 5181`；build完成后另开 preview 5187，根目录执行：

```sh
S1_PRODUCTION_URL=http://127.0.0.1:5187 node apps/platform/tests/workbench/authoring-publication-browser.mjs
PYTHONPATH=metriccanvas-authoring/tool /private/tmp/metriccanvas-126-delivery-python/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p '*publish*.py' -q
```

`S1_BASE_URL` 可覆盖开发地址；Python环境路径是本机已锁定依赖复用入口，不是分发要求。没有外部设计稿还原，本票按冻结功能字段实现界面并验证行为，未宣称 SDD 视觉对稿或多视口全量覆盖。

## 三类结论与交付限制

**本仓**：UI/工具同契约正反例、公开入口、整票组合与门禁证据齐备，交 S0 验收；M2/整批放行仍由 S0决定。**外部确认**：本轮无新增 Java/Relay 协议确认，服务端提取算法、原子事务/幂等、证明/租约及映射仍未由本仓替身证明。**真实联调**：未运行真实 Java/Relay/盘古/模型，不以本票关闭 M3 或真实模型评测欠项。

本票8文件均在登记窗口；没有修改 page-assets-client.ts、RevisionPreview.svelte、公共产品导出或原工作区。回退 S1两作者提交及证据可移除UI接缝，S4工具回退按其证据独立处理；没有生产数据迁移或真实模板写入。

GitHub证据回写仍等待此前自动审批拒绝后的明确批准；本轮没有尝试以其他任务代发或发布 #145评论。只交本地提交与此可审阅回执。

## 交验后增量更正：释放回调归属

此前201b085/9e6bac9回执保留历史；最终代码替换为 **`f5aafa2e3893f43e488b31b0af5df6673b61ad4c`**。S1交验后自查发现确认失败的await release后清候选、取消release失败提示，可能迟到覆盖新评审，已立即通知S0暂停原最终放行结论。确认失败先同步移除旧候选/预览再释放，清理及迟到错误提示均检查generation归属；取消提示也检查当前操作/候选状态。新增两个真实挂起释放反例：旧确认失败或取消→新准备完成→旧释放拒绝，新snapshot逐项保持不变。

最终UI专项 **31通过**，tests tsc通过、Svelte **0错0警告**、Vite build通过；新构建完整发布浏览器及生产门禁PASS，日志 `/private/tmp/s1-t19-release-browser.log`。全量最终 **144文件、1203通过、5既有跳过**，日志 `/private/tmp/s1-t19-release-full-unsandboxed.log`，退出0。第一次本轮全量在沙箱中因本地HTTP listen EPERM导致13项失败（日志 `/private/tmp/s1-t19-release-full.log`），没有改测试或跳过，取得本地监听权限后原命令完整重跑通过。Python工具/安装产物未改，沿用前述固定汇合验证。

本增量只修改已登记控制器与其测试；证据另提交。不重写历史；S0复核此增量后再给最终正式共同SHA。
