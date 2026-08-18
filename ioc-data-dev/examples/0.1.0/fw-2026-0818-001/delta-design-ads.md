# delta-design-ads.md — ADS 增量设计(示例)

## 1. 前置产物引用

| 前置产物 | 文件 | 状态 |
|----------|------|------|
| 需求澄清 | proposal-fe.md | ✅ |
| FE 增量规格 | feature-delta-spec.md | ✅ |
| FE 验收摘要 | feature-delta-acceptance.md | ✅ |
| 指标盘点 | feature-delta-indicator.md | ✅ |
| GWT 验收 | GWT验收.md | ✅ |

## 2. ADS 表设计

### ADS 表: ads_db_marketing.ads_dm_customer_active_m

| 属性 | 值 |
|------|-----|
| 库名 | ads_db_marketing(actual_schemas 枚举) |
| 表名 | ads_dm_customer_active_m(ads_dm pattern) |
| 粒度 | 月/客户/区域 |
| 引擎 | hive |
| 复用授权 | 无(新建) |

### 字段定义

| 字段名 | 类型 | 来源(表.列) | 来源分层 | 计算规则 | 备注 |
|--------|------|--------------|----------|----------|------|
| party_id | string | dws_t_customer_active_daily.party_id | DWS | 直接映射 | |
| data_site_type | string | dws_t_customer_active_daily.data_site_type | DWS | 直接映射 | 区域路由 |
| cust_active_cnt | bigint | dws_t_customer_active_daily.active_cnt | DWS | SUM(active_cnt) | 聚合须 COALESCE |

## 3. 指标回填(v2)

| 指标 | ADS 表名/字段名 | 消费数据源 | 绑定状态 |
|------|-----------------|------------|----------|
| 区域客户活跃数 | ads_dm_customer_active_m.cust_active_cnt | dws_t_customer_active_daily | 已绑定 |

## 4. 分层合规自查(KW-AX8)

- [x] ADS 未消费 SDI/ODS(来源 DWS)
- [x] 来源分层 ∈ {DWD, DWS, DM, DIM}
- [x] 同一区域字段来源统一
