import ast, collections, datetime, hashlib, json, pathlib, re, subprocess
ROOT=pathlib.Path.cwd()
OUT=ROOT/'docs/evidence/2026-09-22-architecture-audit'
raw=subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard']).decode().split('\0')
paths=sorted(set(p for p in raw if p and not p.startswith('docs/evidence/2026-09-22-architecture-audit/')))
code_ext={'.ts','.tsx','.js','.mjs','.cjs','.svelte','.py','.java','.css','.scss','.sass','.less','.sh','.bash','.sql','.html','.vue','.go','.rs','.kt','.kts','.c','.h','.cpp','.rb'}
records=[]
for s in paths:
 p=ROOT/s
 if not p.is_file() or p.is_symlink(): continue
 try: text=p.read_text()
 except (UnicodeError,OSError): continue
 if '\0' in text: continue
 parts=p.relative_to(ROOT).parts
 module='/'.join(parts[:2]) if parts[0] in {'apps','packages','tools'} and len(parts)>2 else parts[0] if len(parts)>1 else '(root)'
 kind='other'
 if p.suffix in code_ext:
  kind='implementation'
  if parts[0] in {'tools','scripts'} or len(parts)==1 or p.name.endswith(('.config.ts','.config.js')): kind='tooling'
  if any(x in {'tests','test','test-harness','__tests__','fixtures','model-evals'} for x in parts) or re.search(r'\.(test|spec)\.',p.name): kind='test'
  if '/prototype/' in s or '/prototype-' in s or p.name.endswith('-fixture.ts') or p.name.endswith('Fixture.svelte') or '/src/routes/dev/' in s: kind='dev-prototype'
  if '/generated/' in s or '/_bundle/' in s: kind='generated-code'
  if parts[0]=='metriccanvas-authoring' and parts[1]=='scripts': kind='tooling'
  if parts[0]=='.agents': kind='tooling'
  if s.startswith('docs/archive/'): kind='archived-code'
 elif p.suffix=='.md': kind='documentation'
 elif p.suffix in {'.json','.yaml','.yml','.toml','.lock','.in'}: kind='data-contract-config'
 lines=text.splitlines()
 records.append(dict(path=s,module=module,kind=kind,lines=len(lines),nonblank=sum(bool(l.strip()) for l in lines),sha256=hashlib.sha256(text.encode()).hexdigest()))
mods={}
for r in records:
 m=mods.setdefault(r['module'],dict(files=0,lines=0,code=0,code_nonblank=0,implementation=0,test=0,tooling=0,dev_prototype=0,generated_code=0,archived_code=0,documentation=0,data_contract_config=0,other=0))
 m['files']+=1;m['lines']+=r['lines'];m[r['kind'].replace('-','_')]+=r['lines']
 if r['kind'] in {'implementation','test','tooling','dev-prototype','generated-code','archived-code'}:m['code']+=r['lines'];m['code_nonblank']+=r['nonblank']
base=ROOT/'metriccanvas-authoring/tool'
modules={}
for p in (base/'metriccanvas_authoring').rglob('*.py'):
 if '__pycache__' in p.parts or '_bundle' in p.parts:continue
 mod='.'.join(p.relative_to(base).with_suffix('').parts)
 if mod.endswith('.__init__'):mod=mod[:-9]
 modules[mod]=p
edges={m:set() for m in modules}
for m,p in modules.items():
 tree=ast.parse(p.read_text())
 for n in ast.walk(tree):
  names=[]
  if isinstance(n,ast.Import): names=[x.name for x in n.names]
  elif isinstance(n,ast.ImportFrom):
   prefix=n.module or ''
   if n.level:
    parent=m if p.name=='__init__.py' else m.rsplit('.',1)[0]
    prefix='.'.join(parent.split('.')[:len(parent.split('.'))-n.level+1]+([prefix] if prefix else []))
   names=[prefix]+[prefix+'.'+x.name for x in n.names]
  for name in names:
   if name in modules and name!=m:edges[m].add(name)
roots=['metriccanvas_authoring.entrypoints.compat.server','metriccanvas_authoring.entrypoints.compat.content_server','metriccanvas_authoring.platform_server','metriccanvas_authoring.entrypoints.compat.lifecycle_server']
seen=set();stack=roots.copy()
while stack:
 m=stack.pop()
 if m in seen:continue
 seen.add(m);stack+=list(edges.get(m,()))
unreachable=[str(p.relative_to(ROOT)) for m,p in modules.items() if m not in seen and p.name!='__init__.py']
violations=[(m,d) for m,ds in edges.items() for d in ds if '.adapters.' in d and '.bootstrap.' not in m and '.adapters.' not in m]
# strongly connected components
index={};low={};active=set();stack=[];components=[]
def visit(m):
 index[m]=low[m]=len(index);stack.append(m);active.add(m)
 for d in edges[m]:
  if d not in index:visit(d);low[m]=min(low[m],low[d])
  elif d in active:low[m]=min(low[m],index[d])
 if low[m]==index[m]:
  c=[]
  while True:
   d=stack.pop();active.remove(d);c.append(d)
   if d==m:break
  if len(c)>1:components.append(sorted(c))
for m in modules:
 if m not in index:visit(m)
result=dict(time=datetime.datetime.now().isoformat(),head=subprocess.check_output(['git','rev-parse','HEAD']).decode().strip(),method='git tracked plus nonignored untracked existing regular text files; physical lines incl comments and blank; code by extension; no symlink target, ignored build/venv/node_modules, or audit outputs; nonblank includes comments',modules=mods,files=records,python=dict(module_count=len(modules),edges={m:sorted(ds) for m,ds in edges.items()},unreachable_from_console_scripts=sorted(unreachable),adapter_imports_outside_bootstrap=violations,cycles=components))
OUT.mkdir(exist_ok=True,parents=True)
(OUT/'inventory.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('MODULES')
for m,v in sorted(mods.items(),key=lambda it:-it[1]['code']):
 print(m, 'code',v['code'],'impl',v['implementation'],'test',v['test'],'tool',v['tooling'],'dev',v['dev_prototype'],'data',v['data_contract_config'],'doc',v['documentation'])
print('PYTHON UNREACHABLE',json.dumps(unreachable,indent=2));print('ADAPTER IMPORTS',violations);print('CYCLES',components)
print('LARGEST IMPLEMENTATION')
for r in sorted([r for r in records if r['kind']=='implementation'],key=lambda r:-r['lines'])[:24]:print(r['lines'],r['path'])
