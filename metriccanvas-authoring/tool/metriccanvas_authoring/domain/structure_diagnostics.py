"""Schema-owned diagnostics: never return exception messages or instance values."""
from jsonschema import Draft202012Validator


def schema_issues(schema, instance, prefix=''):
    result=[]
    def visit(rule, value, path):
        for error in Draft202012Validator(rule).iter_errors(value):
            location=path + ''.join('/'+str(p).replace('~','~0').replace('/','~1')[:128] for p in error.path)
            if error.validator in {'oneOf','anyOf'}:
                branches=error.validator_value
                if isinstance(error.instance,dict):
                    selected=[]
                    for branch in branches:
                        props=branch.get('properties',{})
                        discriminators={k:v['const'] for k,v in props.items() if 'const' in v}
                        if discriminators and all(error.instance.get(k)==v for k,v in discriminators.items()):
                            selected.append(branch)
                    if selected:
                        for branch in selected: visit(branch,error.instance,location)
                        continue
            common={'code':'STRUCTURE_PLAN_INVALID','path':location[:512], 'rule':error.validator,
                    'objectIds':[], 'blocking':True, 'options':['revise-reference']}
            if error.validator=='required':
                for key in error.validator_value:
                    if key not in error.instance:
                        result.append({**common,'path':(location+'/'+key)[:512]})
            else:
                if error.validator=='enum': common['allowedValues']=error.validator_value
                if error.validator=='const': common['allowedValues']=[error.validator_value]
                result.append(common)
    visit(schema,instance,prefix)
    return result
