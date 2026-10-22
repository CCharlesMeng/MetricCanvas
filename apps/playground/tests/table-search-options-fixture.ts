import { mount, unmount } from 'svelte';
import RuntimeView from '../../../packages/engine/runtime-ui/src/RuntimeView.svelte';

export function mountTableSearchFixture(target: HTMLElement, document: unknown) {
  const runtime = mount(RuntimeView, { target, props: { document } });
  return () => unmount(runtime);
}
