<script lang="ts">
 import Theme from '../../shared/Theme.svelte';
 let { value='', oninput, oncommit, disabled=false, readonly=false, placeholder='', label, type='text', id, invalid=false }: {value?:string;oninput?:(value:string)=>void;oncommit?:(value:string)=>void;disabled?:boolean;readonly?:boolean;placeholder?:string;label?:string;type?:'text'|'search'|'password'|'number'|'date'|'month'|'date'|'month';id?:string;invalid?:boolean}=$props();
</script>
<Theme><div class="mc-ui-input" class:is-disabled={disabled}><input class="mc-ui-input__inner" {id} {type} {value} {disabled} {readonly} {placeholder} aria-label={label} aria-invalid={invalid} oninput={event=>oninput?.(event.currentTarget.value)} onchange={event=>oncommit?.(event.currentTarget.value)}/></div></Theme>
