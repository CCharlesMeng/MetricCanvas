import assert from 'node:assert/strict';

const results = JSON.parse(process.env.CI_JOB_RESULTS || '{}');
assert(results && typeof results === 'object' && !Array.isArray(results), 'Expected CI job results');
const jobs = Object.entries(results);
assert(jobs.length > 0, 'CI gate needs upstream jobs');
const incomplete = jobs.filter(([, job]) => job?.result !== 'success');
for (const [name, job] of jobs) console.log(`${name}: ${job?.result ?? 'missing'}`);
assert(incomplete.length === 0, `Required CI jobs did not succeed: ${incomplete.map(([name]) => name).join(', ')}`);
