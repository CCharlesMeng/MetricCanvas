/** 仅用于伙伴健康度自动化测试；各粒度分数是预设演示值，不代表业务聚合公式。 */
export const scoreMetrics = [
  '助手-现网-合同商务看板-对象-合作意愿感知得分', '伙伴声音闭环率得分',
  '助手-现网-合同商务看板-对象-客户对伙伴的评价得分', '助手-现网-合同商务看板-对象-伙伴商业市场Core收入得分',
  '伙伴健康度-区域专职团队认证达标率得分', '伙伴健康度-区域价值客户付费占比得分',
  '伙伴健康度-区域价值客户数增长得分', '伙伴健康度-区域价值云经销商付费占比得分',
  '伙伴健康度-区域价值云经销商数增长得分', '伙伴健康度-区域能力标签伙伴得分',
  '助手-现网-合同商务看板-对象-伙伴健康度扣分项'
];
export type ScoreVector = ReadonlyArray<number | null>;
export interface Office {site: string; department: string; name: string; scores: ScoreVector}
const china = [21,4.5,26,4,4.2,3.7,3.8,4.1,3.6,8.4,-2];
const overseas = [19.2,3.8,24,3.6,3.8,3.2,3,3.4,3.1,7.7,-4];
export const scopeScores: Record<string, ScoreVector> = {
  '全部': [20.2,4.2,25.4,3.9,4,3.5,3.3,3.8,3.4,8,-3], '中国区': china, '海外': overseas,
  '华东地区部': [22,4.4,27,4.2,4,4,3.9,4.2,3.8,8.6,-1],
  '华南地区部': [20,4.1,25,3.5,4,null,3.2,3.8,3,7.8,-3],
  '亚太地区部': [20.5,4,25.5,4,4.1,3.6,3.5,3.8,3.4,8.2,-2],
  '拉美地区部': [17.5,3.2,22,3.2,3.3,2.8,2.4,3,2.5,6.9,-5]
};
export const offices: readonly Office[] = [
  {site:'中国区',department:'华东地区部',name:'上海代表处',scores:[23,4.7,28,4.3,4.4,4.1,4.2,4.5,4.2,9,-1]},
  {site:'中国区',department:'华东地区部',name:'杭州代表处',scores:[21,4.1,26,4,3.6,3.9,3.6,3.9,3.4,8.2,-1]},
  {site:'中国区',department:'华南地区部',name:'深圳代表处',scores:[22,4.6,27,4.1,4.3,4,3.8,4.2,3.6,8.7,-2]},
  {site:'中国区',department:'华南地区部',name:'广州代表处',scores:[18,3.6,23,2.9,3.7,null,2.6,3.4,2.4,6.9,-4]},
  {site:'海外',department:'亚太地区部',name:'新加坡代表处',scores:[22,4.5,27,4.2,4.4,3.9,3.9,4.1,3.7,8.8,-1]},
  {site:'海外',department:'亚太地区部',name:'泰国代表处',scores:[19,3.5,24,3.8,3.8,3.3,3.1,3.5,3.1,7.6,-3]},
  {site:'海外',department:'拉美地区部',name:'巴西代表处',scores:[18,3.5,23,3.4,3.5,3,2.7,3.2,2.8,7.3,-4]},
  {site:'海外',department:'拉美地区部',name:'智利代表处（全缺项示例）',scores:Array(11).fill(null)}
];
export function organizationFields(office: Office): Record<string,string> {
  return {data_site_type:office.site,geo_pc_name_cn:office.site,'地区部':office.department,
    region_dept_name_cn:office.department,'代表处':office.name,rep_office_name_cn_fin:office.name,rep_office_name_cn:office.name};
}
