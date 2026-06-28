// 新增：细胞系名称映射
import SearchBar from './components/SearchBar';
import Chart from './components/Chart';
import ViolinPlot from './components/ViolinPlot';
import CorrelationScatterPlot from './components/CorrelationScatterPlot'; // 替换GroupedViolinPlot
import DrugViolinPlot from './components/DrugViolinPlot';
import DrugDetailsTable from './components/DrugDetailsTable';
import SelectWithAll from './components/SelectWithAll';
import React, { useState, useEffect, useRef, useCallback } from 'react';

const METRICS = [
  { value: 'Z_SCORE', label: 'Z_SCORE (Z分数)' },
  { value: 'LN_IC50', label: 'LN_IC50 (自然对数IC50)' },
  { value: 'AUC', label: 'AUC (曲线下面积)' },
  { value: 'RMSE', label: 'RMSE (均方根误差)' }
];

// 指标解释说明
const METRIC_EXPLANATIONS = {
  'Z_SCORE': 'Z分数：衡量药物敏感性相对于平均水平的标准化得分。正值表示比平均水平更耐药，负值表示比平均水平更敏感。',
  'LN_IC50': 'LN_IC50：IC50值的自然对数。IC50是指抑制50%细胞生长所需的药物浓度，数值越小表示药物效果越好。',
  'AUC': 'AUC：剂量-反应曲线下面积。反映药物在不同浓度下的总体抑制效果，数值越大表示药物效果越强。',
  'RMSE': 'RMSE：均方根误差。用于衡量药物反应预测模型的准确性，数值越小表示预测越准确。'
};

const GROUPINGS = ['中位数', '上三分位', '下三分位', '上四分位', '下四分位'];

// 计算t检验的p值
function calculateTTest(group1, group2) {
  if (group1.length < 2 || group2.length < 2) return null;
  
  const mean1 = group1.reduce((a, b) => a + b, 0) / group1.length;
  const mean2 = group2.reduce((a, b) => a + b, 0) / group2.length;
  
  const variance1 = group1.reduce((a, b) => a + Math.pow(b - mean1, 2), 0) / (group1.length - 1);
  const variance2 = group2.reduce((a, b) => a + Math.pow(b - mean2, 2), 0) / (group2.length - 1);
  
  const pooledSE = Math.sqrt(variance1 / group1.length + variance2 / group2.length);
  const t = (mean1 - mean2) / pooledSE;
  const df = group1.length + group2.length - 2;
  
  // 简化的p值计算（双尾检验）
  const absT = Math.abs(t);
  let p;
  if (absT > 6) p = 0.000001;
  else if (absT > 4) p = 0.0001;
  else if (absT > 3) p = 0.001;
  else if (absT > 2.5) p = 0.01;
  else if (absT > 2) p = 0.05;
  else p = 0.1;
  
  return p;
}

// 计算标准差
function calculateSD(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function App() {
  const [selectedGene, setSelectedGene] = useState('TP53');
  const [exprData, setExprData] = useState([]);
  const [siteOptions, setSiteOptions] = useState([]);
  const [histOptions, setHistOptions] = useState([]);
  const [tcgaOptions, setTcgaOptions] = useState([]); // 新增：TCGA_DESC选项
  const [filterSite, setFilterSite] = useState(['all']);
  const [filterHistology, setFilterHistology] = useState(['all']);
  const [filterTcga, setFilterTcga] = useState(['all']); // 新增：TCGA_DESC筛选
  const [grouping, setGrouping] = useState('中位数');
  const [metric, setMetric] = useState('Z_SCORE');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortByGroup, setSortByGroup] = useState('low'); // 默认低表达排序
  const [correlationStats, setCorrelationStats] = useState(null);
  
  // 新增：选中的药物和对应的数据
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [drugViolinData, setDrugViolinData] = useState(null);
  
  // 新增：相关性分析需要的数据
  const [correlationData, setCorrelationData] = useState({
    expressionData: [],
    drugResponseData: []
  });
  
  // 新增：搜索历史相关状态
  const [searchHistory, setSearchHistory] = useState(['TP53']); // 初始包含默认基因
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef(null);
  
  // 新增：小提琴图分组方式
  const [violinGroupBy, setViolinGroupBy] = useState('histology');

  // 新增：细胞系名称映射
  const [cellLineMapping, setCellLineMapping] = useState({});

  const handleGeneSelect = (gene) => {
    setSelectedGene(gene);
    // 添加到搜索历史（避免重复）
    if (!searchHistory.includes(gene)) {
      setSearchHistory([...searchHistory, gene]);
    }
  };

  const handleCorrelationCalculated = useCallback((stats, metric) => {
    setCorrelationStats(stats);
  }, []);
  
  // 点击外部关闭历史记录下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (historyRef.current && !historyRef.current.contains(event.target)) {
        setShowHistory(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const resetFilters = () => {
    setFilterSite(['all']);
    setFilterHistology(['all']);
    setFilterTcga(['all']); // 新增：重置TCGA筛选
    setGrouping('中位数');
    setMetric('Z_SCORE');
    setSortByGroup('low'); // 重置为默认的低表达排序
    setSelectedDrug(null);
    setDrugViolinData(null);
    setViolinGroupBy('histology'); // 重置分组方式
    setCorrelationData({ expressionData: [], drugResponseData: [] });// 重置相关性数据
    setCellLineMapping({}); // 重置细胞系映射
    setCorrelationStats(null);
  };

  // 新的分组逻辑函数
  const getGrouping = (filteredData, values, groupingType) => {
    let highGroupIds = [], lowGroupIds = [];
    values.sort((a, b) => a - b);
    
    if (groupingType === '中位数') {
      const median = values[Math.floor(values.length / 2)];
      highGroupIds = filteredData.filter((item) => parseFloat(item.value) >= median).map((item) => item.COSMIC_ID);
      lowGroupIds = filteredData.filter((item) => parseFloat(item.value) < median).map((item) => item.COSMIC_ID);
    } else if (groupingType === '上三分位') {
      // 高表达组：上三分之二（>=33%分位点），低表达组：下三分之一（<33%分位点）
      const cut = values[Math.floor(values.length * 0.67)];
      highGroupIds = filteredData.filter((item) => parseFloat(item.value) >= cut).map((item) => item.COSMIC_ID);
      lowGroupIds = filteredData.filter((item) => parseFloat(item.value) < cut).map((item) => item.COSMIC_ID);
    } else if (groupingType === '下三分位') {
      // 高表达组：上三分之一（>=67%分位点），低表达组：下三分之二（<67%分位点）
      const cut = values[Math.floor(values.length * 0.33)];
      highGroupIds = filteredData.filter((item) => parseFloat(item.value) >= cut).map((item) => item.COSMIC_ID);
      lowGroupIds = filteredData.filter((item) => parseFloat(item.value) < cut).map((item) => item.COSMIC_ID);
    } else if (groupingType === '上四分位') {
      // 高表达组：上四分之三（>=25%分位点），低表达组：下四分之一（<25%分位点）
      const cut = values[Math.floor(values.length * 0.75)];
      highGroupIds = filteredData.filter((item) => parseFloat(item.value) >= cut).map((item) => item.COSMIC_ID);
      lowGroupIds = filteredData.filter((item) => parseFloat(item.value) < cut).map((item) => item.COSMIC_ID);
    } else if (groupingType === '下四分位') {
      // 高表达组：上四分之一（>=75%分位点），低表达组：下四分之三（<75%分位点）
      const cut = values[Math.floor(values.length * 0.25)];
      highGroupIds = filteredData.filter((item) => parseFloat(item.value) >= cut).map((item) => item.COSMIC_ID);
      lowGroupIds = filteredData.filter((item) => parseFloat(item.value) < cut).map((item) => item.COSMIC_ID);
    }
    
    return { highGroupIds, lowGroupIds };
  };

  // 处理药物点击事件 - 修改为获取相关性分析数据
  // 在App.js中替换原有的handleDrugClick函数

  const handleDrugClick = async (drugName) => {
    if (!chartData) return;
    
    console.log('Drug clicked:', drugName);
    setSelectedDrug(drugName);
    setCorrelationStats(null);
    setLoading(true);

    try {
      // 获取高低表达组的COSMIC_ID（用于小提琴图）
      let filteredData = exprData;
      if (!filterSite.includes('all')) {
        filteredData = filteredData.filter((item) => filterSite.includes(item.site));
      }
      if (!filterHistology.includes('all')) {
        filteredData = filteredData.filter((item) => filterHistology.includes(item.histology));
      }
      if (!filterTcga.includes('all')) {
        filteredData = filteredData.filter((item) => filterTcga.includes(item.tcga_desc));
      }

      const values = filteredData.map((item) => parseFloat(item.value)).filter((v) => !isNaN(v));
      const { highGroupIds, lowGroupIds } = getGrouping(filteredData, values, grouping);

      console.log('High group IDs count:', highGroupIds.length);
      console.log('Low group IDs count:', lowGroupIds.length);

      // 获取所有样本的完整数据（用于相关性分析）
      const allCosmicIds = filteredData.map(item => item.COSMIC_ID);
      console.log('All COSMIC IDs count:', allCosmicIds.length);

      // 并行请求数据
      const [highDrugData, lowDrugData, allDrugData] = await Promise.all([
        fetch('http://127.0.0.1:5000/drug_response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            cosmic_ids: highGroupIds, 
            metric // 当前选中的指标
          }),
        }).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        }),
        fetch('http://127.0.0.1:5000/drug_response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            cosmic_ids: lowGroupIds, 
            metric
          }),
        }).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        }),
        // 获取所有指标的数据用于相关性分析
        fetch('http://127.0.0.1:5000/drug_response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            cosmic_ids: allCosmicIds, 
            metric: 'Z_SCORE' // 可以是任意指标，组件内会根据需要选择
          }),
        }).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
      ]);

      console.log('High drug data count:', highDrugData.length);
      console.log('Low drug data count:', lowDrugData.length);
      console.log('All drug data count:', allDrugData.length);

      // 筛选出选中药物的数据（用于小提琴图）
      const highValues = highDrugData
        .filter(item => item.Drug_Name === drugName)
        .map(item => parseFloat(item[metric]))
        .filter(v => !isNaN(v));
      
      const lowValues = lowDrugData
        .filter(item => item.Drug_Name === drugName)
        .map(item => parseFloat(item[metric]))
        .filter(v => !isNaN(v));

      console.log('High values for violin plot:', highValues.length);
      console.log('Low values for violin plot:', lowValues.length);

      setDrugViolinData({
        high: highValues,
        low: lowValues,
        highLabels: filteredData
          .filter((item) => highGroupIds.includes(item.COSMIC_ID))
          .map((item) => cellLineMapping[item.COSMIC_ID] || `ID: ${item.COSMIC_ID}`),
        lowLabels: filteredData
          .filter((item) => lowGroupIds.includes(item.COSMIC_ID))
          .map((item) => cellLineMapping[item.COSMIC_ID] || `ID: ${item.COSMIC_ID}`)
      });

      // 验证相关性分析数据的有效性
      console.log('Expression data for correlation:', filteredData.length);
      console.log('Drug response data for correlation:', allDrugData.length);
      
      // 检查选中药物在all drug data中是否存在
      const drugSpecificDataForCorrelation = allDrugData.filter(item => item.Drug_Name === drugName);
      console.log('Drug specific data for correlation:', drugSpecificDataForCorrelation.length);

      // 设置相关性分析数据
      setCorrelationData({
        expressionData: filteredData.map(item => ({
          ...item,
          label: cellLineMapping[item.COSMIC_ID] || item.CELL_LINE || `ID: ${item.COSMIC_ID}`
        })),
        drugResponseData: allDrugData
      });

    } catch (error) {
      console.error('获取药物数据失败:', error);
      // 提供更详细的错误信息
      alert(`获取药物数据失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedGene) return;
    setCorrelationStats(null);
    setChartData(null);
    setSelectedDrug(null);
    setDrugViolinData(null);
    setCorrelationData({ expressionData: [], drugResponseData: [] }); // 重置相关性数据
    setLoading(true);
    
    // 同时获取表达数据和细胞系映射
    Promise.all([
      fetch(`http://127.0.0.1:5000/expression/${encodeURIComponent(selectedGene)}`).then(res => res.json()),
      fetch('http://127.0.0.1:5000/cell_line_map').then(res => res.json())
    ])
      .then(([expressionData, cellMapping]) => {
        setExprData(expressionData || []);
        setCellLineMapping(cellMapping || {});
        
        // 获取所有COSMIC_ID，用于获取TCGA_DESC信息
        const cosmicIds = expressionData.map(item => item.COSMIC_ID);
        
        // 获取TCGA_DESC信息
        return fetch('http://127.0.0.1:5000/drug_response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            cosmic_ids: cosmicIds, 
            metric: 'Z_SCORE' // 可以用任意指标，我们只需要TCGA_DESC
          }),
        }).then(res => res.json()).then(drugData => {
          // 创建COSMIC_ID到TCGA_DESC的映射
          const tcgaMapping = {};
          drugData.forEach(item => {
            if (item.COSMIC_ID && item.TCGA_DESC) {
              tcgaMapping[item.COSMIC_ID] = item.TCGA_DESC;
            }
          });
          
          // 将TCGA_DESC信息合并到表达数据中
          const enrichedData = expressionData.map(item => ({
            ...item,
            tcga_desc: tcgaMapping[item.COSMIC_ID] || 'Unknown'
          }));
          
          return enrichedData;
        });
      })
      .then((enrichedData) => {
        setExprData(enrichedData);
        setLoading(false);
        
        const sites = Array.from(new Set(enrichedData.map((item) => item.site))).filter((x) => x !== 'NS');
        const histologies = Array.from(new Set(enrichedData.map((item) => item.histology))).filter((x) => x !== 'NS' && x !== 'other');
        // 获取TCGA_DESC选项
        const tcgaDescs = Array.from(new Set(enrichedData.map((item) => item.tcga_desc))).filter((x) => x && x !== 'NS' && x !== 'other' && x !== 'Unknown');
        
        setSiteOptions(sites.map((s) => ({ value: s, label: s })));
        setHistOptions(histologies.map((h) => ({ value: h, label: h })));
        setTcgaOptions(tcgaDescs.map((t) => ({ value: t, label: t })));
        setFilterSite(['all']);
        setFilterHistology(['all']);
        setFilterTcga(['all']);
        setSortByGroup('low'); // 每次选择新基因时重置为低表达排序
        setViolinGroupBy('histology'); // 重置分组方式
      })
      .catch((err) => {
        console.error('Error fetching data:', err);
        setCellLineMapping({}); // 错误时重置cellLineMapping
        setLoading(false);
      });
  }, [selectedGene]);

  useEffect(() => {
    if (exprData.length === 0) return;
    let filteredData = exprData;
    if (!filterSite.includes('all')) {
      filteredData = filteredData.filter((item) => filterSite.includes(item.site));
    }
    if (!filterHistology.includes('all')) {
      filteredData = filteredData.filter((item) => filterHistology.includes(item.histology));
    }
    // 新增：TCGA_DESC筛选
    if (!filterTcga.includes('all')) {
      filteredData = filteredData.filter((item) => filterTcga.includes(item.tcga_desc));
    }
    
    const values = filteredData.map((item) => parseFloat(item.value)).filter((v) => !isNaN(v));
    
    const { highGroupIds, lowGroupIds } = getGrouping(filteredData, values, grouping);
    
    const requestBodyHigh = { cosmic_ids: highGroupIds, metric };
    const requestBodyLow = { cosmic_ids: lowGroupIds, metric };
    setLoading(true);
    Promise.all([
      fetch('http://127.0.0.1:5000/drug_response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBodyHigh),
      }).then((res) => res.json()),
      fetch('http://127.0.0.1:5000/drug_response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBodyLow),
      }).then((res) => res.json()),
    ]).then(([highData, lowData]) => {
      const highMap = {}, lowMap = {};
      highData.forEach((r) => {
        const v = parseFloat(r[metric]);
        if (!isNaN(v)) {
          if (!highMap[r.Drug_Name]) highMap[r.Drug_Name] = [];
          highMap[r.Drug_Name].push(v);
        }
      });
      lowData.forEach((r) => {
        const v = parseFloat(r[metric]);
        if (!isNaN(v)) {
          if (!lowMap[r.Drug_Name]) lowMap[r.Drug_Name] = [];
          lowMap[r.Drug_Name].push(v);
        }
      });
      const commonDrugs = Object.keys(highMap).filter((d) => lowMap[d]);
      let data = commonDrugs.map((drug) => {
        const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
        return {
          drug,
          high: parseFloat(avg(highMap[drug]).toFixed(4)),
          low: parseFloat(avg(lowMap[drug]).toFixed(4)),
        };
      });
      if (sortByGroup === 'high') data.sort((a, b) => a.high - b.high);
      else if (sortByGroup === 'low') data.sort((a, b) => a.low - b.low);

      const violinByHist = {};
      const violinDetailsByHist = {};
      filteredData.forEach(item => {
        const hist = item.histology;
        if (!violinByHist[hist]) {
          violinByHist[hist] = [];
          violinDetailsByHist[hist] = [];
        }
        violinByHist[hist].push(parseFloat(item.value));
        // 使用cellLineMapping获取真正的细胞系名称
        const cellLineName = cellLineMapping[item.COSMIC_ID] || `ID: ${item.COSMIC_ID}`;
        violinDetailsByHist[hist].push({
          cellLine: cellLineName,
          value: parseFloat(item.value)
        });
      });
      
      // 新增：按不同方式分组的数据
      const violinBySite = {};
      const violinDetailsBySite = {};
      filteredData.forEach(item => {
        const site = item.site;
        if (!violinBySite[site]) {
          violinBySite[site] = [];
          violinDetailsBySite[site] = [];
        }
        violinBySite[site].push(parseFloat(item.value));
        const cellLineName = cellLineMapping[item.COSMIC_ID] || `ID: ${item.COSMIC_ID}`;
        violinDetailsBySite[site].push({
          cellLine: cellLineName,
          value: parseFloat(item.value)
        });
      });
      
      const violinByTcga = {};
      const violinDetailsByTcga = {};
      filteredData.forEach(item => {
        const tcga = item.tcga_desc;
        if (!violinByTcga[tcga]) {
          violinByTcga[tcga] = [];
          violinDetailsByTcga[tcga] = [];
        }
        violinByTcga[tcga].push(parseFloat(item.value));
        const cellLineName = cellLineMapping[item.COSMIC_ID] || `ID: ${item.COSMIC_ID}`;
        violinDetailsByTcga[tcga].push({
          cellLine: cellLineName,
          value: parseFloat(item.value)
        });
      });

      // 计算表达值的统计信息
      const highExpressionValues = filteredData.filter(item => highGroupIds.includes(item.COSMIC_ID)).map(item => parseFloat(item.value));
      const lowExpressionValues = filteredData.filter(item => lowGroupIds.includes(item.COSMIC_ID)).map(item => parseFloat(item.value));
      
      const expressionPValue = calculateTTest(highExpressionValues, lowExpressionValues);
      const highExpressionSD = calculateSD(highExpressionValues);
      const lowExpressionSD = calculateSD(lowExpressionValues);
      const highExpressionMean = highExpressionValues.reduce((a, b) => a + b, 0) / highExpressionValues.length;
      const lowExpressionMean = lowExpressionValues.reduce((a, b) => a + b, 0) / lowExpressionValues.length;

      const grouped = {
        high: highExpressionValues,
        low: lowExpressionValues
      };

      setChartData({
        drugNames: data.map((d) => d.drug),
        highValues: data.map((d) => d.high),
        lowValues: data.map((d) => d.low),
        total: filteredData.length,
        highCount: highGroupIds.length,
        lowCount: lowGroupIds.length,
        violinData: violinByHist,
        violinDataBySite: violinBySite,
        violinDataByTcga: violinByTcga,
        violinDetailsByHist: violinDetailsByHist,
        violinDetailsBySite: violinDetailsBySite,
        violinDetailsByTcga: violinDetailsByTcga,
        groupedViolin: grouped,
        // 保存原始数据供药物点击使用
        rawHighData: highData,
        rawLowData: lowData,
        highGroupIds,
        lowGroupIds,
        // 新增：表达值统计信息
        expressionStats: {
          pValue: expressionPValue,
          highSD: highExpressionSD,
          lowSD: lowExpressionSD,
          highMean: highExpressionMean,
          lowMean: lowExpressionMean
        }
      });
      setLoading(false);
    });
    
    // 重置选中的药物
    setSelectedDrug(null);
    setDrugViolinData(null);
    setCorrelationData({ expressionData: [], drugResponseData: [] }); // 重置相关性数据
  }, [exprData, filterSite, filterHistology, filterTcga, grouping, metric, sortByGroup]); // 新增：filterTcga依赖

  // 生成PDF下载信息
  const getPdfInfo = () => {
    const siteFilter = filterSite.includes('all') ? '全部' : filterSite.join(', ');
    const histologyFilter = filterHistology.includes('all') ? '全部' : filterHistology.join(', ');
    const tcgaFilter = filterTcga.includes('all') ? '全部' : filterTcga.join(', '); // 新增：TCGA筛选信息
    
    return {
      gene: selectedGene,
      metric: metric,
      grouping: grouping,
      siteFilter: siteFilter,
      histologyFilter: histologyFilter,
      tcgaFilter: tcgaFilter, // 新增
      totalSamples: chartData?.total || 0,
      highCount: chartData?.highCount || 0,
      lowCount: chartData?.lowCount || 0,
      sortOrder: sortByGroup || '无',
      timestamp: new Date().toLocaleString('zh-CN')
    };
  };

return (
    <div className="max-w-full px-6 py-4">
      {/* 标题和搜索栏 */}
      <div className="flex items-center justify-between mb-4">
        {/* 左侧：标题和搜索图标 */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Gene-drug Response (version 1.0)</h1>
        </div>
        
        {/* 中间：搜索框和搜索历史居中区域 */}
        <div className="flex items-center gap-4">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <div className="w-[400px]">
            <SearchBar onSelectGene={handleGeneSelect} defaultValue={selectedGene} placeholder="输入基因名称..." />
          </div>
          
          {/* 搜索历史按钮 */}
          <div className="relative" ref={historyRef}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              title="搜索历史"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">搜索历史</span>
            </button>
            
            {/* 历史记录下拉菜单 */}
            {showHistory && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-200">
                <div className="py-1">
                  <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-200">
                    本次搜索历史
                  </div>
                  {searchHistory.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-400">暂无搜索记录</div>
                  ) : (
                    searchHistory.map((gene, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          handleGeneSelect(gene);
                          setShowHistory(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                          gene === selectedGene ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                        }`}
                      >
                        {gene}
                      </button>
                    ))
                  )}
                  {searchHistory.length > 0 && (
                    <button
                      onClick={() => {
                        setSearchHistory([]);
                        setShowHistory(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 border-t border-gray-200 transition-colors"
                    >
                      清空历史
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* 右侧：占位空间，保持布局平衡 */}
        <div className="w-[200px]"></div>
      </div>
      
      {selectedGene && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {/* 筛选选项 - 统一宽度 */}
            <div className="w-48">
              <label className="block mb-1 text-sm text-gray-700">Site (部位):</label>
              <SelectWithAll 
                options={siteOptions} 
                value={filterSite} 
                onChange={setFilterSite} 
                placeholder="选择 Site" 
                isMulti 
                className="w-full"
              />
            </div>
            <div className="w-48">
              <label className="block mb-1 text-sm text-gray-700">Histology (组织学类型):</label>
              <SelectWithAll 
                options={histOptions} 
                value={filterHistology} 
                onChange={setFilterHistology} 
                placeholder="选择 Histology" 
                isMulti 
                className="w-full"
              />
            </div>
            {/* 新增：TCGA_DESC筛选 */}
            <div className="w-48">
              <label className="block mb-1 text-sm text-gray-700">TCGA_DESC (TCGA描述):</label>
              <SelectWithAll 
                options={tcgaOptions} 
                value={filterTcga} 
                onChange={setFilterTcga} 
                placeholder="选择 TCGA_DESC" 
                isMulti 
                className="w-full"
              />
            </div>
            <div className="w-48">
              <label className="block mb-1 text-sm text-gray-700">指标:</label>
              <select 
                value={metric} 
                onChange={(e) => setMetric(e.target.value)} 
                className="w-full border border-gray-300 rounded px-2 py-1"
              >
                {METRICS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
              </select>
            </div>
            <div className="w-48">
              <label className="block mb-1 text-sm text-gray-700">分组:</label>
              <select 
                value={grouping} 
                onChange={(e) => setGrouping(e.target.value)} 
                className="w-full border border-gray-300 rounded px-2 py-1"
              >
                {GROUPINGS.map((g) => (<option key={g} value={g}>{g}</option>))}
              </select>
            </div>
            
            {/* 按钮组 */}
            <div className="flex gap-2 mt-6">
              <button 
                onClick={() => setSortByGroup('high')} 
                className={`px-3 py-1 rounded transition-colors ${
                  sortByGroup === 'high' 
                    ? 'bg-orange-400 text-white hover:bg-orange-500' 
                    : 'bg-orange-200 hover:bg-orange-300'
                }`}
              >
                高表达组排序
              </button>
              <button 
                onClick={() => setSortByGroup('low')} 
                className={`px-3 py-1 rounded transition-colors ${
                  sortByGroup === 'low' 
                    ? 'bg-blue-400 text-white hover:bg-blue-500' 
                    : 'bg-blue-200 hover:bg-blue-300'
                }`}
              >
                低表达组排序
              </button>
              <button 
                onClick={() => setSortByGroup(null)} 
                className={`px-3 py-1 rounded transition-colors ${
                  sortByGroup === null 
                    ? 'bg-gray-400 text-white hover:bg-gray-500' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                不排序
              </button>
              <button 
                onClick={resetFilters} 
                className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
              >
                重置
              </button>
            </div>
          </div>
          
          {/* 指标解释 */}
          <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
            <p className="text-sm text-blue-800">
              <strong>当前指标说明：</strong> {METRIC_EXPLANATIONS[metric]}
            </p>
          </div>
        </>
      )}

      <div className="mt-6">
        {/* 主要内容区域 */}
        <div className="space-y-6">
          {/* 上方：散点图和Histology分组图 1:2 布局 */}
          <div className="grid grid-cols-3 gap-6">
            {/* 左侧：散点图 (1/3) */}
            <div className="col-span-1">
              {!selectedGene && <p className="text-gray-600">请选择一个基因以查看对应的药物响应图表。</p>}
              {selectedGene && loading && <p className="text-gray-600">数据加载中，请稍候...</p>}
              {selectedGene && !loading && chartData && chartData.drugNames.length === 0 && (
                <p className="text-gray-600">当前筛选条件下没有足够的数据绘制图表。</p>
              )}
              {selectedGene && chartData && chartData.drugNames.length > 0 && (
                <>
                  <Chart 
                    drugNames={chartData.drugNames} 
                    highValues={chartData.highValues} 
                    lowValues={chartData.lowValues} 
                    metric={metric} 
                    loading={loading}
                    sortOrder={sortByGroup}
                    setSortOrder={setSortByGroup}
                    onDrugClick={handleDrugClick}
                    pdfInfo={getPdfInfo()}
                    geneName={selectedGene}
                  />
                  <div className="mt-4 text-sm text-gray-700">
                    当前基因: <strong>{selectedGene}</strong>； 样本总数: <strong>{chartData.total}</strong>； 高表达组: <strong>{chartData.highCount}</strong> 个样本； 低表达组: <strong>{chartData.lowCount}</strong> 个样本； 指标: <strong>{metric}</strong>； 分组方式: <strong>{grouping}</strong>。
                    {selectedDrug && <span className="ml-2 text-blue-600">当前选中药物: <strong>{selectedDrug}</strong></span>}
                  </div>
                </>
              )}
            </div>

            {/* 右侧：按Histology分组的表达值分布 (2/3) */}
            <div className="col-span-2">
              {selectedGene && chartData && (
                <div>
                  {/* 分组方式选择按钮 */}
                  <div className="flex gap-2 mb-3">
                    <span className="text-sm text-gray-700 mr-2">按以下方式分组：</span>
                    <button
                      onClick={() => setViolinGroupBy('histology')}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        violinGroupBy === 'histology'
                          ? 'bg-blue-500 text-white hover:bg-blue-600'
                          : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                    >
                      Histology
                    </button>
                    <button
                      onClick={() => setViolinGroupBy('site')}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        violinGroupBy === 'site'
                          ? 'bg-blue-500 text-white hover:bg-blue-600'
                          : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                    >
                      Site
                    </button>
                    <button
                      onClick={() => setViolinGroupBy('tcga_desc')}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        violinGroupBy === 'tcga_desc'
                          ? 'bg-blue-500 text-white hover:bg-blue-600'
                          : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                    >
                      TCGA_DESC
                    </button>
                  </div>
                  
                  <ViolinPlot 
                    data={
                      violinGroupBy === 'histology' ? chartData.violinData :
                      violinGroupBy === 'site' ? chartData.violinDataBySite :
                      chartData.violinDataByTcga
                    }
                    detailedData={
                      violinGroupBy === 'histology' ? chartData.violinDetailsByHist :
                      violinGroupBy === 'site' ? chartData.violinDetailsBySite :
                      chartData.violinDetailsByTcga
                    }
                    selectedItems={
                      violinGroupBy === 'histology' ? (filterHistology.includes('all') ? [] : filterHistology) :
                      violinGroupBy === 'site' ? (filterSite.includes('all') ? [] : filterSite) :
                      (filterTcga.includes('all') ? [] : filterTcga)
                    }
                    groupBy={violinGroupBy}
                    gene={selectedGene}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 下方：三个组件 1:1:1 布局 */}
          <div className="grid grid-cols-3 gap-6">
            {/* 左侧：表达值与药物响应值相关性散点图 - 替换原来的GroupedViolinPlot */}
            <div>
              <CorrelationScatterPlot 
                selectedDrug={selectedDrug}
                expressionData={correlationData.expressionData}
                drugResponseData={correlationData.drugResponseData}
                gene={selectedGene}
                currentMetric={metric}
                cellLineMapping={cellLineMapping}
                onCorrelationCalculated={handleCorrelationCalculated}
              />
            </div>
            
            {/* 中间：药物在高低表达组中的分布 */}
            <div>
              {selectedGene && chartData && (
                <DrugViolinPlot 
                  data={drugViolinData}
                  drugName={selectedDrug}
                  metric={metric}
                  gene={selectedGene}
                  grouping={grouping}
                  pdfInfo={getPdfInfo()}
                />
              )}
            </div>
            
            {/* 右侧：药物详情表格 */}
            <div>
              <DrugDetailsTable 
                drugName={selectedDrug} 
                expressionStats={chartData?.expressionStats}
                correlationStats={correlationStats}
                currentMetric={metric}
                violinData={drugViolinData}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;








