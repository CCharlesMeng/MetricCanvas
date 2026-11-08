<script lang="ts">
  let { values, selected, all = false, disabled = false, onchange }: {
    values: readonly (string | number)[];
    selected: readonly (string | number)[];
    all?: boolean;
    disabled?: boolean;
    onchange: (values: (string | number)[], all: boolean) => void;
  } = $props();
  const allSelected = $derived(all);
  const someSelected = $derived(values.some(value => selected.includes(value)));
  function toggle(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    // Restore controlled DOM state before emitting; the owner may reject a change.
    input.checked = allSelected;
    input.indeterminate = someSelected && !allSelected;
    if (disabled) return;
    onchange(allSelected ? [] : [...new Set([...selected, ...values])], !allSelected);
  }
</script>

<label class="candidate-option">
  <input type="checkbox" checked={allSelected} indeterminate={someSelected && !allSelected}
    {disabled} onchange={toggle} />
  <span>全选</span>
</label>

<style>
  label { display: flex; align-items: center; gap: 8px; padding: 6px 2px; border-bottom: 1px solid #eee; font-weight: normal; }
  input { flex: 0 0 auto; }
</style>
