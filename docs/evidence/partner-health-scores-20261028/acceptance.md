> 原始运行附件留在主项目 `.scratch/partner-health-delivery-20261028/evidence/` 对应目录，未纳入版本管理。

> 本文保留本地主项目的开发期记录（Schema6.70、基线9ee7e6ac6）；最终 main 交付基于更新基线、Schema6.71，结果以 [交付复验](../partner-health-delivery-20261028/README.md) 为准。

# 伙伴健康度两层加法：2026-10-28

## 已确认口径

后端按所选范围返回已加权的11个子项得分。前端只在同一行内计算，不乘表头权重、不纵向汇总地区部或代表处得分。感知=合作意愿+声音闭环；满意度=客户评价；能力贡献=商业Core+认证+客户付费+客户增长+云经销商付费+云经销商增长+服务标签；风险直接使用负数；总分=四类相加。null/缺失数值按0参与，单字段分类和全缺项也输出真实数值0。无结果行不造组织，查询失败、响应缺少声明的queryField、非法非空数值、溢出不当作0。

日期和区域范围共享。区域筛选可切换区域/地区部/代表处层级，并选择具体组织；查询用levelQueryFields显式下推字段。中国区/海外仅控制顶部指标卡和图表；上方图表与下方表格的地区部/代表处页签各自独立。

## 页面与查询变化

覆盖 `pages/temporary/partner-health.json`，保留Dashboard布局、身份、展示结构与原有明细入口。附件首尾拼接补最后一个大括号，原文规范化见input-normalized.json；before.json保存覆盖前页面。

原来三个顶部inline示例源改为动态查询；五个得分源分别是整体、顶部地区部、顶部代表处、下表地区部、下表代表处。每个查询输出同一组11项业务指标，分组维度分别为空、地区部、rep_office_name_cn_fin。将输入中的单指标查询合并为同粒度多指标查询；每个queryField/业务指标名从附件复制，未引入新指标。整体取后端整体口径，不由各组织分数相加得到。图表与表格都读取compute结果；原始得分映射到raw-*，单字段sumFields归零后再合成四类和总分。无source.initial，无静态得分作为回退。

全局旧level筛选移入region层级，避免把“地区部”字面值绑定到组织名称；原明细源同步消费共享region，移除顶部中国区/海外依赖。旧区域伙伴详情保留为独立空pending源，没有把地区汇总行冒充伙伴明细。其他原有inline明细仍是示例。

多指标查询可执行性、组织维度和值字典、data_site_type的中国区/海外编码、指标在整体粒度的语义仍须真实业务DQE验证。本机仅有DQE Sim；合成拦截返回不属于真实服务验真。

## 最小协议更新

现有sumFields的ignore在全缺时返回null。Schema6.70增加onMissing:"zero"并允许单字段fields；zero对null/undefined按0，全部缺项也为0。旧null和ignore语义保留，新声明在6.69及以下拒绝。产品Schema、能力下限、运行时、参考、合法契约夹具与local-authoring1.6.0同批同步。新完整声明见pages/capabilities/data/sum-fields-zero.json，inline合成数据仅用于能力验收。

## 验证

- `pnpm test packages/page/tests`：92文件、980项通过。
- 页面计算、运行时计算/依赖、版本及local-authoring相关检查共240项；首次因旧升级演示仍写6.69失败，按当前写出版本更新schema-upgrade-demo至6.70后，受影响104项复验通过，其余136项已通过。
- `pnpm exec tsc --noEmit -p tests/tsconfig.json`：通过。
- 独立local-authoring完整页面校验通过；attempt-final保留校验前原始字节和SHA256。
- 浏览器合成验收与截图见browser-verification.json及PNG；实际验收入口为主项目http://localhost:5193/pages/partner-health（合成HTTP拦截仅存在验收脚本，普通打开仍使用当前集成应用的DQE配置）。当前主项目checkout路径为 `/Users/moon/Documents/Code/公司项目/DataDashboard`，基线9ee7e6ac6；主项目未提交改动保持。完整请求不含生产凭据。
- 导出/MC/仓外独立安装与最终复验结果由verification.json记录；未完成项不得由本段推定通过。

## 复杂度

工具metriccanvas-ts-ast/1，TypeScript5.9.3，口径selfCC（每个函数独立，包含回调；可选链单列）。applyOperator 8→8，移出的求和回调原自身CC4，新sumFields自身CC8；新映射回调CC1。能力探测usedAt及其两层回调分别1/2/4；本次测试全部新增回调CC1–2；浏览器验收脚本主流程CC10、合成响应映射CC13，其余回调CC1–2（完整测量见browser-complexity.json）。无本次修改/新增函数超过15，未关闭项0。前后完整实测文件见complexity-before.json/complexity-final.json；同文件其他未改存量函数不在本批重构范围。

没有提交、推送、CI或线上发布，真实DQE未运行。

最终收口：authoring:contracts:check、MC来源覆盖、MC33项测试、最终诊断夹具检查均分项通过。完整mc:content:check早期受系统Python缺依赖及版本夹具过期影响，已用项目虚拟环境和官方生成器处理；最后未机械重跑已通过的33项测试。仓外独立Skill复制692个文件、无软链接，校验当前业务页通过。六项浏览器合成验收无pageerror或console error。临时工作树已归档，未提交或推送，保留主项目5193预览服务及其他任务原有工作树。
