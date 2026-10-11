# dev-baseline — report-date-filters

| 字段 | 值 |
| --- | --- |
| Story / repo | MetricCanvas / report-date-filters |
| 基线源 | 已批准文字规格：../2026-10-09-report-header-date-filters.md；C 原型作位置参考 |
| 冻结状态 | 已冻结；用户 2026-10-11 明确“审批通过，执行” |
| app baseline | apps/playground/frontend-baselines；统一运行时、六类筛选、纯展示组件、数据网关和布局 token |
| 起点 | 混合工作区，计划/原型为本会话变更；不使用整份 HEAD diff 推断本轮所有权 |
| 起点限制 | playground 的 preview-document.ts 有既存 JSON 断言类型错误；6.12 参考手册字段/分支覆盖尚未完成 |

## QA 基线

| F | AT | 冻结判据 |
| --- | --- | --- |
| F1-1 | AT-1 | 工具带位于页头封面上方；宽容器控件靠右、窄容器换行，标题保持完整 |
| F2-1 | AT-2 | 月/日单选或范围；非法/半成品保持旧已应用值及期间文本 |
| F3-1 | AT-3 | 只有确认提取后增加控件；已有日期身份复用，无值模板不带初始数据 |
| F4-1 | AT-4 | 导出包含全部正文、页签和匹配行；期间来自捕获值，日期输入和详情浮层缺席 |
| F5-1 | AT-5 | 公共 DOM 回调期间有效；60 秒仅含准备；10000 行超限拒绝；finally 清理 |
| F6-1 | AT-6 | 受控创作增删改、版本门禁、类型/构建和生成产物自洽 |

### 已知缺口

真实集成应用 PDF 编码、Relay/Java/DS 接缝不以本地合成数据验收代替。宽分区交由集成应用编码器按 A4 横向缩放/分页。

## 采用的依据

PATTERN-STRUCT-1（分层依赖单向；structure.md），PATTERN-COMP-2（构件不取数、不持交互状态），PATTERN-DATA-1（三态沿用统一宿主），PATTERN-DATA-2（服务端数据与界面状态分开持有），PATTERN-DATA-4（筛选值唯一写入口）。正文位于 apps/playground/frontend-baselines/components.md、data.md；本轮无需样式或命名额外豁免。REQ-DEC-1：用户 2026-10-11 批准 C 工具带、DOM 回调和固定限额，完整判据见本文件 QA 基线及批准计划。
