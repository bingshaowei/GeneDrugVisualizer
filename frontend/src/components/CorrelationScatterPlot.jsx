// src/components/CorrelationScatterPlot.jsx
import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { jStat } from 'jstat';

const CorrelationScatterPlot = ({ 
  selectedDrug, 
  expressionData, 
  drugResponseData, 
  gene, 
  currentMetric, 
  cellLineMapping,
  onCorrelationCalculated
}) => {
  const [selectedCorrelationMetric, setSelectedCorrelationMetric] = useState(currentMetric || 'Z_SCORE');
  const [correlationStats, setCorrelationStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);

  // 指标选项
  const CORRELATION_METRICS = [
    { value: 'Z_SCORE', label: 'Z_SCORE' },
    { value: 'LN_IC50', label: 'LN_IC50' },
    { value: 'AUC', label: 'AUC' },
    { value: 'RMSE', label: 'RMSE' }
  ];

  // 计算Pearson相关系数和p值 - 添加更多调试信息
  const calculateCorrelation = (x, y, metric) => {
    console.log(`🧮 开始计算相关性 - 指标: ${metric}`);
    console.log(`输入数据长度: x=${x.length}, y=${y.length}`);
    
    if (!x || !y || x.length !== y.length || x.length < 3) {
      console.log('❌ 数据验证失败');
      return null;
    }

    try {
      // 添加唯一ID确保每次计算都是独立的
      const calculationId = Date.now() + Math.random();
      console.log(`🆔 计算ID: ${calculationId}`);
      
      // 验证输入数据
      console.log(`X前5个值: [${x.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
      console.log(`Y前5个值: [${y.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
      
      // 计算Pearson相关系数
      const n = x.length;
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
      const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
      const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

      console.log(`中间计算值:`);
      console.log(`  n: ${n}`);
      console.log(`  sumX: ${sumX.toFixed(4)}`);
      console.log(`  sumY: ${sumY.toFixed(4)}`);
      console.log(`  sumXY: ${sumXY.toFixed(4)}`);
      console.log(`  sumX2: ${sumX2.toFixed(4)}`);
      console.log(`  sumY2: ${sumY2.toFixed(4)}`);

      const numerator = n * sumXY - sumX * sumY;
      const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      
      console.log(`  numerator: ${numerator.toFixed(6)}`);
      console.log(`  denominator: ${denominator.toFixed(6)}`);
      
      if (denominator === 0) {
        console.log('❌ 分母为0');
        return null;
      }
      
      const r = numerator / denominator;
      console.log(`  相关系数 r: ${r.toFixed(6)}`);
      
      // 计算t统计量和p值
      const t = r * Math.sqrt((n - 2) / (1 - r * r));
      const df = n - 2;
      const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));

      console.log(`  t统计量: ${t.toFixed(6)}`);
      console.log(`  自由度: ${df}`);
      console.log(`  p值: ${p.toExponential(6)}`);

      const result = {
        r: r,
        p: p,
        n: n,
        calculationId: calculationId,
        metric: metric,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ 相关性计算完成`, result);
      return result;
    } catch (error) {
      console.error('💥 计算相关性失败:', error);
      return null;
    }
  };

  // 同步更新指标选择
  useEffect(() => {
    if (currentMetric && currentMetric !== selectedCorrelationMetric) {
      console.log(`🔄 同步指标更新: ${selectedCorrelationMetric} → ${currentMetric}`);
      setSelectedCorrelationMetric(currentMetric);
    }
  }, [currentMetric]);

  useEffect(() => {
    console.log('\n🔍 === 开始新的相关性分析 ===');
    console.log(`选中药物: ${selectedDrug}`);
    console.log(`选中指标: ${selectedCorrelationMetric}`);
    console.log(`当前时间戳: ${Date.now()}`);
    
    // 强制重置所有状态
    setCorrelationStats(null);
    setDebugInfo(null);

    // 清空回调
    if (onCorrelationCalculated) {
      onCorrelationCalculated(null, selectedCorrelationMetric);
    }

    if (!selectedDrug) {
      console.log('❌ 未选择药物，退出');
      return;
    }

    if (!expressionData || expressionData.length === 0) {
      console.log('❌ 表达数据为空，退出');
      setDebugInfo('表达数据为空');
      return;
    }

    if (!drugResponseData || drugResponseData.length === 0) {
      console.log('❌ 药物响应数据为空，退出');
      setDebugInfo('药物响应数据为空');
      return;
    }

    setIsLoading(true);

    // 使用setTimeout确保状态更新
    setTimeout(() => {
      try {
        const drugNameStr = String(selectedDrug);
        const drugSpecificData = drugResponseData.filter(item => String(item.Drug_Name) === drugNameStr);
        
        if (drugSpecificData.length === 0) {
          console.log(`❌ 未找到药物 ${drugNameStr} 的数据`);
          setDebugInfo(`未找到药物 ${drugNameStr} 的数据`);
          setIsLoading(false);
          return;
        }

        console.log(`✅ 找到药物数据: ${drugSpecificData.length} 条`);

        // 检查当前指标数据
        const validDrugData = drugSpecificData.filter(item => {
          const metricValue = item[selectedCorrelationMetric];
          return metricValue !== undefined && metricValue !== null && !isNaN(parseFloat(metricValue));
        });

        if (validDrugData.length === 0) {
          console.log(`❌ 指标 ${selectedCorrelationMetric} 无有效数据`);
          setDebugInfo(`指标 ${selectedCorrelationMetric} 无有效数据`);
          setIsLoading(false);
          return;
        }

        // 匹配数据
        const matchedData = [];
        expressionData.forEach((exprItem) => {
          const expressionValue = parseFloat(exprItem.value);
          if (isNaN(expressionValue)) return;

          const drugItem = validDrugData.find(drugItem => 
            drugItem.COSMIC_ID === exprItem.COSMIC_ID || 
            String(drugItem.COSMIC_ID) === String(exprItem.COSMIC_ID)
          );
          
          if (drugItem) {
            const drugValue = parseFloat(drugItem[selectedCorrelationMetric]);
            if (!isNaN(drugValue)) {
              const cellLineName = cellLineMapping?.[exprItem.COSMIC_ID] || 
                                  exprItem.CELL_LINE || 
                                  `ID: ${exprItem.COSMIC_ID}`;
              
              matchedData.push({
                cosmicId: exprItem.COSMIC_ID,
                expressionValue: expressionValue,
                drugValue: drugValue,
                cellLine: cellLineName
              });
            }
          }
        });

        if (matchedData.length < 3) {
          console.log(`❌ 匹配数据不足: ${matchedData.length} < 3`);
          setDebugInfo(`匹配数据不足: ${matchedData.length} 个数据点`);
          setIsLoading(false);
          return;
        }

        console.log(`✅ 成功匹配 ${matchedData.length} 个数据点`);

        const xValues = matchedData.map(d => d.expressionValue);
        const yValues = matchedData.map(d => d.drugValue);
        
        // 验证数据唯一性
        const xUnique = new Set(xValues).size;
        const yUnique = new Set(yValues).size;
        console.log(`数据唯一性检查: X有${xUnique}个唯一值, Y有${yUnique}个唯一值`);

        // 计算相关性 - 传入指标名称用于调试
        const stats = calculateCorrelation(xValues, yValues, selectedCorrelationMetric);
        
        if (stats) {
          const finalStats = {
            ...stats,
            data: matchedData,
            xValues: xValues,
            yValues: yValues
          };
          
          console.log(`🎉 设置最终结果:`, finalStats);
          setCorrelationStats(finalStats);
          setDebugInfo(`计算成功: r=${stats.r.toFixed(4)}, p=${stats.p.toExponential(3)}, n=${stats.n}`);
          
          if (onCorrelationCalculated) {
            onCorrelationCalculated(stats, selectedCorrelationMetric);
          }
        } else {
          console.log(`❌ 相关性计算失败`);
          setDebugInfo('相关性计算失败');
        }

      } catch (error) {
        console.error('💥 处理数据出错:', error);
        setDebugInfo(`处理错误: ${error.message}`);
      } finally {
        setIsLoading(false);
        console.log('🏁 === 相关性分析结束 ===\n');
      }
    }, 100); // 100ms延迟确保状态更新

  }, [selectedDrug, expressionData, drugResponseData, selectedCorrelationMetric, cellLineMapping, onCorrelationCalculated]);

  // 处理指标切换
  const handleMetricChange = (newMetric) => {
    console.log(`\n🔄 用户手动切换指标: ${selectedCorrelationMetric} → ${newMetric}`);
    
    // 先清空当前结果
    setCorrelationStats(null);
    setDebugInfo('切换指标中...');
    
    // 然后设置新指标
    setSelectedCorrelationMetric(newMetric);
  };

  if (!selectedDrug) {
    return (
      <div className="mt-8 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">未选择药物</h3>
          <p className="mt-1 text-sm text-gray-500">请在上方散点图中点击一个药物点查看相关性分析</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">正在处理数据...</h3>
          <p className="mt-1 text-sm text-gray-500">正在计算 {selectedDrug} 的相关性</p>
          <p className="mt-1 text-xs text-gray-400">当前指标: {selectedCorrelationMetric}</p>
        </div>
      </div>
    );
  }

  if (!correlationStats || correlationStats.data.length < 3) {
    return (
      <div className="mt-8 p-6 bg-yellow-50 rounded-lg border border-yellow-200">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 15.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">数据不足</h3>
          <p className="mt-1 text-sm text-gray-500">
            药物 <strong>{String(selectedDrug)}</strong> 的数据点不足
          </p>
          <p className="mt-1 text-xs text-gray-400">当前指标: {selectedCorrelationMetric}</p>
          {debugInfo && (
            <p className="mt-2 text-xs text-gray-600 bg-gray-100 p-2 rounded">
              {debugInfo}
            </p>
          )}
        </div>
      </div>
    );
  }

  // 确定显著性水平
  let significance = 'ns';
  if (correlationStats.p < 0.0001) significance = '****';
  else if (correlationStats.p < 0.001) significance = '***';
  else if (correlationStats.p < 0.01) significance = '**';
  else if (correlationStats.p < 0.05) significance = '*';

  // 准备散点图数据
  const scatterData = [{
    x: correlationStats.xValues,
    y: correlationStats.yValues,
    text: correlationStats.data.map(d => `${d.cellLine}<br>表达值: ${d.expressionValue.toFixed(3)}<br>${selectedCorrelationMetric}: ${d.drugValue.toFixed(3)}`),
    type: 'scatter',
    mode: 'markers',
    marker: {
      size: 8,
      color: 'rgba(31, 119, 180, 0.6)',
      line: {
        color: 'rgba(31, 119, 180, 1)',
        width: 1
      }
    },
    name: '样本点',
    hovertemplate: '%{text}<extra></extra>'
  }];

  // 添加趋势线
  if (correlationStats.xValues.length >= 2) {
    const n = correlationStats.xValues.length;
    const sumX = correlationStats.xValues.reduce((a, b) => a + b, 0);
    const sumY = correlationStats.yValues.reduce((a, b) => a + b, 0);
    const sumXY = correlationStats.xValues.reduce((sum, xi, i) => sum + xi * correlationStats.yValues[i], 0);
    const sumX2 = correlationStats.xValues.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const minX = Math.min(...correlationStats.xValues);
    const maxX = Math.max(...correlationStats.xValues);
    
    scatterData.push({
      x: [minX, maxX],
      y: [slope * minX + intercept, slope * maxX + intercept],
      type: 'scatter',
      mode: 'lines',
      line: {
        color: 'red',
        width: 2,
        dash: 'dash'
      },
      name: '趋势线',
      hoverinfo: 'skip'
    });
  }

  return (
    <div className="mt-8">
      {/* 指标选择器 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          相关性分析指标:
        </label>
        <div className="flex gap-2 flex-wrap">
          {CORRELATION_METRICS.map(metric => (
            <button
              key={metric.value}
              onClick={() => handleMetricChange(metric.value)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                selectedCorrelationMetric === metric.value
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>

      {/* 散点图 */}
      <Plot
        key={`${selectedDrug}-${selectedCorrelationMetric}-${correlationStats?.calculationId}`} // 强制重新渲染
        data={scatterData}
        layout={{
          title: {
            text: `${gene}表达值 vs ${String(selectedDrug)} ${selectedCorrelationMetric}相关性`,
            font: { size: 16 },
            y: 0.98,
          },
          xaxis: {
            title: {
              text: `${gene} 表达值(FPKM)`,
              font: { size: 14 }
            },
            zeroline: false,
          },
          yaxis: {
            title: {
              text: `${String(selectedDrug)} ${selectedCorrelationMetric}`,
              font: { size: 14 }
            },
            zeroline: false,
          },
          margin: { t: 80, l: 80, r: 20, b: 80 },
          height: 400,
          showlegend: false,
          annotations: [{
            text: `r = ${correlationStats.r.toFixed(3)}, p = ${
              correlationStats.p < 0.001 ? correlationStats.p.toExponential(2) : correlationStats.p.toFixed(3)
            } (${significance})<br>n = ${correlationStats.n}<br>指标: ${selectedCorrelationMetric}`,
            xref: 'paper',
            yref: 'paper',
            x: 0.5,
            y: 1.08,
            xanchor: 'center',
            yanchor: 'middle',
            showarrow: false,
            font: { size: 12 },
            bgcolor: 'rgba(255,255,255,0.9)',
            bordercolor: 'gray',
            borderwidth: 1,
          }],
        }}
        config={{ 
          responsive: true,
          displayModeBar: 'hover',
          modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'resetScale2d']
        }}
        style={{ width: '100%' }}
      />

      {/* 统计信息 */}
      <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong>相关系数 (r):</strong> {correlationStats.r.toFixed(4)}
          </div>
          <div>
            <strong>P值:</strong> {correlationStats.p < 0.001 ? correlationStats.p.toExponential(3) : correlationStats.p.toFixed(4)}
          </div>
          <div>
            <strong>样本数 (n):</strong> {correlationStats.n}
          </div>
          <div>
            <strong>显著性:</strong> 
            <span className={`ml-1 ${correlationStats.p < 0.05 ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
              {significance} {correlationStats.p < 0.05 ? '(显著)' : '(不显著)'}
            </span>
          </div>
          <div className="col-span-2">
            <strong>当前指标:</strong> {selectedCorrelationMetric}
            {correlationStats.calculationId && (
              <span className="ml-2 text-xs text-gray-400">
                (ID: {correlationStats.calculationId.toString().slice(-6)})
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CorrelationScatterPlot;










