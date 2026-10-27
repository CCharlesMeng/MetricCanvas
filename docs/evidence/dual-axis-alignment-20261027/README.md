# 双轴刻度对齐验收

日期：2026-10-27（Asia/Shanghai）。用户已审核主副轴对齐、仅主轴绘制网格线的对照效果后实施。

基线：`origin/main` a7033134256ed1e13775c25b6a5f6804ba0e3259，Schema 6.66。主工作区停留在更早版本且有并行修改；本批实现和生成产物保存在独立工作树 `dual-axis-ticks`，未覆盖主工作区；实施验收时未提交或推送。

## 原因与修复

主副数值轴原来各自计算 nice ticks。数量 [120,160] 与完成率 [38,87] 的最小复现中，主轴有 7 个刻度，副轴有 6 个刻度，两套网格线交错。无高级配置或自定义格式时同样复现，排除了高级扩展覆盖和格式化造成的错觉。

共享 `alignedSecondaryAxis` 保留现有轴对象的格式与单位，为副轴设置 `alignTicks: true` 和 `splitLine.show: false`。普通柱图与折线图经过 `dualOrSingleAxis` 复用，显式柱线混合图也调用同一函数。单轴默认值和高级配置覆盖顺序保留，不新增协议属性或版本。

自动对齐可能扩展副轴范围，本页右轴自动扩到 120%。显式 min/max/interval 或关闭 alignTicks 后由该配置约束，不保证继续自动对齐。折线示例通过既有高级属性 `xAxis.name: ""` 省略重复的类别轴名称，月份由类别标签表达；这属于演示配置，不改变产品类别轴命名策略。

## 场景与分发映射

- Playground：`pages/capabilities/chart/dual-axis-alignment.json`，入口 `/pages/dual-axis-alignment`；说明在相邻 README 和 `pages/README.md`。
- 静态契约夹具：`packages/page/fixtures/contract-valid/dual-axis-alignment.json`。
- 产品说明：`PAGE-METADATA.md` 与 `docs/page-metadata/components/{barChart,lineChart}.md`。
- 示例和语义路由：`docs/page-metadata/reference-map.json`；新增章节明确登记至 authoringSemanticHeadings。
- 导出器同步产品参考、contract-snapshot、local-authoring 知识与独立校验器、哈希和 Bundle 清单。其他兼容投影仅由导出器同步，不追加其他 Skill 或真实模型验收。

## 验证

- 修复前运行 `pnpm exec vitest run packages/engine/widgets/tests/dual-axis-alignment.test.ts`，三个主要图表分支均因 7 对 6 个刻度失败。另一个探索性横向双轴组合触发现有 ECharts 配置错误，未作为本批支持场景；最终测试聚焦本次确认的双 Y 轴。
- 修复后运行 `pnpm exec vitest run packages/engine/widgets/tests/dual-axis-alignment.test.ts packages/engine/widgets/tests/bar-chart-options.test.ts packages/engine/widgets/tests/line-chart-options.test.ts packages/engine/widgets/tests/chart-option-extension.test.ts`：4 文件、40 项通过。
- 使用 ECharts 6.1.0 SVG SSR 实际 scale 检查刻度坐标和 splitLine，而非仅断言生成 option；覆盖柱/线/混合、正负值、全零、空数据、resize(360×240)、更新数据、固定副轴范围/间隔、隐藏轴和显式高级覆盖。
- `pnpm exec tsc --noEmit -p packages/engine/tsconfig.test.json`：通过。
- `node metriccanvas-authoring/skill/metriccanvas-local-authoring/scripts/validate-page.mjs --expected-layout dashboard pages/capabilities/chart/dual-axis-alignment.json`：ok true，errors []。
- `METRICCANVAS_PYTHON=/Users/moon/Documents/Code/公司项目/DataDashboard/metriccanvas-authoring/tool/.venv/bin/python pnpm authoring:contracts` 及 `pnpm authoring:contracts:check`：通过，1251 product、4 authoring、1 interface files。最初系统 Python 缺 fastmcp，改用已安装依赖的仓库虚拟环境后成功。
- 同一 Python 环境运行 `pnpm exec vitest run tests/local-authoring-tools.test.ts tests/local-authoring-skill.test.ts tests/page-reference.test.ts`：3 文件、73 项通过；包括仓外复制、链接、知识/哈希、独立校验器与产品向量一致性。生成完成前启动的一次旧验证已停止，以本次完成后的结果为准。
- 浏览器：`pnpm --filter playground dev --host 127.0.0.1 --port 5176`，打开 `http://127.0.0.1:5176/pages/dual-axis-alignment`。1280px 视口中三种双轴刻度等高、单套网格线、百分号与混合图单位保留，单轴对照正常；隐藏并恢复完成率图例后仍正常。控制台无 warn/error。截图见 [实际页面](/Users/moon/.codex/visualizations/2026/10/27/01a17b69-9dd7-7752-b4e5-703e6490fd93/dual-axis-alignment/playground-fixed.png)。窄尺寸由上述真实 ECharts SSR resize 验证，没有将其记为窄屏浏览器验收。
- `git diff --check`：通过。

以上均为内联合成数据与本地呈现验收，未调用真实 DQE、Relay 或模型，不涉及远端 CI。

## 复杂度

同一测量器 `metriccanvas-ts-ast/1`、TypeScript 5.9.3、自身圈复杂度 selfCC（嵌套函数独立计数）。原始结果按仓库忽略规则留在本地，已核对复制到 `/Users/moon/.codex/visualizations/2026/10/27/01a17b69-9dd7-7752-b4e5-703e6490fd93/dual-axis-alignment`，文件为 `complexity-before.json`、`complexity-after.json`，与实际页面截图一起保留；工作树清理不删除该副本。

| 函数 | 前 | 后 |
| --- | --- | --- |
| dualOrSingleAxis | 3 | 3 |
| mixedOption | 3 | 3 |
| alignedSecondaryAxis（新增） | — | 1 |

新增测试文件的 20 个函数（含回调）最大 CC 3。修改函数及全部新增函数均低于 15；本次无新增或修改的超限函数，未扩大为无关存量重构。

## main 交付复验

用户于 2026-10-27 授权提交并 push main。远端基线新增 b212b3caddff83b37e279b0213e655ab4f312570，仅修改另一批验收说明与公共 API 快照，与本次实现无交叠。交付复验使用正式 `pnpm test` 入口（包含 svelte-kit sync），完整远端提交与 exact-SHA CI 结论见本聊天交付回执。

首次 CI（719ade26，run 40445807822）在 MC 诊断夹具检查失败：新增章节使知识主题数 179→181、产品参考文件数 1249→1251，但 `mc-content-layout-demo` 与诊断报告仍引用旧计数及内容哈希。使用既有 `tools/scripts/mc-content-fixtures.py` 重新生成演示与诊断夹具，并按真源生成 MC 来源身份、版本和分发锁；不手写计数或放宽检查。已完成的 local-authoring Skill 验证通过；旧失败工作流的未完成任务取消，最终提交重新等待完整 CI。

补充提交前复跑失败步骤：MC 来源覆盖通过、Python MC 内容包测试 30 项通过、`pnpm test tests/mc-content-coverage.test.ts` 6 项通过、诊断夹具 --check 通过、独立归档打包通过。此补充仅更新生成夹具、来源哈希及交付说明，没有修改可执行分支，复杂度口径和结果保持不变。
