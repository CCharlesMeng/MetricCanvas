import {mount} from 'svelte';
import UiHarness from './UiHarness.svelte';
const host=document.getElementById('app')!;
if(new URLSearchParams(location.search).has('shadow')){const root=host.attachShadow({mode:'open'});const target=document.createElement('div');root.append(target);mount(UiHarness,{target});}else mount(UiHarness,{target:host});
