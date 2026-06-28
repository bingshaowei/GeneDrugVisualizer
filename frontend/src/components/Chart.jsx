import React, { useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import jsPDF from 'jspdf';

function Chart({ 
  drugNames, highValues, lowValues, metric, loading, sortOrder, setSortOrder,
  onDrugClick, geneName
}) {
  const chartRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  const sortedIndices = (() => {
    if (sortOrder === 'high') return [...highValues.map((v, i) => [v, i])].sort((a, b) => a[0] - b[0]).map(([_, i]) => i);
    if (sortOrder === 'low') return [...lowValues.map((v, i) => [v, i])].sort((a, b) => a[0] - b[0]).map(([_, i]) => i);
    return drugNames.map((_, i) => i);
  })();
  const sortedDrugNames = sortedIndices.map(i => drugNames[i]);
  const sortedHigh = sortedIndices.map(i => highValues[i]);
  const sortedLow = sortedIndices.map(i => lowValues[i]);
  const titleText = geneName ? `${geneName} 表达水平（FPKM）分组下的药物敏感性散点图` : '';


  const option = {
    title: {
      text: titleText,
      left: 'center',
      top: 10,
      textStyle: {
        fontSize: 18,
        fontWeight: 'bold'
      }
    },
    color: ['#FFA500', '#87CEFA'],
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross', snap: true } },
    legend: { data: ['高表达组', '低表达组'], bottom: 20 },
    grid: { top: 60, bottom: 100 },
    xAxis: { 
      type: 'category', 
      name: 'Drug',
      nameLocation: 'middle',
      nameGap: 20,
      nameTextStyle: {
        fontSize: 12,
        color: '#333'
      },
      data: sortedDrugNames, 
      axisLabel: { show: false }, 
      axisLine: { lineStyle: { type: 'solid' } }, 
      splitLine: { show: false } 
    },
    yAxis: { 
      type: 'value', 
      name: metric, 
      nameLocation: 'middle',
      nameGap: 25,
      nameRotate: 90,
      nameTextStyle: {
        fontSize: 12,
        color: '#333'
      },
      axisLine: { lineStyle: { type: 'solid' } }, 
      splitLine: { lineStyle: { type: 'solid' } } 
    },
    series: [
      { name: '高表达组', type: 'scatter', symbolSize: 6, data: sortedHigh },
      { name: '低表达组', type: 'scatter', symbolSize: 6, data: sortedLow }
    ]
  };

  const onChartClick = (params) => {
    if (params.componentType === 'series' && onDrugClick) {
      const drugName = sortedDrugNames[params.dataIndex];
      onDrugClick(drugName);
    }
  };

  const exportChart = (type) => {
    const echartsInstance = chartRef.current.getEchartsInstance();
    const pixelRatio = type === 'png' ? 5 : 2;
    const dataURL = echartsInstance.getDataURL({ type, pixelRatio, backgroundColor: '#fff' });
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `chart-export-${pixelRatio}x.${type}`;
    link.click();
  };

  const downloadPDF = async () => {
    setIsExporting(true);
    try {
      const echartsInstance = chartRef.current.getEchartsInstance();
      const chartCanvas = echartsInstance.getDataURL({ type: 'png', pixelRatio: 5, backgroundColor: '#fff' });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(chartCanvas);
      const ratio = imgProps.width / imgProps.height;
      const chartWidth = pageWidth - 30;
      const chartHeight = chartWidth / ratio;

      pdf.addImage(chartCanvas, 'PNG', 15, 20, chartWidth, chartHeight);
      pdf.save('chart-graph-only.pdf');
    } catch (err) {
      console.error('PDF导出失败:', err);
      alert('PDF导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      <div className="text-right mb-2">
        <button onClick={() => exportChart('png')} className="mr-2 px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded" disabled={isExporting}>
          导出 PNG (5x高清)
        </button>
        <button onClick={() => exportChart('svg')} className="mr-2 px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded" disabled={isExporting}>
          导出 SVG
        </button>
        <button onClick={downloadPDF} className="px-3 py-1 text-sm bg-green-500 text-white hover:bg-green-600 rounded disabled:bg-gray-400" disabled={isExporting}>
          {isExporting ? '导出中...' : '导出 PDF'}
        </button>
      </div>
      <ReactECharts 
        ref={chartRef} 
        option={option} 
        style={{ height: '500px', width: '100%' }} 
        showLoading={loading} 
        onEvents={{ 'click': onChartClick }} 
      />
    </div>
  );
}

export default Chart;

