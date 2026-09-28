import {installLocalDevRuntimeConfig,readPageAssetsRuntimeConfig} from '../lib/runtime-config';
import {mountPlatform} from '../lib/integration/mount';
import {panguDialogueAdapter} from '../lib/dialogue/runtime';
import {readAuthoringIntegration} from '../lib/dialogue/authoring-integration';
if(import.meta.env.DEV){
  installLocalDevRuntimeConfig();
}
const instance=await mountPlatform(document.getElementById('app')!,{
  routeBase:import.meta.env.BASE_URL.replace(/\/$/,'')||'/',readConfig:()=>readPageAssetsRuntimeConfig(),
  subscribeConfig(changed){window.addEventListener('metriccanvas:config-changed',changed);return()=>window.removeEventListener('metriccanvas:config-changed',changed);},
  dialogueAdapter:panguDialogueAdapter,authoring:readAuthoringIntegration(),events:window
},false);
if(import.meta.hot)import.meta.hot.dispose(()=>{void instance.destroy();});
