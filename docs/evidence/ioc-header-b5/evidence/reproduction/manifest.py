from pathlib import Path
import json,subprocess,hashlib,difflib
r=Path.cwd();out=r/'docs/evidence/ioc-header-b5/evidence';start=json.loads((out/'start-manifest.json').read_text());old={f['path']:f['sha256'] for f in start['files']};backup=Path(start['backup_directory']);files=[];patch=[]
paths=sorted(set(p for p in subprocess.check_output(['git','ls-files','--modified','--others','--exclude-standard','-z']).decode().split('\0')if p and not p.startswith(('docs/evidence/','packages/ui/prototypes/')) and p!='docs/plan/2026-10-19-ioc-header-handoff.md'))
manifest=[]
for name in paths:
 p=r/name
 if not p.is_file():continue
 data=p.read_bytes();sha=hashlib.sha256(data).hexdigest()
 if name in old:
  if sha==old[name]:continue
  before=(backup/name).read_text()
 else:
  result=subprocess.run(['git','show',start['base_ref']+':'+name],capture_output=True);before=result.stdout.decode()if result.returncode==0 else ''
  if hashlib.sha256(before.encode()).hexdigest()==sha:continue
 manifest.append({'path':name,'sha256':sha});files.append(name);patch.extend(difflib.unified_diff(before.splitlines(True),data.decode().splitlines(True),fromfile='a/'+name,tofile='b/'+name))
for name in sorted(set(old)-set(files)):
 p=r/name
 if p.is_file():manifest.append({'path':name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
manifest.sort(key=lambda f:f['path']);base={'base_ref':start['base_ref'],'head':subprocess.check_output(['git','rev-parse','HEAD']).decode().strip(),'baseline_manifest':'docs/evidence/ioc-header-b5/evidence/start-manifest.json','files':manifest};base['code_fingerprint']=hashlib.sha256(json.dumps({k:base[k]for k in ['base_ref','head','files']},ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest();(out/'code-manifest.json').write_text(json.dumps(base,ensure_ascii=False,indent=2)+'\n');(out/'b5.diff').write_text(''.join(patch));(out/'changed-files.json').write_text(json.dumps(files,ensure_ascii=False,indent=2)+'\n');print(len(files),base['code_fingerprint'])
