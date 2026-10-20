export const regionNodes=[
  {id:'region:EU',label:'欧洲地区部',children:[{id:'office:DE',label:'德国代表处',children:[]},{id:'office:FR',label:'法国代表处',children:[]}]},
  {id:'region:AP',label:'亚太地区部',children:[{id:'office:TH',label:'泰国代表处',children:[]},{id:'office:SG',label:'新加坡代表处',children:[]}]}
];
export const industryNodes=[
  {id:'industry:public',label:'公共事业',children:[{id:'industry:gov',label:'政府',children:[]},{id:'industry:edu',label:'教育',children:[]}]},
  {id:'industry:enterprise',label:'企业',children:[{id:'industry:finance',label:'金融',children:[]},{id:'industry:manufacture',label:'制造',children:[]}]}
];
export const stateChoices=[['ready','就绪'],['idle','未请求'],['loading','加载中'],['empty','空'],['failed','失败'],['unavailable','不可用'],['readonly','只读'],['denied','无权限'],['unconfigured','无配置']];
export const stateText:Record<string,string>=Object.fromEntries(stateChoices);
export const actionChoices=[['theme','主题'],['fullscreen','全屏'],['xlsx','表格 XLSX'],['pdf','整页 PDF'],['refresh','刷新'],['reset','重置'],['apply','查询/应用'],['search','全页搜索（能力边界）']];
export type Entity={id:string;name:string;tags:string[]};
export function entityAt(i:number):Entity{return {id:'PRJ-2026-'+String(i+1).padStart(6,'0'),name:'商业客户算力平台升级项目 '+(i+1),tags:i%2?['一般项目','方案阶段','计算']:['重点项目','验证阶段','计算']};}
export const tagTone:Record<string,string>={'已立项':'green','重点项目':'blue','一般项目':'neutral','方案阶段':'amber','验证阶段':'blue','计算':'blue','海外':'green','跨 BG 协同':'amber','年度跟踪':'neutral'};
