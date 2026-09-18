# 场景参考驱动创作：首期实施与验收

2026-09-17，按用户明确开工授权实施。首期为结构与呈现，自动分析结论不在本次范围。

## 用户复核后的验收补充

用户指出顶部指标过碎、缺少示例卡片层次，以及“结构分析”命名与表达重复。本文技术通过结果仍成立，但不能作为业务组织和视觉质量已达标的证明；旧模型提示预设了概览/趋势/结构分析，不能据此证明自主章节设计。最新修订方案见 [refinement/design.md](refinement/design.md)，本轮仅规划，尚未修复。

## 已交付

- 页面结构计划 v1：取数需求与章节分离；create_content_page 的 plan/operations 互斥，旧 compose_page 保持兼容。
- 经营报告、资源用量报告参考；7 种默认占位组合（含 custom），可裁剪、重排、重复，不限制固定章节数量。
- 同章跨口径、一源多组件、同次调用重复查询复用；可信字段解析、唯一行指标卡选择、完整数据占比检查、单轴量纲/刻度检查及可见口径。
- add_section、set_section、move_section、remove_section、add_source_component。删除章节须明确列出当前全部组件；页头受保护。结构编辑不取数，不覆盖未触及内容。
- 业务域有界枚举与快照分页；实际工具 Schema 暴露支持枚举。计划、数据行和完整产物保留原有程序/模型通道边界。
- ADR-0082 与领域术语；契约导出纳入组合注册表。顺带补齐已合入 5.x 兼容读取的参考枚举说明，按生成器更新快照，没有修改其兼容规则。

## 验证

| 层次 | 结果 |
|---|---|
| Python authoring 全量 | 446 项通过，其中新结构专项 15 项 |
| Bundle | 1483 个摘要检查通过 |
| 契约导出漂移 | 474 product / 4 authoring / 1 interface 文件检查通过 |
| 最终代码重放 | 新仓内适配器重放真实模型创建参数，产物与原 JSON 完全一致；这是非模型验证 |
| 产品 TypeScript 页面校验 | 最终流水 JSON 零错误，见 page-validation.json |
| 真实模型 | DeepSeek，3 次请求，4 次工具调用，73,656 tokens；首次创建即全部 applied，没有人工修补 JSON |
| 查询复用 | 3 个查询源、3 次执行，支撑 9 个数据组件 |
| 运行时 | 1440 / 768 视口均无 pageerror、无容器横向溢出；已查看截图，窄屏指标卡转单列 |
| 资源用量场景 | 公开工具回归已覆盖；未做独立真实模型专项评测 |

最终页面为页头 + 流水概览 + 结构分析。概览包含 6 张指标卡、趋势及说明；同章实际包含 2026-02 与全年两个时间口径。结构章包含趋势、明细与说明。实际与预测按独立序列标注，金额与百分比不共轴。

[真实页面 JSON](flow-analysis-report.json) · [专项摘要](evaluation-summary.json)。原始请求/响应、候选链、查询日志及浏览器截图在本地 `.scratch/flow-report-connected/scenario-guided-06/`，未将密钥写入证据。该目录被 Git 忽略；本目录保留可移植的页面、摘要和校验结果。

通用模型 runner 的 `status=inconclusive` 表示没有挂接此专项评分器，不能直接改写为全链路通过。本表是独立人工/程序专项验收。此前 01–05 轮证据也保留：工具 Schema 重复 required、ID 与产品正则不一致、保守预算提前中止等问题已明确暴露并修复；此前合法但偏表格的结果促成了场景参考补强。最终轮没有人工续写或修补。

## 复验入口

- `python -m unittest discover -s metriccanvas-authoring/test-harness/tests`（Python 3.12 环境及本地 HTTP 测试权限）。
- `python metriccanvas-authoring/scripts/check_bundle.py`。
- `node --import tsx tools/scripts/export-authoring-contracts.ts --check`。
- 真实模型：`python metriccanvas-authoring/test-harness/model-evals/run_scenario_flow.py --output <新证据目录>`。该命令显式调用模型，使用 apps/platform/.env 既有配置；最多 6 次请求、35 万 token 预算。仅发送 Skill、工具契约、既有合成样例指标/维度元数据，行数据不回模型。测试适配器是本地投影，不用于生产部署。

## 验收边界

没有验证生产身份、生产数据服务、刷新、保存或发布；未增加自动归因或数值结论生成。初始行的浏览器渲染不能替代刷新成功证据。场景参考引导业务组织，不保证每次模型输出完全相同，也不以与示例逐像素相同作为本期验收目标。
