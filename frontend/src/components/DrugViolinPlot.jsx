import React from 'react';
import Plot from 'react-plotly.js';
import { jStat } from 'jstat';

const DrugViolinPlot = ({ data, drugName, metric }) => {
  if (!data || !drugName || !data.high || !data.low) {
    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-600 text-center">
          点击散点图中的药物点查看该药物在高低表达组中的分布
        </p>
      </div>
    );
  }

  const colorMap = {
    '高表达组': 'rgba(255,165,0,0.4)',
    '低表达组': 'rgba(135,206,235,0.4)',
  };
  const borderMap = {
    '高表达组': 'rgba(255,165,0,1)',
    '低表达组': 'rgba(135,206,235,1)',
  };

  const highValues = data.high.map(parseFloat).filter(v => !isNaN(v));
  const lowValues = data.low.map(parseFloat).filter(v => !isNaN(v));
  const highLabels = data.highLabels || [];
  const lowLabels = data.lowLabels || [];

  if (highValues.length === 0 || lowValues.length === 0) {
    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-600 text-center">
          药物 "{drugName}" 的数据不足，无法绘制小提琴图
        </p>
      </div>
    );
  }

  const traces = [
    {
      type: 'violin',
      y: highValues,
      x: highValues.map(() => '高表达组'),
      name: '高表达组',
      side: 'both',
      box: { visible: true },
      meanline: { visible: true },
      line: { color: borderMap['高表达组'] },
      fillcolor: colorMap['高表达组'],
      points: 'all',
      jitter: 0.3,          // 减少散点抖动，让散点更靠近中心
      scalemode: 'count',
      width: 0.4,           // 控制小提琴图宽度
      marker: {
        color: borderMap['高表达组'],
        size: 4,            // 减小散点大小
        opacity: 0.6,       // 增加透明度
        line: { width: 0.5, color: 'black' }
      },
      text: highLabels,
      hovertemplate: `%{text}<br>${metric}: %{y:.2f}<extra></extra>`,
      legendgroup: '高表达组',
    },
    {
      type: 'violin',
      y: lowValues,
      x: lowValues.map(() => '低表达组'),
      name: '低表达组',
      side: 'both',
      box: { visible: true },
      meanline: { visible: true },
      line: { color: borderMap['低表达组'] },
      fillcolor: colorMap['低表达组'],
      points: 'all',
      jitter: 0.3,          // 减少散点抖动
      scalemode: 'count',
      width: 0.4,           // 控制小提琴图宽度
      marker: {
        color: borderMap['低表达组'],
        size: 4,            // 减小散点大小
        opacity: 0.6,       // 增加透明度
        line: { width: 0.5, color: 'black' }
      },
      text: lowLabels,
      hovertemplate: `%{text}<br>${metric}: %{y:.2f}<extra></extra>`,
      legendgroup: '低表达组',
    }
  ];

  // p值计算（两独立样本 t 检验）
  let annotation = null;
  try {
    const n1 = highValues.length, n2 = lowValues.length;
    const mean1 = jStat.mean(highValues), mean2 = jStat.mean(lowValues);
    const var1 = jStat.variance(highValues), var2 = jStat.variance(lowValues);
    const se = Math.sqrt(var1 / n1 + var2 / n2);
    const t = Math.abs((mean1 - mean2) / se);
    const df = Math.pow(var1 / n1 + var2 / n2, 2) /
      (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));
    const p = 2 * (1 - jStat.studentt.cdf(t, df));

    let stars = 'ns';
    if (p < 0.0001) stars = '****';
    else if (p < 0.001) stars = '***';
    else if (p < 0.01) stars = '**';
    else if (p < 0.05) stars = '*';

    annotation = {
      text: `p = ${p < 0.001 ? p.toExponential(2) : p.toFixed(3)} (${stars})`,
      xref: 'paper',
      yref: 'paper',
      x: 0.5,
      y: 1.08,
      showarrow: false,
      font: { size: 14, color: 'black' },
      bgcolor: 'rgba(255,255,255,0.9)',
      bordercolor: 'gray',
      borderwidth: 1
    };
  } catch (e) {
    console.warn('p值计算失败', e);
  }

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold text-gray-800">
        药物 "{drugName}" 在高低表达组中的{metric}分布
      </h3>
      <p className="text-sm text-gray-600 mt-1">
        高表达组: {highValues.length} 样本, 低表达组: {lowValues.length} 样本
      </p>

      <Plot
        data={traces}
        layout={{
          title: {
            text: `${drugName} - ${metric} 分布比较`,
            x: 0.5,
            font: { size: 16 }
          },
          violingap: 0.3,         // 减少组间距离
          violinmode: 'group',
          margin: { t: 80, b: 80, l: 80, r: 40 },
          showlegend: false,
          xaxis: {
            title: {
              text: '表达组别',
              font: { size: 14 }
            },
            categoryorder: 'array',
            categoryarray: ['高表达组', '低表达组']
          },
          yaxis: {
            title: {
              text: `${metric}`,
              font: { size: 14 }
            },
            zeroline: true,        // 显示0线
            zerolinewidth: 1,      // 设置0线宽度为1（正常粗细）
            zerolinecolor: 'black' // 设置0线颜色（可选）
          },
          annotations: annotation ? [annotation] : [],
        }}
        config={{
          responsive: true,
          displayModeBar: 'hover',
          displaylogo: false,
          modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
        }}
        style={{ width: '100%', height: 460 }}
      />

      <p className="text-xs text-gray-500 text-center mt-2">
        点击散点图中的其他药物点可切换显示不同药物的分布
      </p>
    </div>
  );
};

export default DrugViolinPlot;
