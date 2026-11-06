import { MediaQuery } from 'svelte/reactivity';

// Device presentation follows the host viewport; SSR and static rendering default to PC.
const mobile = new MediaQuery('(max-width: 760px)', false);
export function mobilePresentation(): boolean { return mobile.current; }
