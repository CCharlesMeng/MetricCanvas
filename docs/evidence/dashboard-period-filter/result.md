# Dashboard 期间筛选实施与验收

最新 main 交付以 [交付复验记录](main-delivery.md) 为准；下文保留原混合工作区实施时的证据与失败状态。

2026-10-15。功能已实现，期间筛选的定向本地验收通过；当前混合工作区的全量检查未通过。未提交、未推送或部署。本功能在 Schema 6.27 引入；实施末期并行 PDF 批次已把当前写出版本升为 6.28，不能把此前 6.27 检查结果当作最终 6.28 全仓结果。

## 实现结果

- 在现有 `timeRange` 上增加 `display:period`，复用 DashboardToolbar / FilterBar，单个 ID 原子提交。未新增查询网关或改变查询的 `period/is_aggregate`。
- 年／季／月复用现有 OpenTiny OS 风格 DatePicker。季度输入 `2026 年 Q4`、面板 Q1—Q4；年季月可恢复历史期间。
- 近一年移除日期输入与日历按钮，仅显示当前月之前 12 个完整月份；2026-10 对应 `25年10月~26年9月`。不受先前历史月份影响。
- URL／导航／最后筛选记录保存模式；相同范围切模式更新显示但不重复查询。动态默认不复用无法证明时间一致的旧 initial。
- month / date 序列化与自然期间校验集中在 `period-filter.ts`，参数只初始化；导出使用已应用的实际范围，不跨月重算。
- Dashboard 页面级人工日期配置及 Python add/update_date_filter 已支持新声明，复用统一编辑与产品校验。

## 功能、场景、协议与 Skill 对应

| 功能 | 页面／用例 | 文档／产物 |
| --- | --- | --- |
| 日期与月份精度 | `pages/dashboard-period-filter.json`、`dashboard-period-filter-month.json` | `PAGE-METADATA.md`、`docs/page-metadata/filters.md`、`PAGE-PARAMETERS.md` |
| 更多筛选与只读 compact | `dashboard-period-filter-more.json`、`dashboard-period-filter-readonly.json` | 四页均注册 `apps/playground/page-catalog.json`，操作及数据边界见 `pages/README.md` |
| 协议拒绝与初始化 | 合法夹具、page-conformance-vectors、period-filter 单元测试 | schema/filter、report-date-filters、version、reference-map、产品契约与独立校验器 |
| 人工／本地创作 | report-date-edit、Python InteractionEditingTest 新增期间 add/update | page-edit-request 契约、平台 Dashboard 布局知识、本地 Skill 作者说明及生成知识 |
| UI 验收 | 正式组件截图、UI 普通 DOM / ShadowRoot、embed 场景 | [SDD 验收](../../plan/dashboard-period-filter/ui/acceptance.md)、[逐项账本](../../plan/dashboard-period-filter/ui/alpha-tests.md) |

人工演示入口：`pnpm --filter platform exec vite --config tests/browser/report-date.vite.config.ts`，打开 `http://127.0.0.1:5187/tests/browser/report-date-editor.html?dashboard`。这是正式属性面板＋运行时，使用本地合成网关，不代表业务数据真实性。选择“编辑已有筛选 → 统计期间”，可修改初始模式并应用。

[历史截图：正式季度面板](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/dashboard-period-filter/formal-quarter.png)

[历史截图：近一年无日期框](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/dashboard-period-filter/formal-last12.png)

## 已执行的验证

| 层次／命令 | 结果与边界 |
| --- | --- |
| 期间／日期／版本／状态／执行／取消／导出／日历／FilterBar／人工编辑的 13 文件 Vitest 定向集 | 6.27 稳定代码时 101 项通过；并行 6.28 后复测 12 文件期间功能集，98 项全部通过 |
| `pnpm --filter @metriccanvas/ui exec playwright test --project=chrome` | 22 项通过，含普通 DOM、ShadowRoot、新年季键盘及原日期范围行为 |
| `pnpm --filter @metriccanvas/embed exec playwright test tests/browser/period-filter.spec.ts` | 3 项通过；读取正式 pages，检查实际 DQE 请求范围、原聚合保持、无绑定源请求次数、URL季度、历史月返回、跨月、更多、compact、390px |
| page / data-execution / engine / UI / Platform 检查 | 均通过；最后一次 Platform svelte-check 为 0 error / 0 warning |
| 公共 API 快照 | 8 项通过，同步新增声明与 DatePicker 精度 |
| `pnpm authoring:contracts`、`:check` | 在 6.27 完成 713 product / 4 authoring / 1 interface 产物生成与检查；末期 6.28 当前检查状态见下文 |
| `python3 metriccanvas-authoring/scripts/check_bundle.py` | 6.27 产物 2598 digest checks 通过 |
| local-authoring-skill / page-reference / authoring-export-isolation | 3 文件 31 项通过，含复制安装目录至仓外的闭合验证 |
| Python `run_tests.py --layer rules` | 160 项通过，含新期间 add/update 与查询聚合保留用例 |
| 最后复制 Skill 至 `/tmp/metriccanvas-period-final-skill` 并从 `/tmp` 执行独立 Node 校验器 | 四个期间场景全部 ok |
| CUA 正式属性面板→运行时 | 季度应用、Q1—Q4、近一年移除输入均实测；键盘 Shift+Tab 到月分段，focus-visible=true，蓝色 2px outline / 2px offset，见 formal-focus.png |
| 独立源码构建＋六包 tarball 严格依赖安装 | 构建、page-only Node ESM、UI-only 与组合消费者 svelte-check / tsc / Vite 均通过；UI 22 项、安装后 embed 期间 3 项 Chrome 通过 |

安装包证据见 [installed-consumers.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/dashboard-period-filter/installed-consumers.json)、[浏览器结果](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/dashboard-period-filter/installed-period-browser-results.json) 与 [logs](logs/)。使用源码树 `b5adefa4752b480b2f46bc1b88c9a60fe32fcc57`；它是临时索引生成的 Git tree，未创建仓库分支或提交。原型 4183 和源码服务 4175 保留，安装包临时服务改用 4193 / 4195 / 4196。

官方 `compatibility:check` 先跑全仓测试，遇下列失败后停止。为继续验证已安装产品，本轮仅在 `/tmp` 的临时 runner 跳过已记录的源码 test/check 门，保留源码 build、真实 pack/install、类型与构建检查，组合浏览器限期间用例、浏览器限 Chrome。这是定向安装包证据，不能写成官方完整兼容矩阵通过。未修改仓库兼容性脚本。

## 全仓失败与并行变化

1. 隔离完整源码全仓 Vitest 为 2114 passed / 7 failed / 4 skipped。其中本次默认 filter ID 与页面重名的 1 项已修复，page-id-neutrality 单独复测通过；另外 6 项来自原有 business-sdt-report：signed-number-formats 1、canonical-writers 1、business-sdt-cascade 4。三组均在初始完整工作区快照重跑得到同样失败，保留原页面和 Sim。
2. `pnpm check` 在 `packages/embed/tests/browser/paged-join.spec.ts:20` 的已有谓词类型失败；该文件与初始快照逐字相同。不能宣称全仓类型检查通过。
3. 实施末期并行 PDF 批次修改 `report-pdf-client.ts`、engine 依赖和 `report-date-filters.ts` 的 PDF 位置限制，并把 Schema 升到 6.28。新增范围未被本次覆盖或回退。当前生成检查被其 `report-pdf-export.json` 非法样例阻断；最新广义定向集还命中 PDF capability 的版本期望和与页面 ID 重名的检查。期间功能集本身未出现失败。后续应在该批次收口后重跑 `pnpm authoring:contracts:check`、`pnpm check`、版本／页面中立性测试。
4. 并行依赖切换时当前 engine 的两个 node_modules 链接缺失，曾令 5187 热更新报找不到 html2canvas；本地已恢复链接并重启服务，页面恢复。最初 frozen install 明确报并行 manifest 与锁文件未同步；不据此回退对方源码。最终依赖状态随并行批次维护。

精确交付核对用 [scoped-source-tree.json](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/dashboard-period-filter/scoped-source-tree.json)：列出已验证源码快照相对任务初始混合工作区的增量，标识快照后又变化的文件。清单中包含生成物，不能据此整文件覆盖并行增量。当前实际工作区仍以各源码的并行最终状态为准。

## 尚未证明的范围

Edge 未安装；完整 Chrome＋Edge 兼容矩阵未通过。浏览器请求响应为合成数据；真实 DQE／Relay／Java、真实 DS 模型、远端 CI 与部署均未验证。新控件不改变查询聚合。

SDD 聚合无产品 blocker；L2/L5、C2/C5、Q2/Q5 无发现。C1 因所选 baseline 缺少明文命名规则保持局部未验证，不伪造规范结论；慢旧请求晚到没有新增专门浏览器序列，既有取消测试通过且隔离代码已审。该差异登记在 SDD 原始结果中，不作为真实服务证据。
