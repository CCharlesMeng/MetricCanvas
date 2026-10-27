# DSL-20261027-partner-health-increment：伙伴健康度增量合并与多槽取数边界

- 来源与日期：2026-10-27 用户要求理解两份粘贴输入的取数逻辑，与本地伙伴健康度对比并补齐缺失逻辑。
- 操作与场景：修改页面查询、字段绑定、多数据槽表格；地区部/代表处得分明细。
- 版本与环境：工作区 HEAD `ea40f6641`，页面修改前后均为 Schema 6.52；用户输入声明 6.58。工作区包含其他任务未提交改动；本批未改变产品 Schema、运行时或版本策略。独立 Skill 声明 6.52。真实业务 DQE/Relay 未接入。
- 预期与实际：输入有三个指标的两粒度共六个得分查询，本地没有；认证得分指标名也有差异。直接整页覆盖会恢复六条静态主行，并丢失本地已验证的主查询行集与标题字段修复。输入的中国区/海外得分 case 完全一致，并没有站点谓词。

## 最小结构与判别

修改前主表是 `data.main = voice-closure-score-region`、`data.pending = health-detail-region`、`props.rowKey = region`，pending 源 rows 为空。输入却以带示例行的 health-detail-region 为 main，同时将各得分放辅助槽。合并时保留原 main，新增四个辅助槽（认证及三个新增指标），修改对应列绑定。

相同模式的最小片段：`queryModes.filterId = china-overseas`，两个 case 均输出同一组织维度与同一得分指标，只绑定 stat-year 和 region，没有 data_site_type。按 case 名称不能判断实际过滤；合成浏览器切换海外后得分请求被复用，而两份明细查询仍有站点谓词。

复现对齐：主源返回甲/乙/null 三行且声音得分为 0；辅助源反序返回不同得分，其中服务能力缺乙。预期甲按键取正确得分，乙的服务能力为“—”，主源 null 行保留且不匹配辅助 null 行。地区部和代表处均已验证。

复现失败影响：令认证指标返回 `code: FAILURE`、空 data、total_count=0，其余得分成功。当前运行时使整表显示“暂无数据”，成功行也不呈现；页面没有显示 DQE_QUERY_REJECTED 文案。这是现有运行时行为，本批未改错误隔离策略。

## 修复、回灌与验证

- 页面：`pages/temporary/partner-health.json`；新增六源与输入完全一致，两个认证源与输入完全一致，其他源保持原值。原过滤初值、Schema、detailViews、空静态主行、无 initial 均保留。
- 报告：`pages/temporary/partner-health-data-analysis.md` 列出逐项差异、取数链路、示例边界与未关闭项。Playground 入口及操作写入同目录 README。
- Skill：作者维护的 `metriccanvas-authoring/skill/metriccanvas-local-authoring/references/data-analysis.md` 在“候选与写回”加入增量合并触发分支：比对定义/字段/消费位置，保留本地修复，复验多槽主行集及辅助失败影响，按实际请求判定 queryModes 的范围差异。没有新增协议规则或改动生成知识/校验器。
- 静态：独立 local-authoring 校验通过；产品 CLI 的单文件调用提示 ENOTDIR，改为独立临时目录后通过。六新增源、两认证源与输入逐对象比较通过，其余源和本地修复保持断言通过。
- Skill 验证：local-authoring-skill/local-authoring-tools 两组共 44 项通过；完整 Skill 仓外复制无软链接，工作流新增段落存在，副本校验页面通过。
- 浏览器：`/pages/partner-health`，1600px / 390px；合成响应通过两粒度对齐、缺行、零值、空键、详情标题、年度月聚合范围、海外相同得分请求复用，以及认证失败导致整表空状态的断言。合成结果没有写入页面。
- 证据：`../partner-health-logic-supplement/` 的 before、input-normalized、attempt-1、structural-verification、browser-verification 和截图。快照与真实查询证据分开保留。

## 状态与待办

通用增量合并检查已回灌；真实指标与业务口径待验证。需要业务 DQE 环境执行新指标，核对完整性、组织键一致性及年度聚合；确认中国区/海外差异；确认旧明细 level→组织名称字段的含义。认证新指标是否已配置未知，失败会影响整表。概览、图表和部分详情仍为原 inline 示例，未新增总分/数量增长等未知公式。
