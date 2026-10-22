from pathlib import Path
import tempfile,shutil,subprocess,json
root=Path.cwd();out=Path(tempfile.mkdtemp(prefix='ioc-b5-skill-installed-'));skill=out/'metriccanvas-local-authoring';shutil.copytree(root/'metriccanvas-authoring/skill/metriccanvas-local-authoring',skill,symlinks=True)
for path in skill.rglob('*'):
 if path.is_symlink():assert path.resolve().is_relative_to(skill.resolve()),path
pages=out/'pages';pages.mkdir()
for name in ['source','list','detail']:
 name='ioc-header-navigation-'+name+'-demo.json';shutil.copyfile(root/'pages'/name,pages/name)
result=subprocess.run(['node',str(skill/'scripts/validate-page.mjs'),str(pages)],capture_output=True,text=True);print(result.stdout);print(result.stderr);assert result.returncode==0
version=subprocess.check_output(['node',str(skill/'scripts/validate-page.mjs'),'--version'],text=True).strip();assert json.loads(version)['schemaVersion']=='6.36';print(version)
print('Standalone copied Skill:',skill)
Path('/tmp/ioc-b5-skill-installed-path').write_text(str(out));(out/'summary.json').write_text(json.dumps({'skill':str(skill),'pages':3,'schemaVersion':'6.36','validation_exit_code':result.returncode,'external_symlinks':0},indent=2)+'\n')
