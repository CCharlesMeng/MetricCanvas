/** Reproduce only component CSS from the observed, digest-pinned official OS Theme assets. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const postcss = createRequire(require.resolve('vite/package.json'))('postcss');
const repo = fileURLToPath(new URL('../../..', import.meta.url));
const evidence = resolve(repo, 'docs/evidence/platform-ui-os-theme-2026-10-12');
const manifest = JSON.parse(readFileSync(resolve(evidence, 'sources.json'), 'utf8'));
const families = /\.tiny-(?:button|input|textarea|select|option|tabs|tag|pager|grid|dropdown|dialog-box)(?:\b|__)/;
const classes = new Set();
function scan(dir) { for(const entry of readdirSync(dir,{withFileTypes:true})) { const path=resolve(dir,entry.name);if(entry.isDirectory())scan(path);else if(entry.name.endsWith('.svelte'))for(const match of readFileSync(path,'utf8').matchAll(/mc-ui-[\w-]+/g))classes.add(match[0].replace('mc-ui-','tiny-')); } }
scan(resolve(repo,'packages/ui/src/components'));
for(const family of ['button','tag']) for(const variant of ['primary','danger','info','success','warning'])classes.add(`tiny-${family}--${variant}`);
const css = postcss.root();
let variables = '';
function select(parent) {
  const out = postcss.root();
  for (const node of parent.nodes ?? []) {
    if (node.type === 'rule') {
      if (node.selector === ':root,:host' || node.selector === ':root, :host') {
        variables += node.nodes.filter(n => n.type === 'decl' && n.prop.startsWith('--tv-')).map(n => `${n.prop}:${n.value};`).join('');
      }
      const selectors = node.selectors.filter(s => /^\.tiny-/.test(s) && families.test(s) && !s.includes('[data-v-') && [...s.replace(/:not\((?:[^()]|\([^()]*\))*\)/g,'').matchAll(/\.tiny-([\w-]+)/g)].every(m=>classes.has('tiny-'+m[1])));
      if (!selectors.length) continue;
      const copy = node.clone();
      for (const decl of [...copy.nodes]) if (decl.type === 'decl' && decl.prop === '-webkit-line-clamp') copy.append(decl.clone({prop:'line-clamp'}));
      copy.selectors = selectors.map(s => `.mc-ui-theme :global(${s.replaceAll('tiny-', 'mc-ui-')})`);
      out.append(copy);
    } else if (node.type === 'atrule' && ['media', 'supports'].includes(node.name)) {
      const contents = select(node);
      if (contents.nodes.length) { const copy = node.clone({ nodes: [] }); copy.append(contents.nodes); out.append(copy); }
    }
  }
  return out;
}
for (const asset of manifest.assets) {
  const source = readFileSync(resolve(evidence, asset.file));
  if (createHash('sha256').update(source).digest('hex') !== asset.sha256) throw Error(`Official source digest mismatch: ${asset.file}`);
  css.append(select(postcss.parse(source.toString())).nodes);
}
const component = `<script lang="ts">\n  import type { Snippet } from 'svelte';\n  let { children }: { children: Snippet } = $props();\n</script>\n<div class="mc-ui-theme">{@render children()}</div>\n<style>\n/* OpenTiny TinyVue OS Theme 3.32.0, MIT; see LICENSE and digest-pinned sources.json. */\n.mc-ui-theme { display:contents; font-family:Helvetica,Arial,PingFangSC-Regular,'Hiragino Sans GB','Microsoft YaHei',微软雅黑,'Microsoft JhengHei';font-size:14px;line-height:1.5;color:#191919;${variables} }\n.mc-ui-theme :global(*) { box-sizing:border-box; }\n.mc-ui-theme :global(button),.mc-ui-theme :global(input),.mc-ui-theme :global(textarea) { font-family:inherit; }\n${css.nodes.map(n=>n.toString()).join('\n')}\n</style>\n`;
writeFileSync(resolve(repo, 'packages/ui/src/shared/Theme.svelte'), component);
console.log(`Frozen ${css.nodes.length} source rules; ${component.length} bytes. No document-global TinyVue stylesheet is required.`);
