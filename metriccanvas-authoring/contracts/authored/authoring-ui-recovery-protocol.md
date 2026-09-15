# Workbench recovery / 1.0

S4工作台通过独立可选TrustedLanguageRecoveryPort消费可信恢复摘要，不能从localStorage/聊天重造完整command或旧LanguageContext.active。真实部署Adapter尚未提供，默认生产写保持关闭；现有无语言恢复消费者保持兼容。

Port接口由workbench/authoring-language-recovery.ts统一作者导出：loadPending({actorId,workspaceId,pageId},signal)->RecoverySummary|null；recover(recoveryRef,attemptId,signal)、cancel(recoveryRef,signal)、retryOriginal(recoveryRef,attemptId,signal)返回RecoverySummary；readVerified(recoveryRef,ref,signal)->SavedDraft，由程序鉴权精确回读并校验完整候选后提供。每个summary含formatVersion=1.0、recoveryRef、actorId/workspaceId/pageId、operationId、status(unknown|pending|not-applied|rejected|unchanged|saved-unverified|saved)、cancelRequested、ref(DraftRef|null)、previewState(not-requested|failed|ready)；缺/错scope、格式、operation/ref变更都拒绝，保留锁。未知回执与saved-unverified都不能解锁。查询/重试每次用程序新attemptId，模型不传载荷。

PageAuthoringWorkbench新增可选languageRecoveryPort和onLanguageRecoveryReady供部署/测试注入。配置该port时，onMount先建立本地恢复锁并loadPending，再准许普通coordinator.load/自动同步/语言start。null才释放并正常load；错误保持锁，可重新检查。已有pending时只用不透明recoveryRef查询原操作，不调language.run/prepare。当前身份或页切换、dispose后的迟到返回不接收。

恢复控制器createAuthoringLanguageRecovery暴露snapshot/subscribe/check(pageId)/recover()/cancel()/retryOriginal()/openSaved()/dispose()；可复用coordinator.beginLanguage(pageId)仅作本地输入锁（无内容调用），不重建原模型轮次。不在检查未知操作前加载本地队列或启动自动发写。重复check不得释放未决锁，pending时禁止换页；不丢弃原ref。

not-applied/rejected/unchanged必须来自可信原操作结果才可释放恢复锁并普通load；saved须保留锁，用户明确openSaved时调用readVerified，验证返回draft.ref与摘要精确ref/页一致、文档合法，再通过现有lease.accept和自动同步保护接受，保留现有手工队列冲突处理。saved-unverified仅允许继续恢复读取，不能声称已读回。cancel不暗示远端撤回，只有后续权威结果决定释放。页面提供简洁的恢复状态、查询/取消/原操作重试/打开已保存修订操作；不暴露内部程序标识。
