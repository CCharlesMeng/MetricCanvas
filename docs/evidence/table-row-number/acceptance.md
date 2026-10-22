# 普通表格自动序号列验收

2026-10-22，独立工作树 `table-row-number`，基于 `4b4a7942`。协议增量6.48。

## 能力与产物

- 页面：`pages/table-row-number.json`，已注册Playground目录；入口 `/pages/table-row-number`，内联合成数据，无外部参数。
- 协议：`props.rowNumber` 与子表格的 `rowExpansion.table.rowNumber`。属性对象支持title、width和fixed:left；省略则关闭。无需数据源提供序号字段。
- 行为：按当前呈现行集编号，本地/查询分页跨页连续；排序、搜索、筛选后重新编号；所有行（含小计、合计）参与编号；展开区域本身不占编号，子表格独立编号。
- 文档：`PAGE-METADATA.md`、`docs/page-metadata/components/table.md`、`pages/README.md`；参考映射与契约向量随真源更新。
- Skill：通过 `pnpm authoring:contracts` 生成local-authoring协议知识、完整示例、独立校验器及哈希清单，仓外复制与契约向量一致性由local-authoring专项测试验收。

## 实际浏览器

运行命令：

```sh
pnpm --filter playground dev --port 5186
pnpm --filter @metriccanvas/embed build
PLAYGROUND_BASE_URL=http://127.0.0.1:5186 pnpm --filter @metriccanvas/embed exec playwright test tests/browser/table-row-number.spec.ts tests/browser/table-toolbar.spec.ts tests/browser/table-row-expansion.spec.ts --workers=1
```

16项通过：本地第2页11—20；金额降序客户25序号1；搜索客户2结果为1—7；数值下限24匹配2行并重编号；Excel完整行集从1编号且跨行表头正确；query网关桩第2页从11开始且未增加查询字段；多级表头、三种变体、空结果、390px固定列无重叠；父表展开colspan包含序号，子表第2页从11开始且父表仍为1；已有搜索、导出、子表行为回归通过。

实际Playground路由 `/pages/table-row-number` 显示第1页序号1，切第2页后为11。最终元数据调整后单独重跑该路由测试通过。截图：[第2页及变体](playground.png)。

## 其他检查

- `pnpm validate`：77个完整页面通过。
- 产品页面协议、版本门禁、表头布局、Excel和静态导出编号专项测试通过；静态呈现测试验证捕获第3页时完整行集仍从1编号。
- `pnpm --filter @metriccanvas/engine check`、Playground检查、嵌入端测试类型检查通过。
- 产品包、嵌入端和Playground生产构建通过。
- `pnpm authoring:contracts:check`、Bundle哈希检查通过（3535项）；local-authoring仓外安装、契约向量一致性、参考生成及导出隔离等7个测试文件75项通过。

真实DQE/Relay、真实模型与线上环境未验收；查询分页浏览器测试使用网关桩。原混合工作区保留；用户已确认示例并授权提交至main，远端提交与CI结果以GitHub交付记录为准。


## CI门禁修复

首轮CI在页面id中立性测试失败：内部能力标识与示例页面id同为 `table-row-number`。本地 `pnpm test apps/playground/tests/page-id-neutrality.test.ts` 确定性复现后，将内部能力标识改为 `table-row-ordinal-column`，保留页面id、6.48版本下限和所有运行行为；不修改或放宽门禁。重新运行页面id中立性、版本和序号列测试，并重新生成协议分发物。
