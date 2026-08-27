import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../src/RuntimeSection.svelte', import.meta.url), 'utf8');

describe('RuntimeSection narrow-screen backdrop flow', () => {
  it('keeps the backdrop full-width when the higher-specificity rule returns it to normal flow', () => {
    expect(source).toMatch(
      /\.section-grid\.has-backdrop > \.cell\.backdrop-cell\s*\{[^}]*grid-column:\s*1\s*\/\s*-1\s*!important;/s
    );
  });
});
