import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  checkRepoHygiene,
  evaluateRepoHygiene,
  formatHygieneReport,
  MAX_FILE_BYTES,
  parseStageIndex,
} from './check-repo-hygiene.mjs';

function initTempGitRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'mc-repo-hygiene-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: dir });
  return dir;
}

describe('evaluateRepoHygiene', () => {
  it('allows files up to exact 1,000,000 bytes and blocks 1,000,001 bytes', () => {
    const result = evaluateRepoHygiene([
      { path: 'packages/page/src/exact.ts', size: MAX_FILE_BYTES },
      { path: 'packages/page/src/too-big.ts', size: MAX_FILE_BYTES + 1 },
    ]);

    assert.equal(result.ok, false);
    assert.equal(result.checkedFiles, 2);
    assert.deepEqual(result.violations, [
      {
        rule: 'max-file-size',
        path: 'packages/page/src/too-big.ts',
        size: MAX_FILE_BYTES + 1,
        limit: MAX_FILE_BYTES,
      },
    ]);
  });

  it('allows docs/evidence/README.md and blocks other docs/evidence paths', () => {
    const result = evaluateRepoHygiene([
      { path: 'docs/evidence/README.md', size: 120 },
      { path: 'docs/evidence/audit.md', size: 200 },
      { path: 'docs\\evidence\\nested\\capture.json', size: 50 },
    ]);

    assert.equal(result.ok, false);
    assert.deepEqual(result.violations, [
      { rule: 'forbidden-evidence-path', path: 'docs/evidence/audit.md' },
      { rule: 'forbidden-evidence-path', path: 'docs/evidence/nested/capture.json' },
    ]);
  });

  it('formats passing and failing reports cleanly', () => {
    const passReport = formatHygieneReport(
      { ok: true, checkedFiles: 3, violations: [] },
      'tracked',
    );
    assert.match(passReport, /checked 3 files, 0 violation\(s\)/);

    const failReport = formatHygieneReport(
      evaluateRepoHygiene([{ path: 'docs/evidence/report.md', size: 10 }]),
      'staged',
    );
    assert.match(failReport, /Repo hygiene \(staged\)/);
    assert.match(failReport, /\[forbidden-evidence-path\] docs\/evidence\/report\.md/);
  });

  it('parses git ls-files --stage output and skips submodule entries', () => {
    const raw = [
      '100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\tsrc/index.ts',
      '160000 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0\tvendor/sub',
      '120000 cccccccccccccccccccccccccccccccccccccccc 0\t.agents/link',
      '',
    ].join('\0');

    const map = parseStageIndex(raw);
    assert.equal(map.size, 2);
    assert.deepEqual(map.get('src/index.ts'), {
      mode: '100644',
      oid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    assert.equal(map.has('vendor/sub'), false);
  });
});

describe('checkRepoHygiene git integration', () => {
  it('checks tracked files and skips files deleted from the working tree', () => {
    const dir = initTempGitRepo();
    try {
      mkdirSync(join(dir, 'docs/evidence'), { recursive: true });
      writeFileSync(join(dir, 'docs/evidence/README.md'), '# Evidence\n');
      writeFileSync(join(dir, 'small.txt'), 'ok\n');
      writeFileSync(join(dir, 'removed.txt'), 'temp\n');
      execFileSync('git', ['add', '.'], { cwd: dir });
      execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir });
      unlinkSync(join(dir, 'removed.txt'));

      const clean = checkRepoHygiene({ cwd: dir });
      assert.equal(clean.ok, true);
      assert.equal(clean.checkedFiles, 2);

      writeFileSync(join(dir, 'oversize.bin'), Buffer.alloc(MAX_FILE_BYTES + 1, 65));
      writeFileSync(join(dir, 'docs/evidence/note.md'), 'not allowed\n');
      execFileSync('git', ['add', 'oversize.bin', 'docs/evidence/note.md'], { cwd: dir });

      const dirty = checkRepoHygiene({ cwd: dir });
      assert.equal(dirty.ok, false);
      assert.deepEqual(
        dirty.violations.map((item) => [item.rule, item.path]),
        [
          ['forbidden-evidence-path', 'docs/evidence/note.md'],
          ['max-file-size', 'oversize.bin'],
        ],
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('checks staged blob sizes in --staged mode even when working tree differs', () => {
    const dir = initTempGitRepo();
    try {
      writeFileSync(join(dir, 'base.txt'), 'hello\n');
      execFileSync('git', ['add', 'base.txt'], { cwd: dir });
      execFileSync('git', ['commit', '-q', '-m', 'base'], { cwd: dir });

      assert.equal(checkRepoHygiene({ cwd: dir, staged: true }).ok, true);

      writeFileSync(join(dir, 'blob.bin'), Buffer.alloc(MAX_FILE_BYTES + 10, 66));
      execFileSync('git', ['add', 'blob.bin'], { cwd: dir });
      // Shrink working-tree file after staging; staged blob must still fail.
      writeFileSync(join(dir, 'blob.bin'), 'tiny');

      const stagedResult = checkRepoHygiene({ cwd: dir, staged: true });
      assert.equal(stagedResult.ok, false);
      assert.equal(stagedResult.violations.length, 1);
      assert.equal(stagedResult.violations[0].rule, 'max-file-size');
      assert.equal(stagedResult.violations[0].size, MAX_FILE_BYTES + 10);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
