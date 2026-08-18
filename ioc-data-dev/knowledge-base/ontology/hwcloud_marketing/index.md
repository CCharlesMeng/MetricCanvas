# knowledge-base/ontology/hwcloud_marketing/index.md — 语义层索引

| 文件 | 说明 |
|------|------|
| catalog.yml | 域→事实正向索引 + 共享维度 + 指标索引 |
| shared-dimensions.yml | 一致性维度定义(注册表上游) |
| dimensions/ | 维度详情(逐个维度) |
| facts/ | 事实详情(逐个事实) |
| models/ | 语义模型 |
| references/ | 参考 |
| ../ontology-layers.yaml | 六层调用规则(KW-AX8) |

使用顺序:先读 catalog.yml 定位域 → 再读 shared-dimensions.yml 取维度 →
六层规则见 ontology-layers.yaml。写 ADS 设计前必须完成此三步(CORE-AX4)。
