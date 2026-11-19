# 按指标说明补配气泡

用于给一张或一批已有指标卡补配指标定义说明。填写 `props.tipCode`，展示位置遵循[指标卡协议](page-metadata/components/metricCard.md#metric-definition-tip)。

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

逐卡检查 `cards`。工具沿主次指标行、变化值和进度值的字段绑定追到普通单项 DQE 请求。一个请求可以输出多个指标，只核对实际绑定的字段。所有绑定均精确匹配同一编码且有展示位置时标记 `ready`。已有 `tipCode` 标记 `existing` 并保留。组合源、查询模式及无法验证的计算或绑定在该流程中保留待核。所有候选通过页面校验后，才写入新目录，原件可按摘要核验。再次扫描候选时对应卡片应为 `existing`。

`upgrade-required` 表示原页版本低于能力下限。查阅[显式升级流程](page-upgrade.md)，确认本批允许升级后追加 `--upgrade`。脚本对确有补配项的旧页调用产品升级器，列出迁移差异并校验候选。候选页的实际气泡仍由接入环境提供指标定义端口。合成验收入口为 `/pages/metric-card-definition-tip`。
