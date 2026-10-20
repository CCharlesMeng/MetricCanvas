import type { RuntimeDataGateway } from '@metriccanvas/engine';

/** Only /pages/ioc-header-selection opts into this deterministic local fixture. */
export const iocSelectionCandidates = {
  demo_region:[{value:'CN',label:'中国地区部'},{value:'CN-SZ',label:'深圳代表处',parentValue:'CN'},{value:'CN-BJ',label:'北京代表处',parentValue:'CN'},{value:'CN-HQ',label:'总部',parentValue:'CN'},{value:'EU',label:'欧洲地区部'},{value:'EU-DE',label:'德国代表处',parentValue:'EU'},{value:'EU-HQ',label:'总部',parentValue:'EU'}],
  demo_industry:[{value:'MAN',label:'制造'},{value:'AUTO',label:'汽车制造',parentValue:'MAN'},{value:'AUTO-EV',label:'新能源汽车',parentValue:'AUTO'},{value:'AUTO-CV',label:'商用汽车',parentValue:'AUTO'},{value:'ICT',label:'信息通信'}],
  demo_business:[{value:'CLOUD',label:'云业务'},{value:'CLOUD-PRIVATE',label:'私有云',parentValue:'CLOUD'},{value:'CLOUD-PUBLIC',label:'公有云',parentValue:'CLOUD'}],
  demo_category:[{value:'NA1',label:'卓越 NA'},{value:'NA2',label:'战略 NA'},{value:'NA3',label:'核心 NA'},{value:'SMB',label:'商业客户 SMB'}],
  demo_model:[{value:'DIRECT',label:'直销'},{value:'PARTNER',label:'伙伴协同'}],
  demo_legacy:[{value:'CN/SZ',label:'中国/深圳代表处'},{value:'CN/BJ',label:'中国/北京代表处'},{value:'EU/DE',label:'欧洲/德国代表处'}]
};
const rows = [
 {name:'算力中心升级项目',region:'CN-SZ',category:'NA1',amount:120000},
 {name:'云平台建设项目',region:'CN-BJ',category:'NA2',amount:83000},
 {name:'海外网络升级项目',region:'EU-DE',category:'SMB',amount:62000}
];
export const iocSelectionGateway: RuntimeDataGateway = {
 async fetchDimensionValues(dimension) {
   const candidates = iocSelectionCandidates[dimension as keyof typeof iocSelectionCandidates];
   return candidates ? {kind:'values',candidates:structuredClone(candidates)} : {kind:'unavailable'};
 },
 async fetchData(query) {
   const dims = query.filterValues.filter(filter => filter.target === 'dimension');
   return {rows:rows.filter(row => dims.every(dim => {
     if (dim.queryField === 'demo_region') return dim.values.some(value => value === row.region || value === 'CN' && row.region.startsWith('CN-') || value === 'EU' && row.region.startsWith('EU-'));
     if (dim.queryField === 'demo_category') return dim.values.includes(row.category);
     return true;
   }))};
 }
};
