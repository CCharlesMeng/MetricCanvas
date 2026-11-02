# 数据计算场景

## 空组织键兼容

启动 `pnpm dev:playground` 后打开 `/pages/missing-organization-key`，无需 DQE 服务或 URL 参数。页面沿用Schema6.74，全部为 inline 合成数据，无新增开关。上表显示甲0、乙单项缺失且总分0、丙-2；展开“部分数据异常”可见来源a跳过2行、b跳过1行，同一来源并集与关联不重复计数。下表所有组织键都为空，显示空态和跳过2行的提示。类型异常、重复键、依赖失败及导出告警由定向回归覆盖；此页不证明真实 DQE 或内网部署。

## 组织键并集

启动 `pnpm dev:playground` 后打开 `/pages/union-keys-demo`（inline 合成）。三个组织按键并集显示：甲真实0、乙单项全缺但总分0、丙负数-2；单项缺失显示 `--`。Schema6.74。完整查询响应验证入口 `/pages/partner-health-union-null-probe`，见对应临时页 README；正式 `/pages/partner-health` 继续使用真实 DQE。

## 缺项得分归零

启动Playground后打开 `/pages/sum-fields-missing-values`（inline合成）。部分缺项分类8、风险-2、总分6；全部缺项和真实零值均为0。非法非空值/溢出由行为测试覆盖。Schema6.71，真实DQE另验。
