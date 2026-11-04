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

  it('requires every job and always runs the gate, including when an upstream check fails', () => {
    const workflow = parse(readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8'));
    const {ci, ...checks} = workflow.jobs;
    expect([...ci.needs].sort()).toEqual(Object.keys(checks).sort());
    expect(Object.keys(checks).sort()).toEqual(['authoring','build','compatibility','embed-distribution','mc-distribution','relay-distribution','relay-release','tests','types']);
    expect(ci.if).toBe('${{ always() }}');
    expect(ci.steps.at(-1).env.CI_JOB_RESULTS).toBe('${{ toJSON(needs) }}');
    expect(ci.steps.at(-1).run).toBe('node tools/scripts/check-ci-results.mjs');
    expect(workflow.jobs.tests.steps.at(-1).run).toBe('pnpm test');
    expect(workflow.jobs.types.steps.at(-1).run).toBe('pnpm check');
    // Source checks execute independently, rather than serially behind other jobs.
    for(const [name, job] of Object.entries(checks)) {
      if(!['mc-distribution', 'relay-distribution'].includes(name)) expect(job).not.toHaveProperty('needs');
    }
    const distribution = workflow.jobs['mc-distribution'];
    expect(distribution.needs).toBe('authoring');
    expect(distribution.strategy.matrix.os).toEqual(['ubuntu-latest', 'windows-latest']);
    expect(distribution.steps.find((step: {uses?: string}) => step.uses === 'actions/download-artifact@v4').with.name)
      .toBe('mc-content-${{ github.sha }}');
    expect(distribution.steps.some((step: {run?: string}) => step.run?.includes('mc-content-pack.py verify --archive'))).toBe(true);
  });

  it('uses the CI-only compatibility profile and uploads diagnostics without workspace dependencies', () => {
    const workflow = parse(readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8'));
    const steps = workflow.jobs.compatibility.steps;
    expect(steps.find((step: {run?: string}) => step.run?.includes('compatibility:check')).run)
      .toContain('--source-checks=ci');
    const paths = steps.at(-1).with.path.trim().split('\n');
    expect(paths).toContain('${{ runner.temp }}/metriccanvas-compatibility/*/logs/**');
    expect(paths).toContain('${{ runner.temp }}/metriccanvas-compatibility/*/*.tgz');
    expect(paths).not.toContain('${{ runner.temp }}/metriccanvas-compatibility');
    for(const path of paths) expect(path).not.toMatch(/node_modules|\/source(?:\/|$)/);
  });

  it('requires real Linux and Windows embed builds with the unchanged distribution guard', () => {
    const workflow = parse(readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8'));
    const distribution = workflow.jobs['embed-distribution'];
    expect(workflow.jobs.ci.needs).toContain('embed-distribution');
    expect(distribution['runs-on']).toBe('${{ matrix.os }}');
    expect(distribution.strategy.matrix.os).toEqual(['ubuntu-latest', 'windows-latest']);
    expect(distribution.steps.some((step: {run?: string}) => step.run === 'pnpm test tests/embed-chunking.test.ts')).toBe(true);
    expect(distribution.steps.some((step: {run?: string}) => step.run === 'pnpm --filter @metriccanvas/embed build')).toBe(true);
    expect(distribution.steps.some((step: {run?: string}) => step.run === 'pnpm --filter @metriccanvas/embed exec playwright install --with-deps chrome')).toBe(true);
    expect(distribution.steps.some((step: {run?: string}) => step.run === 'pnpm --filter @metriccanvas/embed exec playwright test distribution.spec.ts webpack-consumer.spec.ts --workers=1')).toBe(true);
    expect(distribution.steps.at(-1).with.path).toBe('packages/embed/dist');
  });

  it('builds and round-trips actual four artifacts independently from mc-content', () => {
    const workflow = parse(readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8'));
    const job = workflow.jobs['relay-release'];
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
    expect(workflow.jobs.ci.needs).toContain('relay-release');
  });

  it('requires native minimum Node 22 consumers with only six initial dependencies', () => {
    const workflow = parse(readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8'));
    const job = workflow.jobs['relay-distribution'];
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
    expect(workflow.jobs.ci.needs).toContain('relay-distribution');
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
