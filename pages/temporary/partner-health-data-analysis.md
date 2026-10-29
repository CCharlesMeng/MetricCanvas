# 2026-10-29 当前版本：同步main并关闭.length异常

本地主分支从9ee7e6ac6快进至5c084bffb，产品协议与生成知识对齐6.73。恢复用户本轮partner-health修订，除schemaVersion从6.70迁移为6.73外，24个查询定义、字段、筛选、组件和13个空inline源均与同步前逐对象相同。没有将远端旧业务页的计算修订覆盖回用户页面。

在同步后的main上复现原始报错：生产入口仍接入partner-preview，模拟器对object查询读取不存在的output_metrics.length，在HTTP前抛TypeError，被网关包装成DQE_TRANSPORT_ERROR。移除两处生产接管和模拟登记，删除应用目录中的旧模拟器，合成夹具只保留在测试目录。原有层级、零总数及分页合并等其他演示接线保留。

修复前3项回归失败，浏览器复现同一.length报错；修复后106项相关测试通过，覆盖28个查询分支、完整页面默认条件、空结果和传输失败。完整页面实际HTTP探针发出5次execute，记录11次生效查询，服务返回DQE_QUERY_REJECTED / DQE_SIM_UNSUPPORTED_QUERY，未再发生.length异常。浏览器默认页和代表处切换复核通过。真实业务DQE及凭据尚待对应环境验证。

135个页面全部通过产品校验，页面试验场类型检查和生产构建通过。完整记录、原始失败日志、截图和复杂度报告见[本轮验收](../../docs/evidence/partner-health-real-dqe-20261029/README.md)。原始本地文件、补丁和冲突决策保留于 `/Users/moon/.codex/backups/metriccanvas-main-sync-20261029-4fr90u6x/`，Git恢复快照1620dcaf2a42d07abe95bc46241361151729cbd8保留；此段为提交前记录；本次范围交付与skip ci边界见本轮验收记录。

---

# 历史修订（2026-10-29）：移除页面专属模拟网关

独立页面与场景预览均恢复共享DQE网关，删除partner-health专属网关分支、模拟输入登记及模拟提示。合成夹具移至 `tests/fixtures/partner-health/`，仅自动化测试使用。页面的24个query源、字段映射、筛选与详情配置未变；所有inline行仍为空。

回归命令：`pnpm exec vitest run apps/playground/tests/partner-health-dqe.test.ts apps/playground/tests/runtime-config.test.ts tests/partner-health-preview.test.ts tests/partner-health-object-preview.test.ts tests/partner-health-scores.test.ts`，36项通过。新测试在修复前复现指标/对象查询HTTP调用均为0；修复后按页面声明向execute端点POST，覆盖空结果和传输失败不回填演示数据。页面试验场类型检查通过。

浏览器入口 `http://localhost:5193/pages/partner-health` 已移除模拟提示，不再显示预设地区行；收到服务返回 `DQE_QUERY_REJECTED / DQE_SIM_UNSUPPORTED_QUERY`。本机默认开发代理仍连接本地DQE Sim，故这只证明页面已恢复HTTP查询，真实业务服务的成功返回及鉴权仍待对应环境验收。真实端点与凭据由既有运行配置供给，Windows gray开发代理配置不受本次修改影响。未修改页面协议或本地创作Skill的声明规则。

复杂度口径为 `metriccanvas-ts-ast/1`、TypeScript 5.9.3，Svelte仅提取script测量；`pageExternalInputs` 12→11，`scenarioEnvironment` 9→8，`loadPage` 13→13。新增回归文件的7个函数/回调均为1；迁移夹具的全部函数最大9，调整的预览测试最大3，无本次超限项。测量报告位于 `/tmp/partner-health-real-dqe-20261029/complexity-{before,after}.json`。

---

# 历史修订（2026-10-29）：清空全部inline数据

按用户要求清空13个inline源的所有数据行，共删除18行静态示例；保留字段、组件、筛选和详情引用。概览、对比图及未接数明细显示空态，24个query源完整保留。页面试验场仍使用专属模拟网关，因此查询区域的演示数据不代表真实业务结果。本地创作升级将schemaVersion从6.58迁移至6.70，未改变查询与交互配置。完整页面通过local-authoring独立校验器；本次只修改页面文档与说明，没有修改可执行函数或分支。

浏览器验收入口为 `http://localhost:5193/pages/partner-health`：五个概览分数均显示“—”，对比图没有数据点；点击华东地区部的CSP价值客户付费占比明细，弹层显示“暂无数据”、总条数0。查询主表仍显示4个地区部的模拟结果。升级原件与报告保留于 `/tmp/partner-health-inline-removal-20261029/migration/`。

---

# 历史修订（2026-10-28）：按最新两段附件全文替换

当前页面为用户最新提供的Schema6.58文档，前后两段直接拼接即可解析。两表以声音得分查询为main，其他得分按region对齐；总分仍绑定空pending槽，顶部与图表仍为inline示例，没有补写未经确认的汇总计算或查询映射。以下“两层得分相加”及更早章节均为被替换修订的历史记录。

本地页面试验场专用模拟网关原先只处理指标查询，遇到本次object查询读取output_metrics.length时报TypeError；任一辅助槽失败按现有整表策略清空成功槽，因此出现“主查询成功但整表暂无数据”。本次修复该模拟适配器并补代表处维度别名，浏览器验证地区部4行、代表处8行。没有修改全局错误策略、业务DQE或页面字段映射。columns:null不参与当前网关字段映射，新增回归证明其正常消费；data缺失声明的queryField仍明确失败。真实客户评价响应尚待提供，不能把本地模拟故障当成真实环境根因。完整记录见[附件替换与预览修复](../../docs/evidence/partner-health-pasted-repair-20261028/README.md)。

---

# 历史修订：两层得分相加

已按本轮附件覆盖页面并接入两层横向加法。后端提供整体/地区部/代表处粒度的已加权子项；前端先生成四类得分，再生成总分。风险按负数，缺项按0，顶部不再读取旧inline示例分数。中国区/海外只作用顶部，日期/区域共享，上下页签独立。页面Schema6.70，所需sumFields归零策略已同步运行时与local-authoring。

当前查询将11项合为同粒度多指标请求，业务服务可执行性、整体口径和组织/站点筛选映射尚未取得真实DQE证据。其他明细的inline示例未变。验收与复杂度见[本轮记录](../../docs/evidence/partner-health-scores-20261028/acceptance.md)。下面内容为历史版本记录，其中“顶部仍为inline”“无前端总分计算”等已被本轮替换，不作为当前状态。

---

# 伙伴健康度：输入增量对比与取数逻辑

## 2026-10-27 本次结果

目标文件为 `partner-health.json`。两份用户附件是同一页面的前后片段；去掉拼接处的重复逗号后可以解析。输入声明 Schema 6.58，本地声明 6.52；本批全部用到现有能力，保留本地版本和 Dashboard 布局，没有修改产品协议或运行时。

已按用户输入补入三类指标、两个粒度共六个查询，并更新两个认证得分查询的指标名；两张主表现在分别消费声音得分、认证得分及三类新增得分。输入中的六条主表静态示例行未合入，保留本地由声音得分查询决定行集的修复，默认期间仍为 2026-10，页面不含 source.initial。

## 输入与本地差异

| 项目 | 修改前本地 | 本次补充 |
|---|---|---|
| 价值云经销商付费占比得分 | 未声明真实查询，列读空 pending 槽 | `cloud-dealer-payment-score-region/representative`，字段 `cloud-dealer-payment-rate`，绑定两表对应列 |
| 能力标签伙伴得分 | 未声明真实查询，列读空 pending 槽 | `service-capability-score-region/representative`，字段 `service-capability-rate`，绑定两表对应列 |
| CSP价值客户付费占比得分 | 未声明真实查询，列读空 pending 槽 | `csp-customer-payment-score-region/representative`，字段 `csp-customer-payment-rate`，绑定两表对应列 |
| 专职团队认证达标率得分 | 查询名为“区域专职团队认证达标率得分”，未绑定主表 | 按输入改为“伙伴健康度-区域专职团队认证达标率得分”，同步 output_metrics、queryField、label，绑定两表认证列 |
| 声音得分、声音明细、服务能力明细 | 已有查询 | 保留，不重复增加 |
| 概览、对比图和其他详情 | 与输入相同的 inline 数据 | 保留，仍属于示例，不能视为本次真实出数 |
| 主行集、默认期间、详情标题 | 主查询行集、2026-10、titleField=region | 保留本地修复，未恢复输入中的静态主行集和 detail-title 引用 |

## 取数和呈现链路

1. 得分查询使用 `resultScope: complete`、`period: month`、`is_aggregate: true`。地区部查询输出 `地区部`，代表处查询输出 `rep_office_name_cn_fin`，均映射成页面字段 `region`。得分直接使用 DQE 返回值，没有前端权重运算；表头 5%/10% 等只是说明，未新增总分或分子分母计算。
2. 声音指标为“伙伴声音闭环率得分”；其余四类得分分别为“伙伴健康度-区域专职团队认证达标率得分”“伙伴健康度-区域价值云经销商付费占比得分”“伙伴健康度-区域能力标签伙伴得分”“伙伴健康度-区域价值客户付费占比得分”。字段 id 中的 rate 不代表实际返回百分比，本页按得分 `number-1` 呈现，沿用输入语义。
3. 时间由 `stat-year` 绑定；区域由 `region` 下推到 `geo_pc_name_cn`。本地默认发送 start=end=2026-10；选择年后仍发送 month 聚合查询，范围为 2026-01 至 2026-12。年度得分聚合口径由上游指标决定，前端没有将月得分相加。
4. `voice-closure-score-region` / `voice-closure-score-representative` 是两张表的 main，决定行集合和顺序；四个辅助得分槽按 `rowKey: region` 左对齐。不按行号拼接，辅助源独有的地区不会增加主表行；主源的空键行保留，但不会匹配辅助槽空键。缺失得分显示“—”，零分显示 0.0。
5. 声音明细沿用三个组织维度和 `metrics_cnt_number` / `metrics_cnt_number_close`；服务能力明细沿用伙伴公司、账号、计划、ID 和一级标签维度。它们原先已经存在，本次没有新增可验证的实际响应，也没有新增下钻过滤或改写旧口径。
6. 详情入口和全部 detailViews 保留本地配置；新增得分列沿用原入口，标题继续读取主行的 region。CSP及云经销商详情仍为 inline 示例，不能用这些示例核对真实得分。

## 未关闭的口径与运行边界

- 输入中的中国区/海外 queryModes 两个 case 完全一致，得分查询都没有 `data_site_type` 谓词。本地地区部声音查询也保持原有普通查询。浏览器合成验收确认切换海外后得分请求可直接复用缓存，所以不能声称已区分中国区和海外范围。需要业务方提供真实站点条件或不同查询定义后再补。
- 用户输入提供了明确指标名与维度映射，但没有新增指标的真实请求/响应。本次按用户要求写回这些声明，真实执行仍为 not-run。此前认证指标未配置而移出主表；本次按新输入重新绑定了更名指标，新名字是否已配置必须在业务 DQE 复验。
- 合成认证查询失败时，现有运行时使整表呈现“暂无数据”，而不是只令认证列缺省。此为已确认的失败影响，本批没有修改运行时的错误隔离策略。
- 得分查询要求完整结果；本批没有真实 total_count/行集完整性证据。各源地区名称是否完全一致、代表处键是否唯一，仍需真实响应核查。
- 原明细查询将 `level` 筛选值绑定到组织名称字段（声音明细为 region_dept_name_cn，服务能力明细为“地区部”）；合成请求可见发送字面值“地区部”。该问题来自输入及本地既有声明，真实语义尚未确认，本次不猜测组织名称或新增下钻条件。
- 总分、合作意愿、客户评价、经营贡献、数量增长、风险扣分等列仍无新增真实查询；概览/图表和部分详情继续展示原 inline 示例。本次没有将示例冒充真实汇总。

## 验证与证据

- 独立 local-authoring 校验和产品 `pnpm validate`（将目标文件复制到独立临时目录）通过。产品 CLI 接受目录而非单文件；首次单文件调用为 ENOTDIR，改正入口后通过。
- Playground `/pages/partner-health`，桌面 1600px / 窄屏 390px，以合成 DQE 响应验证两粒度五类得分、乱序对齐、缺失辅助行、零值、主源空键行、详情标题、海外同查询复用、年度重查及认证查询失败。合成数字只存在验收拦截器和证据中，未写进页面。
- local-authoring 两组相关测试共 44 项通过；完整 Skill 复制到仓外后无软链接，新增创作说明在副本中存在，副本独立校验目标页面通过。冻结快照哈希复核通过。
- 真实 DQE、真实 Relay、线上保存/发布均未执行。本批没有改产品协议或可执行函数，函数复杂度测量不适用，无新增函数或分支超限项。
- 证据目录：`docs/evidence/partner-health-logic-supplement/`。`before.json` 为修改前本地文件，`input-normalized.json` 为拼接后用户输入，`attempt-1` 为校验前冻结稿，`browser-verification.json` 保留合成请求与断言结果，截图分别记录两张主表、窄屏和认证失败状态。
- 使用问题回灌：`docs/evidence/dsl-usage/2026-10-27-partner-health-increment.md`；增量合并的检查顺序已补到 local-authoring 的 `references/data-analysis.md`，保留真实取数待验证状态。

---

## 历史：本次补充前的查询行集修复

以下记录的是修改前状态；认证查询未绑定的说明已由本次新增章节更新，其余历史证据边界仍然保留。

### 原修复记录

## 当前页面

- `partner-health.json` 采用Dashboard布局，声明本机引擎支持的6.52版本；当前结构通过独立校验器，未升级或改动引擎版本策略。
- 地区部表格的main为`voice-closure-score-region`，代表处表格的main为`voice-closure-score-representative`。表格行集直接来自各自主查询。
- `health-detail-region`、`health-detail-representative`的6条原静态示例行已清空。这两个源只保留未接通列的字段契约，作为pending数据槽，未接通列呈现缺省值。两表不再由静态行决定行集合。
- 未配置的认证指标查询定义仍保留，但不再绑定到主表；本批没有改全局组件错误隔离策略。后端指标配置及真实执行成功后，再将它作为独立指标槽接回。
- 各详情入口的titleField改为新主查询拥有的region；未接通列的缺省值不会生成可点击入口。

## 地区部真实结果

用户提供的2026-10真实请求使用`output_dims:[地区部]`和`output_metrics:[伙伴声音闭环率得分]`，time为period=month、is_aggregate=true、start=end=2026-10。

SUCCESS响应有10行，total_count=10，得分均为0；地区部有1个null。字段映射为地区部→region、伙伴声音闭环率得分→closure-rate，空维度保持原值、不删除行、不补造名称。

已按用户要求删除source.initial，当前页面不内嵌这10条返回值，首屏直接请求DQE。默认期间为2026-10。中国区/海外两个相同查询case已合并为普通查询；当前查询未声明站点过滤。

切换期间或区域条件后仍走原有动态查询。当前本地服务为DQE Sim，没有该业务查询的仿真数据；真实动态重查仍需业务DQE环境。代表处没有对应真实响应，保留原查询定义，不冒用地区部结果，也不添加示例行。

## 验证

- 独立local-authoring校验通过；两张主表的inline示例行数为0。
- 历史返回值重放验证仅证明字段映射与表格能渲染10行零值，不代表真实动态请求成功。当前版本已删除全部source.initial。
- 先前10行截图来自已撤销的首屏快照方案，不能作为当前动态取数验收结果。当前首屏必须请求DQE；本地Sim不支持业务指标，实际出数需业务环境。
- 本次仅修改页面JSON和说明，没有修改可执行函数，复杂度测量不适用。

## 证据

`docs/evidence/partner-health-query-render/`：before.json为用户最新文件修复前备份；attempt-1保留首次候选的详情标题字段错误；attempt-2为历史含initial候选，已被撤销；response-rows.json仅保留用户真实返回的数据与总数，避免复制无关账号元数据；verification.json为执行链验证结果；rendered.png为实际浏览器截图。
