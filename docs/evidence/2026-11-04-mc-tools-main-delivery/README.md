# mc-tools 主线交付验收

日期：2026-11-04。交付范围：本轮 mc-tools 复数路径、共享 references 校验、Node 路径解析、按操作读取概览、公开请求样例及 Relay 审核/接入文档。原主工作区的并行修改保持原状；在独立工作树交付。

## 与 main 集成

初始实现基线为 `2cd32ee85`，交付时 main 已包含 Schema6.84。三份生成清单存在文本冲突，均从合并后的产品作者源重新生成，没有手改哈希。旧0.3.1/0.3.2包和冻结消费者保留原字节。

0.3.3记录6.84消费基线：原35条请求逐字保留；13条完整结果变化经逐项审查，涉及当前版本/升级目标、Schema摘要及旧换源分析报告的过期拒绝。旧报告返回`ANALYSIS_BASELINE_STALE`，不重写它伪装成功。另加两条使用当前报告的换源成功/缺字段用例，共37条。

[6.83→6.84逐调用审查](../../../tools/relay-reference/fixtures/schema684-plural-consumer-review-v1.json)、[新冻结消费者](../../../tools/relay-reference/fixtures/consumer-0.3.3-schema684.json)、[原0.3.0消费者](../../../tools/relay-reference/fixtures/consumer-0.3.0-tools-plural.json)同时保留。正式门禁继续核对原0.1.0的23条历史差异，不绕过真实current迁移。

首次在新main基线使用项目pnpm入口时，系统Python缺少锁定依赖，发行测试未完成；已将PATH和METRICCANVAS_PYTHON同时设为项目锁定venv后重跑。新基线93项发行回归通过，后续13项adoption检查通过。两个核心Skill检查中一个现有5秒参考一致性用例在并发运行时超时，该文件原命令单独重跑8项通过，未放宽时限。完整检查及远端CI分别报告，不能用局部复跑冒充整轮成功。

当前6.84基线正式37条冻结消费及23条历史差异已通过实际打包门禁。交付时随后到达的embed主线更新只改变分发材料；按不可变批次规则继续以新patch发行，不覆盖上述冻结基线。

## 复杂度与边界

Radon6.0.1覆盖全部21个Python变更源文件，包含方法及闭包：298→328个函数，最高CC均为12，本批无超过15项。前后实测见[基线](complexity-base.json)/[合并后](complexity-after.json)。仓库新增全项目平均复杂度门禁已通过；存量热点按其固定基线核对。新增adoption检查只审查版本、原请求保留和过期报告拒绝，不修改产品业务分支。

TypeScript导出器仍只有路径替换，AST测量selfCC4→4。产品页面协议新增属于既有main的6.84，本轮未另增字段或改变页面引擎。旧compile/inspect的等价公开能力仍未提供，见[交接映射](../../plan/2026-11-02-product-relay-evolution/relay-adapter-mapping-20261104.md)。真实Relay模型装载、DQE、Java保存、取消/迟到及unknown恢复仍须现场验收。
