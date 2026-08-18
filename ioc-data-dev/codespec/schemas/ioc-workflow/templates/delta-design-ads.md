# delta-design-ads.md — ADS 增量设计(CTR-DES-001)
# 前置:必须引用全部 5 个 PRD 产物;ADS 禁止消费 SDI/ODS(POL-DESIGN-001)。

## 1. 前置产物引用

| 前置产物 | 文件 | 状态 |
|----------|------|------|
| 需求澄清 | proposal-fe.md | ✅/⏳ |
| FE 增量规格 | feature-delta-spec.md | ✅/⏳ |
| FE 验收摘要 | feature-delta-acceptance.md | ✅/⏳ |
| 指标盘点 | feature-delta-indicator.md | ✅/⏳ |
| GWT 验收 | GWT验收.md | ✅/⏳ |

## 2. ADS 表设计

### ADS 表: {ads_db}.{ads_table}

| 属性 | 值 |
|------|-----|
| 库名 | {从 actual_schemas 枚举选择,POL-DESIGN-002} |
| 表名 | {符合 ads_dm pattern,POL-DESIGN-003} |
| 粒度 | {如 天/客户/产品} |
| 引擎 | hive / dli |
| 地图前缀 | {若地图类,须带地图前缀,POL-DESIGN-007} |
| 复用授权 | {若 ads_reuse,须授权记录,POL-DESIGN-008} |

### 字段定义

| 字段名 | 类型 | 来源(表.列) | 来源分层 | 计算规则 | 备注 |
|--------|------|--------------|----------|----------|------|
| {col} | {type} | {dwd_t_xxx.col} | DWD | {规则} | {active/reserved 等} |

### 维度与事实

- 维度列: {来自一致性维度注册表,POL-DESIGN-004}
- 事实: {指标与字段映射,回填 indicator v2}

## 3. 指标回填(v2)

| 指标 | ADS 表名/字段名 | 消费数据源 | 绑定状态 |
|------|-----------------|------------|----------|
| {指标名} | {ads_table.col} | {DWS/DM 表} | 已绑定/待绑定 |

## 4. 分层合规自查(KW-AX8)

- [ ] ADS 未消费 SDI/ODS
- [ ] 来源分层 ∈ {DWD, DWS, DM, DIM}
- [ ] 同一区域 table 字段来源统一(POL-DESIGN-009)
