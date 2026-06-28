// src/components/ViolinPlot.jsx
import React from 'react';
import Plot from 'react-plotly.js';

const ViolinPlot = ({ data, selectedItems, groupBy = 'histology', gene, detailedData, cellLineMapping = {} }) => {
  if (!data || Object.keys(data).length === 0) return <p className="text-gray-500">暂无小提琴图数据</p>;

  const colorPalette = [
    '#636EFA', '#EF553B', '#00CC96', '#AB63FA', '#FFA15A',
    '#19D3F3', '#FF6692', '#B6E880', '#FF97FF', '#FECB52',
    '#636EFA', '#EF553B', '#00CC96', '#AB63FA', '#FFA15A'
  ];

  // 处理数据：当选择全部时，合并小类别和NS到other
  let processedData = { ...data };
  let processedDetailedData = detailedData || {};
  
  if (selectedItems.length === 0) { // 选择全部时
    const otherValues = [];
    const otherDetails = [];
    const newData = {};
    const newDetailedData = {};
    
    Object.entries(data).forEach(([category, values]) => {
      // 将数量≤2的类别、NS类别和unknown类别合并到other
      if (values.length <= 2 || category === 'NS' || category.toLowerCase() === 'unknown') {
        otherValues.push(...values);
        if (detailedData && detailedData[category]) {
          otherDetails.push(...detailedData[category]);
        }
      } else {
        newData[category] = values;
        if (detailedData && detailedData[category]) {
          newDetailedData[category] = detailedData[category];
        }
      }
    });
    
    // 处理other类别的合并逻辑
    if (otherValues.length > 0) {
      if (groupBy === 'tcga_desc') {
        // 对于TCGA_DESC，将other合并到UNCLASSIFIED
        if (newData['UNCLASSIFIED']) {
          newData['UNCLASSIFIED'].push(...otherValues);
          if (newDetailedData['UNCLASSIFIED']) {
            newDetailedData['UNCLASSIFIED'].push(...otherDetails);
          }
        } else {
          newData['UNCLASSIFIED'] = otherValues;
          newDetailedData['UNCLASSIFIED'] = otherDetails;
        }
      } else if (groupBy === 'histology' || groupBy === 'site') {
        // 对于histology和site，将other合并到"其他"类别中
        if (newData['其他']) {
          newData['其他'].push(...otherValues);
          if (newDetailedData['其他']) {
            newDetailedData['其他'].push(...otherDetails);
          }
        } else {
          newData['其他'] = otherValues;
          newDetailedData['其他'] = otherDetails;
        }
      } else {
        // 其他情况保持原有逻辑，创建other类别
        newData['other'] = otherValues;
        newDetailedData['other'] = otherDetails;
      }
    }
    
    // 特殊处理：如果原数据中已经有other类别或unknown类别
    ['other', 'unknown', 'Unknown', 'UNKNOWN'].forEach(key => {
      if (data[key]) {
        if (groupBy === 'tcga_desc') {
          // 将原有的other/unknown合并到UNCLASSIFIED
          if (newData['UNCLASSIFIED']) {
            newData['UNCLASSIFIED'].push(...data[key]);
            if (detailedData && detailedData[key] && newDetailedData['UNCLASSIFIED']) {
              newDetailedData['UNCLASSIFIED'].push(...detailedData[key]);
            }
          } else {
            newData['UNCLASSIFIED'] = data[key];
            if (detailedData && detailedData[key]) {
              newDetailedData['UNCLASSIFIED'] = detailedData[key];
            }
          }
        } else if (groupBy === 'histology' || groupBy === 'site') {
          // 对于histology和site，将原有的other/unknown合并到"其他"类别中
          if (newData['其他']) {
            newData['其他'].push(...data[key]);
            if (detailedData && detailedData[key] && newDetailedData['其他']) {
              newDetailedData['其他'].push(...detailedData[key]);
            }
          } else {
            newData['其他'] = data[key];
            if (detailedData && detailedData[key]) {
              newDetailedData['其他'] = detailedData[key];
            }
          }
        } else {
          // 其他情况保持other类别
          if (!newData['other']) {
            newData['other'] = data[key];
            if (detailedData && detailedData[key]) {
              newDetailedData['other'] = detailedData[key];
            }
          } else {
            newData['other'].push(...data[key]);
            if (detailedData && detailedData[key] && newDetailedData['other']) {
              newDetailedData['other'].push(...detailedData[key]);
            }
          }
        }
      }
    });
    
    processedData = newData;
    processedDetailedData = newDetailedData;
  }

  const traces = Object.entries(processedData).map(([category, values], idx) => {
    const visible = selectedItems.length === 0 || selectedItems.includes(category);
    
    // 获取细胞系名称和值
    const cellLineInfo = processedDetailedData[category] || [];
    const hoverText = cellLineInfo.map(info => {
      // 如果detailedData中没有正确的细胞系名称，尝试从cellLineMapping获取
      const cellLineName = info.cellLine && !info.cellLine.startsWith('ID: ') 
        ? info.cellLine 
        : (cellLineMapping[info.cosmicId] || info.cellLine || `ID: ${info.cosmicId || 'Unknown'}`);
      
      return `细胞系: ${cellLineName}<br>表达值: ${info.value.toFixed(4)}`;
    });
    
    return {
      type: 'violin',
      y: values,
      name: category,
      box: { visible: true },
      line: { color: colorPalette[idx % colorPalette.length] },
      meanline: { visible: true },
      points: 'all',
      jitter: 0.3,
      scalemode: 'count',
      visible: visible ? true : 'legendonly',
      text: hoverText.length > 0 ? hoverText : undefined,
      hovertemplate: hoverText.length > 0 ? '%{text}<extra></extra>' : undefined,
      hoveron: 'points'
    };
  });

  // 动态设置标题和轴标签
  const groupByLabels = {
    histology: 'Histology',
    tcga_desc: 'TCGA_DESC',
    site: 'Site'
  };

  return (
    <div className="mt-4">
      <Plot
        data={traces}
        layout={{
          title: `${gene || '基因'} 表达值分布（按 ${groupByLabels[groupBy]} 分类）`,
          xaxis: { 
            title: {
              text: groupByLabels[groupBy],
              font: { size: 14 }
            }
          },
          yaxis: { 
            zeroline: false, 
            title: {
              text: '表达值(FPKM)',
              font: { size: 14 }
            }
          },
          violingap: 0.4,
          violinmode: 'group',
          margin: { t: 60, l: 60, r: 20, b: 100 },
          height: 600,
          showlegend: true
        }}
        config={{ responsive: true }}
        style={{ width: '100%' }}
      />
    </div>
  );
};

export default ViolinPlot;






