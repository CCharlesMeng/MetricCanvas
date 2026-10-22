"""Read all static identities of a nonrecursive document field binding."""
def binding_keys(binding):
    leaves = binding['byFilter']['cases'].values() if isinstance(binding, dict) and 'byFilter' in binding else [binding]
    return {('main', leaf) if isinstance(leaf, str) else (leaf['data'], leaf['field']) for leaf in leaves}
