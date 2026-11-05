import {mount} from 'svelte';
import UiHarness from './UiHarness.svelte';
import SelectionHarness from './SelectionHarness.svelte';
import PopoverHarness from './PopoverHarness.svelte';
const host=document.getElementById('app')!;
const params = new URLSearchParams(location.search);
const Harness=params.has('popovers')?PopoverHarness:params.has('selection')?SelectionHarness:UiHarness;
if(new URLSearchParams(location.search).has('shadow')){const root=host.attachShadow({mode:'open'});const target=document.createElement('div');root.append(target);mount(Harness,{target});}else mount(Harness,{target:host});
