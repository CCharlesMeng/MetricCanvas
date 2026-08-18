# UI 原型归档 — IOC 数据开发工作台

> 原型均为**一次性设计验证产物**(prototype skill 规范),非生产代码。
> 最终实现规格见 `docs/ioc-workbench-design.md`;本目录仅作可视参考。

| 文件 | 对应设计决策 | 状态 |
|------|--------------|------|
| `workbench-demo-v1.html` | 第一版工作台 demo:流水线 + 门禁矩阵 + 产物 DAG + 澄清项(基于示例 feature fw-2026-0818-001 真实数据) | 已被 v2 取代 |
| `lineage-multi-ads.html` | 多 ADS 血缘图:v2 迭代——3 源表 → 2 ADS → 1 级联,三种边型(映射/聚合/级联)+ 字段下钻 | 被最终版取代 |
| `lineage-evolution-final.html` | **最终确认版**:方向反转(消费端→ADS→DWS/DWD→贴源表)+ 三阶段演进(ads-design / sql-generate / job-create)+ 表节点下钻字段级 | ✅ 用户确认 |

## 关键设计决策(来自原型迭代,已并入设计文档)

1. **A 流水线胜出**(比看板直观)——主视图用流水线,看板的"阻塞/接力"信息融合为流水线卡点标注(🔴 等人工)
2. **血缘方向**:页面组件字段 → ADS 层 → DWS/DWD → 贴源表(从消费端往回看,最多四层)
3. **血缘随阶段演进**:ads-design(指标→ADS 绑定)→ sql-generate(+DWS/DWD 源)→ job-create(+贴源表)
4. **表级默认 + 点击下钻字段级**:图保持干净,详情面板承载字段绑定

## 复用方式

第二批血缘演进图(设计文档 §12)可直接参考 `lineage-evolution-final.html` 的:
- 三阶段按钮 + SVG 分层布局
- 节点点击下钻 + 上下游边高亮
- 图例与"✦ 本阶段新增"标记
