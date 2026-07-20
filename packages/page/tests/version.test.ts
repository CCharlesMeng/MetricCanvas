import { describe, expect, it } from 'vitest';
import { versionErrors, upgradeWarnings, supportedVersions, type VersionPolicy } from '../src/version';
import { validate } from '../src/validate';

import unsupportedFormatVersion from '../fixtures/invalid/unsupported-format-version.json';

/** 注入的版本表(独立事实):模拟 DSL 已出 2.0、1.0 退为 N-1 的未来局面 */
const nextEra: VersionPolicy = { current: '2.0', previous: '1.0' };

function doc(formatVersion: unknown): unknown {
  return { formatVersion };
}

describe('版本判定:运行时兼容 N/N-1,N-2 拒绝(solution.md §3 第 4 条)', () => {
  it('当前版本(N)与前一版本(N-1)都受支持,无错误', () => {
    expect(versionErrors(doc('2.0'), nextEra)).toEqual([]);
    expect(versionErrors(doc('1.0'), nextEra)).toEqual([]);
    expect(supportedVersions(nextEra)).toEqual(['1.0', '2.0']);
  });

  it('N-2 版本报 SCHEMA_ERROR,错误信息含迁移指引', () => {
    const errors = versionErrors(doc('0.9'), nextEra);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ type: 'SCHEMA_ERROR', path: '/formatVersion' });
    expect(errors[0].message).toContain('0.9');
    expect(errors[0].message).toContain('pnpm migrate');
  });

  it('formatVersion 缺失或非字符串不在此报错(归结构校验的 required/type 负责)', () => {
    expect(versionErrors(doc(undefined), nextEra)).toEqual([]);
    expect(versionErrors(doc(1), nextEra)).toEqual([]);
    expect(versionErrors(null, nextEra)).toEqual([]);
  });

  it('尚无历史版本时(previous=null),只有当前版本受支持', () => {
    const onlyCurrent: VersionPolicy = { current: '1.0', previous: null };
    expect(versionErrors(doc('1.0'), onlyCurrent)).toEqual([]);
    expect(versionErrors(doc('0.9'), onlyCurrent)).toHaveLength(1);
  });
});

describe('升版警告:N-1 是警告不是错误(CI 提示不阻断)', () => {
  it('N-1 文档产出升版警告,含当前版本号', () => {
    const warnings = upgradeWarnings(doc('1.0'), nextEra);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].path).toBe('/formatVersion');
    expect(warnings[0].message).toContain('2.0');
    expect(warnings[0].message).toContain('pnpm migrate');
  });

  it('当前版本无警告;N-2 也无警告(它是错误,不重复报)', () => {
    expect(upgradeWarnings(doc('2.0'), nextEra)).toEqual([]);
    expect(upgradeWarnings(doc('0.9'), nextEra)).toEqual([]);
  });
});

describe('validate 集成:不支持的版本被拒绝且只报一条带指引的错误', () => {
  it('formatVersion 0.4(未知版本)报单条 SCHEMA_ERROR,定位 /formatVersion,含迁移指引', () => {
    const errors = validate(unsupportedFormatVersion);
    const versionRelated = errors.filter((e) => e.path === '/formatVersion');
    expect(versionRelated).toHaveLength(1);
    expect(versionRelated[0].message).toContain('pnpm migrate');
  });
});
