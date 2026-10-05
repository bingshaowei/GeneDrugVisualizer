import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createRequire } from 'node:module';
import jsPDF from 'jspdf';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Chart from './Chart';

const echarts = createRequire(import.meta.url)('echarts');

// jsdom 不实现 Canvas；只替换浏览器绘图边界，保留真实 ECharts 和 jsPDF。
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
let container;
let root;
let downloads;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    return new Proxy({
      canvas: this,
      measureText: (text) => ({ width: String(text).length * 7 }),
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    }, { get: (target, key) => key in target ? target[key] : () => {} });
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(png);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(500);
  downloads = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    downloads.push({ href: this.href, filename: this.download });
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  delete jsPDF.API.save;
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

async function renderChart(overrides = {}) {
  await act(async () => {
    root.render(<Chart drugNames={['DrugA', 'DrugB']} highValues={[4, 1]}
      lowValues={[2, 3]} metric="AUC" sortOrder="high" geneName="TP53"
      loading={false} setSortOrder={() => {}} {...overrides} />);
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); });
  return echarts.getInstanceByDom(container.querySelector('.echarts-for-react'));
}

test('真实 ECharts 渲染排序后的高低表达散点并传回点击药物', async () => {
  const onDrugClick = vi.fn();
  const chart = await renderChart({ onDrugClick });
  expect(chart.getOption().xAxis[0].data).toEqual(['DrugB', 'DrugA']);
  expect(chart.getOption().series[0].data).toEqual([1, 4]);
  expect(chart.getOption().series[1].data).toEqual([3, 2]);
  chart.trigger('click', { componentType: 'series', dataIndex: 0 });
  expect(onDrugClick).toHaveBeenCalledWith('DrugB');
});

test('PNG 导出调用真实图表实例的 5 倍白底输出', async () => {
  const chart = await renderChart();
  const getDataURL = vi.spyOn(chart, 'getDataURL');
  await act(async () => container.querySelectorAll('button')[0].click());
  expect(getDataURL).toHaveBeenCalledWith({ type: 'png', pixelRatio: 5, backgroundColor: '#fff' });
  expect(downloads).toEqual([{ href: png, filename: 'chart-export-5x.png' }]);
});

test('SVG 导出提供真正的 SVG 图像数据', async () => {
  await renderChart();
  await act(async () => container.querySelectorAll('button')[1].click());
  expect(downloads[0].href).toMatch(/^data:image\/svg\+xml/);
  expect(decodeURIComponent(downloads[0].href.split(',')[1])).toContain('<svg');
  expect(decodeURIComponent(downloads[0].href.split(',')[1])).toContain('TP53');
  expect(downloads[0].filename).toBe('chart-export-2x.svg');
});

test('PDF 导出通过真实 jsPDF 生成包含图像的 PDF 文档', async () => {
  await renderChart();
  let pdfContents;
  const save = jsPDF.API.save = vi.fn(function () {
    pdfContents = this.output();
    return this;
  });
  await act(async () => container.querySelectorAll('button')[2].click());
  expect(save).toHaveBeenCalledWith('chart-graph-only.pdf');
  expect(pdfContents).toMatch(/^%PDF-/);
  expect(pdfContents).toContain('/Subtype /Image');
  expect(container.querySelectorAll('button')[2].disabled).toBe(false);
});
