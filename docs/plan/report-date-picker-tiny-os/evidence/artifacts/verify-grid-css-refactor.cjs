const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = process.cwd();
const { compile } = createRequire(path.join(root, 'packages/engine/package.json'))('svelte/compiler');
const evidence = path.join(root, 'docs/plan/report-date-picker-tiny-os/evidence');
const before = fs.readFileSync(path.join(evidence, 'artifacts/date-picker-before-grid-refactor.svelte'), 'utf8');
const after = fs.readFileSync(path.join(root, 'packages/engine/runtime-ui/src/filters/DatePicker.svelte'), 'utf8');
const assert = require('node:assert/strict');
assert.equal(before.slice(0, before.indexOf('<style>')), after.slice(0, after.indexOf('<style>')));
const options = { filename: 'DatePicker.svelte', css: 'external', cssHash: () => 'svelte-date-picker-equivalence' };
const compiledBefore = compile(before, options);
const compiledAfter = compile(after, options);
assert.deepEqual(compiledAfter.warnings, compiledBefore.warnings);
assert.equal(compiledAfter.js.code, compiledBefore.js.code);
function selectors(text) {
  let depth = 0, start = 0; const out = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    else if (text[i] === ',' && depth === 0) { out.push(text.slice(start,i).trim()); start=i+1; }
  }
  out.push(text.slice(start).trim()); return out;
}
function canonical(css) {
  const out = new Map();
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    let selectorText = match[1].replace(/\/\*[\s\S]*?\*\//g,'').trim();
    const declarations = match[2].trim().replace(/\s+/g,' ');
    for (const selector of selectors(selectorText)) {
      const pair = ':is(.tiny-year-table, .tiny-month-table)';
      const expanded = selector.includes(pair)
        ? ['.tiny-year-table','.tiny-month-table'].map(table=>selector.replace(pair, table)) : [selector];
      for (const s of expanded) { if (!out.has(s)) out.set(s, []); out.get(s).push(declarations); }
    }
  }
  return [...out].sort((a,b)=>a[0].localeCompare(b[0]));
}
const cssBefore = canonical(compiledBefore.css.code), cssAfter = canonical(compiledAfter.css.code);
assert.deepEqual(cssAfter, cssBefore);
// Only equal class alternatives are placed in :is(), preserving specificity.
assert.equal((after.match(/:is\(/g)||[]).length, (after.match(/:is\(\.tiny-year-table, \.tiny-month-table\)/g)||[]).length);
assert.match(after,/class:tiny-month-table=\{level === 'month'\} class:tiny-year-table=\{level === 'year'\}/);
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const result = {
  scope: '17 duplicated month/year CSS rules and two shared final overrides',
  before_sha256: hash(before), after_sha256: hash(after),
  source_lines_removed: before.split('\n').length-after.split('\n').length,
  svelte_version: createRequire(path.join(root,'packages/engine/package.json'))('svelte/package.json').version,
  js_identical_with_fixed_css_hash: true,
  expanded_css_selectors: cssAfter.length,
  expanded_css_declarations_and_per_selector_order_identical: true,
  specificity: ':is() max specificity is one class, equal to replaced class; table classes mutually exclusive',
  compiled_css_bytes: { before: Buffer.byteLength(compiledBefore.css.code), after: Buffer.byteLength(compiledAfter.css.code) },
  warnings: compiledAfter.warnings.length,
  browser_verification: 'not rerun; compiler-level equivalence checked for this behavior-preserving refactor'
};
fs.writeFileSync(path.join(evidence,'grid-css-refactor-equivalence.json'), JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
