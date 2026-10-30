<svelte:options css="injected" />
<script lang="ts"></script>

<span class="loading-spinner" role="status" aria-label="正在加载">
  <span class="ring" aria-hidden="true"></span>
</span>

<style>
  .loading-spinner {
    display: inline-flex;
    flex: none;
    width: 16px;
    height: 16px;
    vertical-align: middle;
  }
  .ring {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    border: 2px solid var(--mc-color-border, #e4e4e7);
    border-top-color: var(--mc-color-primary, #536dfe);
    border-radius: 50%;
    animation: mc-loading-spin 0.8s linear infinite;
  }
  @keyframes mc-loading-spin {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ring { animation: none; }
  }
</style>
