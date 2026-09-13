import { jStat } from 'jstat';


export function finiteNumbers(values) {
  return (values || []).map(Number).filter(Number.isFinite);
}

export function sampleVariance(values) {
  const numbers = finiteNumbers(values);
  if (numbers.length < 2) return null;
  const mean = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  return numbers.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (numbers.length - 1);
}

export function sampleStandardDeviation(values) {
  const variance = sampleVariance(values);
  return variance === null ? null : Math.sqrt(variance);
}

export function welchTTest(first, second) {
  const group1 = finiteNumbers(first);
  const group2 = finiteNumbers(second);
  if (group1.length < 2 || group2.length < 2) return null;

  const variance1 = sampleVariance(group1);
  const variance2 = sampleVariance(group2);
  const term1 = variance1 / group1.length;
  const term2 = variance2 / group2.length;
  const standardErrorSquared = term1 + term2;
  if (!Number.isFinite(standardErrorSquared) || standardErrorSquared <= 0) return null;

  const mean1 = jStat.mean(group1);
  const mean2 = jStat.mean(group2);
  const t = Math.abs(mean1 - mean2) / Math.sqrt(standardErrorSquared);
  const denominator = (term1 ** 2) / (group1.length - 1) + (term2 ** 2) / (group2.length - 1);
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  const degreesOfFreedom = (standardErrorSquared ** 2) / denominator;
  const p = 2 * (1 - jStat.studentt.cdf(t, degreesOfFreedom));
  return Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : null;
}

export function pearsonCorrelation(xValues, yValues) {
  const pairs = (xValues || []).map((x, index) => [Number(x), Number(yValues?.[index])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 3) return null;
  const x = pairs.map((pair) => pair[0]);
  const y = pairs.map((pair) => pair[1]);
  const meanX = jStat.mean(x);
  const meanY = jStat.mean(y);
  const numerator = x.reduce((sum, value, index) => sum + ((value - meanX) * (y[index] - meanY)), 0);
  const sumSquaresX = x.reduce((sum, value) => sum + ((value - meanX) ** 2), 0);
  const sumSquaresY = y.reduce((sum, value) => sum + ((value - meanY) ** 2), 0);
  const denominator = Math.sqrt(sumSquaresX * sumSquaresY);
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  const r = Math.max(-1, Math.min(1, numerator / denominator));
  const p = Math.abs(r) === 1
    ? 0
    : 2 * (1 - jStat.studentt.cdf(Math.abs(r) * Math.sqrt((pairs.length - 2) / (1 - (r ** 2))), pairs.length - 2));
  if (!Number.isFinite(p)) return null;
  return { r, p: Math.max(0, Math.min(1, p)), n: pairs.length };
}

export function buildDrugViolinData(responses, expressionRows, highIds, lowIds, metric) {
  const highSet = new Set(highIds.map(String));
  const lowSet = new Set(lowIds.map(String));
  const expressionById = new Map(expressionRows.map((row) => [String(row.COSMIC_ID), row]));
  const result = { high: [], low: [], highLabels: [], lowLabels: [] };

  for (const response of responses || []) {
    const id = String(response.COSMIC_ID);
    const value = Number(response[metric]);
    if (!Number.isFinite(value)) continue;
    const row = expressionById.get(id);
    const label = row?.CELL_LINE || `ID: ${response.COSMIC_ID}`;
    if (highSet.has(id)) {
      result.high.push(value);
      result.highLabels.push(label);
    } else if (lowSet.has(id)) {
      result.low.push(value);
      result.lowLabels.push(label);
    }
  }
  return result;
}

export function normalizeViolinGroups(data, details = {}, groupBy = 'histology') {
  const normalizedData = {};
  const normalizedDetails = {};
  const otherLabel = groupBy === 'tcga_desc' ? 'UNCLASSIFIED' : '其他';

  for (const [category, values] of Object.entries(data || {})) {
    const normalizedCategory = String(category || '').toLowerCase();
    const mergeIntoOther = values.length <= 2
      || normalizedCategory === 'ns'
      || normalizedCategory === 'other'
      || normalizedCategory === 'unknown';
    const target = mergeIntoOther ? otherLabel : category;
    if (!normalizedData[target]) {
      normalizedData[target] = [];
      normalizedDetails[target] = [];
    }
    normalizedData[target].push(...values);
    normalizedDetails[target].push(...(details[category] || []));
  }
  return { data: normalizedData, details: normalizedDetails };
}
