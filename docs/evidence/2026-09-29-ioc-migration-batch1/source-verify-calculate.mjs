#!/usr/bin/env node
/**
 * 第一批页面计算规则的本地验证脚本
 * 证据基线：a260c10744add7fe013d5e4591fa1ecc407f8083
 *
 * 方法说明（任务 §九）：
 * - 以下函数均为从来源源码逐行复制的"最小提取函数"，复制范围见每项 source 注释；
 *   无手写新算法，无行为改动。
 * - 依赖 @cloud/ana 的 DataFilter 闭源格式化无法在 Node 直测（NOT-RUN），
 *   验证范围仅覆盖纯计算（算术/排序/分组/日期窗口）。
 * - 夹具为匿名值，不破坏类型/单位/关联键。
 */
'use strict';

let failures = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) {
    console.log(`      expected: ${JSON.stringify(expected)}`);
    console.log(`      actual:   ${JSON.stringify(actual)}`);
  }
}

/* ============ 提取自 long-term-contactless/calculate.ts（原样复制） ============ */
const validate = (value) => value !== null && value !== undefined && !isNaN(value);
class IndicatorCalculate {
  SUBTRACT(pre, suffix) {
    if (!(validate(pre) && validate(suffix))) return null;
    return (pre - suffix);
  }
  DIVIDE(pre, suffix) {
    if (!(validate(pre) && validate(suffix)) || suffix === 0) return null;
    return (pre / suffix);
  }
}
const calculator = new IndicatorCalculate();

/* ============ 提取自 commercial-market/commercial-market.config.ts:407-411（原样） ============ */
const getCAGR = (beginningValue, endingValue, periods) => {
  return (Math.pow(endingValue / beginningValue, 1 / Number(periods)) - 1) * 100;
};

/* ============ 提取自 business-overview.datasource.ts:3-21（原样） ============ */
const calcMom = (currentMonth, preMonth) => {
  let mom = null;
  if (preMonth && preMonth !== 0) {
    mom = (currentMonth - preMonth) / preMonth * 100;
  } else {
    mom = 0;
  }
  return mom;
};
const calcCagr = (cagr_beginning, cagr_ending) => {
  let near_6_cagr = null;
  if (cagr_beginning && cagr_beginning > 0) {
    near_6_cagr = (Math.pow(cagr_ending / cagr_beginning, 1 / 6) - 1) * 100;
  } else {
    near_6_cagr = null;
  }
  return near_6_cagr;
};

/* ============ 提取自 customer-detail.datasource.ts:754-800（页面收入趋势，系统当前年对齐） ============ */
function buildRevenueTrend(rows) {
  const currentYear = new Date().getFullYear();
  const currentYearData = rows.filter(row => parseInt(row.mtime.substring(0, 4)) === currentYear);
  const lastYearData = rows.filter(row => parseInt(row.mtime.substring(0, 4)) === currentYear - 1);
  currentYearData.sort((a, b) => parseInt(a.mtime) - parseInt(b.mtime));
  lastYearData.sort((a, b) => parseInt(a.mtime) - parseInt(b.mtime));
  const monthLabels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  return monthLabels.map((month, index) => {
    const monthNum = index + 1;
    const currentMonthData = currentYearData.find(row => parseInt(row.mtime.substring(4, 6)) === monthNum);
    const lastYearMonthData = lastYearData.find(row => parseInt(row.mtime.substring(4, 6)) === monthNum);
    const currentRevenue = currentMonthData?.revenue_amt_sum || null;
    const lastYearRevenue = lastYearMonthData?.revenue_amt_sum || null;
    let growthRate = null;
    if (lastYearRevenue > 0 && currentRevenue !== null) {
      growthRate = ((currentRevenue - lastYearRevenue) / lastYearRevenue) * 100;
    }
    return { x_time: month, current_year_revenue: currentRevenue, last_year_revenue: lastYearRevenue, growth_rate: growthRate };
  });
}

/* ============ 提取自 customer-detail.datasource.ts:975-1047（云服务趋势，最后一行年份） ============ */
function buildCloudServiceTrend(rows) {
  if (!rows.length) return [];
  const trendData = [...rows].sort((a, b) => parseInt(a.mtime) - parseInt(b.mtime));
  const currentYear = parseInt(trendData[trendData.length - 1].mtime.substring(0, 4));
  const lastYear = currentYear - 1;
  const currentYearData = trendData.filter(row => parseInt(row.mtime.substring(0, 4)) === currentYear);
  const lastYearData = trendData.filter(row => parseInt(row.mtime.substring(0, 4)) === lastYear);
  const monthLabels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  return monthLabels.map((month, index) => {
    const monthNum = index + 1;
    const currentMonthData = currentYearData.find(row => parseInt(row.mtime.substring(4, 6)) === monthNum);
    const lastYearMonthData = lastYearData.find(row => parseInt(row.mtime.substring(4, 6)) === monthNum);
    const currentRevenue = currentMonthData?.revenue_amt_cny_sum ?? null;
    const currentPreRevenue = currentMonthData?.pre_revenue_amt_cny_sum ?? null;
    const lastYearRevenue = lastYearMonthData?.revenue_amt_cny_sum ?? null;
    const lastYearPreRevenue = lastYearMonthData?.pre_revenue_amt_cny_sum ?? null;
    let popCurrent = calculator.DIVIDE(calculator.SUBTRACT(currentRevenue, currentPreRevenue), currentPreRevenue);
    popCurrent = popCurrent === null ? null : popCurrent * 100;
    let popLast = calculator.DIVIDE(calculator.SUBTRACT(lastYearRevenue, lastYearPreRevenue), lastYearPreRevenue);
    popLast = popLast === null ? null : popLast * 100;
    return { x_time: month, current_year_revenue: currentRevenue, last_year_revenue: lastYearRevenue, pop_current: popCurrent, pop_last: popLast };
  });
}

/* ============ 提取自 token-specific-page.config.ts:212-232（getDateRange） ============ */
const getDateRange = (currentDateStr, days) => {
  const year = parseInt(currentDateStr.substring(0, 4));
  const month = parseInt(currentDateStr.substring(4, 6)) - 1;
  const day = parseInt(currentDateStr.substring(6, 8));
  const currentDate = new Date(year, month, day);
  const startDate = new Date(currentDate);
  startDate.setDate(startDate.getDate() - days);
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };
  return { startDate: formatDate(startDate), endDate: currentDateStr };
};

/* ============ 提取自 token-specific-page.config.ts:392-458（completeDailyData） ============ */
const completeDailyData = ({ data, startTime, endTime, dateField = 'dtime', emptyValueGenerator }) => {
  if (!startTime || !endTime || startTime.length !== 8 || endTime.length !== 8) {
    return data ?? [];
  }
  const allDates = [];
  const start = new Date(parseInt(startTime.slice(0,4)), parseInt(startTime.slice(4,6))-1, parseInt(startTime.slice(6,8)));
  const end = new Date(parseInt(endTime.slice(0,4)), parseInt(endTime.slice(4,6))-1, parseInt(endTime.slice(6,8)));
  const current = new Date(start);
  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    allDates.push(`${y}${m}${d}`);
    current.setDate(current.getDate() + 1);
  }
  const existingDataMap = new Map();
  (data ?? []).forEach(item => {
    const dateValue = item[dateField];
    if (dateValue) existingDataMap.set(dateValue, item);
  });
  return allDates.map(date => {
    if (existingDataMap.has(date)) return existingDataMap.get(date);
    if (emptyValueGenerator) return emptyValueGenerator(date);
    return { [dateField]: date, revenue_amt_sum: null, revenue_amt_prev_sum: null, revenue_amt_sum_pop: null };
  });
};

/* ============ 提取自 token-specific-page.config.ts:257-323（processModelTokenData 排序/TOP5） ============ */
const CommonUtil = {
  isNull: (v) => v === undefined || v === null,
};
function processModelTokenData(data, field) {
  if (!data || data.length === 0) return [];
  const sortedData = [...data].sort((a, b) => {
    const aValue = a[field];
    const bValue = b[field];
    const aShouldBeLast = CommonUtil.isNull(aValue) && CommonUtil.isNull(a.model_name);
    const bShouldBeLast = CommonUtil.isNull(bValue) && CommonUtil.isNull(b.model_name);
    if (aShouldBeLast && bShouldBeLast) return 0;
    if (aShouldBeLast) return 1;
    if (bShouldBeLast) return -1;
    if (CommonUtil.isNull(aValue) && CommonUtil.isNull(bValue)) return 0;
    if (CommonUtil.isNull(aValue)) return 1;
    if (CommonUtil.isNull(bValue)) return -1;
    const valueDiff = bValue - aValue;
    if (valueDiff !== 0) return valueDiff;
    const aModelEmpty = CommonUtil.isNull(a.model_name);
    const bModelEmpty = CommonUtil.isNull(b.model_name);
    if (aModelEmpty && bModelEmpty) return 0;
    if (aModelEmpty) return 1;
    if (bModelEmpty) return -1;
    return 0;
  });
  const totalSum = sortedData.reduce((sum, item) => sum + (item[field]), 0);
  if (sortedData.length <= 5) {
    return sortedData.map(item => ({
      model_name: CommonUtil.isNull(item.model_name) ? '--' : item.model_name,
      target_count: item[field],
      percent: calculator.DIVIDE(item[field], totalSum),
    }));
  } else {
    const top5 = sortedData.slice(0, 5);
    const otherModels = sortedData.slice(5);
    const otherSum = otherModels.reduce((sum, item) => sum + item[field], 0);
    const result = top5.map(item => ({
      model_name: CommonUtil.isNull(item.model_name) ? '--' : item.model_name,
      target_count: item[field],
      percent: calculator.DIVIDE(item[field], totalSum),
    }));
    result.push({ model_name: '其他', target_count: otherSum, percent: calculator.DIVIDE(otherSum, totalSum) });
    return result;
  }
}

/* ============ 提取自 token-specific-page.component.ts:501-586（表格分组/合并单元格） ============ */
function groupAndProcessTable(data, currentPage, pageSize) {
  const groups = new Map();
  data.forEach(item => {
    const uniqueValue = `${item.customer_name}_${item.account_name}`;
    if (!groups.has(uniqueValue)) groups.set(uniqueValue, []);
    groups.get(uniqueValue).push(item);
  });
  const result = [];
  let customerIndex = (currentPage - 1) * pageSize;
  groups.forEach((items, customerName) => {
    customerIndex++;
    const totalRow = items.find(item => item.model_name === '合计');
    const normalRows = items.filter(item => item.model_name !== '合计');
    normalRows.sort((a, b) => {
      if (a.total_tokens == null && b.total_tokens == null) return 0;
      if (a.total_tokens == null) return 1;
      if (b.total_tokens == null) return -1;
      return b.total_tokens - a.total_tokens;
    });
    const sortedItems = totalRow ? [...normalRows, totalRow] : normalRows;
    const rowCount = sortedItems.length;
    sortedItems.forEach((item, index) => {
      const isTotal = item.model_name === '合计';
      result.push({
        customer_name: item.customer_name,
        account_name: item.account_name,
        model_name: item.model_name,
        is_total: isTotal,
        rowSpan: index === 0 ? rowCount : 1,
        rowHide: index !== 0,
        customerIndex,
        customerIndex_show: customerIndex.toString(),
      });
    });
  });
  return result;
}

/* ============ 提取自 customer-detail-page.component.ts:602-612（frontendSortData） ============ */
function frontendSortData(sortKey, asc, tableData) {
  tableData.sort((a, b) => {
    if (a[sortKey] === null || a[sortKey] === undefined) return 1;
    if (b[sortKey] === null || b[sortKey] === undefined) return -1;
    return asc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey];
  });
}

/* ============ 提取自 project-home-page.component.ts:451-518（setOverviewSummaryData 核心） ============ */
function computeSupportCoverage(overviewSummaryData, flowForecastData, revenueTargetData, realizedRevenueRestData) {
  const dAggregated = flowForecastData?.reduce((acc, item) => {
    const key = `${item.region_dept_code_fin}_${item.rep_office_code_fin}`;
    if (!acc[key]) acc[key] = 0;
    acc[key] += item.stock_forecast_revenue_amt_sum;
    return acc;
  }, {});
  const fAggregated = revenueTargetData?.reduce((acc, item) => {
    const key = `${item.region_dept_code_fin}_${item.rep_office_code_fin}`;
    if (!acc[key]) acc[key] = 0;
    acc[key] += item.target_revenue_amt_cny;
    return acc;
  }, {});
  const eAggregated = realizedRevenueRestData?.reduce((acc, item) => {
    const key = `${item.region_code}_${item.repoffice_code}`;
    if (!acc[key]) acc[key] = 0;
    acc[key] += item.ytd_amt;
    return acc;
  }, {});
  return overviewSummaryData?.map((item) => {
    const key = `${item.region_dept_code_fin}_${item.rep_office_code_fin}`;
    const stockForecastRevenueAmtSum = dAggregated?.[key] || 0;
    const targetRevenueAmt = fAggregated?.[key] || 0;
    const ytdAmt = eAggregated?.[key] || 0;
    const denominator = targetRevenueAmt - stockForecastRevenueAmtSum - ytdAmt;
    const annual_pip_supp_rate_pct = [0, null, undefined].includes(denominator)
      ? 0
      : (item.effective_opportunity_remaining_amount_current_sum || 0) / denominator;
    return { ...item, support_coverage: annual_pip_supp_rate_pct };
  }) || [];
}

/* ============ 提取自 business-overview.component.ts:1762-1812（概览表合并） ============ */
function mergeOverviewTable(income_table_data, salesRate_table_data) {
  const newArr = [...(Array.isArray(income_table_data) ? income_table_data : []), ...(Array.isArray(salesRate_table_data) ? salesRate_table_data : [])];
  const groupedData = {};
  newArr.forEach(item => {
    const k = item.repoffice_code;
    if (!groupedData[k]) groupedData[k] = [];
    groupedData[k].push(item);
  });
  const mergedData = [];
  for (const repOfficeCode in groupedData) {
    const repOfficeItems = groupedData[repOfficeCode];
    const repOfficeItem = repOfficeItems[0];
    const reportItemsMap = {};
    repOfficeItems.forEach(item => { reportItemsMap[item.report_item_code] = item; });
    mergedData.push({
      repoffice_code: repOfficeItem.repoffice_code,
      repoffice_cn_name: repOfficeItem.repoffice_cn_name,
      income_ytd_amt: reportItemsMap['GEO_PL_91000']?.ytd_amt || null,
      income_yoy_y: reportItemsMap['GEO_PL_91000']?.yoy_y || null,
      income_budget_completion_y_ratio: reportItemsMap['GEO_PL_91000']?.budget_completion_y_ratio || null,
      gross_profit_margin_ytd_amt: reportItemsMap['GEO_PL_10997']?.ytd_amt || null,
    });
  }
  return mergedData;
}

/* ============ 提取自 opportunity-list.component.ts:431-439（搜索转义） ============ */
function buildSearchParam(value) {
  const str = value.toLocaleLowerCase().replace(/'/g, "''");
  if (str) {
    return `and (LOWER(opportunity_name) like '%${str}%' or LOWER(party_company_name) like '%${str}%')`;
  }
  return '';
}

/* ============ 用例区 ============ */

console.log('== 决策4：直接减法 null/缺失语义（IndicatorCalculate.SUBTRACT） ==');
check('本期100-上期null → null', calculator.SUBTRACT(100, null), null);
check('本期100-上期字段缺失(undefined) → null', calculator.SUBTRACT(100, undefined), null);
check('本期100-上期0 → 100', calculator.SUBTRACT(100, 0), 100);
check('本期100-上期80 → 20', calculator.SUBTRACT(100, 80), 20);

console.log('== 决策2/决策1：比率消费者 0/null 各自口径 ==');
check('DIVIDE(100,0) → null（客户详情比率消费者）', calculator.DIVIDE(100, 0), null);
check('calcMom(100,null) → 0（经营概览环比消费者）', calcMom(100, null), 0);
check('calcMom(100,0) → 0（经营概览环比消费者）', calcMom(100, 0), 0);
check('calcMom(100,80) → 25', calcMom(100, 80), 25);
check('calcMom(80,100) → -20', calcMom(80, 100), -20);

console.log('== CAGR（getCAGR 期数参数化 vs calcCagr 固定6期） ==');
check('getCAGR(100,200,"6") → (2^(1/6)-1)*100', getCAGR(100, 200, '6'), (Math.pow(2, 1/6) - 1) * 100);
check('calcCagr(100,200) → 同6期', calcCagr(100, 200), (Math.pow(2, 1/6) - 1) * 100);
check('calcCagr(0,200) → null（begin≤0）', calcCagr(0, 200), null);
check('calcCagr(-5,200) → null', calcCagr(-5, 200), null);

console.log('== 页面收入趋势（系统当前年对齐；页面年份≠系统年） ==');
const sysYear = new Date().getFullYear();
const trendRows = [
  { mtime: `${sysYear}01`, revenue_amt_sum: 100 },
  { mtime: `${sysYear}02`, revenue_amt_sum: 120 },
  { mtime: `${sysYear - 1}02`, revenue_amt_sum: 80 },
  { mtime: `${sysYear - 1}12`, revenue_amt_sum: 90 },
  { mtime: `${sysYear - 2}06`, revenue_amt_sum: 999 }, // 页面所选年份的旧数据，不应进入双年窗口
];
const pageTrend = buildRevenueTrend(trendRows);
check('1月当年=100（上年无1月→null）', [pageTrend[0].current_year_revenue, pageTrend[0].last_year_revenue], [100, null]);
check('1月growth null（上年无数据）', pageTrend[0].growth_rate, null);
check('2月growth = (120-80)/80*100 = 50', pageTrend[1].growth_rate, 50);
check('sysYear-2 数据未进入窗口（页面年份≠系统年）', pageTrend.every(p => p.last_year_revenue !== 999 && p.current_year_revenue !== 999), true);

console.log('== 云服务趋势（最后一行年份推导） ==');
const csTrendRows = [
  { mtime: `${sysYear - 1}01`, revenue_amt_cny_sum: 10, pre_revenue_amt_cny_sum: 5 },
  { mtime: `${sysYear}01`, revenue_amt_cny_sum: 20, pre_revenue_amt_cny_sum: 10 },
  { mtime: `${sysYear}03`, revenue_amt_cny_sum: 30, pre_revenue_amt_cny_sum: 15 },
];
const csTrend = buildCloudServiceTrend(csTrendRows);
check('currentYear=最后一行年份sysYear', csTrend.find(p => p.x_time === '1月').current_year_revenue, 20);
check('1月pop_current = (20-10)/10*100 = 100', csTrend.find(p => p.x_time === '1月').pop_current, 100);
check('上年1月last_year_revenue=10', csTrend.find(p => p.x_time === '1月').last_year_revenue, 10);
check('缺月（2月）→ null', [csTrend.find(p => p.x_time === '2月').current_year_revenue, csTrend.find(p => p.x_time === '2月').pop_current], [null, null]);
check('3月pop=100', csTrend.find(p => p.x_time === '3月').pop_current, 100);

console.log('== getDateRange（跨月/跨年） ==');
// 注：源码用 setDate(getDate()-days) 按日历日回推。config.ts 注释示例 getDateRange('20260302',5)='20260227'
// 为错误示例；实际执行为 20260225（3月2日-5日历日）。以执行为准（SOURCE-EXECUTED）。
check("getDateRange('20260302',5) 实际=0225（注释0227为错例）", getDateRange('20260302', 5), { startDate: '20260225', endDate: '20260302' });
check("getDateRange('20260102',5) 跨年", getDateRange('20260102', 5), { startDate: '20251228', endDate: '20260102' });
check("getDateRange('20260516',6)", getDateRange('20260516', 6), { startDate: '20260510', endDate: '20260516' });

console.log('== completeDailyData（缺日/重复日/跨年） ==');
const cdd = completeDailyData({
  data: [
    { dtime: '20260501', revenue_amt_sum: 100, revenue_amt_prev_sum: 90, revenue_amt_sum_pop: 11.1 },
    { dtime: '20260503', revenue_amt_sum: 300, revenue_amt_prev_sum: 200, revenue_amt_sum_pop: 50 },
    { dtime: '20260503', revenue_amt_sum: 999, revenue_amt_prev_sum: 0, revenue_amt_sum_pop: null }, // 重复日
  ],
  startTime: '20260501',
  endTime: '20260505',
});
check('补全5天', cdd.length, 5);
check('重复日取最后一条（999）', cdd.find(d => d.dtime === '20260503').revenue_amt_sum, 999);
check('缺日 05-02 填充 null 三元组', [cdd[1].revenue_amt_sum, cdd[1].revenue_amt_prev_sum, cdd[1].revenue_amt_sum_pop], [null, null, null]);
const cddYear = completeDailyData({ data: [], startTime: '20251230', endTime: '20260102' });
check('跨年补全4天', cddYear.length, 4);
check('跨年首尾日期', [cddYear[0].dtime, cddYear[3].dtime], ['20251230', '20260102']);

console.log('== processModelTokenData（TOP5+其他/空值排序） ==');
const pmtd = processModelTokenData([
  { model_name: 'M-A', total_tokens_sum: 9 },
  { model_name: 'M-B', total_tokens_sum: 80 },
  { model_name: null, total_tokens_sum: 1000 },
  { model_name: 'M-C', total_tokens_sum: 50 },
  { model_name: 'M-D', total_tokens_sum: 20 },
  { model_name: 'M-E', total_tokens_sum: 30 },
], 'total_tokens_sum');
check('7条输入→6条输出（TOP5+其他）', pmtd.length, 6);
// 五级排序真实行为：值降序优先（1000,80,50,30,20 → TOP5；9 进其他）；名空行值 1000 排第 1 且显示 '--'
check('值1000行（名空）排第1且显示--', pmtd[0].model_name, '--');
check('TOP5 值序', pmtd.slice(0, 5).map(i => i.target_count), [1000, 80, 50, 30, 20]);
check('占比和为1（浮点容差）', Math.abs(pmtd.reduce((s, i) => s + (i.percent || 0), 0) - 1) < 1e-9, true);

console.log('== 表格分组/合并单元格（合计置末/倒序/null末） ==');
const grouped = groupAndProcessTable([
  { customer_name: 'C1', account_name: 'A1', model_name: 'M1', total_tokens: 5 },
  { customer_name: 'C1', account_name: 'A1', model_name: '合计', total_tokens: 7 },
  { customer_name: 'C1', account_name: 'A1', model_name: 'M2', total_tokens: null },
  { customer_name: 'C2', account_name: 'A2', model_name: 'M3', total_tokens: 3 },
], 1, 5);
check('C1组3行', grouped.filter(g => g.customerIndex === 1).length, 3);
check('C1组行序 M1(5)→M2(null)→合计', grouped.slice(0, 3).map(g => g.model_name), ['M1', 'M2', '合计']);
check('C1组 rowSpan 首行3/其余1', grouped.slice(0, 3).map(g => g.rowSpan), [3, 1, 1]);
check('C1组 rowHide 首行false/其余true', grouped.slice(0, 3).map(g => g.rowHide), [false, true, true]);
check('C2序号=2', grouped.find(g => g.customerIndex === 2).customerIndex_show, '2');

console.log('== frontendSortData（null 置末） ==');
const sortArr = [
  { name: 'A', revenue: 9 },
  { name: 'B', revenue: null },
  { name: 'C', revenue: 1000 },
  { name: 'D', revenue: 80 },
];
frontendSortData('revenue', false, sortArr);
check('降序：1000,80,9,null 置末', sortArr.map(s => s.revenue), [1000, 80, 9, null]);

console.log('== 管道支撑率（缺行/分母0/正常） ==');
const support = computeSupportCoverage(
  [{ region_dept_code_fin: 'R01', rep_office_code_fin: 'O1', effective_opportunity_remaining_amount_current_sum: 500 }],
  [{ region_dept_code_fin: 'R01', rep_office_code_fin: 'O1', stock_forecast_revenue_amt_sum: 300 }],
  [{ region_dept_code_fin: 'R01', rep_office_code_fin: 'O1', target_revenue_amt_cny: 1000 }],
  [{ region_code: 'R01', repoffice_code: 'O1', ytd_amt: 200 }],
);
check('支撑率=500/(1000-300-200)=1', support[0].support_coverage, 1);
const supportNoTarget = computeSupportCoverage(
  [{ region_dept_code_fin: 'R01', rep_office_code_fin: 'O1', effective_opportunity_remaining_amount_current_sum: 500 }],
  [], [], [],
);
check('缺目标/流水/已实现 → 分母0 → 0', supportNoTarget[0].support_coverage, 0);
const supportNoEffective = computeSupportCoverage(
  [{ region_dept_code_fin: 'R01', rep_office_code_fin: 'O1', effective_opportunity_remaining_amount_current_sum: 0 }],
  [{ region_dept_code_fin: 'R01', rep_office_code_fin: 'O1', stock_forecast_revenue_amt_sum: 100 }],
  [{ region_dept_code_fin: 'R01', rep_office_code_fin: 'O1', target_revenue_amt_cny: 200 }],
  [],
);
check('分子0 → 0', supportNoEffective[0].support_coverage, 0);

console.log('== 概览表合并（收入+销毛率跨源关联） ==');
const merged = mergeOverviewTable(
  [{ repoffice_code: '1001', repoffice_cn_name: '代表处X', report_item_code: 'GEO_PL_91000', ytd_amt: 100, yoy_y: 0.1, budget_completion_y_ratio: 0.8 }],
  [{ repoffice_code: '1001', repoffice_cn_name: '代表处X', report_item_code: 'GEO_PL_10997', ytd_amt: 0.5 }],
);
check('合并后收入=100', merged[0].income_ytd_amt, 100);
check('合并后销毛率=0.5（0.5=50%）', merged[0].gross_profit_margin_ytd_amt, 0.5);
const mergedMissing = mergeOverviewTable(
  [{ repoffice_code: '1002', repoffice_cn_name: '代表处Y', report_item_code: 'GEO_PL_91000', ytd_amt: 9 }],
  [],
);
check('缺销毛率行 → null', mergedMissing[0].gross_profit_margin_ytd_amt, null);

console.log('== 搜索转义 ==');
check("搜索 O'Brien → O''Brien 且双引号转义", buildSearchParam("O'Brien"), "and (LOWER(opportunity_name) like '%o''brien%' or LOWER(party_company_name) like '%o''brien%')");
check('空搜索 → 空串', buildSearchParam(''), '');

console.log(`\n${failures === 0 ? '全部通过' : failures + ' 项失败'}`);
process.exit(failures === 0 ? 0 : 1);
