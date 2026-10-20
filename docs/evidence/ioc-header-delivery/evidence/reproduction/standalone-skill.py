from pathlib import Path
import tempfile,shutil,subprocess,json
root=Path.cwd();out=Path(tempfile.mkdtemp(prefix='ioc-b5-skill-installed-'));skill=out/'metriccanvas-local-authoring';shutil.copytree(root/'metriccanvas-authoring/skill/metriccanvas-local-authoring',skill,symlinks=True)
for path in skill.rglob('*'):
 if path.is_symlink():assert path.resolve().is_relative_to(skill.resolve()),path
pages=out/'pages';pages.mkdir()
for source in (root/'pages').rglob('*.json'):
 target=pages/source.relative_to(root/'pages');target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
result=subprocess.run(['node',str(skill/'scripts/validate-page.mjs'),str(pages)],capture_output=True,text=True);print(result.stdout);print(result.stderr);assert result.returncode==0
version=subprocess.check_output(['node',str(skill/'scripts/validate-page.mjs'),'--version'],text=True).strip();assert json.loads(version)['schemaVersion']=='6.40';print(version)
print('Standalone copied Skill:',skill)
Path('/tmp/ioc-delivery-skill-installed-path').write_text(str(out));(out/'summary.json').write_text(json.dumps({'skill':str(skill),'pages':len(list(pages.rglob('*.json'))),'schemaVersion':'6.40','validation_exit_code':result.returncode,'external_symlinks':0},indent=2)+'\n')
