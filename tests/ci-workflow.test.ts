import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {parse} from 'yaml';
import {describe, expect, it} from 'vitest';
// @ts-expect-error Standalone Node JS profile resolver.
import {sourceCheckCommands} from '../tools/package-build/compatibility-profile.mjs';

const root = resolve(import.meta.dirname, '..');
const sha = 'a'.repeat(40), tree = 'b'.repeat(40);
const context = {githubActions:'true', ci:'true', githubSha:sha, headSha:sha, sourceTree:tree, headTree:tree};
const regular = parse(readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8'));
const full = parse(readFileSync(resolve(root, '.github/workflows/ci-full.yml'), 'utf8'));

function gate(results: unknown) {
  return spawnSync(process.execPath, [resolve(root, 'tools/scripts/check-ci-results.mjs')], {
    env:{...process.env, CI_JOB_RESULTS:JSON.stringify(results)}, encoding:'utf8'
  });
}

describe('parallel CI keeps a complete required gate', () => {
  it('fails closed for failed, cancelled, skipped and missing results', () => {
    for(const result of ['failure','cancelled','skipped',undefined]) {
      expect(gate({tests:{result}}).status).toBe(1);
    }
    expect(gate({}).status).toBe(1);
    expect(gate([]).status).toBe(1);
    expect(gate({tests:{result:'success'},build:{result:'success'}}).status).toBe(0);
  });

  it('requires the per-change jobs for pull requests and pushes to main', () => {
    expect(regular.on).toEqual({pull_request: null, push: {branches: ['main']}});
    const {ci, ...checks} = regular.jobs;
    expect([...ci.needs].sort()).toEqual(Object.keys(checks).sort());
    expect(Object.keys(checks).sort()).toEqual(['architecture','authoring','build','tests','types']);
    expect(ci.if).toBe('${{ always() }}');
    expect(ci.steps.at(-1).env.CI_JOB_RESULTS).toBe('${{ toJSON(needs) }}');
    expect(ci.steps.at(-1).run).toBe('node tools/scripts/check-ci-results.mjs');
    expect(checks.types.steps.at(-1).run).toBe('pnpm check');
    const architecture = checks.architecture.steps.at(-1);
    expect(architecture.env.METRICCANVAS_ARCHITECTURE_BASE).toBe('${{ github.event.pull_request.base.sha || github.event.before }}');
    expect(architecture.run.trim().split('\n').at(-1)).toBe('pnpm architecture:check');
    // Source checks execute independently, rather than serially behind other jobs.
    for(const job of Object.values(checks)) expect(job).not.toHaveProperty('needs');
  });

  it('shards the frequent suite and defers only the listed files to the complete suite', () => {
    const sharding = {'fail-fast': false, matrix: {shard: [1, 2, 3]}};
    const run = 'pnpm test --maxWorkers=2 --shard=${{ matrix.shard }}/3';
    expect(regular.jobs.tests.strategy).toEqual(sharding);
    expect(full.jobs.tests.strategy).toEqual(sharding);
    expect(regular.jobs.tests.steps.at(-1).run).toBe([
      run,
      '--exclude tests/authoring-export-isolation.test.ts',
      '--exclude tests/authoring-temporal-evaluation.test.ts',
      '--exclude tests/skill-release.test.ts'
    ].join(' '));
    expect(full.jobs.tests.steps.at(-1).run).toBe(run);
    expect(full.jobs.types.steps.at(-1).run).toBe('pnpm check');
  });

  it('runs the full release checks on schedule and on demand, with a separate result', () => {
    expect(full.on).toEqual({schedule: [{cron: '17 18 * * *'}], workflow_dispatch: null});
    const {'ci-full': gate, ...checks} = full.jobs;
    expect([...gate.needs].sort()).toEqual(Object.keys(checks).sort());
    expect(Object.keys(checks).sort()).toEqual([
      'authoring-distribution', 'compatibility', 'embed-distribution', 'mc-distribution',
      'platform-distribution', 'relay-distribution', 'relay-release', 'tests', 'types'
    ]);
    expect(gate.if).toBe('${{ always() }}');
    expect(gate.steps.at(-1).run).toBe('node tools/scripts/check-ci-results.mjs');
    expect(gate.steps.at(-1).env.CI_JOB_RESULTS).toBe('${{ toJSON(needs) }}');
    const distribution = checks['mc-distribution'];
    expect(distribution.needs).toBe('authoring-distribution');
    expect(distribution.strategy.matrix.os).toEqual(['ubuntu-latest', 'windows-latest']);
    expect(distribution.steps.find((step: {uses?: string}) => step.uses === 'actions/download-artifact@v4').with.name)
      .toBe('mc-content-${{ github.sha }}');
    expect(distribution.steps.some((step: {run?: string}) => step.run?.includes('mc-content-pack.py verify --archive'))).toBe(true);
  });

  it('uses the CI-only compatibility profile and uploads diagnostics without workspace dependencies', () => {
    const steps = full.jobs.compatibility.steps;
    expect(steps.find((step: {run?: string}) => step.run?.includes('compatibility:check')).run)
      .toContain('--source-checks=ci');
    const paths = steps.at(-1).with.path.trim().split('\n');
    expect(paths).toContain('${{ runner.temp }}/metriccanvas-compatibility/*/logs/**');
    expect(paths).toContain('${{ runner.temp }}/metriccanvas-compatibility/*/*.tgz');
    expect(paths).not.toContain('${{ runner.temp }}/metriccanvas-compatibility');
    for(const path of paths) expect(path).not.toMatch(/node_modules|\/source(?:\/|$)/);
  });

  it('keeps authoring consistency in the regular workflow and archives in the full workflow', () => {
    const commands = regular.jobs.authoring.steps.map((step: {run?: string}) => step.run ?? '').join('\n');
    expect(commands).not.toMatch(/^\s*pnpm (?:test|skills:check|skills:repair:check|authoring:check)\b/m);
    expect(commands).toContain('pnpm exec tsc --noEmit -p tools/tsconfig.skills.json');
    expect(commands).toContain('pnpm authoring:contracts:check');
    expect(commands).not.toContain('pnpm skills:pack');
    const archiveCommands = full.jobs['authoring-distribution'].steps.map((step: {run?: string}) => step.run ?? '').join('\n');
    expect(archiveCommands).toContain('pnpm skills:pack');
    expect(archiveCommands).toContain('pnpm mc:content:test');
    expect(archiveCommands).toContain('mc-content-fixtures.py --check');
  });

  it('keeps basic Embed browser and size checks fast and requires both native release builds', () => {
    const commands = regular.jobs.build.steps.map((step: {run?: string}) => step.run ?? '').join('\n');
    expect(commands).toContain('pnpm build');
    expect(commands).toContain('check:dist');
    expect(commands).toContain('playwright test mount-lifecycle.spec.ts distribution.spec.ts');
    expect(commands).not.toContain('webpack-consumer.spec.ts');
    const distribution = full.jobs['embed-distribution'];
    expect(full.jobs['ci-full'].needs).toContain('embed-distribution');
    expect(distribution['runs-on']).toBe('${{ matrix.os }}');
    expect(distribution.strategy.matrix.os).toEqual(['ubuntu-latest', 'windows-latest']);
    expect(distribution.steps.some((step: {run?: string}) => step.run === 'pnpm test tests/embed-chunking.test.ts')).toBe(true);
    expect(distribution.steps.some((step: {run?: string}) => step.run === 'pnpm --filter @metriccanvas/embed build')).toBe(true);
    expect(distribution.steps.some((step: {run?: string}) => step.run === 'pnpm --filter @metriccanvas/embed exec playwright install --with-deps chrome')).toBe(true);
    expect(distribution.steps.some((step: {run?: string}) => step.run === 'pnpm --filter @metriccanvas/embed exec playwright test mount-lifecycle.spec.ts distribution.spec.ts webpack-consumer.spec.ts --workers=1')).toBe(true);
    expect(distribution.steps.at(-1).with.path).toBe('packages/embed/dist');
  });

  it('builds and round-trips actual four artifacts independently from mc-content', () => {
    const job = full.jobs['relay-release'];
    const commands = job.steps.flatMap((step: {run?: string}) => step.run ? [step.run] : []);
    expect(job.env.METRICCANVAS_PYTHON).toBe('python');
    expect(commands.some((command: string) => command.startsWith('pnpm relay:build '))).toBe(true);
    expect(commands).toContain('pnpm relay:test');
    expect(commands).toContain('pnpm relay:core:test');
    expect(commands).toContain('python -B -m unittest discover -s tools/relay-reference -p test_adoption.py');
    expect(job.steps.find((step: {env?: {METRICCANVAS_RELAY_CANDIDATE?: string}}) => step.env?.METRICCANVAS_RELAY_CANDIDATE).env.METRICCANVAS_RELAY_CANDIDATE).toBe('${{ runner.temp }}/relay-reference');
    expect(commands.some((command: string) => command.startsWith('pnpm relay:pack '))).toBe(true);
    expect(commands.some((command: string) => command.startsWith('pnpm relay:verify ') && command.includes('--probe'))).toBe(true);
    const upload = job.steps.find((step: {uses?: string}) => step.uses === 'actions/upload-artifact@v4');
    expect(upload.with.name).toBe('relay-reference-${{ github.sha }}');
    expect(upload.with.path).toContain('metriccanvas-relay-reference.zip.release.json');
    const download = job.steps.find((step: {uses?: string}) => step.uses === 'actions/download-artifact@v4');
    expect(download.with.name).toBe(upload.with.name);
    expect(full.jobs['ci-full'].needs).toContain('relay-release');
  });

  it('requires native minimum Node 22 consumers with only six initial dependencies', () => {
    const job = full.jobs['relay-distribution'];
    expect(job.needs).toBe('relay-release');
    expect(job.strategy.matrix.os).toEqual(['ubuntu-latest', 'windows-latest']);
    expect(job['runs-on']).toBe('${{ matrix.os }}');
    expect(job.steps.find((step: {uses?: string}) => step.uses === 'actions/setup-node@v4').with['node-version']).toBe(22);
    expect(job.steps.find((step: {uses?: string}) => step.uses === 'actions/setup-python@v5').with['python-version']).toBe('3.12');
    const commands = job.steps.flatMap((step: {run?: string}) => step.run ? [step.run] : []);
    expect(commands).toContain('python -m pip install -r tools/relay-reference/runtime-requirements.txt');
    expect(commands).toContain('python -B -m unittest discover -s tools/relay-reference -p test_adoption.py');
    expect(commands.some((command: string) => command.includes('package_cli.py extract') && command.includes('relay-native-current-test'))).toBe(true);
    expect(commands.some((command: string) => command.includes('package_cli.py verify') && command.includes('--probe') && command.includes('--expected-source'))).toBe(true);
    expect(commands.some((command: string) => command.includes('pnpm') || command.includes('pip install -e'))).toBe(false);
    expect(full.jobs['ci-full'].needs).toContain('relay-distribution');
  });
});

describe('compatibility source validation', () => {
  it('keeps standalone test/check/build as the default full profile', () => {
    expect(sourceCheckCommands('full', {})).toEqual(['test','check','build']);
    expect(() => sourceCheckCommands('skip', context)).toThrow();
  });

  it('delegates tests/types only for the same GitHub commit and source tree', () => {
    expect(sourceCheckCommands('ci', context)).toEqual(['build']);
    expect(() => sourceCheckCommands('ci', {...context, githubActions:'false'})).toThrow('GitHub Actions');
    expect(() => sourceCheckCommands('ci', {...context, ci:'false'})).toThrow('GitHub Actions');
    expect(() => sourceCheckCommands('ci', {...context, githubSha:'c'.repeat(40)})).toThrow('GitHub SHA');
    expect(() => sourceCheckCommands('ci', {...context, sourceTree:'d'.repeat(40)})).toThrow('source tree');
  });
});
