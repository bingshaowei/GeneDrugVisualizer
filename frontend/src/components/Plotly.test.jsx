import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import ViolinPlot from './ViolinPlot';
import DrugViolinPlot from './DrugViolinPlot';
import CorrelationScatterPlot from './CorrelationScatterPlot';

const { plots } = vi.hoisted(() => ({ plots: [] }));

// 保留真实 React Plotly 组件工厂；jsdom 不能绘制 WebGL，替换绘图引擎边界。
vi.mock('react-plotly.js', async () => {
  const { default: createPlotlyComponent } = await import('react-plotly.js/factory');
  return { default: createPlotlyComponent({
    react: vi.fn(async (element, figure) => {
      plots.push(figure);
      element.on = () => {};
      element.removeListener = () => {};
      return element;
    }),
    purge: vi.fn(),
    Plots: { resize: vi.fn() },
  }) };
});

let root;
let container;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  plots.length = 0;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
async function render(element) {
  await act(async () => root.render(element));
}

test('基因小提琴图向 Plotly 传递标题对象和分类数据', async () => {
  await render(<ViolinPlot data={{ lung: [1, 2, 3] }} selectedItems={['lung']} gene="TP53" />);
  expect(plots.at(-1).layout.title).toEqual({ text: 'TP53 表达值分布（按 Histology 分类）' });
  expect(plots.at(-1).data[0]).toMatchObject({ type: 'violin', name: 'lung', y: [1, 2, 3] });
});

test('药物小提琴图保留高低表达数据和统计注释', async () => {
  await render(<DrugViolinPlot data={{ high: [1, 2, 3], low: [4, 5, 6] }} drugName="DrugA" metric="AUC" />);
  expect(plots.at(-1).data.map((trace) => trace.y)).toEqual([[1, 2, 3], [4, 5, 6]]);
  expect(plots.at(-1).layout.title.text).toBe('DrugA - AUC 分布比较');
  expect(plots.at(-1).layout.annotations[0].text).toMatch(/^p = /);
});

test('相关性散点图按细胞系匹配样本并渲染趋势线', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const callback = vi.fn();
  await render(<CorrelationScatterPlot selectedDrug="DrugA" gene="TP53" currentMetric="AUC"
    expressionData={[1, 2, 3].map((value) => ({ COSMIC_ID: value, value }))}
    drugResponseData={[1, 2, 3].map((value) => ({ COSMIC_ID: value, Drug_Name: 'DrugA', AUC: value * 2 }))}
    cellLineMapping={{}} onCorrelationCalculated={callback} />);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 150)); });
  expect(plots.at(-1).data[0]).toMatchObject({ type: 'scatter', x: [1, 2, 3], y: [2, 4, 6] });
  expect(plots.at(-1).data[1]).toMatchObject({ mode: 'lines', x: [1, 3], y: [2, 6] });
  expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ r: 1, n: 3 }), 'AUC');
});
