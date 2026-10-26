import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage, validate } from '../src/validate';
import { versionPolicy } from '../src/version';

const example = () => JSON.parse(readFileSync('pages/capabilities/layout/metric-card-primary-detail.json', 'utf8'));

describe('主指标与多行次级指标', () => {
  it('接受真实演示页的0/1/3/6行，校验不改变原始声明', () => {
    const page = example();
    const original = structuredClone(page);
    expect(parsePage(page).ok).toBe(true);
    expect(page.sections[0].components.map((card: { props: { secondaryRows?: unknown[] } }) => card.props.secondaryRows?.length ?? 0)).toEqual([0, 1, 3, 6]);
    expect(page).toEqual(original);
  });

  it('次级指标数量没有人为上限', () => {
    const page = example();
    const props = page.sections[0].components[1].props;
    props.secondaryRows = Array.from({ length: 20 }, () => structuredClone(props.secondaryRows[0]));
    expect(parsePage(page).ok).toBe(true);
  });

  it('拒绝把多个主指标塞进主次指标形态', () => {
    const page = example();
    const props = page.sections[0].components[0].props;
    props.rows.push(structuredClone(props.rows[0]));
    expect(validate(page)).toContainEqual({ type: 'SCHEMA_ERROR', path: '/sections/0/components/0/props/rows', message: 'primaryDetail 指标卡必须且只能声明一个主指标；次级指标放入 secondaryRows' });
  });

  it('新形态的版本下限生效', () => {
    const page = example();
    page.schemaVersion = '6.64';
    expect(validate(page).some(error => error.message.includes('由 6.65 引入'))).toBe(true);
    page.schemaVersion = versionPolicy.current;
    expect(parsePage(page).ok).toBe(true);
  });

  it('次级指标复用字段契约，未知字段不会静默显示为空', () => {
    const page = example();
    page.sections[0].components[1].props.secondaryRows[0].valueField.field = 'unknown';
    expect(validate(page)).toContainEqual({ type: 'SCHEMA_ERROR', path: '/sections/0/components/1/props/secondaryRows/0/valueField', message: '字段 unknown 不在数据槽 main 的数据源 metrics 中' });
  });

  it('下划线不赋予点击行为；link仍然要求声明动作', () => {
    const page = example();
    const props = page.sections[1].components[1].props;
    delete props.actions;
    expect(validate(page).some(error => error.path.endsWith('/secondaryRows/0/link'))).toBe(true);
    props.secondaryRows[0].link = false;
    expect(parsePage(page).ok).toBe(true);
  });

  it('旧形态仍然允许多个主行', () => {
    const page = example();
    const props = page.sections[0].components[0].props;
    props.variant = 'compactStack';
    props.rows.push(structuredClone(props.rows[0]));
    expect(parsePage(page).ok).toBe(true);
  });
});
