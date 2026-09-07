import { describe, expect, it } from 'vitest';
import { gaugeArc, gaugeProgress } from '../src/components/gauge/gauge';
import { resolveActiveTab } from '../src/components/tab-container/tabs';

describe('gauge 进度', () => {
  it('把值夹到区间并换算成 0–1', () => {
    expect(gaugeProgress(72.4, 0, 100)).toBeCloseTo(0.724);
    expect(gaugeProgress(-10, 0, 100)).toBe(0);
    expect(gaugeProgress(140, 0, 100)).toBe(1);
    expect(gaugeProgress(50, 50, 50)).toBe(0);
  });

  it('空进度不画弧,满进度画大半圆', () => {
    expect(gaugeArc(0, 36)).toMatch(/^M /);
    expect(gaugeArc(1, 36)).toContain('A 36 36');
  });
});

describe('Tab 当前项', () => {
  const tabs = [
    { id: 'overview', label: '概览' },
    { id: 'initiated', label: 'TOP已立项项目' }
  ];

  it('优先已选,其次 defaultTab,最后第一项', () => {
    expect(resolveActiveTab(tabs, 'initiated', 'overview')).toBe('initiated');
    expect(resolveActiveTab(tabs, 'missing', 'overview')).toBe('overview');
    expect(resolveActiveTab(tabs, undefined, undefined)).toBe('overview');
    expect(resolveActiveTab([], undefined, 'overview')).toBeUndefined();
  });
});
