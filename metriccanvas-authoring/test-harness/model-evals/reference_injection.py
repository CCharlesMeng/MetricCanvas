"""Bounded host injection of authored references; not a model filesystem tool."""
from eval_evidence import injection_paths, sha


def has_issues(value):
    if isinstance(value,dict):
        if isinstance(value.get('issues'),list) and value['issues']:return True
        return any(has_issues(child) for child in value.values())
    if isinstance(value,list):return any(has_issues(child) for child in value)
    return False


class ReferenceInjection:
    def __init__(self,root,case,include_examples=False):
        self.root=root;self.case=case;self.include_examples=include_examples;self.events=[];self.loaded=set()
        self.skill=root/'metriccanvas-authoring/skill/metriccanvas-platform-authoring'
    @property
    def policy(self):
        return {'errors':'host-inject-on-first-tool-issue','examples':'preinjected-explicit-parameter-help' if self.include_examples else 'not-available; rerun with --include-examples if parameter examples are required',
                'filesystemTool':False}
    def load(self,path,phase,turn=0,step=0):
        if path in self.loaded:return ''
        content=path.read_text()  # Missing required author source must stop, never substitute discovery.
        self.events.append({'path':str(path.relative_to(self.root)),'sha256':sha(path),'phase':phase,'turn':turn,'step':step})
        self.loaded.add(path)
        return content
    def initial(self):
        paths=injection_paths(self.root,self.case,'unified')
        if self.include_examples:paths.append(self.skill/'references/examples.md')
        # Validate conditional source before any model request, even if no failure occurs.
        if not (self.skill/'references/errors.md').is_file():raise ValueError('ERROR_REFERENCE_UNAVAILABLE')
        text='\n\n'.join(self.load(p,'startup') for p in paths)
        declaration=('部署参考由宿主注入，无文件读取工具；遇到实际工具issues时宿主会补入errors.md。'
                     + ('参数示例已由本次运行显式选定并注入。' if self.include_examples else 'examples.md本次未提供；若缺参数示例须明确缺口，不用数据发现查文档。'))
        return declaration+'\n\n'+text
    def after_tools(self,results,turn,step):
        if any(has_issues(result) for result in results):
            content=self.load(self.skill/'references/errors.md','first-tool-issue',turn,step)
            if content:return {'role':'system','content':'宿主按本次实际工具错误补充已锁定参考：\n'+content}
        return None
