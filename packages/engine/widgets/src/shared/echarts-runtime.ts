import { use } from 'echarts/core';
import { BarChart, LineChart, PieChart, MapChart, ScatterChart, EffectScatterChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, GeoComponent, VisualMapComponent, DataZoomComponent, MarkPointComponent } from 'echarts/components';
import { LabelLayout, UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

// Register only capabilities used by the page protocol and the engine's generated options.
use([
  BarChart, LineChart, PieChart, MapChart, ScatterChart, EffectScatterChart,
  GridComponent, TooltipComponent, LegendComponent, GeoComponent, VisualMapComponent, DataZoomComponent, MarkPointComponent,
  LabelLayout, UniversalTransition, CanvasRenderer
]);

export * from 'echarts/core';
