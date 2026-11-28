import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runValidateCli, type ValidateJsonOutput } from '../src/validate-cli';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const SAMPLE_PAGE_PATH = 'pages/capabilities/layout/demo.json';
const SAMPLE_PAGE = JSON.parse(
  readFileSync(resolve(REPO_ROOT, SAMPLE_PAGE_PATH), 'utf8'),
) as Record<string, unknown>;

interface CapturedRun {
  code: number;
  stdout: string;
  stderr: string;
}

function withTempDir(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'page-validate-cli-'));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeTextFile(root: string, relativePath: string, content: string): string {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
  return target;
}

function writeJsonFile(root: string, relativePath: string, value: unknown): string {
  return writeTextFile(root, relativePath, JSON.stringify(value));
}

function captureRun(argv: string[], cwd?: string): CapturedRun {
  const out: string[] = [];
  const err: string[] = [];
  const code = runValidateCli(argv, {
    cwd,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });
  return {
    code,
    stdout: out.join('\n'),
    stderr: err.join('\n'),
  };
}

function spawnValidateCli(argv: string[], cwd = REPO_ROOT) {
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', 'packages/page/src/validate-cli.ts', ...argv],
    { cwd, encoding: 'utf8' },
  );
}

describe('validate CLI', () => {
  it.each(['empty', 'nested', 'wrong', 'duplicate'] as const)('递归目录场景：%s', (kind) => {
    withTempDir((directory) => {
      const files =
        kind === 'empty'
          ? []
          : kind === 'duplicate'
            ? ['demo.json', 'nested/deep/demo.json']
            : ['nested/deep/demo.json'];
      for (const file of files) {
        writeJsonFile(
          directory,
          file,
          kind === 'wrong' ? { ...SAMPLE_PAGE, id: 'wrong' } : SAMPLE_PAGE,
        );
      }

      const result = spawnValidateCli([directory]);
      expect(result.status, result.stderr).toBe(kind === 'nested' ? 0 : kind === 'wrong' ? 1 : 2);
      const expected = {
        empty: '没有找到页面文档',
        nested: '共 1 个页面文档,1 通过,0 失败',
        wrong: '与 Page.id(wrong)不一致',
        duplicate: '重复页面 ID demo',
      };
      expect(result.stdout + result.stderr).toContain(expected[kind]);
    });
  });

  it('直接校验裸 Page fixtures', () => {
    const result = spawnValidateCli(['packages/page/fixtures/contract-valid']);
    expect(result.status, result.stderr).toBe(0);
    const count = readdirSync(resolve(REPO_ROOT, 'packages/page/fixtures/contract-valid')).filter(
      (file) => file.endsWith('.json'),
    ).length;
    expect(result.stdout).toContain(`共 ${count} 个页面文档,${count} 通过,0 失败`);
  });

  it('无参数默认校验当前工作目录下的 pages/（覆盖全通过与含失败页）', () => {
    withTempDir((workspace) => {
      writeJsonFile(workspace, 'pages/demo.json', SAMPLE_PAGE);
      const okRun = captureRun([], workspace);
      expect(okRun.code).toBe(0);
      expect(okRun.stdout).toContain('✓ demo.json');
      expect(okRun.stdout).toContain('共 1 个页面文档,1 通过,0 失败');
      expect(okRun.stderr).toBe('');

      writeJsonFile(workspace, 'pages/nested/broken.json', { id: 'broken' });
      const failRun = captureRun([], workspace);
      expect(failRun.code).toBe(1);
      expect(failRun.stdout).toContain('✓ demo.json');
      expect(failRun.stderr).toContain('✗ nested/broken.json');
      expect(failRun.stdout).toContain('共 2 个页面文档,1 通过,1 失败');
    });
  });

  it('单文件校验：合法文档、Schema 非法文档、文件名不匹配与非法 JSON 语法', () => {
    withTempDir((workspace) => {
      writeJsonFile(workspace, 'valid/demo.json', SAMPLE_PAGE);
      writeJsonFile(workspace, 'invalid/bad-schema.json', {
        id: 'bad-schema',
        title: 'Missing fields',
      });
      writeJsonFile(workspace, 'invalid/mismatch.json', SAMPLE_PAGE);
      writeTextFile(workspace, 'invalid/malformed.json', '{ not valid json');

      const validRun = captureRun(['valid/demo.json'], workspace);
      expect(validRun.code).toBe(0);
      expect(validRun.stdout).toContain('✓ valid/demo.json');
      expect(validRun.stdout).toContain('共 1 个页面文档,1 通过,0 失败');
      expect(validRun.stderr).toBe('');

      const schemaFail = captureRun(['invalid/bad-schema.json'], workspace);
      expect(schemaFail.code).toBe(1);
      expect(schemaFail.stderr).toContain('✗ invalid/bad-schema.json');
      expect(schemaFail.stdout).toContain('共 1 个页面文档,0 通过,1 失败');

      const mismatchFail = captureRun(['invalid/mismatch.json'], workspace);
      expect(mismatchFail.code).toBe(1);
      expect(mismatchFail.stderr).toContain('与 Page.id(demo)不一致');

      const syntaxFail = captureRun(['invalid/malformed.json'], workspace);
      expect(syntaxFail.code).toBe(1);
      expect(syntaxFail.stderr).toContain('[SCHEMA_ERROR] / 不是合法 JSON:');
    });
  });

  it('支持 --json 输出结构与确定性退出码（0 / 1 / 2）', () => {
    withTempDir((workspace) => {
      writeJsonFile(workspace, 'ok/demo.json', SAMPLE_PAGE);
      writeJsonFile(workspace, 'bad/broken.json', { id: 'broken' });
      writeTextFile(workspace, 'bad/syntax.json', '{invalid');

      const okRun = captureRun(['--json', 'ok/demo.json'], workspace);
      expect(okRun.code).toBe(0);
      expect(okRun.stderr).toBe('');
      const okPayload = JSON.parse(okRun.stdout) as ValidateJsonOutput;
      expect(okPayload).toEqual({
        ok: true,
        checkedCount: 1,
        failedCount: 0,
        results: [
          {
            file: 'ok/demo.json',
            ok: true,
            errors: [],
          },
        ],
      });

      const mixedRun = captureRun(
        ['ok/demo.json', 'bad/broken.json', 'bad/syntax.json', '--json'],
        workspace,
      );
      expect(mixedRun.code).toBe(1);
      expect(mixedRun.stderr).toBe('');
      const mixedPayload = JSON.parse(mixedRun.stdout) as ValidateJsonOutput;
      expect(mixedPayload.ok).toBe(false);
      expect(mixedPayload.checkedCount).toBe(3);
      expect(mixedPayload.failedCount).toBe(2);
      expect(mixedPayload.results.map((item) => [item.file, item.ok])).toEqual([
        ['ok/demo.json', true],
        ['bad/broken.json', false],
        ['bad/syntax.json', false],
      ]);
      const syntaxError = mixedPayload.results[2]?.errors[0];
      expect(Object.keys(syntaxError ?? {})).toEqual(['type', 'path', 'message']);
      expect(syntaxError?.type).toBe('SCHEMA_ERROR');
      expect(syntaxError?.path).toBe('/');
      expect(syntaxError?.message).toContain('不是合法 JSON:');

      const cliErrorRun = captureRun(['--json', 'missing.json'], workspace);
      expect(cliErrorRun.code).toBe(2);
      expect(cliErrorRun.stdout).toBe('');
      expect(cliErrorRun.stderr).toContain('路径不存在');
    });
  });

  it('真实子进程支持单文件与 --json 输出', () => {
    const result = spawnValidateCli(['--json', SAMPLE_PAGE_PATH]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    const payload = JSON.parse(result.stdout) as ValidateJsonOutput;
    expect(payload).toEqual({
      ok: true,
      checkedCount: 1,
      failedCount: 0,
      results: [
        {
          file: SAMPLE_PAGE_PATH,
          ok: true,
          errors: [],
        },
      ],
    });
  });

  it('参数与目标调用错误统一返回退出码 2', () => {
    withTempDir((workspace) => {
      writeTextFile(workspace, 'notes.txt', 'plain text');

      const missingPath = captureRun(['does-not-exist.json'], workspace);
      expect(missingPath.code).toBe(2);
      expect(missingPath.stdout).toBe('');
      expect(missingPath.stderr).toContain('路径不存在');

      const unknownFlag = captureRun(['--unknown'], workspace);
      expect(unknownFlag.code).toBe(2);
      expect(unknownFlag.stdout).toBe('');
      expect(unknownFlag.stderr).toContain('未知参数:--unknown');

      const shortFlag = captureRun(['-x'], workspace);
      expect(shortFlag.code).toBe(2);
      expect(shortFlag.stderr).toContain('未知参数:-x');

      const nonJsonFile = captureRun(['notes.txt'], workspace);
      expect(nonJsonFile.code).toBe(2);
      expect(nonJsonFile.stdout).toBe('');
      expect(nonJsonFile.stderr).toContain('仅支持 .json 页面文档');
    });
  });
});
