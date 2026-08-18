-- 违规示例(反例):演示校验器如何拦截 —— 该文件不应通过任何校验
SELECT * FROM dws_t_customer_active_daily t1 JOIN dwd_t_customer_insight_map_m t2 ON t1.party_id = t2.party_id;
INSERT INTO bi_test.ads_bad_result_0818_ads_db_marketing_test
SELECT party_id, active_cnt / total_cnt FROM t1 WHERE active_cnt > 100;
