<script lang="ts">
 import type {Snippet} from 'svelte';import Theme from '../../shared/Theme.svelte';
 let {children,type='info'}:{children:Snippet;type?:'info'|'success'|'warning'|'danger'}=$props();
</script>
<Theme><span class="mc-ui-tag mc-ui-tag--light mc-ui-tag--{type}">{@render children()}</span></Theme>
