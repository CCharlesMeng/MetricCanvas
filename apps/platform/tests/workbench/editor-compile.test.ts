import { readFileSync } from 'node:fs';
import { compile } from 'svelte/compiler';
import { expect, it } from 'vitest';

it('compiles the page editor with the installed Svelte compiler', () => {
  // compatibility:check also runs this test with the declared minimum Svelte 5.29.0.
  const file = new URL('../../src/routes/manage/pages/[pageId]/edit/+page.svelte', import.meta.url);
  expect(() => compile(readFileSync(file, 'utf8'), {
    filename: file.pathname,
    generate: 'client'
  })).not.toThrow();
});
