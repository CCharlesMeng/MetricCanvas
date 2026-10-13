<script lang="ts">
 import Theme from '../../shared/Theme.svelte';
 let {value='',oninput,oncommit,disabled=false,readonly=false,placeholder='',label,rows=3,invalid=false}:{value?:string;oninput?:(value:string)=>void;oncommit?:(value:string)=>void;disabled?:boolean;readonly?:boolean;placeholder?:string;label?:string;rows?:number;invalid?:boolean}=$props();
</script>
<Theme><div class="mc-ui-textarea" class:is-disabled={disabled}><textarea class="mc-ui-textarea__inner" {value} {disabled} {readonly} {placeholder} {rows} aria-label={label} aria-invalid={invalid} oninput={event=>oninput?.(event.currentTarget.value)} onchange={event=>oncommit?.(event.currentTarget.value)}></textarea></div></Theme>
