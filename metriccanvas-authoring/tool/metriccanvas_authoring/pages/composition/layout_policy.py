"""Platform creation defaults and non-destructive layout transition impacts.

These are authoring defaults, never restrictions on valid page combinations.
RuntimeSection/RuntimeSurface remain the presentation and responsive authority.
"""
from copy import deepcopy


def apply_creation_layout(document, layout):
    """Apply only to a newly assembled Platform document, never an edit baseline."""
    page = deepcopy(document)
    page['layout'] = layout
    if layout == 'report':
        return page
    sections = []
    for section in page['sections']:
        # Keep the automatically generated page header outside module cards.
        headers = [c for c in section['components'] if c['type'] == 'reportHeader']
        content = [c for c in section['components'] if c['type'] != 'reportHeader']
        if headers and content:
            occupied = {s['id'] for s in page['sections']} | {s['id'] for s in sections}
            header_id = section['id'] + '-heading'
            while header_id in occupied:
                header_id += '-heading'
            sections.append({'id': header_id, 'container': 'plain', 'components': headers})
            section['components'] = content
        elif headers:
            section['container'] = 'plain'
            sections.append(section)
            continue
        # Generated grouped views keep their scope title on an explicit shared card.
        # Untitled modules use the runtime's default cells, including map height.
        if section.get('title'):
            only = section['components'][0] if len(section['components']) == 1 else None
            if only is not None and (not only['props'].get('title') or only['props']['title'] == section['title']):
                only['props']['title'] = section.pop('title')
                section.pop('container', None)
            else:
                # card removes chart-cell minimum height; keep a panel for charts.
                height_dependent = {'barChart', 'lineChart', 'pieChart', 'mapChart', 'gauge'}
                section['container'] = 'panel' if any(c['type'] in height_dependent for c in section['components']) else 'card'
        else:
            section.pop('container', None)
        sections.append(section)
    page['sections'] = sections
    return page


def layout_transition_impacts(page, target):
    """Describe actual runtime consequences while preserving all authored settings.

The caller's existing complete-page validator rejects invalid combinations. A
valid container or backdrop must not become an invented authoring conflict.
"""
    if page['layout'] == target:
        return []
    impacts = ['page.layout',
        '页面宽度采用集成应用全部可用宽度。' if target == 'dashboard' else '页面宽度采用报告定宽居中，在较窄集成应用内收缩。',
        '标题归属、分区容器、组件占位及业务设置保持；视觉间距与主题由目标形态呈现。',
        '响应式仍由集成应用容器宽度驱动：窄于既有断点时组件转为单列，声明的 span 不变。']
    if page.get('dashboardToolbar') != 'hidden':
        impacts.append('看板工具栏随形态显示，已声明筛选保持。' if target == 'dashboard' else '看板工具栏在报告形态不呈现，原工具栏配置保留。')
    for index, section in enumerate(page['sections']):
        prefix = f'/sections/{index}'
        if section.get('title'):
            impacts.append(prefix + ': 分区标题仍由分区呈现，不转抄为组件标题。')
        if section.get('columnTracks'):
            impacts.append(prefix + ': 自定义轨道比例和组件 span 保留，实际像素宽度随可用宽度改变。')
        if any(c.get('layout', {}).get('layer') == 'backdrop' for c in section['components']):
            impacts.append(prefix + ': 铺底与安全区沿用统一运行时，窄屏铺底回到内容流；不删除或改序组件。')
    return impacts
