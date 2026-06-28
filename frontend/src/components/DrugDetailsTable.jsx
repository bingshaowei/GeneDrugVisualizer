// src/components/DrugDetailsTable.jsx
import React, { useEffect, useState } from 'react';
import { jStat } from 'jstat';

function DrugDetailsTable({ drugName, expressionStats, correlationStats, currentMetric, violinData }) {
  const [drugDetails, setDrugDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!drugName) {
      setDrugDetails(null);
      return;
    }

    setLoading(true);
    setError(null);

    // 确保drugName是字符串格式，处理数字药物名称
    const drugNameStr = String(drugName);

    fetch(`http://127.0.0.1:5000/drug_details/${encodeURIComponent(drugNameStr)}`)
      .then(res => {
        if (!res.ok) throw new Error('药物信息未找到');
        return res.text(); // 先获取文本而不是直接解析JSON
      })
      .then(responseText => {
        // 清理响应文本中的NaN值
        const cleanedText = responseText.replace(/:\s*NaN\b/g, ': null')
                                      .replace(/"\s*NaN\s*"/g, '""')
                                      .replace(/,\s*NaN\s*,/g, ', null,')
                                      .replace(/,\s*NaN\s*\}/g, ', null}')
                                      .replace(/\{\s*NaN\s*:/g, '{ null:');
        
        const data = JSON.parse(cleanedText);
        setDrugDetails(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Drug details error:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [drugName]);

  // 计算药物在高低表达组中的分布差异p值
  const calculateDrugGroupPValue = () => {
    if (!violinData || !violinData.high || !violinData.low) return null;
    
    try {
      const highValues = violinData.high.map(parseFloat).filter(v => !isNaN(v));
      const lowValues = violinData.low.map(parseFloat).filter(v => !isNaN(v));
      
      if (highValues.length < 2 || lowValues.length < 2) return null;
      
      const n1 = highValues.length, n2 = lowValues.length;
      const mean1 = jStat.mean(highValues), mean2 = jStat.mean(lowValues);
      const var1 = jStat.variance(highValues), var2 = jStat.variance(lowValues);
      const se = Math.sqrt(var1 / n1 + var2 / n2);
      const t = Math.abs((mean1 - mean2) / se);
      const df = Math.pow(var1 / n1 + var2 / n2, 2) /
        (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));
      const p = 2 * (1 - jStat.studentt.cdf(t, df));
      
      return p;
    } catch (e) {
      console.warn('药物分组p值计算失败', e);
      return null;
    }
  };

  // 计算药物响应值的均值和标准差
  const calculateDrugStats = () => {
    if (!violinData || !violinData.high || !violinData.low) {
      return { highMean: null, highSD: null, lowMean: null, lowSD: null };
    }

    try {
      const highValues = violinData.high.map(parseFloat).filter(v => !isNaN(v));
      const lowValues = violinData.low.map(parseFloat).filter(v => !isNaN(v));

      const highMean = highValues.length > 0 ? jStat.mean(highValues) : null;
      const highSD = highValues.length > 1 ? Math.sqrt(jStat.variance(highValues)) : null;
      const lowMean = lowValues.length > 0 ? jStat.mean(lowValues) : null;
      const lowSD = lowValues.length > 1 ? Math.sqrt(jStat.variance(lowValues)) : null;

      return { highMean, highSD, lowMean, lowSD };
    } catch (e) {
      console.warn('药物统计信息计算失败', e);
      return { highMean: null, highSD: null, lowMean: null, lowSD: null };
    }
  };

  // 格式化p值显示
  const formatPValue = (pValue) => {
    if (pValue === null || pValue === undefined) return '-';
    if (pValue < 0.001) return 'p < 0.001';
    if (pValue < 0.01) return `p = ${pValue.toFixed(3)}`;
    return `p = ${pValue.toFixed(2)}`;
  };

  // 格式化SD值显示（均值±标准差）
  const formatMeanSD = (mean, sd) => {
    if (mean === null || mean === undefined || sd === null || sd === undefined) return '-';
    return `${mean.toFixed(3)} ± ${sd.toFixed(3)}`;
  };

  // 获取显著性星号
  const getSignificanceStars = (pValue) => {
    if (pValue === null || pValue === undefined) return '';
    if (pValue < 0.0001) return '****';
    if (pValue < 0.001) return '***';
    if (pValue < 0.01) return '**';
    if (pValue < 0.05) return '*';
    return 'ns';
  };

  // 安全显示函数，处理null、undefined和NaN值
  const safeDisplay = (value) => {
    if (value === null || value === undefined || value === 'null' || 
        (typeof value === 'number' && isNaN(value)) || value === '') {
      return '-';
    }
    return String(value);
  };

  // 如果没有选择药物，显示提示信息
  if (!drugName) {
    return (
      <div className="h-full border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center min-h-[400px] bg-gray-50">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="mt-2 text-gray-500">点击散点图中的药物点查看详情</p>
        </div>
      </div>
    );
  }

  // 加载中状态
  if (loading) {
    return (
      <div className="h-full min-h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="h-full min-h-[400px] flex items-center justify-center">
        <div className="text-red-500 text-center">
          <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-2">{error}</p>
          <p className="mt-1 text-sm text-gray-600">药物名称: {String(drugName)}</p>
        </div>
      </div>
    );
  }

  const drugGroupPValue = calculateDrugGroupPValue();
  const drugStats = calculateDrugStats();
  
  // 获取指标的中文名称
  const getMetricDisplayName = (metric) => {
    const metricNames = {
      'Z_SCORE': 'Z_SCORE',
      'LN_IC50': 'LN_IC50',
      'AUC': 'AUC',
      'RMSE': 'RMSE'
    };
    return metricNames[metric] || metric;
  };

  // 显示药物详情
  return (
    <div className="h-full min-h-[400px] bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <svg className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        药物详细信息
      </h3>
      
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <table className="w-full">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-3 px-4 text-sm font-medium text-gray-600 w-1/3">药物名称</td>
                <td className="py-3 px-4 text-sm text-gray-900 font-semibold">
                  {safeDisplay(drugDetails?.DRUG_NAME) || String(drugName)}
                </td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-3 px-4 text-sm font-medium text-gray-600">靶点</td>
                <td className="py-3 px-4 text-sm text-gray-900">
                  <div className="break-words">
                    {safeDisplay(drugDetails?.PUTATIVE_TARGET)}
                  </div>
                </td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-3 px-4 text-sm font-medium text-gray-600">通路</td>
                <td className="py-3 px-4 text-sm text-gray-900">
                  <div className="break-words">
                    {safeDisplay(drugDetails?.PATHWAY_NAME)}
                  </div>
                </td>
              </tr>
              {/* 修复：药物在高低表达组中的分布差异p值 */}
              <tr className="border-b border-gray-200">
                <td className="py-3 px-4 text-sm font-medium text-gray-600">
                  高低分组{getMetricDisplayName(currentMetric || 'Z_SCORE')}差异p值
                </td>
                <td className="py-3 px-4 text-sm text-gray-900">
                  <span className={`font-medium ${drugGroupPValue && drugGroupPValue < 0.05 ? 'text-red-600' : 'text-gray-900'}`}>
                    {drugGroupPValue ? (
                      <>
                        {formatPValue(drugGroupPValue)} 
                        <span className="ml-1 text-xs">
                          ({getSignificanceStars(drugGroupPValue)})
                        </span>
                      </>
                    ) : '-'}
                  </span>
                </td>
              </tr>
              {/* 修复：显示药物响应值的统计信息，而不是基因表达值 */}
              <tr className="border-b border-gray-200">
                <td className="py-3 px-4 text-sm font-medium text-gray-600">
                  高表达组 {getMetricDisplayName(currentMetric || 'Z_SCORE')}均值 ± SD
                </td>
                <td className="py-3 px-4 text-sm text-gray-900">
                  {formatMeanSD(drugStats.highMean, drugStats.highSD)}
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm font-medium text-gray-600">
                  低表达组 {getMetricDisplayName(currentMetric || 'Z_SCORE')}均值 ± SD
                </td>
                <td className="py-3 px-4 text-sm text-gray-900">
                  {formatMeanSD(drugStats.lowMean, drugStats.lowSD)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 如果靶点或通路信息较长，添加一个提示卡片 */}
        {(drugDetails?.PUTATIVE_TARGET?.length > 50 || drugDetails?.PATHWAY_NAME?.length > 50) && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  该药物具有多个靶点或涉及多条通路
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 如果药物分组差异显著，显示提示 */}
        {drugGroupPValue && drugGroupPValue < 0.05 && (
          <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-orange-700">
                  该药物在高低表达组间的{getMetricDisplayName(currentMetric || 'Z_SCORE')}存在显著差异 (p &lt; 0.05)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 如果药物分组不显著，显示提示 */}
        {(!drugGroupPValue || drugGroupPValue >= 0.05) && (
          <div className="bg-gray-50 border-l-4 border-gray-400 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-700">
                  药物在高低表达组间的{getMetricDisplayName(currentMetric || 'Z_SCORE')}无显著差异 (p ≥ 0.05)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DrugDetailsTable;