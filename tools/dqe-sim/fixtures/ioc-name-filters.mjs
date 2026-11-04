import dictionary from './ioc-dimension-values.json' with {type:'json'};
import offices from './ioc-opportunity-list.json' with {type:'json'};
import pageDatasets from './ioc-page-datasets.json' with {type:'json'};
const signatures=new Set([offices,...Object.values(pageDatasets.datasets)].map(data=>JSON.stringify([data.output_dims,data.output_metrics])));
const fields={'地区部':['region_dept_code','region-dept-code'],'代表处':['rep_office_code','rep-office-code'],'客户级别':['public_cloud_na_level']};
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
/** Synthetic backend aliases only; production field names remain the integrating application's contract. */
export function iocNameFilterItem(item){
 if(!record(item)||!record(item.filter)||!Array.isArray(item.filter.dims)||!signatures.has(JSON.stringify([item.output_dims,item.output_metrics])))return item;
 return {...item,filter:{...item.filter,dims:item.filter.dims.map(nameFilter)}};
}
function nameFilter(entry){
 if(!record(entry)||!Array.isArray(entry.dim_value_list))return entry;
 const field=fields[entry.dim_name];if(!field)return entry;
 const values=field[1]?dictionary.dimensions[field[1]].values:[];
 return {...entry,dim_name:field[0],dim_value_list:entry.dim_value_list.map(value=>values.find(item=>item.label===value)?.value??value)};
}
/** A complete authorized list in this local fixture, independent of requested Region. */
export function iocKeyOfficeCandidates(request){
 if(request.dimension!=='rep-office-name'||request.constraints?.booleans?.[request.filterId]!==true)return;
 return {kind:'values',candidates:[...new Set(offices.rows.filter(row=>row.is_key_office===true).map(row=>row.rep_office_name))].map(value=>({value,label:value}))};
}
