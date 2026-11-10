import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const scripts = dirname(fileURLToPath(import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const usage = 'finish-edit.mjs --page file --baseline frozen-file --baseline-sha256 hash --allow /pointer [--allow /pointer] [--expected-layout dashboard|report]';

function options(args) {
  const result = {allow: []};
  if (args.length % 2) throw new Error(usage);
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i], value = args[i + 1];
    if (key === '--allow') result.allow.push(value);
    else {
      if (!['--page', '--baseline', '--baseline-sha256', '--expected-layout'].includes(key) || key in result) throw new Error(usage);
      result[key] = value;
    }
  }
  validateOptions(result);
  return result;
}
function validateOptions(value) {
  for (const key of ['--page', '--baseline', '--baseline-sha256']) if (!value[key]) throw new Error(usage);
  if (!/^[a-f0-9]{64}$/.test(value['--baseline-sha256'])) throw new Error('Invalid baseline SHA256');
  if (!value.allow.length || value.allow.some(pointer => !/^\/.+/.test(pointer) || /~(?![01])/u.test(pointer))) throw new Error('At least one non-root JSON Pointer is required');
  if (value['--expected-layout'] && !['dashboard', 'report'].includes(value['--expected-layout'])) throw new Error('Invalid expected layout');
}
function invoke(script, args) {
  const child = spawnSync(process.execPath, [resolve(scripts, script), ...args], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  if (child.error) throw child.error;
  let receipt;
  try { receipt = JSON.parse(child.stdout); }
  catch { throw new Error(`${script} returned no JSON receipt: ${child.stderr}`); }
  return {exitCode: child.status, receipt};
}
const encode = key => key.replaceAll('~', '~0').replaceAll('/', '~1');
function changedPaths(before, after, at = '') {
  if (before === after) return [];
  if (before === null || after === null || typeof before !== 'object' || typeof after !== 'object') return [at];
  if (Array.isArray(before) !== Array.isArray(after)) return [at];
  if (Array.isArray(before) && before.length !== after.length) return [at];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.flatMap(key => childChanges(before, after, key, `${at}/${encode(key)}`));
}
function childChanges(before, after, key, at) {
  if (!Object.hasOwn(before, key) || !Object.hasOwn(after, key)) return [at];
  return changedPaths(before[key], after[key], at);
}
function scopeCheck(before, after, allowed) {
  try {
    const changes = changedPaths(JSON.parse(before), JSON.parse(after));
    const unexpected = changes.filter(at => !allowed.some(root => at === root || at.startsWith(root + '/')));
    return {ok: unexpected.length === 0, changedCount: changes.length, changedPaths: changes.slice(0, 100),
      unexpectedCount: unexpected.length, unexpectedPaths: unexpected.slice(0, 100), pathsTruncated: changes.length > 100,
      comparison: 'JSON values; object key order and number spelling are ignored; array order and value types are preserved'};
  } catch (error) {
    return {ok: false, error: String(error)};
  }
}
async function finish(value) {
  const baseline = await readFile(value['--baseline']);
  if (digest(baseline) !== value['--baseline-sha256']) throw new Error('Baseline identity mismatch; retain the original baseline');
  const captured = invoke('snapshot-attempt.mjs', [value['--page']]);
  if (captured.exitCode !== 0 || !captured.receipt.ok) throw new Error('Could not freeze candidate');
  const snapshot = captured.receipt;
  const candidate = await readFile(snapshot.file);
  const validationArgs = value['--expected-layout'] ? ['--expected-layout', value['--expected-layout'], snapshot.file] : [snapshot.file];
  const validation = invoke('validate-page.mjs', validationArgs);
  const scope = scopeCheck(baseline.toString('utf8'), candidate.toString('utf8'), value.allow);
  const snapshotIntact = digest(await readFile(snapshot.file)) === snapshot.sha256;
  const currentMatchesSnapshot = digest(await readFile(value['--page'])) === snapshot.sha256;
  const ok = scope.ok && validation.exitCode === 0 && validation.receipt.ok && snapshotIntact && currentMatchesSnapshot;
  return {ok, status: ok ? 'static-verified' : 'rejected', baselineSha256: digest(baseline), snapshot,
    scope, validation, snapshotIntact, currentMatchesSnapshot, intent: 'not-assessed', runtime: 'not-assessed'};
}
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') console.log(JSON.stringify({usage, output: 'One receipt: frozen candidate, allowed-scope comparison and full page validation. Does not write the target or establish business/runtime acceptance.'}));
  else {
    const receipt = await finish(options(args));
    console.log(JSON.stringify(receipt));
    process.exitCode = receipt.ok ? 0 : 1;
  }
} catch (error) {
  console.error(JSON.stringify({ok: false, status: 'call-error', error: String(error)}));
  process.exitCode = 2;
}
