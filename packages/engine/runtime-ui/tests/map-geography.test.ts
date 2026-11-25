import {automaticMapFocus} from "../../widgets/src/components/map-chart/auto-focus";
import {describe,it,expect} from 'vitest';
import {mapGeographyZ} from '../../../page/src/schema/map-geography';
import {hasRegionMapRouting, resolveRegionMapViewport, selectedViewport} from '../src/region-map';
import {mapRows,resolvePlacement} from '../../widgets/src/components/map-chart/geography';

const request = {basemap:'world',level:'region-dept',value:'欧洲地区部'} as const;
const host = mapGeographyZ.parse({world:{'region-dept':{'欧洲地区部':{point:{lngLat:[21,52.13]},viewport:{center:[20.7129,60.166],zoom:3}}}}});

describe('组织地理资料',()=>{
  it('只传显示名不会启用地理适配的 Region 点击路径',()=>{
    const displayNames={'region-dept':{'欧洲地区部':'欧洲'}};
    expect(hasRegionMapRouting({displayNames})).toBe(false);
    expect(hasRegionMapRouting({geography:host,displayNames})).toBe(true);
    expect(hasRegionMapRouting({})).toBe(true);
  });
  it('镜头逐字段合并，优先级为页面、OM 公共资料、动态回执',async()=>{
    const dynamic=await resolveRegionMapViewport({resolveViewport:async()=>({center:[0,0],zoom:1})},request,new AbortController().signal);
    const page=mapGeographyZ.parse({world:{'region-dept':{'欧洲地区部':{viewport:{zoom:6.4}}}}});
    expect(selectedViewport({host,page},request,dynamic)).toEqual({center:[20.7129,60.166],zoom:6.4});
    expect(host.world?.['region-dept']?.['欧洲地区部']?.viewport?.zoom).toBe(3);
    expect(selectedViewport({page},request)).toBeUndefined();
  });
  it('点位整体覆盖，空多边形清单可取消公共着色',()=>{
    const base={point:{feature:'Germany'},features:['Germany','France']};
    expect(resolvePlacement(base,{point:{lngLat:[21,52]},features:[]},'France','欧洲地区部')).toEqual({point:{lngLat:[21,52]},features:[]});
    expect(resolvePlacement(base,undefined,'France','德国代表处').point).toEqual({feature:'France'});
  });
  it('多组织重叠区域不能选择任一组织，散点各自保留原始行',()=>{
    const first={org:'A'},second={org:'B'};
    const page=mapGeographyZ.parse({world:{office:{A:{features:['Germany','France']},B:{features:['Germany']}}}});
    const displayNames={office:{A:'Abbr',B:'Abbr'}};
    const result=mapRows([first,second],'org',{map:'world',nameField:'org',valueField:'value',hierarchyFilter:'region',parentField:'dept',codeField:'org'},{page,displayNames});
    expect(result.areas.get('Germany')).toBeUndefined();
    expect(result.areas.get('France')).toBe(first);
    expect(result.points.get('B')).toBe(second);
    expect(result.points.get('A')).toBe(first);
    expect(result.displayNames).toEqual(new Map([[first,'Abbr'],[second,'Abbr']]));
  });
  it('拒绝越界坐标、非正缩放和混合点位',()=>{
    for(const entry of [{viewport:{center:[300.7129,0.166]}},{viewport:{zoom:0}},{point:{lngLat:[0,0],feature:'France'}}]) {
      expect(mapGeographyZ.safeParse({world:{office:{A:entry}}}).success).toBe(false);
    }
  });
});

describe('区域概览的自动聚焦', () => {
  const props = {map:'world', nameField:'name', valueField:'value', hierarchyFilter:'region', parentField:'dept', codeField:'id'} as const;
  const geography = {page:mapGeographyZ.parse({world:{'region-dept':{一区:{point:{feature:'Anchor'}}},office:{
    A:{point:{lngLat:[10,20]}}, B:{point:{lngLat:[30,40]}}, C:{point:{lngLat:[100,0]}}
  }}})};
  const locations = mapRows([
    {id:'A', name:'甲', dept:'一区'}, {id:'B', name:'乙', dept:'一区'}, {id:'C', name:'丙', dept:'二区'}
  ], 'name', props, geography);
  const map = {centers:new Map(), bounds:new Map<string, [[number, number], [number, number]]>([['Anchor', [[0,0], [1,1]]]])};

  it('单坐标按原始组织值居中放大，无法定位则回退', () => {
    expect(automaticMapFocus(props,{level:'office',value:'A'},geography,locations,map)).toEqual({center:[10,20],zoom:4});
    expect(automaticMapFocus(props,{level:'office',value:'未知'},geography,locations,map)).toBeUndefined();
  });

  it('地区部按所属代表处取景，排除其他地区部的行', () => {
    expect(automaticMapFocus(props,{level:'region-dept',value:'一区'},geography,locations,map))
      .toEqual({boundingCoords:[[7.6,17.6],[32.4,42.4]]});
  });
});
