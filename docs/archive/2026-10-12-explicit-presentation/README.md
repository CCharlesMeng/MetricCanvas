# 显式数字颜色与图表标签批次结论

2026-10-12：完成6.16的数字颜色就地声明、全部类别标签、常驻数值标签和公共图例空间计算，迁移商务SDT页，同步TS/Python校验、正式协议、生成契约与bundle，并完成本地测试、实际浏览器和快照静态导出验收。[过程计划](plan.md)保留本批范围与实施清单。

现行结论在[ADR-0101](../../adr/0101-explicit-value-colors-and-chart-labels.md)和[字段绑定与格式协议](../../page-metadata/field-bindings-and-formats.md)，代码入口是`packages/page/src/schema/presentation.ts`及`packages/engine/widgets/src/shared/value-color.ts`、`chart-presentation.ts`。[实施与验收](../../evidence/2026-10-12-explicit-presentation/result.md)区分本地证明和外部未执行项：原query导出重查受本地DQE模拟器限制，真实服务、模型、生产PDF、CI与部署未执行。

用户最终选择直接red/green，放弃good/bad等业务语义命名和隐藏的引擎方向推断。类别及数值过密时也保留全量，不自动隐藏；代表处60分类在实际桌面采用90度旋转，窄屏密度仍待用户看结果后决定。旧规则保留，冲突声明校验拒绝，没有静默优先级。初期全局标签避让导致导出布局漂移，最终使用节点几何锚定与交替位置，并以重复resize回归锁定。
