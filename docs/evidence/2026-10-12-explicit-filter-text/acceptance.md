# 显式筛选文本与 period 格式验收

已实现 Schema 6.15 的 `{filter, format?}` 文本取值引用，只新增 `period`，保留 `asOf` 名称。`filterIds` 仅控制日期框位置；静态文字和参数引用不会被筛选覆盖。6.13/6.14 保留版本及原期间派生读取行为，参数提取确认写出显式期间引用。

## 验证

| 层级 | 结果 | 证据 |
| --- | --- | --- |
| TypeScript 全量 | 195 文件，1729 项通过 | artifacts/full-tests-final.txt |
| Python 创作全量 | Tool venv，524 项通过，无真实模型调用 | artifacts/authoring-venv-final.txt |
| Schema / 程序契约 | 筛选存在性、格式类型、6.15 能力下限和互斥形状；共享正反例一致 | packages/page/tests/filter-text-value.test.ts；artifacts/authoring-validation-final.txt |
| 类型检查 | page、engine、playground 通过；Svelte 0 errors / 0 warnings | artifacts/*-check.txt |
| 页面目录 | 15/15 通过 | artifacts/pages-check.txt |
| 创作分发 | 生成契约检查通过；Bundle 1793 digest checks；ADR 索引通过 | artifacts/contracts-check.txt；pnpm authoring:contracts / check_bundle.py / adr:index:check |
| 浏览器 | 月份修改后 5 行对应数据；页头、分区标题、正文及标签联动，参数副标题仍为打开时的 1—6 月；静态 asOf 不覆盖，无 asOf 不自动创建 | artifacts/browser-assertions.txt、page-applied.json、generic-text.json、static-text.json |
| 导出视图 | 所有内容组/Tabs，共159行，日期控件0；捕获1—4月，页面随后改1—5月，导出仍为1—4月 | artifacts/export-period.json |

月份/日期单点和范围、同端点、清空、非法范围不应用由确定性回归覆盖。浏览器使用本地 DQE simulation 或导出示例的合成网关。未声明真实 Relay/DQE 服务、真实模型、生产 PDF 编码或部署验收。PDF 编码器本次未修改。

## 配置

`pages/report-date-filter-example.json` 已升级 6.15：

```json
"asOf": {
  "label": "当前期间",
  "value": { "filter": "report-period-filter", "format": "period" }
}
```

代码与原有未提交需求保留在当前工作区，本次未提交或 push。白色工具带是前一轮成果，本轮未修改 ReportHeaderView 的样式。协议决策见 docs/adr/0100-explicit-filter-text-values-and-period-format.md；源码指纹见 code.json。
