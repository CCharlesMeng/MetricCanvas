# T18 / #144 验收证据

S2任务 `01a09f69-a06b-7703-b87b-ccdfe05d765e`；工作树 `/private/tmp/metriccanvas-126-s2`；分支 `codex/s2-execution-consumer-144`。

实现提交 `88246f0024f52017a64a6eb48f36a11d8f21c938`，源码树 `c3bbf514ddd6b63cd132007830d411bf2e74a947`，父共同基线 `155346f2eae7c5dc8d9e35c8613f69ffa15de22a`。已包含 #143、#134/#139、#135地名资产及 #140恢复逻辑；尚未包含 S3 #135文本/地图作者02b6026。最终集成两线后须由S2统一重生成锁，不能直接取旧锁覆盖。消费约定见 t18-execution-contract.md。

## 实测结果

- `pnpm check`：全仓通过，Svelte 0 errors/0 warnings。日志 `/private/tmp/s2-t18-final-check.log`。
- `pnpm test`：138文件，1038 passed、5既有 skipped，共1043。日志 `/private/tmp/s2-t18-final-tests.log`。
- `pnpm build`：协议/引擎/界面库/Embed与Platform构建通过。日志 `/private/tmp/s2-t18-final-build.log`。
- `node --import tsx tools/scripts/export-authoring-contracts.ts --check`：195 product / 4 authoring / 1 interface无漂移。`check_bundle.py`：497摘要校验通过。
- 使用已有完整依赖环境 `/private/tmp/metriccanvas-126-delivery-python/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_*.py'`：184通过，日志 `/private/tmp/s2-t18-python-final.log`。未修改Python作者，未以旧sdist证明新候选。
- 最终构建后串行 `pnpm --filter @metriccanvas/embed test:browser`：真实Chrome的46项全部通过，包含ESM/IIFE执行初始行、实际值优先、部分错误隔离、变更/清空和记录失败不回滚。日志 `/private/tmp/s2-t18-browser.log`。没有在本票重跑完整Svelte最低版本/Edge矩阵；#133的既有完整矩阵不当作rc.4新矩阵。
- `node apps/platform/tests/workbench/revision-preview-execution-browser.mjs`：真实Chrome验证精确read→execute、读取/执行两阶段切换取消、迟到隔离、错误target拒绝、卸载取消、无executor旧预览通过，无pageerror。虚拟Svelte夹具只有sourcemap缺源提示。日志 `/private/tmp/s2-t18-preview4.log`。
- `node --import tsx tools/package-build/check.ts`：四个真实tarball的公开入口、声明/运行时导出、相对引用闭包、无workspace路径泄漏及Svelte源码编译通过。page109文件/2入口；engine253文件/6入口/36组件；metric-canvas12文件/2入口/2组件；embed6文件/1入口。日志 `/private/tmp/s2-t18-pack-check.log`。
- `git diff --check`通过。四包候选同版 `1.0.0-rc.4`；页面协议未再升版，仍6.2。

## 反例与环境纠正

执行回归消费T04六样例及错误目标/操作键/条件/缺源/额外源/成功错误双载荷/总状态错配；支持空集、部分/全失败、两种字段映射、实际参数与筛选不一致拒绝。声明参数、queryField和当前源定义的匹配均走既有协议工具。取消之后不消费执行回执。改变查询定义仅重查该源；改变条件不套旧行；后续筛选/清空不被原始params覆盖。最后筛选测试独立操作键/递增序号、错键回执、乱序/身份切换/卸载/缺能力/同步异常隔离。

首次全量唯一失败来自 #135地名资产新增后，隔离导出测试遗漏 china/world 源复制；S0授权仅补两文件复制及父目录创建，最终全量已通过。首次新查询回归缺TypeScript联合类型收窄，补query分支断言后最终check通过。初次无executor浏览器夹具没有数据网关/内嵌行，出现原有DQE_CONFIG_ERROR；夹具补合法source.initial再验证旧行为，未改产品回退逻辑。系统Python3.14缺jsonschema等依赖的尝试无效，改用已准备的Python3.12完整环境后184通过。沙箱禁止本地监听/tsx IPC的尝试不计业务失败，所需浏览器/构建/本地HTTP测试提升权限运行。

## 产物与边界

四个tarball保存在 `/private/tmp/s2-t18-artifacts/`，同目录manifest.json记录源码树/字节数/摘要。仅本地候选，未push、发布registry、调用真实Java/Relay或代替服务实现。

- `/private/tmp/s2-t18-artifacts/embed-1.0.0-rc.4.tgz`：SHA256 `dc62de5ceaafc6bf427fde7d354a36e348b3e89338a2916b65ad91a6e05678fa`，1374929字节。
- `/private/tmp/s2-t18-artifacts/engine-1.0.0-rc.4.tgz`：SHA256 `7fdb1ee1eab807c973a1994ac1ef31b3467d26660ff38f8347924cc2c872d69a`，274709字节。
- `/private/tmp/s2-t18-artifacts/metric-canvas-1.0.0-rc.4.tgz`：SHA256 `449b4e6b77b458b63a0fc9f9012de6f0aa10e5a76407027bfbf16d233d4f422d`，8078字节。
- `/private/tmp/s2-t18-artifacts/page-1.0.0-rc.4.tgz`：SHA256 `2fcee835653592cbba3854e55c0b844257c2eed35fa1df433edf18dcc09feae9`，129373字节。

权限/参数提取和显式→历史→默认→允许回退仍是服务权威。本地固定回执只证明消费，conditionKey一致不能证明服务实际执行；历史记录的跨实例排序/权限复核也未真实联调。精确预览hook不证明外部任意修订读取已可用。#103/#104/#105/#106和M2完整手册不由本票关闭。

S0验收后归还S1临时文件RevisionPreview.svelte与新增浏览器脚本；预先获准但未创建的revision-preview-execution.test.ts不在实现清单。tests/authoring-export-isolation.test.ts是#135生成支援的集成兼容修正。#145继续等待#138及S0正式验收基线；S4尚未登记时由S0转交执行/预览契约。回退本票应成套撤销入口/运行时/候选版本及锁，保留#143参数能力和其它已验收作者增量。

## 精确28文件实现清单

- `apps/platform/src/lib/RevisionPreview.svelte`
- `apps/platform/tests/workbench/revision-preview-execution-browser.mjs`
- `contracts/metriccanvas/manifest.json`
- `docs/archive/authoring-tickets-126/t18-execution-contract.md`
- `metriccanvas-authoring/bundle.lock.json`
- `metriccanvas-authoring/contract-lock.json`
- `metriccanvas-authoring/contract-snapshot/manifest.json`
- `packages/embed/README.md`
- `packages/embed/package.json`
- `packages/embed/src/EmbedRoot.svelte`
- `packages/embed/src/index.ts`
- `packages/embed/src/types.ts`
- `packages/embed/tests/browser/execution.spec.ts`
- `packages/engine/package.json`
- `packages/engine/runtime-ui/src/RuntimeSurface.svelte`
- `packages/engine/runtime-ui/src/RuntimeView.svelte`
- `packages/engine/runtime-ui/src/types.ts`
- `packages/engine/runtime/src/execution.ts`
- `packages/engine/runtime/src/filter-history.ts`
- `packages/engine/runtime/src/index.ts`
- `packages/engine/runtime/src/orchestrator.ts`
- `packages/engine/runtime/tests/execution.test.ts`
- `packages/engine/runtime/tests/filter-history.test.ts`
- `packages/metric-canvas/package.json`
- `packages/page/package.json`
- `tests/authoring-export-isolation.test.ts`
- `tests/public-api/embed.txt`
- `tests/public-api/engine.txt`

## #135正式组合追加验证

在原实现/证据不改写的前提下，合入S0正式 #135 基线 `8ea095f744f13bd5af4574f09117685ebf09d1b8`；唯一冲突为bundle.lock.json的contract-lock摘要，使用统一导出器重建，不手改生成值。组合提交 `1ead7b760e9d25192cc991621fc12df9b5fb5e44`，树 `67c6338d6d751cc3631dc86e6f6097979e032cf5`。

该组合重新执行：check通过且Svelte 0错误/警告；全量138文件1038通过/5既有skip；Python197通过；导出195/4/1无漂移、502摘要通过。日志为 `/private/tmp/s2-t18-combined-check.log`、`s2-t18-combined-tests.log`、`s2-t18-combined-python.log`。相对88246f的packages/apps与隔离测试零差异，所以沿用该固定源码的构建、46Chrome、精确预览及四tarball证据，没有无关重跑。保留#135的新增编辑操作、文本/地图作者、地名资产、sdist包含规则；没有用rc.4旧锁覆盖新增内容。

S0要求将隔离测试修复独立前置解锁S1；S2另从8ea095f提交 `38316c196068164e7ab3830a34c655bb62f8e781`，S0验收进 `d593df25a0b79d1a17792fe7cbe341a489602415`。S2再合入此正式基线；相同修复只保留一次，该步仅新增S0协调记录，不改已验证代码/锁。S0可从此共同基线按最终组合差异集成#144；不要把合并提交第一父差异当成独立#144补丁。

## S0审阅补正：精确引用还须绑定文档内容

S0指出原RevisionPreview仅比较target，随后把execution.document同时当输入和bootstrap基准，可能接受相同引用下被替换的正文。修正先对可信已读document调用公开normalizePageDocument并固定副本，给执行器独立PageRevision副本；回执document同样规范化，完整canonicalizeJson内容必须相等。只允许既有layout兼容规范化，不允许组件/字段/查询替换。原始hash核验仍在可信读取端，不以此比较冒充提供方hash保证。

追加实现三文件：RevisionPreview.svelte、revision-preview-execution-browser.mjs、t18-execution-contract.md。`pnpm --filter platform check`通过，Svelte 0错误/警告，日志 `/private/tmp/s2-t18-preview-integrity-check.log`。真实Chrome脚本 `/private/tmp/s2-t18-preview-integrity.log`通过：同target/不同合法组件文档被拒绝且替换内容不渲染，仍显示原精确修订引用；正常6.0原文→6.1公开规范化且实际heading参数不同于default可呈现；两阶段取消/迟到、错target、卸载、无executor旧预览继续通过。

旧浏览器夹具曾用执行器改标题区分轮次，未验证正文一致；现改为原始param引用与appliedInputs取值区分。新反例第一次替换唯一参数消费位置，先触发完整页面校验拒绝，不能证明本缺口；改为替换另一组件标题、保留参数消费，使prepareExecution通过后明确由RevisionPreview完整性检查拒绝。未改产品校验或放宽断言。此补正未改packages/生成锁，沿用此前包与Embed证据；没有把旧全量1038结果写成补正后的全仓重跑。
