import { mkdir, writeFile } from "node:fs/promises";

const out = new URL("./working/ioc-project-overview.json", import.meta.url);
await mkdir(new URL("./working/", import.meta.url), { recursive: true });

const measure = (label, format = "number", nullable = false) => ({ type: "number", role: "measure", label, defaultFormat: format, ...(nullable ? { nullable: true } : {}) });
const dim = (label, nullable = false) => ({ type: "string", role: "dimension", label, ...(nullable ? { nullable: true } : {}) });
const f = (field, format) => format ? { data: "main", field, format } : field;

const page = {
  schemaVersion: "6.18",
  id: "ioc-project-overview",
  layout: "dashboard",
  meta: { title: "全球/区域作战地图", description: "匿名 inline 演示数据；筛选状态未接入真实查询。金额原值为元。" },
  dashboardToolbar: "visible",
  filters: [
    { id: "month", type: "timePoint", label: "月份", granularity: "month", required: true, default: "2026-03", urlParams: { value: "month" } },
    { id: "key-account", type: "boolean", label: "仅看重点国代", default: false },
    { id: "region", type: "dimension", dimension: "region-name", label: "地域", display: "select", emptyLabel: "全球", urlParams: { value: "region" } },
    { id: "project-level", type: "dimension", dimension: "project-level", label: "项目等级", display: "select", emptyLabel: "全部项目等级" },
    { id: "industry", type: "dimension", dimension: "industry", label: "产业", display: "select", emptyLabel: "全部产业" }
  ],
  dataSources: {
    "global-summary": {
      fields: {
        opportunity_count: measure("本月机会点数"), previous_opportunity_count: measure("上月机会点数"), opportunity_delta: measure("机会点较上月增减"),
        presign_amount: measure("本月预签金额", "cny-adaptive"), previous_presign_amount: measure("上月预签金额", "cny-adaptive"), presign_delta: measure("预签金额较上月增减", "cny-adaptive"),
        annual_sales_forecast: measure("年度销售预测", "cny-adaptive"), annual_target: measure("年度目标", "cny-adaptive"), stock_forecast: measure("存量预测", "cny-adaptive"), realized_revenue: measure("已实现收入", "cny-adaptive"),
        pipeline_denominator_step: measure("管道分母中间值", "cny-adaptive"), pipeline_denominator: measure("管道分母", "cny-adaptive"), remaining_valid_amount: measure("剩余有效机会点金额", "cny-adaptive"), pipeline_support_rate: measure("管道支撑率", "percent-1"),
        established_count: measure("已立项数量"), established_presign_amount: measure("已立项预签金额", "cny-adaptive"), operating_established_count: measure("运作中已立项数"), should_establish_count: measure("应立项数"), establishment_rate: measure("立项率", "percent-1"),
        held_meeting_count: measure("近60天已召开分析会数"), should_hold_meeting_count: measure("近60天应召开分析会数"), meeting_rate: measure("项目分析会召开率", "percent-1"),
        won_count: measure("赢单数"), closed_count: measure("已关闭机会点数"), win_rate: measure("赢单率", "percent-1"), should_review_count: measure("应复盘数"), reviewed_count: measure("已复盘数"), review_rate: measure("复盘率", "percent-1")
      },
      source: { type: "inline", rows: [{ opportunity_count:270, previous_opportunity_count:255, presign_amount:359000000, previous_presign_amount:337000000, annual_sales_forecast:276000000, annual_target:470000000, stock_forecast:85000000, realized_revenue:55000000, remaining_valid_amount:241000000, established_count:126, established_presign_amount:208000000, operating_established_count:126, should_establish_count:180, held_meeting_count:72, should_hold_meeting_count:100, won_count:46, closed_count:85, should_review_count:65, reviewed_count:46 }] },
      compute: [
        { op:"delta", minuend:"opportunity_count", subtrahend:"previous_opportunity_count", output:"opportunity_delta" },
        { op:"delta", minuend:"presign_amount", subtrahend:"previous_presign_amount", output:"presign_delta" },
        { op:"delta", minuend:"annual_target", subtrahend:"stock_forecast", output:"pipeline_denominator_step" },
        { op:"delta", minuend:"pipeline_denominator_step", subtrahend:"realized_revenue", output:"pipeline_denominator" },
        { op:"ratio", numerator:"remaining_valid_amount", denominator:"pipeline_denominator", output:"pipeline_support_rate", onZeroDenominator:"zero" },
        { op:"ratio", numerator:"operating_established_count", denominator:"should_establish_count", output:"establishment_rate", onZeroDenominator:"zero" },
        { op:"ratio", numerator:"held_meeting_count", denominator:"should_hold_meeting_count", output:"meeting_rate", onZeroDenominator:"zero" },
        { op:"ratio", numerator:"won_count", denominator:"closed_count", output:"win_rate", onZeroDenominator:"zero" },
        { op:"ratio", numerator:"reviewed_count", denominator:"should_review_count", output:"review_rate", onZeroDenominator:"zero" }
      ]
    },
    "opportunity-categories": { fields:{ category:dim("机会点分类"), count:measure("数量"), amount:measure("预签金额","cny-adaptive") }, source:{ type:"inline", rows:[{category:"卓越",count:90,amount:120000000},{category:"战略",count:100,amount:145000000},{category:"核心",count:80,amount:94000000}] } },
    "level-categories": { fields:{ category:dim("项目层级"), count:measure("数量"), amount:measure("预签金额","cny-adaptive") }, source:{ type:"inline", rows:[{category:"公司特级",count:30,amount:60000000},{category:"公司级",count:60,amount:100000000},{category:"地区部级",count:36,amount:48000000},{category:"代表处级",count:0,amount:0}] } },
    "reward-categories": { fields:{ category:dim("奖惩类别"), count:measure("数量") }, source:{ type:"inline", rows:[{category:"金牌",count:8},{category:"银牌",count:12},{category:"红牌",count:3},{category:"黄牌",count:5}] } },
    "regional-overview": { fields:{ rank:measure("排名"), region:dim("区域"), office:dim("代表处"), presign_amount:measure("预签金额","cny-adaptive"), pipeline_support_rate:measure("管道支撑率","percent-1"), meeting_rate:measure("项目分析会召开率","percent-1"), establishment_rate:measure("立项率","percent-1"), new_signed_amount:measure("本月新签单金额","cny-adaptive") }, source:{ type:"inline", rows:[
      {rank:1,region:"欧洲",office:"德国",presign_amount:75000000,pipeline_support_rate:1.2857142857,meeting_rate:0.7,establishment_rate:0.75,new_signed_amount:12000000},
      {rank:2,region:"中国",office:"北京",presign_amount:180000000,pipeline_support_rate:0.6666666667,meeting_rate:0.8,establishment_rate:0.75,new_signed_amount:18000000},
      {rank:3,region:"中国",office:"上海",presign_amount:95000000,pipeline_support_rate:0.4545454545,meeting_rate:0.6,establishment_rate:0.6,new_signed_amount:9000000},
      {rank:4,region:"亚太",office:"新加坡",presign_amount:9000000,pipeline_support_rate:0,meeting_rate:0,establishment_rate:0,new_signed_amount:0}
    ] } },
    "top-projects": { fields:{ month:dim("月份"), project_id:dim("项目标识"), project_name:dim("项目名称"), presign_amount:measure("预签金额","cny-adaptive"), annual_sales_forecast:measure("年度销售预测","cny-adaptive"), win_probability:measure("赢率","percent-1") }, source:{ type:"inline", rows:[
      {month:"2026-03",project_id:"DEMO-P01",project_name:"云平台升级",presign_amount:35000000,annual_sales_forecast:22000000,win_probability:0.75},
      {month:"2026-03",project_id:"DEMO-P02",project_name:"行业云项目",presign_amount:28000000,annual_sales_forecast:18000000,win_probability:0.60}
    ] } },
    "lost-projects": { fields:{ month:dim("月份"), project_id:dim("项目标识"), opportunity_name:dim("机会点名称"), presign_amount:measure("预签金额","cny-adaptive"), loss_reason:dim("丢单原因") }, source:{ type:"inline", rows:[
      {month:"2026-03",project_id:"DEMO-P03",opportunity_name:"数据平台机会点C",presign_amount:15000000,loss_reason:"预算取消"},
      {month:"2026-03",project_id:"DEMO-P04",opportunity_name:"容器平台机会点D",presign_amount:8000000,loss_reason:"竞争方案胜出"}
    ] } },
    "map-regions": { fields:{ map_name:dim("底图国家名称"), region_name:dim("业务地区"), opportunity_count:measure("机会点数", "number", true), presign_amount:measure("预签金额","cny-adaptive",true), annual_sales_forecast:measure("年度销售预测","cny-adaptive",true), pipeline_support_rate:measure("管道支撑率","percent-1",true) }, source:{ type:"inline", rows:[
      {map_name:"China",region_name:"中国",opportunity_count:200,presign_amount:275000000,annual_sales_forecast:180000000,pipeline_support_rate:0.5789473684},
      {map_name:"Germany",region_name:"欧洲",opportunity_count:50,presign_amount:75000000,annual_sales_forecast:90000000,pipeline_support_rate:1.2857142857},
      {map_name:"Singapore",region_name:"亚太",opportunity_count:20,presign_amount:9000000,annual_sales_forecast:6000000,pipeline_support_rate:0},
      {map_name:"Kazakhstan",region_name:"中东中亚",opportunity_count:null,presign_amount:null,annual_sales_forecast:null,pipeline_support_rate:null},
      {map_name:"Egypt",region_name:"北部非洲",opportunity_count:null,presign_amount:null,annual_sales_forecast:null,pipeline_support_rate:null},
      {map_name:"South Africa",region_name:"南部非洲",opportunity_count:null,presign_amount:null,annual_sales_forecast:null,pipeline_support_rate:null},
      {map_name:"Brazil",region_name:"拉美",opportunity_count:null,presign_amount:null,annual_sales_forecast:null,pipeline_support_rate:null},
      {map_name:"Russia",region_name:"俄罗斯",opportunity_count:null,presign_amount:null,annual_sales_forecast:null,pipeline_support_rate:null}
    ] } }
  },
  sections: [
    { id:"scope-note", container:"plain", components:[{ id:"scope-text", type:"text", layout:{span:12}, props:{variant:"riskNotice", body:"当前选择状态由顶部控件展示；页面使用 2026-03 inline 演示数据，控件变化不会触发真实筛选取数。分类行是演示分配，汇总与项目样例不可相加对账。"} }] },
    { id:"summary-cards", container:"plain", components:[
      { id:"opportunity-card", type:"compositeCard", layout:{span:4}, props:{title:"机会点概况", titleIcon:"opportunity", variant:"metricGrid", components:[
        {id:"opportunity-headline",type:"metricCard",layout:{span:12},data:{main:"global-summary"},props:{variant:"compactStrip",rows:[
          {label:"机会点数",valueField:"opportunity_count",unit:"个",changes:[{label:"较上月",field:f("opportunity_delta"),unit:"个"}]},
          {label:"总预签金额",valueField:f("presign_amount"),changes:[{label:"较上月",field:f("presign_delta")}]},
          {label:"年度销售预测",valueField:f("annual_sales_forecast")},
          {label:"年度管道支撑率",valueField:f("pipeline_support_rate")}
        ]}},
        {id:"opportunity-pie",type:"pieChart",layout:{span:5},data:{main:"opportunity-categories"},props:{variant:"compactRing",categoryField:"category",valueField:"count"}},
        {id:"opportunity-breakdown",type:"categoryBreakdown",layout:{span:7},data:{main:"opportunity-categories"},props:{variant:"compactList",categoryField:"category",columns:[{label:"数量",field:"count"},{label:"预签金额",field:"amount"}],swatches:true}}
      ]}},
      { id:"level-card", type:"compositeCard", layout:{span:4}, props:{title:"项目分层分级管理", variant:"metricGrid", components:[
        {id:"level-headline",type:"metricCard",layout:{span:12},data:{main:"global-summary"},props:{variant:"compactStrip",rows:[
          {label:"已立项数量",valueField:"established_count",unit:"个"},{label:"已立项预签金额",valueField:"established_presign_amount"},{label:"立项率",valueField:"establishment_rate"},{label:"近60天项目分析会召开率",valueField:"meeting_rate"},{label:"赢单率",valueField:"win_rate"}
        ]}},
        {id:"level-pie",type:"pieChart",layout:{span:5},data:{main:"level-categories"},props:{variant:"compactRing",categoryField:"category",valueField:"count"}},
        {id:"level-breakdown",type:"categoryBreakdown",layout:{span:7},data:{main:"level-categories"},props:{variant:"compactList",categoryField:"category",columns:[{label:"数量",field:"count"},{label:"预签金额",field:"amount"}],swatches:true}}
      ]}},
      { id:"review-card", type:"compositeCard", layout:{span:4}, props:{title:"复盘总结", variant:"metricGrid", components:[
        {id:"review-headline",type:"metricCard",layout:{span:12},data:{main:"global-summary"},props:{variant:"compactStrip",rows:[{label:"应复盘",valueField:"should_review_count",unit:"个"},{label:"已复盘",valueField:"reviewed_count",unit:"个"},{label:"复盘率",valueField:"review_rate"}]}},
        {id:"reward-pie",type:"pieChart",layout:{span:5},data:{main:"reward-categories"},props:{title:"及时奖惩（固定类别色）",variant:"compactRing",categoryField:"category",valueField:"count"}},
        {id:"reward-breakdown",type:"categoryBreakdown",layout:{span:7},data:{main:"reward-categories"},props:{variant:"compactList",categoryField:"category",columns:[{label:"数量",field:"count"}],swatches:true}}
      ]}}
    ]},
    { id:"detail-and-map", container:"plain", components:[
      {id:"details",type:"tabContainer",layout:{span:5},props:{variant:"analysisStack",defaultTab:"overview",tabs:[
        {id:"overview",label:"概览",component:{id:"overview-table",type:"table",layout:{span:12},data:{main:"regional-overview"},props:{fit:"container",pagination:{mode:"local",pageSize:10},columns:[{field:"rank",title:"排名",sortable:true},{field:"region",title:"区域"},{field:"office",title:"代表处"},{field:"presign_amount",title:"预签金额",sortable:true},{field:"pipeline_support_rate",title:"管道支撑率",sortable:true},{field:"meeting_rate",title:"项目分析会召开率",sortable:true},{field:"establishment_rate",title:"立项率",sortable:true},{field:"new_signed_amount",title:"本月新签单金额",sortable:true}]}}},
        {id:"top",label:"TOP预签项目",component:{id:"top-table",type:"table",layout:{span:12},data:{main:"top-projects"},props:{fit:"container",pagination:{mode:"local",pageSize:10},columns:[{field:"project_name",title:"项目名称",link:true,navigate:{href:"/pages/ioc-project-detail",query:{project:{source:"row",field:"project_id"},month:{source:"row",field:"month"}}}},{field:"presign_amount",title:"预签金额",sortable:true},{field:"annual_sales_forecast",title:"年度销售预测",sortable:true},{field:"win_probability",title:"赢率",sortable:true}]}}},
        {id:"lost",label:"丢单项目",component:{id:"lost-table",type:"table",layout:{span:12},data:{main:"lost-projects"},props:{fit:"container",pagination:{mode:"local",pageSize:10},columns:[{field:"opportunity_name",title:"机会点名称",link:true,navigate:{href:"/pages/ioc-project-detail",query:{opportunity:{source:"row",field:"project_id"},month:{source:"row",field:"month"}}}},{field:"presign_amount",title:"预签金额",sortable:true},{field:"loss_reason",title:"丢单原因"}]}}}
      ]}},
      {id:"world-map",type:"mapChart",layout:{span:7},data:{main:"map-regions"},props:{variant:"regionalOverview",title:"世界地域管道支撑率（代表国家着色）",map:"world",nameField:"map_name",valueField:"pipeline_support_rate",legend:{title:"管道支撑率",bands:[{label:"0",from:0},{label:"1%~50%",from:0.01},{label:"51%~80%",from:0.51},{label:"80%以上",from:0.8}]},tooltipFields:[{label:"地域",field:"region_name"},{label:"机会点数",field:"opportunity_count"},{label:"预签金额",field:"presign_amount"},{label:"年度销售预测",field:"annual_sales_forecast"},{label:"管道支撑率",field:"pipeline_support_rate"}]}}
    ]},
    { id:"navigation-gap", container:"plain", components:[{id:"opportunity-list-link",type:"text",layout:{span:12},props:{variant:"insight",body:"地域访问路径目标：全球 → 地区部 → 代表处 → 机会点清单。当前 inline 样例只完成全球层的地区展示；代表处全量层级与地图点击联动待真实层级数据和查询接入。",links:[{label:"进入机会点清单（静态入口）",href:"/pages/ioc-opportunity-list",query:{month:{source:"filter",id:"month"},region:{source:"filter",id:"region"}}}]}}]}
  ]
};

await writeFile(out, JSON.stringify(page, null, 2) + "\n", "utf8");
