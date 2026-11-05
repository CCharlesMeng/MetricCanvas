import type {DimensionFilterDeclaration} from './filter';
import type {IocHeaderControl,IocHeaderDeclaration} from './schema/ioc-header';

/** Child identity is independent from the existing public filter identity. */
export function iocHeaderControlFilterId(control:IocHeaderControl):string {
  return control.type==='regionFilter'?'region':control.props.filterId;
}

export function iocHeaderFilterIds(header:IocHeaderDeclaration):string[] {
  return header.components?.map(iocHeaderControlFilterId)??header.filterIds??[];
}

/** The Operation Map organization control has one product-owned declaration. */
export function standardIocRegionFilter():DimensionFilterDeclaration {
  return {
    id:'region',type:'dimension',dimension:'geo-pc-code',label:'区域',emptyLabel:'区域',
    display:'tree',treeSelection:'level',selection:{mode:'single'},defaultLevel:'geo',
    hierarchy:[
      {id:'geo',dimension:'geo-pc-code',label:'全球'},
      {id:'region-dept',dimension:'region-dept-code',label:'地区部'},
      {id:'office',dimension:'rep-office-code',label:'代表处'}
    ]
  };
}
