# 按指标说明补配气泡

用于批量给指标卡内实际使用的主、次指标补配问号。按指标说明目录匹配编码，给结果字段填写 `metricCode`，给对应指标行设置 `showDefinition: true`。见[指标卡协议](page-metadata/components/metricCard.md#metric-definition-tip)。

## 从资料形成指标说明目录

输入为页面 JSON 和有来源的指标说明。单条说明也使用同一形态。目录可附名称、定义、公式、解释人等原文，自动补配读取 `code`、`source` 和 `queries`。

```json
{
  "metrics": [
    {
      "code": "DEMO-BUSINESS-CLOSURE",
      "source": "合成示例指标目录",
      "queries": [
        {
          "queryField": "决策闭环任务总体闭环率(投标-商务-合同)",
          "dimensions": { "决策业务类型": ["商务"] }
        }
      ]
    }
  ]
}
```

- `code` 取指标管理服务对外的指标编码。用明确的索引、目录导出或代码映射将它与实际请求对应，来源应可追溯到输入材料。名称和定义可辅助查找资料，只有精确的查询标识参与自动匹配。
- `queryField` 填 DQE 请求的真实指标名。请求存在 `schema_id` 时，在目录条目中填写 `schemaId`。同一指标的同比、环比等由目录证明归属时，将其请求作为同一编码下的另一条 `queries` 记录。
- 同名请求的编码随业务口径变化时，声明相应固定维度和值。维度值按集合匹配。动态条件、可覆盖的固定条件或未证实的同名项保留待确认。目录匹配到不同编码时，先收敛来源再重试。

## 试跑和候选

```sh
node "<skill-dir>/scripts/configure-metric-tips.mjs" --pages-dir "<pages-dir>" --catalog "<metrics.json>"
node "<skill-dir>/scripts/configure-metric-tips.mjs" --pages-dir "<pages-dir>" --catalog "<metrics.json>" --out-dir "<new-dir>"
```

目录模式递归读取 JSON 文件。用可重复的 `--page "<page.json>"` 可精确限定输入页。不提供 `--catalog` 时执行只读扫描，返回请求的指标名、数据源、字段及固定维度，便于补齐资料。批量范围与原件摘要写在输出中。

查看 `cards[].rows[]` 的行路径、请求和匹配状态。工具沿主、次指标行的 `valueField` 识别普通单项 DQE 的 `output_metrics`；同比、环比和进度值继续沿用原页面。一个请求输出多个指标时，只核对当前行绑定的字段。行内各分支都匹配后标记 `ready`。共享结果字段只补配一次编码，每个匹配行独立开启问号。

已有 `showDefinition: true` 标记 `existing`，显示开关为 `false` 标记 `disabled`。旧 `tipCode` 卡片标记 `existing` 并沿用原配置。组合源、查询模式、无法验证的绑定、目录歧义和手工编码冲突保留待核。候选通过页面校验后写入新目录，原件可按摘要核验。再次扫描候选时，已开启的指标行为 `existing`。

`upgrade-required` 表示原页版本低于 6.129。查阅[显式升级流程](page-upgrade.md)，确认本批允许升级后追加 `--upgrade`。脚本对确有补配项的旧页调用产品升级器，列出迁移差异并校验候选。候选页的实际气泡仍由接入环境提供指标定义端口。合成验收入口为 `/pages/metric-card-definition-tip`。
