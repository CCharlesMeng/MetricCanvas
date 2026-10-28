# 图例列 unit / align 补充验收（2026-10-26）

本批在 `codex/pie-table-legend` 的未发布 6.52 功能批次内补充，不变更已有默认行为；工作树、基线和隔离方式见 [主验收记录](acceptance.md)。没有修改原工作区或依赖锁文件。

## 语义与实现

- `legend.columns[].unit` 可缺省，缺省或空串不追加单位；显式声明“家”时在格式化值后加一个空格及单位，例如 `96 家`、`0 家`。缺失值只显示 `missingText` / “—”，不追加单位。
- `legend.columns[].align` 可缺省；取值仅 `left`、`center`、`right`，缺省仍为数值列右对齐。列头与全部数据单元格同步生效。
- 单位与对齐只影响这一列的呈现，不改变输入行、扇区数值、排序和占比计算。普通字段列、自动占比列均支持。
- 对外 Schema 仅扩展 pieChart 图例；分类明细复用实现只接收内部可选呈现参数，其独立页面协议与既有显示不变。
- 产品 Schema、PAGE-METADATA、组件文档、页面所在目录 README 与产品/Skill 派生知识已同步；增加非法 align 契约向量。派生产物均从真源生成。

## 页面和浏览器

入口仍为 `http://localhost:5188/pages/pie-table-legend`，完整声明为 `pages/capabilities/chart/pie-table-legend.json`；全部是内联合成数据。

1. 首图客户数量显示“96 家”，unit 已声明而 align 缺省，列头、数值计算样式均为 right。
2. “列呈现”图客户数列头/数值均为 center，占比列头/数值均为 left。
3. 数量变化图客户数列头/数值均为 left，占比列头/数值均为 right。
4. 窄卡片和左侧图例省略 unit/align，仍显示“96”、列头/数值均为 right，证明缺省不会隐式追加字段元数据单位。

计算样式与可见文本的真实浏览器读取见 [unit-align-browser.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/pie-table-legend/unit-align-browser.json)，截图见 [unit-align.jpg](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/pie-table-legend/unit-align.jpg)。单位与对齐均通过静态声明验证，不添加新的页面设置面板。

## 检查

所有命令在本工作树执行，pnpm 使用 `--config.verify-deps-before-run=false` 复用已安装依赖。

- `pnpm test packages/page/tests packages/engine/widgets/tests tests/local-authoring-skill.test.ts tests/page-reference.test.ts`：112 文件、1162 测试通过。
- 引擎、Page、Playground 类型检查通过，Svelte 0 errors / 0 warnings。
- `pnpm build:playground`：静态站点构建通过。
- `pnpm authoring:contracts`、`pnpm authoring:contracts:check`：生成及一致性通过，1104 product / 4 authoring / 1 interface outputs。
- `pnpm test tests/authoring-export-isolation.test.ts -t '无旧链时可运行|独立本地 Skill'`：8 项通过，15 项历史/其他 Skill 场景按范围跳过。
- `git diff --check`：通过。

行为回归覆盖单位在格式化之后追加、真实零保留、缺失值不追加、原始行不变、排序和数值未被字符串化、可选值缺省、三种合法对齐及非法枚举拒绝。

复杂度采用 `metriccanvas-ts-ast/1`、TypeScript 5.9.3。`categoryBreakdownView` 5→5、`pieLegendData` 3→3，新增 `columnValue` 为 3；其余新增回调均 ≤5。Svelte 脚本及模板函数分别提取测量，详见 [unit-align-complexity.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/pie-table-legend/unit-align-complexity.json)。本批无新增/修改函数超限或待关闭项。

未 push、未合入 main、未运行远端 CI；未复验真实 DQE / Relay / 模型或 PDF/PNG 下载。原型分支与实施 worktree 继续保留，未达到已合并清理条件。
