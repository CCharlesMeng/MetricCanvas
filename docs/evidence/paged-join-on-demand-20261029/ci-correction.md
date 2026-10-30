# 2026-10-30 CI 边界修正

首批提交 `9bad2e81dc32184009b052ffb19ec5802d5b041e` 已进入main。CI的构建、类型和创作分发通过，测试3680项通过、2项失败、5项跳过；两个失败是共享执行私有计划导出和正式页面id中立性。此处明确保留首轮失败，不能将它记为全绿。

执行计划必须留在取数包内部。原本由引擎直接调用compilePagedJoin的预检改为SourceProgram.prepareView，该方法只返回合法视图或抛出能力错误，不暴露内部计划。预检仍在提交前执行，失败保留已有页面。去掉runtime的compilePagedJoin导出及其接口快照。

预览数据的文件名与路由类型改为query-join-gateway / query-join，实际页面路由仍为/pages/paged-join-on-demand。IOC候选旧注释命中的demo文字改成明确的synthetic描述。正式页面id扫描规则保持不变。

修正过程中main已合入 `f0993f1146bb2d134ae9061fcf9449ea121444da` 的期间比较功能；先保存本次修改，再快进同步main，恢复本次修改，人工处理两个预览入口重叠。保留期间比较初始化和适配器，只将其新增的硬编码页面id改为已有适配器类型判断。当前主干Schema6.77、Skill1.14.0继续沿用；本功能的能力下限仍为6.76。

本地验证：架构边界、页面id中立性、公开接口、分页执行/会话与期间比较共8文件59项通过；pnpm check全仓通过，Svelte 0errors/0warnings；1317 product、4 authoring、1 interface派生文件一致，官方MC诊断夹具刷新后检查通过。

浏览器复核使用独立端口5192，同步main后的分页与候选8项通过；期间比较脚本的全局排序、数值筛选、全部期间模式、完整导出、失败与重试均通过。首轮误复用了主工作区的5183服务，相关失败已排除为错误checkout输入，未作为产品验收证据。

复杂度口径仍为metriccanvas-ts-ast/1、TypeScript5.9.3；基线为f0993f114。新增prepareView自身CC4，createSourceProgram10→10，orchestrate/start26→26，scenarioEnvironment15→15，tablePreview4→4，queryTableGateway4→4，previewDataGateway14→14，loadPage8→8。存量start26未增长，仍按本批原记录保留，未扩大生命周期重构范围。详见ci-correction-complexity.json。

真实DQE、Relay与模型未追加验证。最终提交和CI结论以main交付回复与对应GitHub记录为准。
