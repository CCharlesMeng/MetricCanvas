/** Local audit of the supplied extraction, not verification against the inaccessible source repo. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { isDeepStrictEqual } from 'node:util';
import assert from 'node:assert/strict';
const source = readFileSync(new URL('./source-verify-calculate.mjs', import.meta.url), 'utf8');
const logs = [];
let exitCode;
const context = createContext({
  console: { log: (...args) => logs.push(args.join(' ')) },
  process: { exit: code => { exitCode = code; } },
  strictEqual: isDeepStrictEqual,
});
runInContext(source, context, { timeout: 5000 });
assert.equal(exitCode, 0);
const originalPasses = logs.filter(line => line.startsWith('PASS')).length;
// JSON.stringify equates null/NaN/Infinity. Re-run with a typed deep comparison.
logs.length = 0;
const strictContext = createContext({
  console: { log: (...args) => logs.push(args.join(' ')) },
  process: { exit: code => { exitCode = code; } },
  strictEqual: isDeepStrictEqual,
});
runInContext(source.replace('JSON.stringify(actual) === JSON.stringify(expected)', 'strictEqual(actual, expected)'), strictContext, { timeout: 5000 });
assert.equal(exitCode, 0);
const checks = [];
function check(name, expression, expected) {
  const actual = runInContext(expression, context, { timeout: 5000 });
  assert.deepEqual(actual, expected, name);
  checks.push({ name, expression, actual });
}
check('null multiplication is zero', 'null * 100', 0);
check('missing multiplication is NaN', 'Number.isNaN(undefined * 100)', true);
check('mixed null sum preserves numbers', '[100, null, 200].reduce((sum, value) => sum + value, 0)', 300);
check('mixed missing sum is NaN', 'Number.isNaN([100, undefined, 200].reduce((sum, value) => sum + value, 0))', true);
check('direct subtraction coerces null to zero', '100 - null', 100);
check('controlled subtraction preserves null', 'calculator.SUBTRACT(100, null)', null);
check('JSON comparator hides Infinity vs null', 'JSON.stringify(Infinity) === JSON.stringify(null)', true);
check('CAGR zero beginning really produces Infinity', 'getCAGR(0, 100, 6) === Infinity', true);
check('cloud trend sorts before selecting reference year', `buildCloudServiceTrend([{mtime:'202603',revenue_amt_cny_sum:30},{mtime:'202501',revenue_amt_cny_sum:10},{mtime:'202601',revenue_amt_cny_sum:20}])[0].current_year_revenue`, 20);
check('page trend loses zero through OR-null', `buildRevenueTrend([{mtime: String(new Date().getFullYear())+'01',revenue_amt_sum:0}])[0].current_year_revenue`, null);
check('cloud trend retains zero through nullish operator', `buildCloudServiceTrend([{mtime:'202601',revenue_amt_cny_sum:0}])[0].current_year_revenue`, 0);
check('overview same report item takes last metric row', `mergeOverviewTable([{repoffice_code:'A',report_item_code:'GEO_PL_91000',ytd_amt:10},{repoffice_code:'A',report_item_code:'GEO_PL_91000',ytd_amt:20}],[])[0].income_ytd_amt`, 20);
check('overview retains sales-only representative', `mergeOverviewTable([],[{repoffice_code:'A',report_item_code:'GEO_PL_10997',ytd_amt:0.5}]).length`, 1);
check('date example correction', `getDateRange('20260302',5).startDate`, '20260225');
check('daily duplicate keeps last row', `completeDailyData({data:[{dtime:'20260501',revenue_amt_sum:1},{dtime:'20260501',revenue_amt_sum:2}],startTime:'20260501',endTime:'20260501'})[0].revenue_amt_sum`, 2);
const output = {
  scope: 'Supplied report JavaScript extraction only; original source repository and browser not accessed',
  node: process.version,
  originalAssertionsPassed: originalPasses,
  typedAssertionsPassed: logs.filter(line => line.startsWith('PASS')).length,
  supplementalAssertionsPassed: checks.length,
  checks,
};
writeFileSync(new URL('./local-verification.json', import.meta.url), JSON.stringify(output, null, 2)+'\n');
console.log(JSON.stringify({ originalAssertionsPassed: originalPasses, typedAssertionsPassed: output.typedAssertionsPassed, supplementalAssertionsPassed: checks.length }));
