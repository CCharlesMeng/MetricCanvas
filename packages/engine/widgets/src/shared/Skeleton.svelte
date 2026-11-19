<svelte:options css="injected" />
<script lang="ts">
  interface Props {
    width?: string;
    inline?: boolean;
    shimmer?: boolean;
  }

  let { width = '100%', inline = false, shimmer = false }: Props = $props();
</script>

<span class="skeleton" class:inline class:shimmer style:width aria-hidden="true"></span>

<style>
  .skeleton {
    display: block;
    max-width: 100%;
    height: 12px;
    margin-block: 4px;
    border-radius: 4px;
    background: var(--mc-color-border, #e4e4e7);
    opacity: 0.55;
  }
  .inline {
    display: inline-block;
    margin-block: 0;
    vertical-align: 0.1em;
  }

  @media (prefers-reduced-motion: no-preference) {
    .shimmer {
      position: relative;
      overflow: hidden;
    }
    .shimmer::after {
      position: absolute;
      inset: 0;
      content: '';
      background: linear-gradient(100deg, transparent 22%, rgb(255 255 255 / 0.72) 50%, transparent 78%);
      animation: skeleton-sweep 1.8s linear infinite;
    }
  }

  @keyframes skeleton-sweep {
    from { transform: translateX(-100%); }
    to { transform: translateX(100%); }
  }
</style>
