-- 合规示例:测试态 SQL(hive, bi_test)——全部 POL-SQL 通过
DROP TABLE IF EXISTS bi_test.ads_dm_customer_active_m_0818_ads_db_marketing_test;

CREATE TABLE IF NOT EXISTS bi_test.ads_dm_customer_active_m_0818_ads_db_marketing_test (
  party_id         string,
  data_site_type   string,
  cust_active_cnt  bigint
)
PARTITIONED BY (stat_month string)
ROW FORMAT SERDE 'org.apache.hadoop.hive.ql.io.orc.OrcSerde'
STORED AS ORC;

WITH active_src AS (
  SELECT
    base.party_id,
    base.data_site_type,
    COALESCE(base.active_cnt, 0) AS active_cnt
  FROM dws_t_customer_active_daily base
  WHERE base.stat_date >= date_sub(current_date, 30)
)
INSERT OVERWRITE TABLE bi_test.ads_dm_customer_active_m_0818_ads_db_marketing_test
PARTITION (stat_month = '2026-07')
SELECT
  src.party_id,
  src.data_site_type,
  SUM(COALESCE(src.active_cnt, 0)) AS cust_active_cnt
FROM active_src src
JOIN dwd_t_customer_insight_map_m map
  ON map.party_id = src.party_id
 AND map.map_type = 'LANDSCAPE_MAP'
 AND map.space IS NOT NULL
WHERE src.data_site_type IN ('china', 'oversea', 'europe')
GROUP BY src.party_id, src.data_site_type;
