<script lang="ts">
  import {onMount} from 'svelte';
  import {createDqeGateway} from '@metriccanvas/engine/dqe';
  import source from '../../../../../packages/page/fixtures/parameter-extraction/tokens-parameter-source.json';
  import {createInlineParameterPublication} from './inline-parameter-publication';
  import {previewParameterPage} from './preview-parameter-page';
  import InlineParameterReview from './InlineParameterReview.svelte';
  let key='fixture-r1';
  const gateway=createDqeGateway({endpoint:'/inline-publication-dqe'});
  const publication=createInlineParameterPublication({
    sourceKey:()=>key,
    readVerifiedSource:async()=>({document:source,baseline:key,dimensionIdentities:Object.fromEntries(Object.keys(source.dataSources).map(id=>[id,{'区域':'region'}]))}),
    preview:(document,signal)=>previewParameterPage(document,gateway,signal),
    save:async(document)=>{
      // Explicit local HTTP substitute. Production delegates to coordinator.publishTemplate.
      const response=await fetch('/inline-publication-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(document)});
      if(!response.ok)throw Error('替身响应未知');
      return await response.json();
    }
  });
  onMount(()=>()=>publication.dispose());
</script>
<p>参数模板本地 HTTP 替身验收，不代表真实 Java 已接通。</p>
<button onclick={()=>{key+='x';publication.invalidate();}}>改变参数来源</button>
<InlineParameterReview {publication} dataGateway={gateway}/>
