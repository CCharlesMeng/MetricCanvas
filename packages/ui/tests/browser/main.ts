import {mount} from 'svelte';
import UiHarness from './UiHarness.svelte';
import SelectionHarness from './SelectionHarness.svelte';
const host=document.getElementById('app')!;
const Harness=new URLSearchParams(location.search).has('selection')?SelectionHarness:UiHarness;
if(new URLSearchParams(location.search).has('shadow')){const root=host.attachShadow({mode:'open'});const target=document.createElement('div');root.append(target);mount(Harness,{target});}else mount(Harness,{target:host});
