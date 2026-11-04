# 数据计算场景

## 创作百分比与覆盖边界

启动 `pnpm dev:playground` 后打开 `/pages/authoring-percent-coverage`，无需 URL 参数或 DQE。页面为 inline 合成数据，字段默认格式对应创作工具在部分/未知覆盖下的百分比决策。表格依次显示 12.50%、0.00%、-0.00%、0.00%、缺失文案；原值列保留 12.5、0.0001、-0.0001、0 和缺失。显式一位格式列显示 12.5%，证明组件意图仍优先；指标卡继承 12.50%。排序仍使用原值。该页不调用 Python query_data；覆盖率与来源建议修正、精度限制告警由字段/查询回归验证，浏览器只证明渲染与绑定。真实 DQE、Relay、模型与保存另验。


## 空组织键兼容

启动 `pnpm dev:playground` 后打开 `/pages/missing-organization-key`，无需 DQE 服务或 URL 参数。页面沿用Schema6.74，全部为 inline 合成数据，无新增开关。上表显示甲0、乙单项缺失且总分0、丙-2；展开“部分数据异常”可见来源a跳过2行、b跳过1行，同一来源并集与关联不重复计数。下表所有组织键都为空，显示空态和跳过2行的提示。类型异常、重复键、依赖失败及导出告警由定向回归覆盖；此页不证明真实 DQE 或内网部署。

## 组织键并集

启动 `pnpm dev:playground` 后打开 `/pages/union-keys-demo`（inline 合成）。三个组织按键并集显示：甲真实0、乙单项全缺但总分0、丙负数-2；单项缺失显示 `--`。Schema6.74。完整查询响应验证入口 `/pages/partner-health-union-null-probe`，见对应临时页 README；正式 `/pages/partner-health` 继续使用真实 DQE。

## 缺项得分归零

启动Playground后打开 `/pages/sum-fields-missing-values`（inline合成）。部分缺项分类8、风险-2、总分6；全部缺项和真实零值均为0。非法非空值/溢出由行为测试覆盖。Schema6.71，真实DQE另验。
