import { describe, expect, it, vi } from 'vitest';
import { headerBackAction } from '../src/ioc-header/back';

const explicit = { back: true };

describe('IOC header default browser return', () => {
  it('uses the browser history without a navigation adapter or return context', () => {
    const history = { length: 2, back: vi.fn() };
    headerBackAction(explicit, undefined, { history })?.();
    expect(history.back).toHaveBeenCalledOnce();
  });

  it('uses the supplied callback even without a return context or browser history', () => {
    const onback = vi.fn();
    const history = { length: 2, back: vi.fn() };
    expect(headerBackAction(explicit, onback, undefined)).toBe(onback);
    headerBackAction(explicit, onback, { history })?.();
    expect(onback).toHaveBeenCalledOnce();
    expect(history.back).not.toHaveBeenCalled();
  });

  it('has no default action without browser history or with only one entry', () => {
    expect(headerBackAction(explicit, undefined, undefined)).toBeUndefined();
    expect(headerBackAction(explicit, undefined, { history: { length: 1, back: vi.fn() } })).toBeUndefined();
  });

  it('uses actual backward availability when the Navigation API is available', () => {
    const history = { length: 3, back: vi.fn() };
    expect(headerBackAction(explicit, undefined, { history, navigation: { canGoBack: false } })).toBeUndefined();
    headerBackAction(explicit, undefined, { history, navigation: { canGoBack: true } })?.();
    expect(history.back).toHaveBeenCalledOnce();
  });

  it('keeps undeclared return intent and legacy adapter behavior', () => {
    const history = { length: 2, back: vi.fn() };
    expect(headerBackAction({ back: false }, vi.fn(), { history })).toBeUndefined();
    expect(headerBackAction({ back: true, legacyBack: true }, undefined, { history })).toBeUndefined();
    const onback = vi.fn();
    expect(headerBackAction({ back: true, legacyBack: true }, onback, { history })).toBe(onback);
  });
});
