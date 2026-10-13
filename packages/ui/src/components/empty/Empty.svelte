<script lang="ts">
 let {message='暂无数据'}:{message?:string}=$props();
</script>
<div class="empty" role="status">{message}</div>
<style>.empty{padding:32px 16px;text-align:center;color:#808080;font-size:14px;line-height:1.5}</style>
