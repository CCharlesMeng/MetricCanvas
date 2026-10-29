# 数据计算场景

## 组织键并集

启动 `pnpm dev:playground` 后打开 `/pages/union-keys-demo`（inline 合成）。三个组织按键并集显示：甲真实0、乙单项全缺但总分0、丙负数-2；单项缺失显示 `--`。Schema6.74。完整查询响应验证入口 `/pages/partner-health-union-null-probe`，见对应临时页 README；正式 `/pages/partner-health` 继续使用真实 DQE。

## 缺项得分归零

启动Playground后打开 `/pages/sum-fields-missing-values`（inline合成）。部分缺项分类8、风险-2、总分6；全部缺项和真实零值均为0。非法非空值/溢出由行为测试覆盖。Schema6.71，真实DQE另验。
